// Builds a professional share message for an access credential.
// channel: 'whatsapp' uses *bold* markdown supported by WhatsApp.
//          'email' uses the same conventions but plain (mail clients ignore *bold*).
//
// item: { title, description, email, password, url, image_url }
// opts: { sender, senderRole, channel }
export function buildShareMessage(item, opts = {}) {
  const { sender = '', senderRole = '', channel = 'whatsapp' } = opts;
  const bold = channel === 'whatsapp' ? (s) => `*${s}*` : (s) => s;
  const italic = channel === 'whatsapp' ? (s) => `_${s}_` : (s) => s;

  const lines = [];
  lines.push(`${bold(`Acceso compartido — ${item.title}`)}`);
  lines.push('');

  if (item.description?.trim()) {
    lines.push(item.description.trim());
  }
  if (item.url?.trim()) {
    lines.push(`🌐 ${item.url.trim()}`);
  }
  if (item.description?.trim() || item.url?.trim()) {
    lines.push('');
  }

  lines.push(`${bold('Usuario:')} ${item.email}`);
  lines.push(`${bold('Clave:')} ${item.password}`);
  lines.push('');

  const senderLabel = sender || 'el equipo';
  const roleSuffix = senderRole ? ` (${senderRole})` : '';
  lines.push(italic(`— Compartido por ${senderLabel}${roleSuffix} vía Gestor de Contraseñas`));

  return lines.join('\n');
}
