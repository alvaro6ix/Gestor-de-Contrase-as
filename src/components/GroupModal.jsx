import React, { useState, useEffect } from 'react';
import { X, Save, Folder, Link, Upload, Camera, Loader, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { enqueue } from '../lib/syncQueue';

const COLORS = ['#ffd300', '#00bcd4', '#7c4dff', '#ff5722', '#4caf50', '#e91e63', '#3f51b5', '#ff9800'];

const GroupModal = ({ group, onClose, onSuccess, userId }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState('url');
  const [imagePreview, setImagePreview] = useState('');
  const [form, setForm] = useState({
    name: '', description: '', image_url: '', url: '', color: '#ffd300'
  });

  useEffect(() => {
    if (group) {
      setForm({
        name: group.name || '',
        description: group.description || '',
        image_url: group.image_url || '',
        url: group.url || '',
        color: group.color || '#ffd300',
      });
      setImagePreview(group.image_url || '');
    }
  }, [group]);

  const handleImageFile = async (file) => {
    if (!file) return;
    setUploadingImage(true);

    const toDataUrl = (f) => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(f);
    });

    try {
      const dataUrl = await toDataUrl(file);
      setImagePreview(dataUrl);

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${userId}/groups/${Date.now()}.${ext}`;
      const uploadPromise = supabase.storage
        .from('password-icons')
        .upload(filename, file, { upsert: true });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('upload timeout')), 6000)
      );

      try {
        const { error } = await Promise.race([uploadPromise, timeoutPromise]);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('password-icons').getPublicUrl(filename);
        setForm(f => ({ ...f, image_url: urlData.publicUrl }));
      } catch (uploadErr) {
        console.warn('Storage upload falló, usando base64 embebido:', uploadErr?.message);
        setForm(f => ({ ...f, image_url: dataUrl }));
      }
    } catch (err) {
      console.error('No se pudo procesar la imagen:', err);
      alert('No se pudo procesar la imagen. Intenta con otra.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (uploadingImage || loading) return;

    const isNew = !group;
    const id = isNew ? (crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random()}`) : group.id;
    const now = new Date().toISOString();

    const optimistic = {
      ...form, id, user_id: userId,
      created_at: isNew ? now : (group.created_at || now),
      updated_at: now,
    };

    onSuccess(optimistic);
    onClose();

    if (isNew) {
      enqueue({ table: 'groups', type: 'insert', payload: { ...form, id, user_id: userId } });
    } else {
      enqueue({ table: 'groups', type: 'update', payload: { ...form }, match: { id: group.id } });
    }
  };

  const handleDelete = () => {
    if (!group) return;
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Las categorías dentro se eliminarán, los accesos quedarán sin grupo asignado.`)) return;
    onSuccess({ __deleted: true, id: group.id });
    onClose();
    enqueue({ table: 'groups', type: 'delete', match: { id: group.id } });
  };

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: form.color, padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <Folder size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>{group ? 'Editar Grupo' : 'Nuevo Grupo'}</h2>
          <p className="text-small">Software o sistema con sus accesos.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">Nombre del Sistema</label>
          <input type="text" required className="input-field" style={{ paddingLeft: '1rem' }}
            placeholder="ej: Oscar CRM, SAP, Office 365..."
            value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="input-group">
          <label className="input-label">Descripción</label>
          <textarea className="input-field" style={{ minHeight: '60px', resize: 'vertical', paddingLeft: '1rem' }}
            placeholder="Sistema de gestión de clientes, ERP, etc."
            value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="input-group">
          <label className="input-label">URL del Sistema</label>
          <div className="input-wrapper">
            <Link className="input-icon" size={16} />
            <input type="url" className="input-field"
              placeholder="https://crm.empresa.com"
              value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Logo del Sistema</label>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {[['url', 'URL', Link], ['upload', 'Archivo', Upload], ['camera', 'Cámara', Camera]].map(([mode, label, Icon]) => (
              <button key={mode} type="button"
                onClick={() => setImageMode(mode)}
                style={{
                  flex: 1, padding: '0.4rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: imageMode === mode ? form.color : 'rgba(0,0,0,0.05)',
                  color: imageMode === mode ? '#000' : 'inherit',
                  fontWeight: 700, fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem'
                }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {imageMode === 'url' && (
            <div className="input-wrapper">
              <Link className="input-icon" size={16} />
              <input type="url" className="input-field" placeholder="https://logo.url/icon.png"
                value={form.image_url}
                onChange={(e) => { setForm(f => ({ ...f, image_url: e.target.value })); setImagePreview(e.target.value); }} />
            </div>
          )}
          {imageMode === 'upload' && (
            <input type="file" accept="image/*" className="input-field" style={{ paddingLeft: '1rem', paddingTop: '0.5rem' }}
              onChange={(e) => handleImageFile(e.target.files[0])} />
          )}
          {imageMode === 'camera' && (
            <input type="file" accept="image/*" capture="environment" className="input-field" style={{ paddingLeft: '1rem', paddingTop: '0.5rem' }}
              onChange={(e) => handleImageFile(e.target.files[0])} />
          )}

          {(imagePreview || uploadingImage) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              {imagePreview && (
                <img src={imagePreview} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: `2px solid ${form.color}`, opacity: uploadingImage ? 0.5 : 1 }} onError={() => setImagePreview('')} />
              )}
              {uploadingImage ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: form.color, fontWeight: 600 }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo...
                </span>
              ) : imagePreview ? (
                <>
                  <span className="text-small" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Logo listo</span>
                  <button type="button" onClick={() => { setImagePreview(''); setForm(f => ({ ...f, image_url: '' })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontWeight: 700 }}>✕</button>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="input-group">
          <label className="input-label">Color identificador</label>
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
          {group && (
            <button type="button" onClick={handleDelete} className="btn btn-ghost btn-danger" disabled={loading}
              style={{ padding: '0.55rem 0.8rem' }}>
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={loading || uploadingImage} className="btn btn-primary" style={{ flex: 2 }}>
            {loading ? 'Guardando...' : <><Save size={16} /> Guardar</>}
          </button>
        </div>
      </form>
    </>
  );
};

export default GroupModal;
