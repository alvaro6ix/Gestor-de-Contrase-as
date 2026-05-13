import React, { useState, useEffect } from 'react';
import { X, Clock, Copy, Shield, ChevronDown, ChevronUp, Share2, Mail, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const PasswordHistory = ({ passwordId, currentPassword, title, onClose }) => {
  const [history, setHistory] = useState([]);
  const [shareLogs, setShareLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('passwords'); // 'passwords' | 'shares'
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: hist }, { data: logs }] = await Promise.all([
        supabase.from('password_history').select('*').eq('password_id', passwordId).order('changed_at', { ascending: false }),
        supabase.from('share_logs').select('*').eq('password_id', passwordId).order('shared_at', { ascending: false })
      ]);
      setHistory(hist || []);
      setShareLogs(logs || []);
      setLoading(false);
    };
    fetchAll();
  }, [passwordId]);

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  };

  const fmt = (date) => new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <Clock size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>Historial</h2>
          <p className="text-small">{title}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="auth-tabs" style={{ marginBottom: '1rem' }}>
        <div className={`auth-tab${activeTab === 'passwords' ? ' active' : ''}`} onClick={() => setActiveTab('passwords')}>
          🔑 Contraseñas
        </div>
        <div className={`auth-tab${activeTab === 'shares' ? ' active' : ''}`} onClick={() => setActiveTab('shares')}>
          📤 Compartidos
        </div>
      </div>

      {loading ? (
        <div className="spinner"></div>
      ) : activeTab === 'passwords' ? (
        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Current password always at top */}
          <div style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(255,211,0,0.08)', border: '1px solid rgba(255,211,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--primary)' }}>Contraseña Actual</span>
              <button className="btn-icon" onClick={() => copy(currentPassword, 'current')}>
                {copied === 'current' ? <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓</span> : <Copy size={14} />}
              </button>
            </div>
            <code className="font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{currentPassword}</code>
          </div>

          {history.length === 0 ? (
            <p className="text-small" style={{ textAlign: 'center', padding: '1.5rem 0' }}>Sin cambios previos registrados.</p>
          ) : history.map((entry, i) => (
            <div key={entry.id} style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', opacity: 0.4 }}>Anterior · {fmt(entry.changed_at)}</span>
                </div>
                <button className="btn-icon" onClick={() => copy(entry.old_password, `hist-${i}`)}>
                  {copied === `hist-${i}` ? <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓</span> : <Copy size={14} />}
                </button>
              </div>
              <code className="font-mono" style={{ fontSize: '0.85rem', wordBreak: 'break-all', opacity: 0.6 }}>{entry.old_password}</code>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxHeight: '55vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {shareLogs.length === 0 ? (
            <p className="text-small" style={{ textAlign: 'center', padding: '1.5rem 0' }}>No has compartido este acceso aún.</p>
          ) : shareLogs.map((log) => (
            <div key={log.id} style={{ padding: '0.85rem', borderRadius: '10px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: log.method === 'whatsapp' ? 'rgba(37,211,102,0.1)' : 'rgba(255,211,0,0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                {log.method === 'whatsapp' ? <ExternalLink size={16} style={{ color: '#25D366' }} /> : <Mail size={16} style={{ color: 'var(--primary)' }} />}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }} className="truncate">{log.shared_with}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{fmt(log.shared_at)} · via {log.method === 'whatsapp' ? 'WhatsApp' : 'Correo interno'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }}>Cerrar</button>
    </>
  );
};

export default PasswordHistory;
