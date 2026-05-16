import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { subscribe, retry, retryAll, discard, process as processQueue } from '../lib/syncQueue';

// Etiquetas legibles por tabla
const TABLE_LABELS = {
  passwords: 'Acceso',
  groups: 'Grupo',
  categories: 'Categoría',
  password_categories: 'Vínculo de categoría',
  password_history: 'Historial',
  profiles: 'Perfil',
  shares: 'Compartido',
  share_logs: 'Log',
};

const opSummary = (op) => {
  const t = TABLE_LABELS[op.table] || op.table;
  const verb = op.type === 'insert' ? 'crear' : op.type === 'update' ? 'actualizar' : 'eliminar';
  return `${verb} ${t}`;
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
};

const PendingSyncBanner = () => {
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribe(setQueue), []);

  if (!queue || queue.length === 0) return null;

  const failed = queue.filter(o => o.status === 'failed');
  const pending = queue.filter(o => o.status === 'pending');
  const isFailed = failed.length > 0;

  const bgColor = isFailed ? '#ffe5e5' : '#fff8d6';
  const borderColor = isFailed ? '#ff5252' : '#ffd300';
  const iconColor = isFailed ? '#d32f2f' : '#9a7700';

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '0.6rem 0.85rem',
      marginBottom: '0.75rem',
      color: '#1a1a1a',
      fontSize: '0.82rem',
      fontWeight: 600,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        {isFailed
          ? <AlertTriangle size={18} color={iconColor} />
          : <RefreshCw size={16} color={iconColor} style={{ animation: 'spin 1.5s linear infinite' }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isFailed ? (
            <>
              <strong>{failed.length} cambio{failed.length !== 1 ? 's' : ''} sin sincronizar.</strong>{' '}
              Tus datos están guardados localmente pero no llegaron al servidor.
            </>
          ) : (
            <>Sincronizando {pending.length} cambio{pending.length !== 1 ? 's' : ''}…</>
          )}
        </div>
        {isFailed && (
          <button onClick={retryAll}
            style={{ background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 6, padding: '0.3rem 0.6rem',
                     fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} /> Reintentar todo
          </button>
        )}
        <button onClick={() => setOpen(o => !o)} aria-label="Ver detalles"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <ul style={{ listStyle: 'none', margin: '0.6rem 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {queue.map(op => (
            <li key={op.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(255,255,255,0.55)', padding: '0.4rem 0.55rem', borderRadius: 7,
              fontSize: '0.78rem', fontWeight: 500,
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ textTransform: 'capitalize' }}>{opSummary(op)}</strong>
                <span style={{ opacity: 0.6, marginLeft: 6 }}>· {formatTime(op.createdAt)}</span>
                {op.status === 'failed' && op.lastError && (
                  <div style={{ fontSize: '0.72rem', color: '#a33', marginTop: 2 }} title={op.lastError}>
                    Error: {op.lastError.length > 60 ? op.lastError.slice(0, 60) + '…' : op.lastError}
                  </div>
                )}
              </span>
              {op.status === 'failed' ? (
                <>
                  <button onClick={() => retry(op.id)} title="Reintentar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                    <RefreshCw size={14} color={iconColor} />
                  </button>
                  <button onClick={() => {
                    if (confirm('¿Descartar este cambio? Se perderá definitivamente.')) discard(op.id);
                  }} title="Descartar"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                    <X size={14} color="#d32f2f" />
                  </button>
                </>
              ) : (
                <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                  {op.attempts > 0 ? `Intento ${op.attempts + 1}/3` : 'En cola'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PendingSyncBanner;
