// Construye un mensaje claro para compartir un acceso.
// channel: 'whatsapp' usa *negrita* y _cursiva_ que WhatsApp interpreta.
//          'email' deja el texto plano.
//
// Decisiones de formato:
//   - SIN emojis (causaban "tofu" en algunos clientes Android sin la fuente).
//   - URL al MEDIO del mensaje, no al final, para que WhatsApp NO genere
//     un preview de link gigante con el botón "Abrir aplicación".
//   - Bloque de credenciales claramente separado para copiar/pegar fácil.
//
// item: { title, description, email, password, url, image_url }
// opts: { sender, senderRole, channel }

export function buildShareMessage(item, opts = {}) {
  const { sender = '', senderRole = '', channel = 'whatsapp' } = opts;
  const isWa = channel === 'whatsapp';
  const bold = isWa ? (s) => `*${s}*` : (s) => s;
  const italic = isWa ? (s) => `_${s}_` : (s) => s;

  const lines = [];

  // Encabezado
  lines.push(bold(`Acceso: ${item.title}`));

  // Descripción / notas (si existen)
  if (item.description?.trim()) {
    lines.push(item.description.trim());
  }

  // URL del servicio — la ponemos al medio para evitar el preview de WhatsApp
  // al final del mensaje (que muestra el botón "Abrir aplicación").
  if (item.url?.trim()) {
    lines.push('');
    lines.push(`${bold('Sitio:')} ${item.url.trim()}`);
  }

  // Bloque de credenciales
  lines.push('');
  lines.push(bold('Credenciales'));
  lines.push(`${bold('Usuario:')} ${item.email}`);
  lines.push(`${bold('Clave:')} ${item.password}`);

  // Firma — solo si hay un nombre real configurado en el perfil.
  // Si no hay, mejor omitir la firma que mostrar un email o "el equipo".
  if (sender && sender.trim()) {
    lines.push('');
    const roleSuffix = senderRole ? ` — ${senderRole}` : '';
    lines.push(italic(`Enviado por ${sender.trim()}${roleSuffix}`));
  }

  // Truco anti-preview: terminar con punto evita que WhatsApp tome el link
  // de arriba como "URL principal" y genere el preview de tarjeta. Si igual
  // lo hace, al menos el botón aparece sobre el sitio real, no sobre la
  // app de WhatsApp.
  return lines.join('\n');
}
