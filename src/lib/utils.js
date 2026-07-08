const { jidNormalizedUser, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('../config');

const logger = pino({ level: 'silent' });

function unwrap(content = {}) {
  if (content.ephemeralMessage) return unwrap(content.ephemeralMessage.message || {});
  if (content.viewOnceMessage) return unwrap(content.viewOnceMessage.message || {});
  if (content.viewOnceMessageV2) return unwrap(content.viewOnceMessageV2.message || {});
  if (content.documentWithCaptionMessage) return unwrap(content.documentWithCaptionMessage.message || {});
  return content;
}

function getMessageContent(msg) {
  return unwrap(msg?.message || {});
}

function getContextInfo(msg) {
  const c = getMessageContent(msg);
  return c.extendedTextMessage?.contextInfo ||
    c.imageMessage?.contextInfo ||
    c.videoMessage?.contextInfo ||
    c.documentMessage?.contextInfo ||
    c.stickerMessage?.contextInfo ||
    c.audioMessage?.contextInfo ||
    {};
}

function getBody(msg) {
  const c = getMessageContent(msg);
  return c.conversation ||
    c.extendedTextMessage?.text ||
    c.imageMessage?.caption ||
    c.videoMessage?.caption ||
    c.documentMessage?.caption ||
    c.buttonsResponseMessage?.selectedButtonId ||
    c.listResponseMessage?.singleSelectReply?.selectedRowId ||
    c.templateButtonReplyMessage?.selectedId ||
    c.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    '';
}

function getMediaInfo(msg) {
  const c = getMessageContent(msg);
  if (c.imageMessage) return { type: 'image', mime: c.imageMessage.mimetype || 'image/jpeg' };
  if (c.videoMessage) return { type: 'video', mime: c.videoMessage.mimetype || 'video/mp4' };
  if (c.stickerMessage) return { type: 'sticker', mime: c.stickerMessage.mimetype || 'image/webp' };
  if (c.audioMessage) return { type: 'audio', mime: c.audioMessage.mimetype || 'audio/ogg' };
  if (c.documentMessage) return { type: 'document', mime: c.documentMessage.mimetype || 'application/octet-stream' };
  return null;
}

async function downloadCurrentMedia(msg) {
  return downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: undefined });
}

function mentionedJids(msg) {
  return getContextInfo(msg).mentionedJid || [];
}

function quotedParticipant(msg) {
  const ctx = getContextInfo(msg);
  return ctx.participant || ctx.remoteJid || '';
}

function normalizeJid(jid = '') {
  if (!jid) return '';
  return jidNormalizedUser(jid);
}

function targetJid(msg, args = []) {
  const mentions = mentionedJids(msg).map(normalizeJid).filter(Boolean);
  if (mentions[0]) return mentions[0];
  const quoted = quotedParticipant(msg);
  if (quoted && quoted.endsWith('@s.whatsapp.net')) return normalizeJid(quoted);
  const digits = config.onlyDigits(args[0] || '');
  if (digits.length >= 7) return config.toUserJid(digits);
  return '';
}

function isAdminParticipant(p) {
  return p?.admin === 'admin' || p?.admin === 'superadmin';
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function money(n) {
  return `Ð${Number(n || 0).toLocaleString('pt-AO')}`;
}

function parseAmount(value, fallback = 0) {
  const n = Number(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function human(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : '', `${sec}s`].filter(Boolean).join(' ');
}

function cooldown(user, key, ms) {
  const last = Number(user.cooldowns?.get(key) || 0);
  const diff = Date.now() - last;
  if (diff < ms) return { ok: false, wait: ms - diff };
  user.cooldowns.set(key, Date.now());
  return { ok: true, wait: 0 };
}

function addXp(user, amount) {
  user.xp += amount;
  let leveled = false;
  while (user.xp >= user.level * 120) {
    user.xp -= user.level * 120;
    user.level += 1;
    user.coins += user.level * 50;
    user.fame += 2;
    user.rpg.maxHp += 5;
    user.rpg.hp = user.rpg.maxHp;
    user.rpg.atk += 1;
    leveled = true;
  }
  return leveled;
}

function renderProgress(current, max, length = 10) {
  const filled = Math.max(0, Math.min(length, Math.round((current / max) * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function nowLuanda() {
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: config.tz,
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date());
}

function extractInviteCode(text = '') {
  const match = String(text).match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/i);
  return match ? match[1] : String(text).trim();
}

function hasGroupInvite(text = '') {
  return /chat\.whatsapp\.com\/[0-9A-Za-z]+/i.test(text);
}

function hasLink(text = '') {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text);
}

module.exports = {
  getBody,
  getMessageContent,
  getContextInfo,
  getMediaInfo,
  downloadCurrentMedia,
  mentionedJids,
  quotedParticipant,
  normalizeJid,
  targetJid,
  isAdminParticipant,
  pick,
  rand,
  money,
  parseAmount,
  human,
  cooldown,
  addXp,
  renderProgress,
  nowLuanda,
  extractInviteCode,
  hasGroupInvite,
  hasLink
};
