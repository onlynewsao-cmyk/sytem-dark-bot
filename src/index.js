require('dotenv').config();
const express = require('express');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const config = require('./config');
const { connectDB } = require('./database');
const { useMongoAuthState } = require('./lib/mongoAuthState');
const { initMediaStore, streamFile } = require('./services/mediaStore');
const { handleMessage, getSettings, getGroup } = require('./handler');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
let sock;
let currentQR = '';
let currentQRDataUrl = '';
let currentPairCode = '';
let currentPairNumber = '';
let pairRequestedAt = null;
let pairRequestInProgress = false;
let startedAt = new Date();
let mongoConnection;

function startHttp() {
  const app = express();

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DARK System</title><style>body{font-family:system-ui;background:#08070b;color:#f2f2f2;margin:0;padding:40px}.card{max-width:720px;margin:auto;background:#14101d;border:1px solid #3b245f;border-radius:20px;padding:28px;box-shadow:0 20px 70px #0008}h1{color:#b48cff}.ok{color:#44ff99}code{background:#211832;padding:3px 7px;border-radius:8px}</style></head><body><div class="card"><h1>⚡ DARK System</h1><p class="ok">Servidor online.</p><p>Use <code>/health</code> no UptimeRobot para manter acordado no Render Free.</p><p>Conexão por código: <code>/pair?key=SUA_QR_WEB_KEY</code></p><p>QR reserva: <code>/qr?key=SUA_QR_WEB_KEY</code></p></div></body></html>`);
  });

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      bot: config.botName,
      connected: Boolean(sock?.user),
      user: sock?.user ? jidNormalizedUser(sock.user.id) : null,
      startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
      time: new Date().toISOString(),
      pairing: { enabled: config.usePairingCode, number: config.pairingNumber, hasCode: Boolean(currentPairCode), requestedAt: pairRequestedAt }
    });
  });

  app.get('/stats', async (_req, res) => {
    const settings = await getSettings().catch(() => null);
    res.json({ ok: true, settings: settings?.stats || {}, connected: Boolean(sock?.user) });
  });

  app.get('/qr', async (req, res) => {
    if (!config.qrWebEnabled) return res.status(404).send('QR web desativado.');
    if (String(req.query.key || '') !== config.qrWebKey) return res.status(401).send('Chave inválida.');
    if (!currentQR) return res.type('html').send('<h2>DARK System</h2><p>Nenhum QR ativo. Se já conectou, não precisa escanear.</p>');
    if (!currentQRDataUrl) currentQRDataUrl = await QRCode.toDataURL(currentQR);
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR DARK System</title><style>body{font-family:system-ui;background:#08070b;color:#fff;display:grid;place-items:center;min-height:100vh}.card{background:#15101f;border:1px solid #3a2661;border-radius:20px;padding:28px;text-align:center}img{width:320px;max-width:90vw;background:white;padding:10px;border-radius:12px}</style></head><body><div class="card"><h1>Escaneie o QR</h1><p>WhatsApp > Aparelhos conectados > Conectar aparelho</p><img src="${currentQRDataUrl}" alt="QR"><p>Não compartilhe este link.</p></div></body></html>`);
  });



  app.get('/pair', async (req, res) => {
    if (String(req.query.key || '') !== config.qrWebKey) return res.status(401).send('Chave inválida.');
    const codeView = currentPairCode ? currentPairCode.match(/.{1,4}/g).join('-') : '';
    res.type('html').send(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>Pair Code DARK System</title><style>body{font-family:system-ui;background:#08070b;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:#15101f;border:1px solid #6e46b8;border-radius:22px;padding:30px;text-align:center;max-width:680px;box-shadow:0 20px 70px #0008}.code{font-size:44px;letter-spacing:8px;font-weight:900;color:#44ff99;background:#09070d;border:1px dashed #44ff99;border-radius:16px;padding:18px;margin:20px 0}.muted{color:#bbb}code{background:#211832;padding:3px 7px;border-radius:8px}</style></head><body><div class="card"><h1>⚡ DARK System — Pair Code</h1><p>Número do bot: <b>+${config.pairingNumber}</b></p>${currentPairCode ? `<div class="code">${codeView}</div><p>Abra o WhatsApp do número do bot → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone/código e digite o código.</p>` : `<p class="muted">Nenhum código ativo. Se o bot já conectou, não precisa parear. Se ainda não conectou, aguarde o boot/reinício do Render.</p>`}<p class="muted">Atualiza automaticamente a cada 10s. Não compartilhe este link.</p></div></body></html>`);
  });

  app.get('/media/:id', (req, res) => {
    try {
      streamFile(req.params.id).pipe(res);
    } catch (err) {
      res.status(404).send(err.message);
    }
  });

  app.listen(config.port, () => console.log(`[HTTP] online na porta ${config.port}`));
}


async function requestPairCode() {
  if (!config.usePairingCode || !sock || sock.user || pairRequestInProgress) return;
  if (sock.authState?.creds?.registered) return;
  const number = config.onlyDigits(config.pairingNumber || config.botNumber);
  if (!number) return console.log('[PairCode] PAIRING_NUMBER/BOT_NUMBER inválido.');
  pairRequestInProgress = true;
  try {
    const raw = await sock.requestPairingCode(number);
    currentPairCode = String(raw || '').replace(/\s|-/g, '');
    currentPairNumber = number;
    pairRequestedAt = new Date();
    console.log(`
[DARK System] Código de pareamento para +${number}: ${currentPairCode.match(/.{1,4}/g).join('-')}`);
    if (config.publicBaseUrl) console.log(`[DARK System] Pair web: ${config.publicBaseUrl}/pair?key=${config.qrWebKey}`);
    console.log('[DARK System] No WhatsApp do número do bot: Aparelhos conectados > Conectar aparelho > Conectar com número/código.');
  } catch (err) {
    console.error('[PairCode] falha ao solicitar código:', err.message);
  } finally {
    pairRequestInProgress = false;
  }
}

async function startSock() {
  const { state, saveCreds } = await useMongoAuthState(mongoConnection);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: Browsers.macOS('DARK System'),
    logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true
  });

  sock.ev.on('creds.update', saveCreds);

  if (config.usePairingCode && !state.creds.registered) {
    setTimeout(requestPairCode, 2500);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !config.usePairingCode) {
      currentQR = qr;
      currentQRDataUrl = '';
      console.log('\n[DARK System] Escaneie o QR abaixo para conectar:');
      qrcodeTerminal.generate(qr, { small: true });
      if (config.publicBaseUrl) console.log(`[DARK System] QR web: ${config.publicBaseUrl}/qr?key=${config.qrWebKey}`);
    } else if (qr && config.usePairingCode && !currentPairCode) {
      setTimeout(requestPairCode, 1000);
    }

    if (connection === 'open') {
      currentQR = '';
      currentQRDataUrl = '';
      currentPairCode = '';
      pairRequestedAt = null;
      const jid = jidNormalizedUser(sock.user.id);
      console.log(`[WhatsApp] conectado como ${sock.user.name || jid} (${jid})`);
      const settings = await getSettings();
      if (!settings.ownerNumbers.includes(config.ownerNumber)) {
        settings.ownerNumbers.push(config.ownerNumber);
        await settings.save();
      }
      await sock.updateProfileStatus(settings.verifiedStatusText).catch(() => null);
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] conexão fechada. code=${statusCode} reconnect=${shouldReconnect}`);
      if (shouldReconnect) setTimeout(startSock, 3000);
      else console.log('[WhatsApp] sessão encerrada. Apague a coleção baileys_auth no MongoDB e conecte novamente se necessário.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) await handleMessage(sock, msg);
  });

  sock.ev.on('group-participants.update', async (ev) => {
    try {
      const group = await getGroup(ev.id, '');
      const settings = await getSettings();
      if (!group.enabled) return;
      const botMention = settings.botName || config.botName;
      for (const jid of ev.participants || []) {
        if (ev.action === 'add' && group.welcome) {
          await sock.sendMessage(ev.id, {
            text: `╔══════════════════════╗\n║ 👋 Bem-vindo(a)!\n╠══════════════════════╣\n║ ${jid.split('@')[0]} entrou no grupo.\n║ Eu sou ${botMention}.\n║ Use ${settings.prefixes?.[0] || '!'}menu para comandos.\n╚══════════════════════╝`,
            mentions: [jid]
          });
        }
        if (ev.action === 'remove' && group.goodbye) {
          await sock.sendMessage(ev.id, { text: `👋 ${jid.split('@')[0]} saiu do grupo.`, mentions: [jid] });
        }
      }
    } catch (err) {
      logger.warn(err, '[welcome] falhou');
    }
  });

  return sock;
}

async function main() {
  startedAt = new Date();
  mongoConnection = await connectDB();
  initMediaStore(mongoConnection);
  startHttp();
  await startSock();
}

process.on('unhandledRejection', (err) => logger.error(err, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error(err, 'uncaughtException'));

main().catch((err) => {
  console.error('[BOOT] erro fatal:', err);
  process.exit(1);
});
