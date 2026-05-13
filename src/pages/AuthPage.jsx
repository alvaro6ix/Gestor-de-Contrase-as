import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, Lock, Sun, Moon, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const translateError = (msg) => {
    if (!msg) return 'Error desconocido.';
    if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de ingresar.';
    if (msg.includes('User already registered')) return 'Este correo ya está registrado.';
    if (msg.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.';
    if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
    return msg;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Redirección automática vía App.jsx PublicRoute
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setSuccessMsg('¡Cuenta creada! Revisa tu correo para confirmarla o inicia sesión directamente.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Escribe tu correo arriba primero.');
      return;
    }
    setLoading(true);
    setError('');
    const redirectTo = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) setError(translateError(error.message));
    else setSuccessMsg('Enlace de recuperación enviado. Revisa tu bandeja de entrada.');
  };

  return (
    <div className="auth-layout">
      <button onClick={toggleTheme} className="btn-icon theme-toggle-fixed glass-card" aria-label="Cambiar tema">
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="auth-box glass-card">
        {/* Logo */}
        <div className="auth-header">
          <div className="auth-logo">
            <ShieldCheck size={32} color="#000" />
          </div>
          <h1 style={{ fontSize: '1.1rem' }}>Gestor de Contraseñas</h1>
          <p className="text-small">Tu bóveda de seguridad personal</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <div className={`auth-tab${isLogin ? ' active' : ''}`} onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}>
            Ingresar
          </div>
          <div className={`auth-tab${!isLogin ? ' active' : ''}`} onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}>
            Registrarse
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="input-group">
            <label className="input-label">Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                placeholder="nombre@ejemplo.com"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label className="input-label" style={{ marginBottom: 0 }}>Contraseña</label>
              {isLogin && (
                <button type="button" onClick={handleForgotPassword} style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••••"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="input-action" aria-label="Ver contraseña">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Mensajes */}
          {error && <div className="auth-error">⚠️ {error}</div>}
          {successMsg && <div className="auth-error" style={{ background: 'rgba(0,230,118,0.1)', color: 'var(--success)', borderColor: 'rgba(0,230,118,0.2)' }}>✓ {successMsg}</div>}

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit">
            {loading ? 'Procesando...' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
