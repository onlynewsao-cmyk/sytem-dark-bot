/**
 * Sytem DARK - Message Sender
 */
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const cfg = require('../config');
const S = cfg.bot.style;

function wrap(title, body){
  return `${S.top}
${S.bullet} *${cfg.bot.name}*
${S.mid}
*${title}*

${body}

${S.bottom}
${S.footer}`.trim();
}

async function sendText(sock, jid, text, quoted){
  return sock.sendMessage(jid, { text }, { quoted });
}

async function sendDark(sock, jid, title, body, quoted){
  return sendText(sock, jid, wrap(title, body), quoted);
}

async function sendButtons(sock, jid, text, buttons, footer, quoted, opts={}){
  // buttons: [{id, text, type:'quick'|'copy'|'url', url?, copy?}]
  try {
    const btns = buttons.map((b,i)=>{
      if (b.type==='url') return { name:'cta_url', buttonParamsJson: JSON.stringify({ display_text: b.text, url: b.url||'https://wa.me/', merchant_url: b.url||'https://wa.me/' }) };
      if (b.type==='copy') return { name:'cta_copy', buttonParamsJson: JSON.stringify({ display_text: b.text, copy_code: b.copy||b.id }) };
      return { name:'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.id }) };
    });
    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            header: proto.Message.InteractiveMessage.Header.create({ title: "", subtitle: "", hasMediaAttachment: false }),
            body: proto.Message.InteractiveMessage.Body.create({ text }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: footer || S.footer }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: btns })
          })
        }
      }
    }, { userJid: sock?.user?.id || sock?.user?.jid, quoted });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return true;
  } catch(e){
    // fallback
    const list = buttons.map(b=>`• ${b.text} → ${b.id}`).join('\n');
    return sendText(sock, jid, text + '\n\n' + list + (footer? '\n\n'+footer:''), quoted);
  }
}

async function sendList(sock, jid, title, text, sections, btnText='ABRIR', quoted){
  try {
    const msg = generateWAMessageFromContent(jid, {
      viewOnceMessage: { message: { messageContextInfo:{deviceListMetadata:{}, deviceListMetadataVersion:2},
        interactiveMessage: proto.Message.InteractiveMessage.create({
          header: proto.Message.InteractiveMessage.Header.create({ title: title || "", subtitle: "", hasMediaAttachment: false }),
          body: proto.Message.InteractiveMessage.Body.create({ text: `${title}\n\n${text}` }),
          footer: proto.Message.InteractiveMessage.Footer.create({ text: S.footer }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [{ name:'single_select', buttonParamsJson: JSON.stringify({ title: btnText, sections }) }]
          })
        })
      }}
    }, { userJid: sock?.user?.id || sock?.user?.jid, quoted });
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return true;
  } catch(e){
    let fallbackText = `${title}\n\n${text}`;
    try {
      for (const sec of sections || []) {
        if (sec.title) fallbackText += `\n\n*[ ${sec.title} ]*`;
        for (const row of sec.rows || []) {
          fallbackText += `\n• ${row.title} → \`${row.rowId}\``;
        }
      }
    } catch(_) {}
    return sendText(sock, jid, fallbackText, quoted);
  }
}

async function sendImage(sock, jid, bufferOrUrl, caption, quoted){
  const content = Buffer.isBuffer(bufferOrUrl) ? { image: bufferOrUrl } : { image: { url: bufferOrUrl } };
  if (caption) content.caption = caption;
  return sock.sendMessage(jid, content, { quoted });
}

module.exports = { sendText, sendDark, sendButtons, sendList, sendImage, wrap, S };
