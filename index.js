require('dotenv').config();
const fs = require('fs');
const express = require('express');
const pino = require('pino');
const NodeCache = require('node-cache');
const readline = require('readline');
const qrcode = require('qrcode-terminal');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  getContentType
} = require('@whiskeysockets/baileys');
const configFile = require('./dono/config.json');
const { JsonDB } = require('./src/database');
const { getBody, onlyNumbers, sleep } = require('./src/utils');
const { configFromEnv, handleCommand, preModeration } = require('./src/commands');

const config = configFromEnv(configFile);
const db = new JsonDB('./dados/json');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = text => new Promise(resolve => rl.question(text, resolve));
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const PORT = process.env.PORT || 3000;
const AUTH_DIR = process.env.AUTH_DIR || './dono/sytem-dark-session';

// Render Free precisa de uma porta HTTP aberta.
const app = express();
app.get('/', (_, res) => res.json({ status: 'online', bot: config.botName, owner: config.Dononame, time: new Date().toISOString() }));
app.get('/health', (_, res) => res.send('OK'));
app.listen(PORT, () => console.log(`[WEB] Health server online na porta ${PORT}`));

function getGroupAdmins(participants = []) {
  return participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id || p.jid || p.lid).filter(Boolean);
}
function isAdmin(user, admins = []) {
  const n = onlyNumbers(user);
  return admins.some(a => onlyNumbers(a) === n);
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
    isBotAdmin: isGroup ? isAdmin(botJid, admins) : false,
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
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
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
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 30000
  });
  sock.ev.on('creds.update', saveCreds);

  // Pareamento por código no terminal. Em Render, veja o código nos Logs.
  if (!sock.authState.creds.registered) {
    const envNumber = onlyNumbers(process.env.BOT_NUMBER || config.numeroBot || config.donoJid);
    let number = envNumber;
    if (process.stdin.isTTY && !number) number = onlyNumbers(await question('Número do bot com DDI, ex +2449xxxxxxx: '));
    if (number) {
      await sleep(2500);
      const code = await sock.requestPairingCode(number);
      console.log('\n╔════════════════════════════╗');
      console.log('  CÓDIGO DE PAREAMENTO');
      console.log('╚════════════════════════════╝');
      console.log(`Número: ${number}`);
      console.log(`Código: ${(code || '').match(/.{1,4}/g)?.join('-') || code}\n`);
    } else {
      console.log('Sem BOT_NUMBER. Use QR abaixo:');
    }
  }

  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log(`[ONLINE] ${config.botName} conectado como ${sock.user?.id}`);
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;
    try {
      const ctx = await getContext(sock, msg);
      if (await preModeration(ctx)) return;
      if (!ctx.isCmd) return;
      db.addXp(ctx.sender, Math.floor(Math.random() * 4) + 1);
      await handleCommand(ctx);
    } catch (e) {
      console.log('[COMMAND ERROR]', e);
      try { await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro interno: ${e.message}` }, { quoted: msg }); } catch {}
    }
  });
}

startBot().catch(e => console.error('[START ERROR]', e));
