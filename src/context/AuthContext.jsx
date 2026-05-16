import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

// REGLA DE ORO (documentada por Supabase):
// NUNCA llamar funciones async de Supabase dentro del callback de
// onAuthStateChange. El callback retiene navigator.locks y cualquier query
// adentro intentará tomar el mismo lock al refrescar token → DEADLOCK.
// Síntomas: setLoading(false) no se ejecuta nunca → pantalla blanca/negra.
// Aquí el callback SOLO hace setUser sincrónico. La carga del profile vive
// en un useEffect separado que reacciona al cambio de user.

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const profileFetchedFor = useRef(null);

  // Suscripción al auth — el callback es 100% sincrónico.
  useEffect(() => {
    let safetyTimer;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        profileFetchedFor.current = null;
      }
    });

    // Safety net: si por cualquier motivo el primer evento INITIAL_SESSION
    // tardara más de 4s (red muerta, lock atascado, etc.), liberamos la UI
    // mostrando la pantalla de login en lugar de quedar en blanco para siempre.
    safetyTimer = setTimeout(() => setLoading(false), 4000);

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Carga del profile — fuera del callback de auth, sin riesgo de deadlock.
  // Se dispara cuando cambia el user. Si la query falla o se cuelga, no rompe
  // el render: el resto de la app funciona aunque profile sea null.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      profileFetchedFor.current = null;
      return;
    }
    if (profileFetchedFor.current === user.id) return;
    profileFetchedFor.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setProfile(data || null);
      } catch (err) {
        console.warn('No se pudo cargar el perfil:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setProfile(data || null);
    } catch (err) {
      console.warn('refreshProfile:', err);
    }
  }, [user]);

  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signOut = async () => {
    // Limpieza optimista para que la UI cambie YA y nunca dependa de que
    // signOut termine (la red puede estar lenta).
    setUser(null);
    setProfile(null);
    profileFetchedFor.current = null;
    try { await supabase.auth.signOut(); } catch (err) { console.warn('signOut:', err); }
  };
  const updatePassword = (newPassword) => supabase.auth.updateUser({ password: newPassword });

  return (
    <AuthContext.Provider value={{ user, profile, loading, recoveryMode, setRecoveryMode, signUp, signIn, signOut, updatePassword, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
