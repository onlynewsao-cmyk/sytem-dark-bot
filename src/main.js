/**
 * Sytem DARK - Main ULTIMATE v5
 * Dark Net
 */
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');
const path = require('path');

const cfg = require('./config');
const DarkDB = require('./core/database');
const Auth = require('./core/auth');
const { handle: routerHandle } = require('./handlers/router');
const Manga = require('./modules/manga');
const U = require('./lib/utils');

const logger = pino({ level: 'silent' });
const db = new DarkDB(cfg);

let sock = null;
let pairTries = 0;
const seenMessages = new Set();

async function startDark(){
  await db.init();

  const sessionDir = path.join(process.cwd(), cfg.system.sessionDir.replace('./',''));
  fs.mkdirSync(sessionDir, { recursive: true });

  // restore auth mongo
  await Auth.restoreAuth(db, cfg.system.authId, sessionDir);
  const backup = Auth.createBackup(db, cfg.system.authId, sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    printQRInTerminal: false,
    browser: ['Sytem DARK', 'Chrome', '5.0'],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    getMessage: async () => undefined,
    defaultQueryTimeoutMs: cfg.system.timeouts.query,
    keepAliveIntervalMs: cfg.system.timeouts.ws,
    connectTimeoutMs: cfg.system.timeouts.connect
  });

  // pair code
  if(cfg.system.pairing.enabled && !sock.authState.creds.registered){
    const pairingNumber = (cfg.system.pairing.number || cfg.bot.botNumber).replace(/\D/g,'');
    setTimeout(async ()=>{
      if(sock.authState.creds.registered) return;
      try{
        console.log('\n🌀 SYTEM DARK ULTIMATE - PAIR CODE 🌀');
        let code = await sock.requestPairingCode(pairingNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log('════════════════════════════════════');
        console.log('  CÓDIGO:', code);
        console.log('  NÚMERO:', pairingNumber);
        console.log('  WhatsApp > Aparelhos conectados > Conectar com número');
        console.log('════════════════════════════════════\n');
        pairTries = 1;
      }catch(e){
        console.error('Pair error:', e.message);
        const retry = async ()=>{
          if(pairTries >= cfg.system.pairing.attempts) return;
          if(sock?.authState?.creds?.registered) return;
          pairTries++;
          await delay(cfg.system.pairing.retryMs);
          try{
            let code = await sock.requestPairingCode(pairingNumber);
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n🔁 Tentativa ${pairTries} - CÓDIGO: ${code}\n`);
          }catch(err){ console.log('Retry pair falhou:', err.message); retry(); }
        };
        retry();
      }
    }, 3500);
  }

  sock.ev.on('creds.update', async ()=>{
    await saveCreds();
    backup.debounce();
  });

  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect } = update;
    if(connection==='close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      const reason = DisconnectReason[code] || code;
      console.log('❌ Conexão fechada:', reason, code);
      const shouldReconnect = code !== DisconnectReason.loggedOut && code !== 401 && code !== 403;
      if(shouldReconnect){
        console.log('🔄 Reconectando em 5s...');
        setTimeout(startDark, 5000);
      } else {
        console.log('🔒 Logout detectado. Apague a sessão e pareie novamente.');
      }
    } else if(connection==='open'){
      console.log('✅╔════════════════════════════════╗');
      console.log('  ║   SYTEM DARK ULTIMATE ONLINE  ║');
      console.log('  ║   Owner: Dark Net             ║');
      console.log('  ║   v5.0 ULTIMATE               ║');
      console.log('  ╚════════════════════════════════╝');
      pairTries = 0;
      backup.now();
      // notify owner JID + LID
      const notifyMsg = `🌌 *SYTEM DARK ULTIMATE ONLINE*\n\n✅ Bot conectado com sucesso!\n📱 ${cfg.bot.botNumber}\n⏰ ${new Date().toLocaleString('pt-BR')}\n\n🤖 ${cfg.bot.name} v${cfg.bot.version}\n👑 ${cfg.bot.creator}\n🆔 LID: ${cfg.bot.ownerLid}\n\n⚡ Multi-prefix: ${cfg.bot.prefixes.join(' ')}\n💎 VIP / Hosting ativo`;
      try{ await sock.sendMessage(cfg.bot.ownerJid, { text: notifyMsg }); }catch(_){}
      try{ await sock.sendMessage(cfg.bot.ownerLid, { text: notifyMsg }); }catch(_){}
    } else if(connection==='connecting'){
      console.log('🔌 Conectando Sytem DARK ULTIMATE...');
    }
  });

  // simultaneous messages + antiStatus
  sock.ev.on('messages.upsert', async ({ messages, type })=>{
    if(type!=='notify') return;
    try{
      await Promise.allSettled(messages.map(async m=>{
        try{
          if(!m.message) return;
          const mid = m.key.id;
          if(mid && seenMessages.has(mid)) return;
          if(mid) seenMessages.add(mid);
          if(seenMessages.size>2000){ seenMessages.clear(); }

          // antiStatus - status@broadcast
          if(m.key.remoteJid === 'status@broadcast'){
            // check if any group has antiStatus enabled? global delete?
            // For now, just ignore / read
            try{ await sock.readMessages([m.key]); }catch(_){}
            // optionally delete status? not possible globally
            return;
          }

          // manga button intercept first
          const handled = await Manga.handleMangaButton(sock, m, db);
          if(handled) return;

          await routerHandle(sock, m, db);
        }catch(e){ console.error('msg err:', e.message); }
      }));
    }catch(e){}
  });

  // group participants welcome / despedida ULTIMATE
  sock.ev.on('group-participants.update', async ev=>{
    try{
      const gset = await db.getGroup(ev.id);
      const meta = await sock.groupMetadata(ev.id).catch(()=>null);
      const gname = meta?.subject || 'grupo';
      for(const p of ev.participants){
        if(ev.action==='add'){
          if(gset?.welcome){
            const custom = gset.welcomeMsg || '';
            const txt = custom || `🌌 *SYTEM DARK WELCOME*\n\n👋 Bem-vindo @${p.split('@')[0]}!\n📣 Grupo: ${gname}\n\nDigite ${cfg.bot.prefixes[0]}menu\n\n${cfg.bot.style.footer}`;
            await sock.sendMessage(ev.id, { text: txt, mentions:[p] });
          }
        } else if(ev.action==='remove' || ev.action==='kick'){
          if(gset?.bye){
            const custom = gset.byeMsg || '';
            const txt = custom || `👋 @${p.split('@')[0]} saiu do grupo.\n\n${cfg.bot.style.footer}`;
            await sock.sendMessage(ev.id, { text: txt, mentions:[p] });
          }
        } else if(ev.action==='promote'){
          await sock.sendMessage(ev.id, { text:`👑 @${p.split('@')[0]} agora é ADMIN!\n\n${cfg.bot.style.footer}`, mentions:[p] });
        } else if(ev.action==='demote'){
          await sock.sendMessage(ev.id, { text:`📉 @${p.split('@')[0]} não é mais admin.`, mentions:[p] });
        }
      }
    }catch(_){}
  });

  // anti call + anti status mention
  sock.ev.on('call', async (calls)=>{
    if(!cfg.features.antiCall) return;
    for(const c of calls){
      if(c.status==='offer'){
        try{
          await sock.rejectCall(c.id, c.from);
          await sock.sendMessage(c.from, { text:'🚫 *SYTEM DARK ULTIMATE*\nChamadas não são permitidas.\nVocê foi bloqueado automaticamente.' });
          await delay(1200);
          await sock.updateBlockStatus(c.from, 'block');
        }catch(_){}
      }
    }
  });

  // messages update - anti delete? placeholder
  sock.ev.on('messages.update', async updates=>{
    // future: anti delete status
  });

  return sock;
}

// HTTP keep alive ULTIMATE
const app = express();
app.use(express.json());
app.get('/', (req,res)=> res.send(`<h2>🌌 Sytem DARK ULTIMATE v5</h2><p>Owner: Dark Net</p><p>LID: 213907088089212@lid</p><p>Bot: ${cfg.bot.botNumber}</p><p>Uptime: ${Math.floor(process.uptime())}s</p><p><a href="/health">/health</a> | <a href="/db">/db</a> | <a href="/stats">/stats</a></p>`));
app.get('/health', (req,res)=> res.json({ status:'online', bot: cfg.bot.name, version: cfg.bot.version, owner: cfg.bot.creator, ownerLid: cfg.bot.ownerLid, uptime: process.uptime(), prefixes: cfg.bot.prefixes, db: db.status() }));
app.get('/db', async (req,res)=> res.json(await db.stats()));
app.get('/stats', async (req,res)=> res.json(await db.stats()));
app.get('/ping', (req,res)=> res.send('pong dark'));
app.listen(cfg.system.port, ()=> console.log(`🌐 [DARK-ULTIMATE] Health server :${cfg.system.port}`));

// keepalive ping
if(cfg.system.keepAlive.url){
  setInterval(()=>{
    fetch(cfg.system.keepAlive.url + '/health').catch(()=>{});
    // self ping
    fetch(`http://localhost:${cfg.system.port}/health`).catch(()=>{});
  }, cfg.system.keepAlive.intervalMs);
  console.log('🔄 KeepAlive ULTIMATE ativo:', cfg.system.keepAlive.url);
}

// fast reconnect watchdog
setInterval(()=>{
  if(!sock || !sock.user){
    console.log('⚡ Watchdog: socket offline');
  }
}, 60000);

startDark().catch(e=>{ console.error(e); process.exit(1); });

process.on('SIGINT', ()=>{ console.log('\n👋 Sytem DARK ULTIMATE desligando...'); process.exit(0); });
process.on('SIGTERM', ()=> process.exit(0));
process.on('uncaughtException', e=> console.error('uncaught:', e.message));
process.on('unhandledRejection', e=> console.error('unhandled:', e?.message||e));
