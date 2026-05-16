// Cola persistente de operaciones de escritura a Supabase.
//
// Por qué existe: el patrón "save optimista en background" cierra el modal
// antes de que el servidor confirme. Si la red falla o el cliente se cuelga,
// el dato muere en memoria y el usuario no se entera. Para un gestor de
// contraseñas eso es inaceptable.
//
// Cómo funciona:
//   1. Cada save/delete entra a una cola en localStorage.
//   2. Se procesa FIFO. Cada op corre con reintentos automáticos (backoff 2s/5s).
//   3. Si falla 3 veces queda en estado 'failed' bloqueando la cola hasta
//      intervención manual (botón Reintentar o Descartar en el banner).
//   4. Al reabrir la app, volver a foreground o recuperar conexión,
//      se vuelve a drenar.
//   5. Los datos NUNCA se pierden silenciosamente — quedan en localStorage
//      hasta que el servidor confirme 200 OK.

import { supabase } from './supabaseClient';

const STORAGE_KEY = 'gestor.syncQueue.v1';
const MAX_AUTO_ATTEMPTS = 3;
const BACKOFFS_MS = [0, 2000, 5000];

let listeners = [];
let processing = false;

const safeRead = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

const safeWrite = (q) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); } catch { /* quota */ }
  // Notificar a suscriptores (UI banner, etc.)
  listeners.forEach(cb => { try { cb(q); } catch { /* ignore */ } });
};

const newId = () => `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ── API pública ────────────────────────────────────────────────────────────
export const subscribe = (cb) => {
  listeners.push(cb);
  cb(safeRead());
  return () => { listeners = listeners.filter(l => l !== cb); };
};

export const getQueue = () => safeRead();

export const enqueue = (op) => {
  // op: { table, type: 'insert'|'update'|'delete', payload?, match?, label? }
  const q = safeRead();
  q.push({
    id: newId(),
    attempts: 0,
    status: 'pending',
    createdAt: Date.now(),
    ...op,
  });
  safeWrite(q);
  process();
};

export const enqueueMany = (ops) => {
  if (!ops?.length) return;
  const q = safeRead();
  ops.forEach(op => {
    q.push({
      id: newId(),
      attempts: 0,
      status: 'pending',
      createdAt: Date.now(),
      ...op,
    });
  });
  safeWrite(q);
  process();
};

export const retry = (id) => {
  const q = safeRead();
  const op = q.find(o => o.id === id);
  if (!op) return;
  op.status = 'pending';
  op.attempts = 0;
  delete op.lastError;
  safeWrite(q);
  process();
};

export const retryAll = () => {
  const q = safeRead();
  q.forEach(o => {
    if (o.status === 'failed') { o.status = 'pending'; o.attempts = 0; delete o.lastError; }
  });
  safeWrite(q);
  process();
};

export const discard = (id) => {
  safeWrite(safeRead().filter(o => o.id !== id));
};

export const discardAll = () => safeWrite([]);

// ── Procesamiento ──────────────────────────────────────────────────────────
// `match` admite dos formas por columna:
//   { id: 'abc' }              → .eq('id', 'abc')
//   { id: { in: ['a','b'] } }  → .in('id', ['a','b'])
const applyMatch = (q, match) => {
  Object.entries(match || {}).forEach(([k, v]) => {
    if (v && typeof v === 'object' && Array.isArray(v.in)) q = q.in(k, v.in);
    else q = q.eq(k, v);
  });
  return q;
};

const executeOp = async (op) => {
  const { table, type, payload, match, options } = op;
  if (type === 'insert') {
    const { error } = await supabase.from(table).insert(Array.isArray(payload) ? payload : [payload]);
    if (error) throw error;
  } else if (type === 'upsert') {
    const { error } = await supabase.from(table).upsert(
      Array.isArray(payload) ? payload : [payload],
      options || {}
    );
    if (error) throw error;
  } else if (type === 'update') {
    let q = supabase.from(table).update(payload);
    q = applyMatch(q, match);
    const { error } = await q;
    if (error) throw error;
  } else if (type === 'delete') {
    let q = supabase.from(table).delete();
    q = applyMatch(q, match);
    const { error } = await q;
    if (error) throw error;
  } else {
    throw new Error(`Unknown op type: ${type}`);
  }
};

export const process = async () => {
  if (processing) return;
  processing = true;
  try {
    // Procesar FIFO. Si encontramos una failed bloqueando la cabeza,
    // paramos: necesita intervención manual (Retry/Discard) para no
    // ejecutar ops dependientes con datos rotos.
    while (true) {
      const q = safeRead();
      if (q.length === 0) break;
      const head = q[0];
      if (head.status === 'failed') break;

      try {
        await executeOp(head);
        // Éxito: drop head
        safeWrite(safeRead().filter(o => o.id !== head.id));
      } catch (err) {
        const cur = safeRead();
        const idx = cur.findIndex(o => o.id === head.id);
        if (idx < 0) continue;
        cur[idx].attempts = (cur[idx].attempts || 0) + 1;
        cur[idx].lastError = err?.message || String(err);
        if (cur[idx].attempts >= MAX_AUTO_ATTEMPTS) {
          cur[idx].status = 'failed';
          safeWrite(cur);
          break;
        }
        safeWrite(cur);
        const wait = BACKOFFS_MS[cur[idx].attempts] ?? 5000;
        await new Promise(r => setTimeout(r, wait));
      }
    }
  } finally {
    processing = false;
  }
};

// ── Triggers automáticos ───────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => process());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') process();
  });
  // Drenar al cargar el módulo (cubre el caso "abrí la app y había pendientes
  // de la sesión anterior").
  setTimeout(() => process(), 500);

  // Aviso si el usuario intenta cerrar con cosas sin sincronizar.
  window.addEventListener('beforeunload', (e) => {
    const q = safeRead();
    const pending = q.filter(o => o.status === 'pending' || o.status === 'failed');
    if (pending.length > 0) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });
}
