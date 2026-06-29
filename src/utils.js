const fs = require('fs');
const os = require('os');
const { getContentType, jidDecode } = require('@whiskeysockets/baileys');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const onlyNumbers = s => String(s || '').replace(/\D/g, '');
function normalizeJid(jid = '') { return jid?.split(':')[0]?.replace(/@lid$/, '@s.whatsapp.net'); }
function decodeJid(jid = '') { if (!jid) return jid; const d = jidDecode(jid); return d?.user && d?.server ? `${d.user}@${d.server}` : jid; }
function runtime(sec = process.uptime()) {
  sec = Number(sec); const d = Math.floor(sec / 86400); const h = Math.floor(sec % 86400 / 3600); const m = Math.floor(sec % 3600 / 60); const s = Math.floor(sec % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function getBody(msg) {
  const m = msg.message || {}; const type = getContentType(m);
  try {
    if (type === 'conversation') return m.conversation || '';
    if (type === 'extendedTextMessage') return m.extendedTextMessage?.text || '';
    if (type === 'imageMessage') return m.imageMessage?.caption || '';
    if (type === 'videoMessage') return m.videoMessage?.caption || '';
    if (type === 'documentMessage') return m.documentMessage?.caption || '';
    if (type === 'documentWithCaptionMessage') return m.documentWithCaptionMessage?.message?.documentMessage?.caption || '';
    if (type === 'buttonsResponseMessage') return m.buttonsResponseMessage?.selectedButtonId || '';
    if (type === 'listResponseMessage') return m.listResponseMessage?.singleSelectReply?.selectedRowId || '';
    if (type === 'templateButtonReplyMessage') return m.templateButtonReplyMessage?.selectedId || '';
    if (type === 'interactiveResponseMessage') return JSON.parse(m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson || '{}').id || '';
    if (type === 'viewOnceMessageV2') return getBody({ message: m.viewOnceMessageV2?.message || {} });
    if (type === 'viewOnceMessage') return getBody({ message: m.viewOnceMessage?.message || {} });
  } catch {}
  return '';
}
function mentioned(msg) {
  const m = msg.message || {}; const type = getContentType(m);
  return m[type]?.contextInfo?.mentionedJid || [];
}
function quotedKey(msg) {
  const m = msg.message || {}; const type = getContentType(m);
  const q = m[type]?.contextInfo;
  if (!q?.stanzaId) return null;
  return { remoteJid: msg.key.remoteJid, fromMe: q.participant === msg.key.remoteJid, id: q.stanzaId, participant: q.participant };
}
function memStats() {
  const used = process.memoryUsage();
  return Object.fromEntries(Object.entries(used).map(([k, v]) => [k, `${(v / 1024 / 1024).toFixed(2)} MB`]));
}
function systemInfo() { return { platform: os.platform(), arch: os.arch(), node: process.version, uptime: runtime(), memory: memStats() }; }
async function safeUnlink(file) { try { if (file && fs.existsSync(file)) fs.unlinkSync(file); } catch {} }
module.exports = { sleep, onlyNumbers, normalizeJid, decodeJid, runtime, pickRandom, getBody, mentioned, quotedKey, memStats, systemInfo, safeUnlink };
