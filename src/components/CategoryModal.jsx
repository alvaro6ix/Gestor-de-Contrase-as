import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const COLORS = ['#ffd300', '#00bcd4', '#7c4dff', '#ff5722', '#4caf50', '#e91e63', '#3f51b5', '#ff9800'];

const CategoryModal = ({ category, groupId, groupName, onClose, onSuccess, userId }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#ffd300' });

  useEffect(() => {
    if (category) {
      setForm({
        name: category.name || '',
        description: category.description || '',
        color: category.color || '#ffd300',
      });
    }
  }, [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!groupId) {
      alert('Falta el grupo de destino. Cierra y vuelve a abrir el formulario.');
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, group_id: groupId, user_id: userId };
      let saved;
      if (category) {
        const { data, error } = await supabase
          .from('categories').update(payload).eq('id', category.id)
          .select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('categories').insert([payload])
          .select().single();
        if (error) throw error;
        saved = data;
      }
      onSuccess(saved);
      onClose();
    } catch (err) {
      console.error('Error guardando categoría:', err);
      alert('No se pudo guardar la categoría: ' + (err.message || 'error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!category) return;
    if (!confirm(`¿Eliminar la categoría "${category.name}"? Los accesos quedarán sin esta categoría asignada.`)) return;
    setLoading(true);
    const { error } = await supabase.from('categories').delete().eq('id', category.id);
    setLoading(false);
    if (error) {
      console.error('Error eliminando categoría:', error);
      return alert('No se pudo eliminar: ' + error.message);
    }
    onSuccess({ __deleted: true, id: category.id });
    onClose();
  };

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: form.color, padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <Tag size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>{category ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
          <p className="text-small">Rol o área dentro de {groupName || 'el grupo'}.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Nombre del Rol / Área</label>
          <input type="text" required className="input-field" style={{ paddingLeft: '1rem' }}
            placeholder="ej: Administrador, Ventas, Soporte..."
            value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="input-group">
          <label className="input-label">Descripción (opcional)</label>
          <textarea className="input-field" style={{ minHeight: '60px', resize: 'vertical', paddingLeft: '1rem' }}
            placeholder="Permisos completos, gestión de clientes..."
            value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="input-group">
          <label className="input-label">Color</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: form.color === c ? '3px solid #000' : '2px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer'
                }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          {category && (
            <button type="button" onClick={handleDelete} className="btn btn-ghost btn-danger" disabled={loading}
              style={{ padding: '0.55rem 0.8rem' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
            {loading ? 'Guardando...' : <><Save size={16} /> Guardar</>}
          </button>
        </div>
      </form>
    </>
  );
};

export default CategoryModal;
