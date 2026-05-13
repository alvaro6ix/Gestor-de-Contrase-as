import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Plus, Search, LogOut, Sun, Moon,
  Shield, Eye, EyeOff,
  Edit, Trash2, Share2, Copy,
  History, RefreshCw, X, ExternalLink,
  Home, ZoomIn, Folder, FolderPlus, Tag, ChevronDown, ChevronRight,
  UserCog, Globe, FolderOpen, Inbox
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import PasswordGenerator from '../components/PasswordGenerator';
import PasswordModal from '../components/PasswordModal';
import PasswordHistory from '../components/PasswordHistory';
import ShareModal from '../components/ShareModal';
import UpdatePasswordModal from '../components/UpdatePasswordModal';
import GroupModal from '../components/GroupModal';
import CategoryModal from '../components/CategoryModal';
import ProfileModal from '../components/ProfileModal';
import { buildShareMessage } from '../lib/shareMessage';

const Logo = () => (
  <svg viewBox="0 0 40 40" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="9" fill="#ffd300" />
    <path d="M20 6 L32 12 L32 22 Q32 31 20 36 Q8 31 8 22 L8 12 Z" fill="#292528" />
    <path d="M15 21 L19 25 L26 17" stroke="#ffd300" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Image Lightbox ────────────────────────────────────────────────────────────
const ImageLightbox = ({ src, alt, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)', animation: 'fadeIn 0.18s ease', padding: '1.5rem',
    }}>
      <button onClick={onClose} style={{
        position: 'fixed', top: '1rem', right: '1rem',
        background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
        width: '40px', height: '40px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', zIndex: 10000,
      }}>
        <X size={22} />
      </button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '14px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)', animation: 'scaleIn 0.2s cubic-bezier(.34,1.56,.64,1)',
      }} />
      <p style={{
        position: 'fixed', bottom: '1.2rem', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', pointerEvents: 'none',
        background: 'rgba(0,0,0,0.3)', borderRadius: '20px', padding: '0.3rem 0.8rem',
      }}>
        {alt} · Toca fuera o Esc para cerrar
      </p>
    </div>
  );
};

