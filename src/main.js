try { require('dotenv').config(); } catch (_) {}
const fs = require('fs');
const express = require('express');
const pino = require('pino');
const NodeCache = require('node-cache');
const readline = require('readline');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  getContentType
} = require('@whiskeysockets/baileys');
const configFile = require('../dono/config.json');
const { JsonDB } = require('./database');
const { getBody, onlyNumbers, sleep } = require('./utils');
const { configFromEnv, handleCommand, preModeration } = require('./commands');
const { restoreAuthFromMongo, debounceBackup } = require('./auth-mongo');
const { handleMangaButton } = require('./manga');

const config = configFromEnv(configFile);
const db = new JsonDB('./dados/json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = text => new Promise(resolve => rl.question(text, resolve));
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './dono/sytem-dark-session';

// Servidor HTTP para manter o painel/site com health check ativo.
const app = express();
app.get('/', (_, res) => res.json({ status: 'online', bot: config.botName, owner: config.Dononame, db: db.mode, time: new Date().toISOString() }));
app.get('/health', (_, res) => res.json({ ok: true, bot: config.botName, db: db.mode, uptime: process.uptime() }));
app.get('/db', (_, res) => res.json({ mode: db.mode, mongoReady: db.mongoReady, users: Object.keys(db.users || {}).length, groups: Object.keys(db.groups || {}).length }));
app.listen(PORT, () => console.log(`[WEB] Health server online na porta ${PORT}`));

const keepAliveUrl = process.env.KEEP_ALIVE_URL || process.env.PUBLIC_URL || '';
const keepAliveInterval = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 300000);
if (keepAliveUrl) {
  setInterval(() => {
    axios.get(keepAliveUrl.replace(/\/$/, '') + '/health', { timeout: 15000 }).catch(() => {});
  }, keepAliveInterval);
  console.log(`[WEB] Keep-alive ativo para ${keepAliveUrl}/health a cada ${Math.round(keepAliveInterval/1000)}s`);
}

