import React, { useState } from 'react';
import { X, Send, Mail, ShieldCheck, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { buildShareMessage } from '../lib/shareMessage';

const ShareModal = ({ item, onClose, userId }) => {
  const { user, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleShare = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Save to shares table
      const { error: shareError } = await supabase.from('shares').insert([{
        password_id: item.id,
        shared_with_email: email,
        shared_by_user_id: userId
      }]);
      if (shareError) throw shareError;

      // 2. Log the share action
      await supabase.from('share_logs').insert({
        password_id: item.id,
        method: 'email_internal',
        shared_with: email,
        user_id: userId
      });

      // 3. Open mail client with the professional message
      const sender = profile?.display_name || user?.email || 'el equipo';
      const senderRole = profile?.role || '';
      const subject = `Acceso compartido: ${item.title}`;
      const body = buildShareMessage(item, { sender, senderRole, channel: 'email' });

      window.open(
        `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      );

      setSuccess(true);
      setTimeout(onClose, 3000);
    } catch (err) {
      alert(err.message?.includes('duplicate key')
        ? 'Ya has compartido este acceso con ese correo.'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      {success ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ width: '70px', height: '70px', background: 'rgba(0,230,118,0.1)', border: '2px solid var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: 'var(--success)' }}>
            <ShieldCheck size={36} />
          </div>
          <h2 style={{ fontSize: '1.1rem' }}>¡Acceso Compartido!</h2>
          <p className="text-small" style={{ marginTop: '0.5rem' }}>Se abrió tu cliente de correo para notificar a <strong>{email}</strong>.<br />También puede ver el acceso en la sección "Compartidas" de la app.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
              <Share2 size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem' }}>Compartir Acceso</h2>
              <p className="text-small">"{item.title}"</p>
            </div>
          </div>

          <form onSubmit={handleShare}>
            <div className="input-group">
              <label className="input-label">Correo del Destinatario</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={18} />
                <input type="email" required placeholder="persona@ejemplo.com" className="input-field"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,211,0,0.08)', border: '1px solid rgba(255,211,0,0.2)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                <strong>¿Cómo funciona?</strong><br />
                Al confirmar: (1) se abre tu cliente de correo con un mensaje profesional pre-escrito (incluyendo descripción y URL si están definidas), y (2) el destinatario podrá ver la clave en la sección <strong>"Compartidas"</strong> si tiene cuenta en la app.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                {loading ? 'Procesando...' : <><Send size={16} /> Compartir</>}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
};

export default ShareModal;
