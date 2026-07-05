/**
 * Sytem DARK - Independent Config v5 ULTIMATE
 * Dark Net © 2024-2026
 */

const multiPrefixes = (process.env.MULTI_PREFIX || process.env.PREFIX || '.')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (!multiPrefixes.includes('.')) multiPrefixes.unshift('.');
const extraPref = ['!', '/', '#', '🐬', '☯️', ''];
for (const p of extraPref) if (!multiPrefixes.includes(p)) multiPrefixes.push(p);

module.exports = {
  bot: {
    name: process.env.BOT_NAME?.replace(/"/g,'') || 'Sytem DARK',
    version: '5.3.0 ULTIMATE PLUS',
    creator: process.env.OWNER_NAME?.replace(/"/g,'') || 'Dark Net',
    prefix: process.env.PREFIX || '.',
    prefixes: [...new Set(multiPrefixes)],
    // IDs
    ownerNumber: process.env.OWNER_NUMBER || '244945280380',
    botNumber: process.env.BOT_NUMBER || '244949926074',
    ownerJid: (process.env.OWNER_NUMBER || '244945280380') + '@s.whatsapp.net',
    ownerLid: process.env.OWNER_LID || '213907088089212@lid',
    // Visual identity - SINGLE INDEPENDENT THEME
    emoji: '🌀',
    style: {
      top: '╔═━─━━─━ DARK SYSTEM ━─━━─━═╗',
      mid: '╠═══╡',
      bottom: '╚═━─━━─━═━━─━━─━═╝',
      bullet: '⟡⃟☯️',
      footer: '🌌☯️ Sytem DARK • Dark Net ☯️🌌'
    }
  },

  system: {
    pairing: {
      enabled: (process.env.PAIRING_CODE ?? 'true') !== 'false',
      number: process.env.PAIRING_NUMBER || process.env.BOT_NUMBER || '244949926074',
      useQr: (process.env.USE_QR || 'false') === 'true',
      attempts: parseInt(process.env.PAIRING_ATTEMPTS || '5', 10),
      retryMs: parseInt(process.env.PAIRING_RETRY_MS || '15000', 10)
    },
    mongo: {
      uri: process.env.MONGODB_URI || process.env.MONGO_URI || '',
      db: process.env.MONGODB_DB || 'dark-system'
    },
    authId: process.env.AUTH_ID || 'sytem_dark_244949926074',
    sessionDir: process.env.SESSION_DIR || './data/session',
    keepAlive: {
      url: process.env.KEEP_ALIVE_URL || process.env.PUBLIC_URL || process.env.APP_URL || '',
      intervalMs: parseInt(process.env.KEEP_ALIVE_INTERVAL_MS || '240000', 10)
    },
    timeouts: {
      connect: parseInt(process.env.CONNECT_TIMEOUT_MS || '180000', 10),
      query: parseInt(process.env.DEFAULT_QUERY_TIMEOUT_MS || '90000', 10),
      ws: parseInt(process.env.KEEP_ALIVE_WS_MS || '30000', 10)
    },
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: process.env.APP_URL || process.env.PUBLIC_URL || ''
  },

  apis: {
    systemzone: {
      url: process.env.SYSTEMZONE_API_URL || 'https://systemzone.store',
      key: process.env.SYSTEMZONE_API_KEY || 'freekey'
    },
    gemini: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    cloudinary: {
      cloud: process.env.CLOUDINARY_CLOUD_NAME || '',
      key: process.env.CLOUDINARY_API_KEY || '',
      secret: process.env.CLOUDINARY_API_SECRET || ''
    }
  },

  features: {
    antiLink: true,
    welcome: true,
    antiCall: true,
    autoRead: false,
    simultaneous: true,
    antiStatus: true,
    antiMentionStatus: true,
    antiSpam: true,
    // APIs System DARK
    copilotModel: process.env.COPILOT_MODEL || 'gpt-5',
    mangaChaptersPerPdf: parseInt(process.env.MANGA_CHAPTERS_PER_PDF || '2', 10)
  },

  limits: {
    ytMaxSeconds: parseInt(process.env.MAX_YOUTUBE_SECONDS || process.env.YT_MAX_SECONDS || '5400', 10),
    downloadMaxMb: 95,
    stickerVideoSec: parseInt(process.env.STICKER_VIDEO_MAX_SEC || '13', 10),
    antiSpam: { max: 7, windowMs: 8000, banMs: 60000 }
  },

  vip: {
    enabled: true,
    defaultDays: 30,
    plans: { '20d': 20, '30d': 30, 'vip': 30, 'premium': 90 }
  },

  hosting: {
    required: true, // precisa hospedagem para usar comandos premium
    bypassOwner: true,
    warning: '⚠️ Hospedagem não ativa neste grupo!\nUse .invokedono ou compre um plano VIP com o Dark Net.'
  }
};