function participantIds(p = {}) {
  return [p.id, p.jid, p.phoneNumber, p.lid, p.lidJid, p.jidPn, p.phoneJid].filter(Boolean);
}
function getGroupAdmins(participants = []) {
  return participants
    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
    .flatMap(participantIds)
    .filter(Boolean);
}
function sameNumber(a, b) {
  const x = onlyNumbers(a);
  const y = onlyNumbers(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(y) || y.endsWith(x);
}
function isAdmin(user, admins = []) {
  return admins.some(a => sameNumber(a, user));
}
function isBotAdminInParticipants(sock, participants = [], admins = []) {
  const ids = [sock.user?.id, sock.user?.jid, sock.user?.lid, sock.user?.name, process.env.BOT_NUMBER, config.numeroBot].filter(Boolean);
  if (ids.some(id => isAdmin(id, admins))) return true;
  const botNums = ids.map(onlyNumbers).filter(Boolean);
  return participants.some(p => (p.admin === 'admin' || p.admin === 'superadmin') && participantIds(p).some(id => botNums.some(n => sameNumber(id, n))));
}
async function getContext(sock, msg) {
  const from = msg.key.remoteJid;
  const isGroup = from?.endsWith('@g.us');
  let metadata = null, participants = [], admins = [];
  if (isGroup) {
    try { metadata = await sock.groupMetadata(from); participants = metadata.participants || []; admins = getGroupAdmins(participants); } catch (e) { console.log('[GROUP META]', e.message); }
  }
  const sender = isGroup ? (msg.key.participant || msg.participant || from) : from;
  const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
  const body = getBody(msg).trim();
  const prefix = config.prefix || '.';
  const isCmd = body.startsWith(prefix);
  const command = isCmd ? body.slice(prefix.length).trim().split(/\s+/).shift()?.toLowerCase() : '';
  const args = isCmd ? body.slice(prefix.length).trim().split(/\s+/).slice(1) : [];
  const q = args.join(' ');
  const type = getContentType(msg.message || {});
  const ctx = {
    sock, msg, from, sender, body, prefix, isCmd, command, args, q, type,
    config, db, metadata, participants, admins,
    isGroup,
    isOwner: onlyNumbers(sender) === config.donoJid || onlyNumbers(msg.key.participant) === config.donoJid || msg.key.fromMe,
    isAdmin: isGroup ? isAdmin(sender, admins) : false,
    isBotAdmin: isGroup ? isBotAdminInParticipants(sock, participants, admins) || isAdmin(botJid, admins) : false,
    pushname: msg.pushName || 'usuário',
    mentions: msg.message?.[type]?.contextInfo?.mentionedJid || [],
    reply: (text, extra = {}) => sock.sendMessage(from, { text, ...extra }, { quoted: msg }),
    react: emoji => sock.sendMessage(from, { react: { text: emoji, key: msg.key } }).catch(() => {})
  };
  return ctx;
}
async function startBot() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.mkdirSync('./temp', { recursive: true });
  await restoreAuthFromMongo(AUTH_DIR);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const backupCreds = debounceBackup(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 0] }));
  const msgRetryCounterCache = new NodeCache();
  const sock = makeWASocket({
    version,
    logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    connectTimeoutMs: Number(process.env.CONNECT_TIMEOUT_MS || 180000),
    defaultQueryTimeoutMs: Number(process.env.DEFAULT_QUERY_TIMEOUT_MS || 90000),
    keepAliveIntervalMs: Number(process.env.KEEP_ALIVE_WS_MS || 30000)
  });
  sock.ev.on('creds.update', async () => { await saveCreds(); backupCreds(); });

  // Sytem DARK prioriza PAIR CODE. Em hospedagem, veja o código nos Logs.
  const useQr = String(process.env.USE_QR || 'false').toLowerCase() === 'true';
  const pairingFirst = String(process.env.PAIRING_CODE || 'true').toLowerCase() !== 'false';
  if (!sock.authState.creds.registered && pairingFirst) {
    const envNumber = onlyNumbers(process.env.PAIRING_NUMBER || process.env.BOT_NUMBER || config.numeroBot || config.donoJid);
    let number = envNumber;
    if (process.stdin.isTTY && !number) number = onlyNumbers(await question('Número do bot com DDI, ex +2449xxxxxxx: '));
    if (!number) {
      console.log('\n[PAIR CODE] Defina BOT_NUMBER ou PAIRING_NUMBER no .env. Exemplo: BOT_NUMBER=244949926074');
    } else {
      const attempts = Number(process.env.PAIRING_ATTEMPTS || 3);
      const waitMs = Number(process.env.PAIRING_RETRY_MS || 15000);
      for (let i = 1; i <= attempts && !sock.authState.creds.registered; i++) {
        try {
          await sleep(i === 1 ? 3500 : waitMs);
          const code = await sock.requestPairingCode(number);
          const pretty = (code || '').match(/.{1,4}/g)?.join('-') || code;
          console.log('\n╔════════════════════════════════════════════╗');
          console.log('        SYTEM DARK - PAIR CODE');
          console.log('╚════════════════════════════════════════════╝');
          console.log(`Número do bot: +${number}`);
          console.log(`Código: ${pretty}`);
          console.log('');
          console.log('No WhatsApp desse número faça:');
          console.log('1) Aparelhos conectados');
          console.log('2) Conectar aparelho');
          console.log('3) Conectar com número');
          console.log(`4) Digite o código: ${pretty}`);
          console.log('');
          console.log(`Tentativa ${i}/${attempts}. O servidor ficará aguardando a conexão...\n`);
          break;
        } catch (e) {
          console.log(`[PAIR CODE] Falha ao gerar código tentativa ${i}/${attempts}: ${e.message}`);
          if (i >= attempts) console.log('[PAIR CODE] Não consegui gerar código. Reinicie ou confirme o BOT_NUMBER.');
        }
      }
    }
  } else if (!sock.authState.creds.registered && useQr) {
    console.log('USE_QR=true ativo. QR será exibido se o WhatsApp enviar QR.');
  }

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && useQr) qrcode.generate(qr, { small: true });
    if (qr && !useQr) console.log('[PAIR CODE] QR recebido, mas ignorado porque o modo prioritário é código. Para usar QR defina USE_QR=true.');
    if (connection === 'open') {
      console.log(`[ONLINE] ${config.botName} conectado como ${sock.user?.id}`);
      const ownerJid = `${config.donoJid}@s.whatsapp.net`;
      sock.sendMessage(ownerJid, { text: `✅ *${config.botName} conectado!*\n\nPair code confirmado com sucesso.\nDono: ${config.Dononame}` }).catch(() => {});
    }
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = status !== DisconnectReason.loggedOut;
      console.log(`[CONEXÃO] Fechada. Status: ${status}. Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) setTimeout(startBot, 3000);
      else console.log('Sessão encerrada. Apague a pasta da sessão para parear novamente.');
    }
  });

  sock.ev.on('group-participants.update', async ev => {
    try {
      const g = db.group(ev.id);
      if (!g.boasvindas && !g.despedida) return;
      const meta = await sock.groupMetadata(ev.id).catch(() => null);
      for (const user of ev.participants) {
        if (ev.action === 'add' && g.boasvindas) await sock.sendMessage(ev.id, { text: `🌀 Bem-vindo(a), @${onlyNumbers(user)}!\nGrupo: *${meta?.subject || 'Sytem DARK'}*`, mentions: [user] });
        if (ev.action === 'remove' && g.despedida) await sock.sendMessage(ev.id, { text: `👋 @${onlyNumbers(user)} saiu do grupo.`, mentions: [user] });
      }
    } catch (e) { console.log('[WELCOME]', e.message); }
  });

  const seenMessages = new Set();
  async function processIncoming(msg) {
    if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;
    const msgId = `${msg.key.remoteJid}:${msg.key.id}`;
    if (seenMessages.has(msgId)) return;
    seenMessages.add(msgId);
    if (seenMessages.size > 1000) seenMessages.clear();
    try {
      if (await handleMangaButton(sock, msg)) return;
      const ctx = await getContext(sock, msg);
      if (await preModeration(ctx)) return;
      if (!ctx.isCmd) return;
      db.addXp(ctx.sender, Math.floor(Math.random() * 4) + 1);
      await handleCommand(ctx);
    } catch (e) {
      console.log('[COMMAND ERROR]', e);
      try { await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro interno: ${e.message}` }, { quoted: msg }); } catch {}
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    await Promise.allSettled((messages || []).map(processIncoming));
  });
}

startBot().catch(e => console.error('[START ERROR]', e));