// ─── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, profile, signOut, recoveryMode } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Data
  const [passwords, setPasswords] = useState([]);
  const [groups, setGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [passwordCategories, setPasswordCategories] = useState([]); // [{password_id, category_id}]

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('all'); // 'all' | 'shared' | 'unclassified' | groupId
  const [activeCategoryIds, setActiveCategoryIds] = useState([]); // chip filters when viewing a group
  const [expandedGroups, setExpandedGroups] = useState({}); // groupId -> bool
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copied, setCopied] = useState('');
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState(false);

  // Modals
  const [showGenerator, setShowGenerator] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryGroupId, setEditingCategoryGroupId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // ── Data loaders ────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pRes, gRes, cRes, pcRes] = await Promise.all([
        supabase.from('passwords').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('groups').select('*').eq('user_id', user.id).order('name'),
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('password_categories').select('*').eq('user_id', user.id),
      ]);
      setPasswords(pRes.data || []);
      setGroups(gRes.data || []);
      setCategories(cRes.data || []);
      setPasswordCategories(pcRes.data || []);
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchShared = async () => {
    setLoading(true);
    try {
      const { data: shares } = await supabase
        .from('shares').select('password_id')
        .eq('shared_with_email', user.email);
      const ids = (shares || []).map(s => s.password_id);
      if (!ids.length) { setPasswords([]); setLoading(false); return; }
      const { data } = await supabase.from('passwords').select('*').in('id', ids);
      setPasswords(data || []);
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (view === 'shared') {
      fetchShared();
    } else {
      fetchAll();
    }
  }, [user, view === 'shared' ? view : 'mine']);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const pwdToCategoryIds = useMemo(() => {
    const m = {};
    passwordCategories.forEach(pc => {
      if (!m[pc.password_id]) m[pc.password_id] = [];
      m[pc.password_id].push(pc.category_id);
    });
    return m;
  }, [passwordCategories]);

  const passwordsByGroup = useMemo(() => {
    const m = {};
    passwords.forEach(p => {
      const key = p.group_id || '__none__';
      if (!m[key]) m[key] = 0;
      m[key]++;
    });
    return m;
  }, [passwords]);

  const categoriesByGroup = useMemo(() => {
    const m = {};
    categories.forEach(c => {
      if (!m[c.group_id]) m[c.group_id] = [];
      m[c.group_id].push(c);
    });
    return m;
  }, [categories]);

  // Filter visible cards based on current view
  const filtered = useMemo(() => {
    let list = passwords;
    if (view === 'unclassified') {
      list = list.filter(p => !p.group_id);
    } else if (view !== 'all' && view !== 'shared') {
      // view is a groupId
      list = list.filter(p => p.group_id === view);
      if (activeCategoryIds.length) {
        list = list.filter(p => {
          const cats = pwdToCategoryIds[p.id] || [];
          return activeCategoryIds.some(id => cats.includes(id));
        });
      }
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.title?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [passwords, view, activeCategoryIds, searchTerm, pwdToCategoryIds]);

  const activeGroup = useMemo(
    () => groups.find(g => g.id === view) || null,
    [groups, view]
  );

  const viewTitle = useMemo(() => {
    if (view === 'all') return 'Mis Claves';
    if (view === 'shared') return 'Compartidas conmigo';
    if (view === 'unclassified') return 'Sin clasificar';
    return activeGroup?.name || 'Grupo';
  }, [view, activeGroup]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta clave permanentemente?')) return;
    const { error } = await supabase.from('passwords').delete().eq('id', id);
    if (!error) fetchAll();
  };

  const toggleVis = (id) => setVisiblePasswords(p => ({ ...p, [id]: !p[id] }));

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  };

  const shareWhatsApp = (item) => {
    const sender = profile?.display_name || user?.email || '';
    const senderRole = profile?.role || '';
    const text = buildShareMessage(item, { sender, senderRole, channel: 'whatsapp' });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    supabase.from('share_logs').insert({
      password_id: item.id,
      method: 'whatsapp',
      shared_with: 'WhatsApp',
      user_id: user.id
    }).then(() => { });
  };

  const selectView = (v) => {
    setView(v);
    setActiveCategoryIds([]);
    setMobileGroupsOpen(false);
  };

  const toggleGroupExpand = (gid) => {
    setExpandedGroups(e => ({ ...e, [gid]: !e[gid] }));
  };

  const toggleCategoryFilter = (cid) => {
    setActiveCategoryIds(ids => ids.includes(cid) ? ids.filter(x => x !== cid) : [...ids, cid]);
  };

  // ── Sidebar tree ────────────────────────────────────────────────────────────
  const SidebarTree = ({ mobile = false }) => (
    <>
      <button className={`nav-item${view === 'all' ? ' active' : ''}`} onClick={() => selectView('all')}>
        <Home size={16} /> <span>Todas mis claves</span>
        <span className="nav-count">{passwords.filter(p => p.user_id === user.id).length || ''}</span>
      </button>
      <button className={`nav-item${view === 'shared' ? ' active' : ''}`} onClick={() => selectView('shared')}>
        <Share2 size={16} /> <span>Compartidas</span>
      </button>
      <button className={`nav-item${view === 'unclassified' ? ' active' : ''}`} onClick={() => selectView('unclassified')}>
        <Inbox size={16} /> <span>Sin clasificar</span>
        <span className="nav-count">{passwordsByGroup['__none__'] || ''}</span>
      </button>

      <div className="sidebar-section-header">
        <span>GRUPOS</span>
        <button className="btn-icon" title="Nuevo grupo" onClick={() => { setEditingGroup(null); setShowGroupModal(true); }}>
          <FolderPlus size={14} />
        </button>
      </div>

      {groups.length === 0 && (
        <div className="sidebar-empty">
          <p className="text-small" style={{ padding: '0 0.4rem' }}>
            Crea tu primer grupo para organizar accesos por software.
          </p>
        </div>
      )}

      {groups.map(g => {
        const cats = categoriesByGroup[g.id] || [];
        const isExpanded = expandedGroups[g.id];
        const isActive = view === g.id;
        return (
          <div key={g.id} className="sidebar-group">
            <div className={`nav-item group-row${isActive ? ' active' : ''}`}>
              <button className="group-toggle" onClick={() => toggleGroupExpand(g.id)} aria-label="Expandir">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button className="group-main" onClick={() => selectView(g.id)}>
                {g.image_url ? (
                  <img src={g.image_url} alt="" className="group-thumb" />
                ) : (
                  <div className="group-thumb" style={{ background: g.color || 'var(--primary)' }}>
                    <Folder size={12} color="#000" />
                  </div>
                )}
                <span className="truncate" style={{ flex: 1, textAlign: 'left' }}>{g.name}</span>
                <span className="nav-count">{passwordsByGroup[g.id] || ''}</span>
              </button>
              <button className="btn-icon group-edit" title="Editar grupo"
                onClick={(e) => { e.stopPropagation(); setEditingGroup(g); setShowGroupModal(true); }}>
                <Edit size={11} />
              </button>
            </div>
            {isExpanded && (
              <div className="group-children">
                {cats.map(c => (
                  <div key={c.id} className="cat-row">
                    <button className="nav-subitem"
                      onClick={() => { selectView(g.id); setActiveCategoryIds([c.id]); }}>
                      <span className="cat-dot" style={{ background: c.color || 'var(--primary)' }} />
                      <span className="truncate" style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
                    </button>
                    <button className="btn-icon cat-edit" title="Editar categoría"
                      onClick={() => { setEditingCategory(c); setEditingCategoryGroupId(g.id); setShowCategoryModal(true); }}>
                      <Edit size={10} />
                    </button>
                  </div>
                ))}
                <button className="nav-subitem add-cat"
                  onClick={() => { setEditingCategory(null); setEditingCategoryGroupId(g.id); setShowCategoryModal(true); }}>
                  <Plus size={12} /> <span>Nueva categoría</span>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-layout">
      {/* Sidebar (desktop) */}
      <aside className="sidebar glass-card" style={{ borderRadius: 0, borderTop: 0, borderBottom: 0, borderLeft: 0 }}>
        <div className="sidebar-header">
          <Logo />
          <h2 style={{ fontSize: '1rem' }}>Gestor</h2>
        </div>

        <nav className="sidebar-nav">
          <SidebarTree />

          <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button className="nav-item" onClick={() => setShowGenerator(true)}>
              <RefreshCw size={16} /> <span>Generador</span>
            </button>
            <button className="nav-item" onClick={() => { setSelectedItem(null); setShowModal(true); }}>
              <Plus size={16} /> <span>Nueva Clave</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="user-profile user-profile-btn" onClick={() => setShowProfile(true)} title="Editar mi perfil">
            <div className="user-avatar">{(profile?.display_name || user?.email || '?')[0]?.toUpperCase()}</div>
            <div style={{ overflow: 'hidden', flex: 1, textAlign: 'left' }}>
              <div className="user-email truncate">{profile?.display_name || user?.email}</div>
              {profile?.role ? (
                <div className="user-role-badge" style={{ background: profile.role_color || 'var(--primary)' }}>
                  {profile.role}
                </div>
              ) : (
                <div className="user-plan">Define tu rol →</div>
              )}
            </div>
            <UserCog size={14} style={{ opacity: 0.5 }} />
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-icon" onClick={toggleTheme} style={{ flex: 1 }} aria-label="Cambiar tema">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-icon btn-danger" onClick={signOut} style={{ flex: 1 }} aria-label="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Top bar */}
        <div className="top-bar">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="truncate" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {activeGroup?.image_url ? (
                <img src={activeGroup.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }} />
              ) : view !== 'all' && view !== 'shared' && view !== 'unclassified' && activeGroup ? (
                <span style={{ width: 28, height: 28, borderRadius: 7, background: activeGroup.color || 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Folder size={16} color="#000" />
                </span>
              ) : null}
              <span className="truncate">{viewTitle}</span>
            </h1>
            <p className="text-small">
              {filtered.length} acceso{filtered.length !== 1 ? 's' : ''}
              {activeGroup?.description ? ` · ${activeGroup.description}` : ''}
              {activeGroup?.url ? (
                <>
                  {' · '}
                  <a href={activeGroup.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                    <Globe size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> Abrir sistema
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-ghost mobile-only" onClick={() => setMobileGroupsOpen(true)}
              style={{ padding: '0.4rem 0.6rem' }}>
              <FolderOpen size={16} />
            </button>
            <button className="btn-icon glass-card desktop-only" onClick={toggleTheme} aria-label="Tema">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn-icon btn-danger glass-card desktop-only" onClick={signOut} aria-label="Salir">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Category filter chips (only when viewing a group) */}
        {activeGroup && (categoriesByGroup[activeGroup.id]?.length > 0) && (
          <div className="category-chips">
            <button className={`chip${activeCategoryIds.length === 0 ? ' chip-active' : ''}`}
              onClick={() => setActiveCategoryIds([])}>
              Todas
            </button>
            {(categoriesByGroup[activeGroup.id] || []).map(c => {
              const on = activeCategoryIds.includes(c.id);
              return (
                <button key={c.id} className={`chip${on ? ' chip-active' : ''}`}
                  onClick={() => toggleCategoryFilter(c.id)}
                  style={on ? { background: c.color || 'var(--primary)', color: '#000' } : {}}>
                  <Tag size={11} /> {c.name}
                </button>
              );
            })}
            <button className="chip chip-add"
              onClick={() => { setEditingCategory(null); setEditingCategoryGroupId(activeGroup.id); setShowCategoryModal(true); }}>
              <Plus size={11} /> Categoría
            </button>
          </div>
        )}

        {/* Search */}
        <div className="search-bar">
          <div className="input-wrapper search-input">
            <Search className="input-icon" size={18} />
            <input
              type="text"
              placeholder="Buscar servicio, usuario o nota..."
              className="input-field glass-card"
              style={{ paddingLeft: '2.6rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => { setSelectedItem(null); setShowModal(true); }}>
            <Plus size={18} /> <span className="desktop-only">Nueva</span>
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="spinner"></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state glass-card">
            <Shield size={56} style={{ opacity: 0.15 }} />
            <h2 style={{ fontSize: '1.1rem' }}>
              {view === 'shared' ? 'Sin accesos compartidos' :
                view === 'unclassified' ? 'No hay claves sin clasificar' :
                  activeGroup ? `Sin claves en "${activeGroup.name}"` : 'Sin resultados'}
            </h2>
            <p className="text-small">Agrega tu primer acceso seguro</p>
            <button className="btn btn-primary" onClick={() => { setSelectedItem(null); setShowModal(true); }}>
              <Plus size={18} /> Agregar clave
            </button>
          </div>
        ) : (
          <div className="password-grid">
            {filtered.map(item => {
              const itemCats = (pwdToCategoryIds[item.id] || [])
                .map(cid => categories.find(c => c.id === cid))
                .filter(Boolean);
              const itemGroup = groups.find(g => g.id === item.group_id);
              return (
                <div key={item.id} className="password-card glass-card">
                  <div className="card-header">
                    <div className="card-icon"
                      style={{ position: 'relative', cursor: item.image_url ? 'zoom-in' : 'default' }}
                      onClick={() => item.image_url && setLightboxImage({ src: item.image_url, alt: item.title })}
                      title={item.image_url ? 'Ver imagen en grande' : ''}>
                      {item.image_url ? (
                        <>
                          <img src={item.image_url} alt={item.title}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                          <div style={{
                            position: 'absolute', inset: 0, borderRadius: '10px',
                            background: 'rgba(0,0,0,0)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s', opacity: 0,
                          }} className="card-icon-overlay">
                            <ZoomIn size={18} color="#fff" />
                          </div>
                        </>
                      ) : <Shield size={20} style={{ opacity: 0.25 }} />}
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div className="card-title truncate">{item.title}</div>
                      {item.description && <div className="card-desc truncate">{item.description}</div>}
                    </div>
                  </div>

                  {/* Group + categories tags */}
                  {(itemGroup || itemCats.length > 0) && (
                    <div className="card-tags">
                      {itemGroup && (
                        <span className="tag tag-group" onClick={() => selectView(itemGroup.id)}
                          style={{ background: (itemGroup.color || 'var(--primary)') + '22', borderColor: (itemGroup.color || 'var(--primary)') + '55' }}>
                          <Folder size={9} /> {itemGroup.name}
                        </span>
                      )}
                      {itemCats.map(c => (
                        <span key={c.id} className="tag"
                          style={{ background: (c.color || 'var(--primary)') + '22', color: 'inherit', borderColor: (c.color || 'var(--primary)') + '55' }}>
                          <Tag size={9} /> {c.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-details">
                    <div className="detail-row">
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div className="detail-label">Usuario</div>
                        <div className="detail-value truncate">{item.email}</div>
                      </div>
                      <button className="btn-icon" onClick={() => copyText(item.email, `email-${item.id}`)} aria-label="Copiar usuario">
                        {copied === `email-${item.id}` ? <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 900 }}>✓</span> : <Copy size={14} />}
                      </button>
                    </div>
                    <div className="detail-row">
                      <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div className="detail-label">Contraseña</div>
                        <div className="detail-value font-mono">{visiblePasswords[item.id] ? item.password : '••••••••'}</div>
                      </div>
                      <div style={{ display: 'flex' }}>
                        <button className="btn-icon" onClick={() => toggleVis(item.id)} aria-label="Ver/Ocultar">
                          {visiblePasswords[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button className="btn-icon" onClick={() => copyText(item.password, `pass-${item.id}`)} aria-label="Copiar contraseña">
                          {copied === `pass-${item.id}` ? <span style={{ color: 'var(--success)', fontSize: '0.7rem', fontWeight: 900 }}>✓</span> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="detail-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <div className="detail-label">URL</div>
                          <div className="detail-value truncate" style={{ color: 'var(--primary)' }}>{item.url}</div>
                        </div>
                        <Globe size={14} style={{ opacity: 0.5 }} />
                      </a>
                    )}
                  </div>

                  <div className="card-actions">
                    <button className="btn-icon" title="Historial" onClick={() => { setSelectedItem(item); setShowHistory(true); }}>
                      <History size={16} />
                    </button>
                    <button className="btn-icon" title="Editar" onClick={() => { setSelectedItem(item); setShowModal(true); }}>
                      <Edit size={16} />
                    </button>
                    <button className="btn-icon" title="Compartir internamente" onClick={() => { setSelectedItem(item); setShowShare(true); }}>
                      <Share2 size={16} />
                    </button>
                    <button className="btn-icon" title="Compartir por WhatsApp" onClick={() => shareWhatsApp(item)} style={{ color: '#25D366' }}>
                      <ExternalLink size={16} />
                    </button>
                    <button className="btn-icon btn-danger" title="Eliminar" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile groups drawer */}
      {mobileGroupsOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileGroupsOpen(false)}>
          <div className="mobile-drawer glass-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem' }}>Navegación</h2>
              <button className="btn-icon" onClick={() => setMobileGroupsOpen(false)}><X size={18} /></button>
            </div>
            <nav className="sidebar-nav">
              <SidebarTree mobile />
            </nav>
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <button className="user-profile user-profile-btn" onClick={() => { setShowProfile(true); setMobileGroupsOpen(false); }}>
                <div className="user-avatar">{(profile?.display_name || user?.email || '?')[0]?.toUpperCase()}</div>
                <div style={{ overflow: 'hidden', flex: 1, textAlign: 'left' }}>
                  <div className="user-email truncate">{profile?.display_name || user?.email}</div>
                  {profile?.role ? (
                    <div className="user-role-badge" style={{ background: profile.role_color || 'var(--primary)' }}>
                      {profile.role}
                    </div>
                  ) : (
                    <div className="user-plan">Define tu rol →</div>
                  )}
                </div>
                <UserCog size={14} style={{ opacity: 0.5 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav (mobile) */}
      <nav className="bottom-nav glass-card">
        <button className={`nav-item nav-item-mobile${view === 'all' ? ' active' : ''}`} onClick={() => selectView('all')}>
          <Home size={22} />
          <span style={{ fontSize: '0.62rem', marginTop: '0.15rem' }}>Inicio</span>
        </button>
        <button className="nav-item nav-item-mobile" onClick={() => setMobileGroupsOpen(true)}>
          <FolderOpen size={22} />
          <span style={{ fontSize: '0.62rem', marginTop: '0.15rem' }}>Grupos</span>
        </button>
        <button className="nav-item nav-item-mobile" onClick={() => { setSelectedItem(null); setShowModal(true); }}>
          <Plus size={22} />
          <span style={{ fontSize: '0.62rem', marginTop: '0.15rem' }}>Nueva</span>
        </button>
        <button className={`nav-item nav-item-mobile${view === 'shared' ? ' active' : ''}`} onClick={() => selectView('shared')}>
          <Share2 size={22} />
          <span style={{ fontSize: '0.62rem', marginTop: '0.15rem' }}>Compartido</span>
        </button>
        <button className="nav-item nav-item-mobile" onClick={toggleTheme}>
          {isDark ? <Sun size={22} /> : <Moon size={22} />}
          <span style={{ fontSize: '0.62rem', marginTop: '0.15rem' }}>Tema</span>
        </button>
      </nav>

      {/* Modals */}
      {showGenerator && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowGenerator(false)}>
          <div className="modal-content glass-card">
            <PasswordGenerator onClose={() => setShowGenerator(false)} />
          </div>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content glass-card">
            <PasswordModal
              item={selectedItem}
              onClose={() => setShowModal(false)}
              onSuccess={fetchAll}
              userId={user.id}
              defaultGroupId={!selectedItem && view !== 'all' && view !== 'shared' && view !== 'unclassified' ? view : null}
              defaultCategoryId={!selectedItem && activeCategoryIds.length === 1 ? activeCategoryIds[0] : null}
            />
          </div>
        </div>
      )}
      {showHistory && selectedItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="modal-content glass-card">
            <PasswordHistory passwordId={selectedItem.id} currentPassword={selectedItem.password} title={selectedItem.title} onClose={() => setShowHistory(false)} />
          </div>
        </div>
      )}
      {showShare && selectedItem && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowShare(false)}>
          <div className="modal-content glass-card">
            <ShareModal item={selectedItem} onClose={() => setShowShare(false)} userId={user.id} />
          </div>
        </div>
      )}
      {showGroupModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowGroupModal(false)}>
          <div className="modal-content glass-card">
            <GroupModal group={editingGroup} onClose={() => setShowGroupModal(false)} onSuccess={fetchAll} userId={user.id} />
          </div>
        </div>
      )}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCategoryModal(false)}>
          <div className="modal-content glass-card">
            <CategoryModal
              category={editingCategory}
              groupId={editingCategoryGroupId}
              groupName={groups.find(g => g.id === editingCategoryGroupId)?.name}
              onClose={() => setShowCategoryModal(false)}
              onSuccess={fetchAll}
              userId={user.id}
            />
          </div>
        </div>
      )}
      {showProfile && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="modal-content glass-card">
            <ProfileModal onClose={() => setShowProfile(false)} />
          </div>
        </div>
      )}
      {recoveryMode && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <UpdatePasswordModal />
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <ImageLightbox
          src={lightboxImage.src}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
