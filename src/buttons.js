const { prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const fs = require('fs');

async function sendText(sock, jid, text, quoted, extra = {}) {
  return sock.sendMessage(jid, { text, ...extra }, { quoted });
}
async function buildHeader(sock, opts = {}) {
  const header = { title: opts.title || '', subtitle: opts.subtitle || '', hasMediaAttachment: false };
  if (opts.image && fs.existsSync(opts.image)) {
    const media = await prepareWAMessageMedia({ image: { url: opts.image } }, { upload: sock.waUploadToServer });
    header.hasMediaAttachment = true;
    header.imageMessage = media.imageMessage;
  }
  return header;
}
function flowButton(b) {
  if (b.url) return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: b.text || b.name || 'Abrir', url: b.url, merchant_url: b.url }) };
  if (b.copy) return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: b.text || b.name || 'Copiar', id: b.id || 'copy', copy_code: b.copy }) };
  return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.text || b.display_text, id: b.id }) };
}
async function sendButtons(sock, jid, text, buttons, quoted, opts = {}) {
  try {
    await sock.relayMessage(jid, {
      interactiveMessage: {
        header: await buildHeader(sock, opts),
        body: { text },
        footer: { text: opts.footer || 'Sytem DARK • Dark Net' },
        nativeFlowMessage: { buttons: buttons.slice(0, 10).map(flowButton), messageParamsJson: '' },
        messageParamsJson: ''
      }
    }, {});
  } catch (e) {
    await sendText(sock, jid, text + '\n\n' + buttons.map(b => `• ${b.text || b.display_text}: ${b.id || b.url || b.copy || ''}`).join('\n'), quoted);
  }
}
async function sendList(sock, jid, text, title, sections, quoted, opts = {}) {
  try {
    await sock.relayMessage(jid, {
      interactiveMessage: {
        header: await buildHeader(sock, opts),
        body: { text },
        footer: { text: opts.footer || 'Sytem DARK • Dark Net' },
        nativeFlowMessage: { buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections }) }], messageParamsJson: '' },
        messageParamsJson: ''
      }
    }, {});
  } catch (e) {
    await sendText(sock, jid, text + '\n\n' + sections.flatMap(s => s.rows || []).map(r => `• ${r.title}: ${r.id}`).join('\n'), quoted);
  }
}
async function sendUrlCopy(sock, jid, text, buttons, quoted, opts = {}) {
  return sendButtons(sock, jid, text, buttons, quoted, opts);
}
module.exports = { sendText, sendButtons, sendList, sendUrlCopy };
