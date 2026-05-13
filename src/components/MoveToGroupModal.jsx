import React, { useState, useEffect, useMemo } from 'react';
import { X, Move, Folder, Tag, Save } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const MoveToGroupModal = ({ itemIds, groups, categories, onClose, onSuccess, userId }) => {
  const [groupId, setGroupId] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [keepExisting, setKeepExisting] = useState(false); // si true, conserva los vínculos previos
  const [loading, setLoading] = useState(false);

  const availableCats = useMemo(
    () => categories.filter(c => c.group_id === groupId),
    [categories, groupId]
  );

  // Al cambiar grupo, las categorías anteriores ya no aplican
  useEffect(() => { setCategoryIds([]); }, [groupId]);

  const toggleCat = (cid) => {
    setCategoryIds(prev => prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Actualiza el group_id de todos los accesos seleccionados
      const { error: updErr } = await supabase
        .from('passwords')
        .update({ group_id: groupId || null, updated_at: new Date().toISOString() })
        .in('id', itemIds);
      if (updErr) throw updErr;

      // 2. Sincroniza las relaciones con categorías
      if (!groupId) {
        // Sin grupo → eliminar todos los vínculos de categorías
        await supabase.from('password_categories').delete().in('password_id', itemIds);
      } else {
        if (!keepExisting) {
          // Limpiar vínculos previos (de cualquier grupo) antes de añadir los nuevos
          await supabase.from('password_categories').delete().in('password_id', itemIds);
        }
        if (categoryIds.length > 0) {
          const rows = [];
          for (const pid of itemIds) {
            for (const cid of categoryIds) {
              rows.push({ password_id: pid, category_id: cid, user_id: userId });
            }
          }
          const { error: pcErr } = await supabase
            .from('password_categories')
            .upsert(rows, { onConflict: 'password_id,category_id', ignoreDuplicates: true });
          if (pcErr) throw pcErr;
        }
      }

      onSuccess();
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
        <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <Move size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>Mover a Grupo</h2>
          <p className="text-small">{itemIds.length} acceso{itemIds.length !== 1 ? 's' : ''} seleccionado{itemIds.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">
            <Folder size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Grupo destino
          </label>
          <select className="input-field" style={{ paddingLeft: '1rem' }}
            value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">— Sin grupo (mover a "Sin clasificar") —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {groupId && (
          <>
            <div className="input-group">
              <label className="input-label">
                <Tag size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
                Asignar a categorías (opcional, varias)
              </label>
              {availableCats.length === 0 ? (
                <p className="text-small" style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.04)', borderRadius: '8px' }}>
                  Este grupo no tiene categorías. Puedes mover los accesos al grupo igual y crear categorías después.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {availableCats.map(c => {
                    const on = categoryIds.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                        style={{
                          padding: '0.3rem 0.7rem', borderRadius: '999px',
                          background: on ? (c.color || 'var(--primary)') : 'rgba(0,0,0,0.05)',
                          color: on ? '#000' : 'inherit',
                          border: 'none', cursor: 'pointer',
                          fontSize: '0.72rem', fontWeight: 700,
                        }}>
                        {on && '✓ '}{c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={keepExisting} onChange={(e) => setKeepExisting(e.target.checked)} />
              <span style={{ fontSize: '0.78rem' }}>
                Conservar categorías previas (sin tocarlas)
              </span>
            </label>
          </>
        )}

        <div style={{ background: 'rgba(255,211,0,0.08)', border: '1px solid rgba(255,211,0,0.2)', borderRadius: '10px', padding: '0.75rem', marginBottom: '1.1rem' }}>
          <p style={{ fontSize: '0.74rem', lineHeight: 1.5 }}>
            {!groupId
              ? 'Los accesos quedarán en "Sin clasificar" y se eliminarán sus categorías.'
              : keepExisting
                ? 'Se asignará el nuevo grupo y se añadirán las categorías seleccionadas sin borrar las anteriores.'
                : 'Se reemplazarán las categorías anteriores por las seleccionadas (o ninguna si no marcas nada).'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
            {loading ? 'Moviendo...' : <><Save size={16} /> Mover {itemIds.length}</>}
          </button>
        </div>
      </form>
    </>
  );
};

export default MoveToGroupModal;
