async function sendText(sock, jid, text, quoted, mentions = []) {
  return sock.sendMessage(jid, { text, mentions }, { quoted });
}

async function sendButtons(sock, jid, text, buttons = [], quoted, footer = 'DARK System') {
  const msg = {
    text,
    footer,
    buttons: buttons.slice(0, 3).map((b, i) => ({
      buttonId: b.id,
      buttonText: { displayText: b.text || b.label || `Opção ${i + 1}` },
      type: 1
    })),
    headerType: 1
  };

  try {
    return await sock.sendMessage(jid, msg, { quoted });
  } catch (err) {
    const fallback = `${text}\n\n${buttons.map((b, i) => `〔${i + 1}〕 ${b.text || b.label}\n${b.id}`).join('\n')}`;
    return sendText(sock, jid, fallback, quoted);
  }
}

function vcard({ name, phone, org = '', email = '', site = '' }) {
  const clean = String(phone || '').replace(/\D/g, '');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    `ORG:${org}`,
    `TEL;type=CELL;type=VOICE;waid=${clean}:+${clean}`,
    email ? `EMAIL:${email}` : '',
    site ? `URL:${site}` : '',
    'END:VCARD'
  ].filter(Boolean).join('\n');
}

module.exports = { sendText, sendButtons, vcard };
