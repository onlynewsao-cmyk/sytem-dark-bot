require('dotenv').config();

function csv(value, fallback = []) {
  const base = value || fallback.join(',');
  return String(base)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

function toUserJid(number) {
  const n = onlyDigits(number);
  return n ? `${n}@s.whatsapp.net` : '';
}

const ownerNumber = onlyDigits(process.env.OWNER_NUMBER || '244945280380');
const botNumber = onlyDigits(process.env.BOT_NUMBER || '244949926074');
const pairingNumber = onlyDigits(process.env.PAIRING_NUMBER || botNumber);

module.exports = {
  botName: process.env.BOT_NAME || 'DARK System',
  ownerName: process.env.OWNER_NAME || 'Dark Net',
  ownerNumber,
  ownerJid: toUserJid(ownerNumber),
  botNumber,
  botJid: toUserJid(botNumber),
  mongoUri: process.env.MONGODB_URI,
  defaultPrefixes: csv(process.env.DEFAULT_PREFIXES, ['!', '.', '/', '#']),
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  qrWebEnabled: bool(process.env.QR_WEB_ENABLED, true),
  qrWebKey: process.env.QR_WEB_KEY || 'dark-system-local',
  usePairingCode: bool(process.env.USE_PAIRING_CODE, true),
  pairingNumber,
  renderFreeRequiresBotAdmin: bool(process.env.RENDER_FREE_REQUIRES_BOT_ADMIN, true),
  maxMediaMb: Number(process.env.MAX_MEDIA_MB || 15),
  directDownloadMaxMb: Number(process.env.DIRECT_DOWNLOAD_MAX_MB || 20),
  tz: process.env.TZ || 'Africa/Luanda',
  toUserJid,
  onlyDigits
};
