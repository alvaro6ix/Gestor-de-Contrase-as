import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff, Shield, RefreshCw, Camera, Link, Upload, Loader, Folder, Tag, Globe } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const PasswordModal = ({ item, onClose, onSuccess, userId, defaultGroupId = null, defaultCategoryId = null }) => {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imageMode, setImageMode] = useState('url');
  const [imagePreview, setImagePreview] = useState('');
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', email: '', password: '', image_url: '', url: '', group_id: defaultGroupId || ''
  });

  // Load groups + categories
  useEffect(() => {
    (async () => {
      const { data: gs } = await supabase.from('groups').select('*').eq('user_id', userId).order('name');
      setGroups(gs || []);
      const { data: cs } = await supabase.from('categories').select('*').eq('user_id', userId).order('name');
      setCategories(cs || []);
    })();
  }, [userId]);

  // Load existing item data
  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        description: item.description || '',
        email: item.email || '',
        password: item.password || '',
        image_url: item.image_url || '',
        url: item.url || '',
        group_id: item.group_id || ''
      });
      setImagePreview(item.image_url || '');
      // Load existing category links
      (async () => {
        const { data } = await supabase.from('password_categories').select('category_id').eq('password_id', item.id);
        setSelectedCategoryIds((data || []).map(r => r.category_id));
      })();
    } else if (defaultCategoryId) {
      setSelectedCategoryIds([defaultCategoryId]);
    }
  }, [item, defaultCategoryId]);

  // When group changes, drop categories from other groups
  useEffect(() => {
    if (!formData.group_id) {
      setSelectedCategoryIds([]);
      return;
    }
    setSelectedCategoryIds(ids =>
      ids.filter(id => categories.find(c => c.id === id)?.group_id === formData.group_id)
    );
  }, [formData.group_id, categories]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let gen = '';
    for (let i = 0; i < 20; i++) gen += chars[Math.floor(Math.random() * chars.length)];
    setFormData(f => ({ ...f, password: gen }));
    setShowPassword(true);
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('password-icons')
        .upload(filename, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('password-icons').getPublicUrl(filename);
        setFormData(f => ({ ...f, image_url: urlData.publicUrl }));
      } else {
        // Fallback: store as base64 data URL (await readAsDataURL via Promise wrapper)
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        setFormData(f => ({ ...f, image_url: dataUrl }));
      }
    } catch {
      // Last-resort fallback
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        setFormData(f => ({ ...f, image_url: dataUrl }));
      } catch { /* give up */ }
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleCategory = (id) => {
    setSelectedCategoryIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (uploadingImage || loading) return;

    const isNew = !item;
    // ID generado en cliente para nuevos items: nos permite cerrar el modal
    // ANTES de que el servidor responda y aun así tener un ID estable.
    const id = isNew ? (crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random()}`) : item.id;
    const now = new Date().toISOString();

    // Campos que sí van al servidor (id/user_id/created_at se manejan aparte)
    const dataFields = {
      title: formData.title.trim(),
      description: formData.description?.trim() || null,
      email: formData.email.trim(),
      password: formData.password,
      image_url: formData.image_url || null,
      url: formData.url?.trim() || null,
      group_id: formData.group_id || null,
    };
    // Payload optimista (lo que ve el padre inmediatamente)
    const optimisticItem = {
      ...dataFields,
      id,
      user_id: userId,
      updated_at: now,
      created_at: isNew ? now : (item.created_at || now),
    };
    const catIds = formData.group_id ? selectedCategoryIds : [];

    // 1. Cierra inmediatamente y actualiza el padre de forma optimista.
    onSuccess(optimisticItem, catIds);
    onClose();

    // 2. Persiste en Supabase en background. Errores se reportan vía alert.
    (async () => {
      try {
        if (isNew) {
          const insertRow = { ...dataFields, id, user_id: userId };
          const { error } = await supabase.from('passwords').insert([insertRow]);
          if (error) throw error;
          if (catIds.length) {
            const rows = catIds.map(cid => ({ password_id: id, category_id: cid, user_id: userId }));
            const { error: pcErr } = await supabase.from('password_categories').insert(rows);
            if (pcErr) throw pcErr;
          }
        } else {
          const updateRow = { ...dataFields, updated_at: now };
          const ops = [supabase.from('passwords').update(updateRow).eq('id', id)];
          if (formData.password !== item.password) {
            ops.push(supabase.from('password_history').insert({
              password_id: id, old_password: item.password, new_password: formData.password,
            }));
          }
          const results = await Promise.all(ops);
          const failed = results.find(r => r?.error);
          if (failed) throw failed.error;
          const { error: delErr } = await supabase.from('password_categories').delete().eq('password_id', id);
          if (delErr) throw delErr;
          if (catIds.length) {
            const rows = catIds.map(cid => ({ password_id: id, category_id: cid, user_id: userId }));
            const { error: pcErr } = await supabase.from('password_categories').insert(rows);
            if (pcErr) throw pcErr;
          }
        }
      } catch (err) {
        console.error('PasswordModal background save failed:', err);
        alert(
          'No se pudo guardar en el servidor:\n' +
          (err?.message || err?.error_description || 'Error desconocido') +
          '\n\nRecarga la página para ver el estado real.'
        );
      }
    })();
  };

  const availableCategories = formData.group_id
    ? categories.filter(c => c.group_id === formData.group_id)
    : [];

  return (
    <>
      <button onClick={onClose} className="modal-close btn-icon"><X size={22} /></button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '10px', color: '#000' }}>
          <Shield size={26} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>{item ? 'Editar Acceso' : 'Nuevo Acceso'}</h2>
          <p className="text-small">Configura los detalles de tu credencial.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="input-group">
          <label className="input-label" htmlFor="pwd-title">Nombre del Servicio</label>
          <input id="pwd-title" type="text" required className="input-field" style={{ paddingLeft: '1rem' }}
            placeholder="ej: Gmail, Instagram, Oscar CRM..."
            autoFocus
            value={formData.title} onChange={(e) => setFormData(f => ({ ...f, title: e.target.value }))} />
        </div>

        {/* URL */}
        <div className="input-group">
          <label className="input-label">URL del Servicio (opcional)</label>
          <div className="input-wrapper">
            <Globe className="input-icon" size={16} />
            <input type="url" className="input-field"
              placeholder="https://crm.empresa.com"
              value={formData.url} onChange={(e) => setFormData(f => ({ ...f, url: e.target.value }))} />
          </div>
        </div>

        {/* Group (optional) */}
        <div className="input-group">
          <label className="input-label">
            <Folder size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
            Grupo / Sistema (opcional)
          </label>
          <select className="input-field" style={{ paddingLeft: '1rem' }}
            value={formData.group_id}
            onChange={(e) => setFormData(f => ({ ...f, group_id: e.target.value }))}>
            <option value="">— Sin grupo —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Categories (only if group selected) */}
        {formData.group_id && (
          <div className="input-group">
            <label className="input-label">
              <Tag size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} />
              Roles / Áreas (opcional, varios)
            </label>
            {availableCategories.length === 0 ? (
              <p className="text-small" style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.04)', borderRadius: '8px' }}>
                Este grupo aún no tiene categorías. Créalas desde la barra lateral.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {availableCategories.map(c => {
                  const selected = selectedCategoryIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCategory(c.id)}
                      style={{
                        padding: '0.3rem 0.7rem', borderRadius: '999px',
                        background: selected ? (c.color || 'var(--primary)') : 'rgba(0,0,0,0.05)',
                        color: selected ? '#000' : 'inherit',
                        border: 'none', cursor: 'pointer',
                        fontSize: '0.72rem', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                      {selected && '✓ '}{c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedCategoryIds.length > 1 && (
              <p className="text-small" style={{ marginTop: '0.3rem' }}>
                Este acceso aparecerá en {selectedCategoryIds.length} áreas distintas.
              </p>
            )}
          </div>
        )}

        {/* Icon / Image */}
        <div className="input-group">
          <label className="input-label">Icono del Servicio</label>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {[['url', 'URL', Link], ['upload', 'Archivo', Upload], ['camera', 'Cámara', Camera]].map(([mode, label, Icon]) => (
              <button key={mode} type="button"
                onClick={() => setImageMode(mode)}
                style={{
                  flex: 1, padding: '0.4rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: imageMode === mode ? 'var(--primary)' : 'rgba(0,0,0,0.05)',
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
                value={formData.image_url}
                onChange={(e) => { setFormData(f => ({ ...f, image_url: e.target.value })); setImagePreview(e.target.value); }} />
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
                <img src={imagePreview} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--primary)', opacity: uploadingImage ? 0.5 : 1 }} onError={() => setImagePreview('')} />
              )}
              {uploadingImage ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo imagen...
                </span>
              ) : (
                <>
                  <span className="text-small" style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Imagen lista</span>
                  <button type="button" onClick={() => { setImagePreview(''); setFormData(f => ({ ...f, image_url: '' })); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontWeight: 700 }}>✕</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="input-group">
          <label className="input-label">Notas (opcional)</label>
          <textarea className="input-field" style={{ minHeight: '60px', resize: 'vertical', paddingLeft: '1rem' }}
            placeholder="Detalles adicionales..."
            value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} />
        </div>

        {/* Email / Password */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="input-group">
            <label className="input-label">Usuario / Email</label>
            <input type="text" required className="input-field" style={{ paddingLeft: '1rem' }}
              value={formData.email} onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="input-group">
            <label className="input-label">Contraseña</label>
            <div className="input-wrapper">
              <input type={showPassword ? 'text' : 'password'} required className="input-field"
                style={{ paddingLeft: '1rem', paddingRight: '4.5rem' }}
                value={formData.password} onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))} />
              <div style={{ position: 'absolute', right: '0.25rem', display: 'flex', gap: '0' }}>
                <button type="button" onClick={generatePassword} className="btn-icon" title="Generar" style={{ padding: '0.3rem' }}>
                  <RefreshCw size={14} />
                </button>
                <button type="button" onClick={() => setShowPassword(s => !s)} className="btn-icon" style={{ padding: '0.3rem' }}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button
            type="submit"
            disabled={loading || uploadingImage}
            className="btn btn-primary"
            style={{ flex: 2, opacity: uploadingImage ? 0.7 : 1 }}
          >
            {loading ? 'Guardando...' : uploadingImage ? (
              <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Espera...</>
            ) : (
              <><Save size={16} /> Guardar</>
            )}
          </button>
        </div>
      </form>
    </>
  );
};

export default PasswordModal;
