import React, { useState, useEffect } from 'react';
import { X, Save, UserCog } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#ffd300', '#00bcd4', '#7c4dff', '#ff5722', '#4caf50', '#e91e63', '#3f51b5', '#ff9800'];

const ROLE_SUGGESTIONS = [
  'Administrador TI',
  'Soporte Técnico',
  'Desarrollador',
  'DevOps',
  'Seguridad',
  'Analista',
  'Gerente',
];

const ProfileModal = ({ onClose }) => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    display_name: '', role: '', role_color: '#ffd300'
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        role: profile.role || '',
        role_color: profile.role_color || '#ffd300',
      });
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, user_id: user.id };
      if (profile) {
        const { error } = await supabase.from('profiles').update(payload).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('profiles').insert([payload]);
        if (error) throw error;
      }
      await refreshProfile();
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: form.role_color, padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <UserCog size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>Mi Perfil</h2>
          <p className="text-small">Cómo te identificas en el gestor.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Nombre a mostrar</label>
          <input type="text" className="input-field" style={{ paddingLeft: '1rem' }}
            placeholder="ej: Alvaro Aldama"
            value={form.display_name} onChange={(e) => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>

        <div className="input-group">
          <label className="input-label">Mi Rol</label>
          <input type="text" className="input-field" style={{ paddingLeft: '1rem' }}
            placeholder="ej: Administrador TI"
            value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))} />
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
            {ROLE_SUGGESTIONS.map(r => (
              <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                style={{
                  padding: '0.2rem 0.55rem', borderRadius: '999px',
                  background: form.role === r ? form.role_color : 'rgba(0,0,0,0.05)',
                  color: form.role === r ? '#000' : 'inherit',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.7rem', fontWeight: 700
                }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Color del badge</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, role_color: c }))}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: form.role_color === c ? '3px solid #000' : '2px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }} />
            ))}
          </div>
        </div>

        {form.role && (
          <div style={{ marginBottom: '1rem' }}>
            <div className="input-label" style={{ marginBottom: '0.4rem' }}>Vista previa</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.3rem 0.7rem', borderRadius: '999px',
              background: form.role_color, color: '#000', fontWeight: 800, fontSize: '0.75rem' }}>
              {form.role}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
            {loading ? 'Guardando...' : <><Save size={16} /> Guardar</>}
          </button>
        </div>
      </form>
    </>
  );
};

export default ProfileModal;
