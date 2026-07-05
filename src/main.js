/**
 * Sytem DARK - Main ULTIMATE PLUS v5.3.1 - PAIR CODE FIX
 * Dark Net
 */
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeCacheableSignalKeyStore, delay, Browsers } = require('@whiskeysockets/baileys');
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
let currentPairCode = null;
const seenMessages = new Set();

function cleanSession(sessionDir){
  try{
    if(fs.existsSync(sessionDir)){
      const files = fs.readdirSync(sessionDir);
      for(const f of files){
        try{ fs.unlinkSync(path.join(sessionDir, f)); }catch(_){}
      }
      console.log('🧹 [DARK] Sessão local limpa:', files.length, 'arquivos');
    }
    return true;
  }catch(e){
    console.error('Erro limpar sessão:', e.message);
    return false;
  }
}

async function startDark(isRetry=false){
  await db.init();

  // carrega prefixes globais do DB
  try{
    const savedPrefs = await db.getMeta('global_prefixes', null);
    if(Array.isArray(savedPrefs) && savedPrefs.length){
      cfg.bot.prefixes = savedPrefs;
      cfg.bot.prefix = savedPrefs[0] || '.';
      console.log('🔧 [DARK] Prefixos carregados do DB:', cfg.bot.prefixes.join(' '));
    }
  }catch(_){}

  const sessionDir = path.join(process.cwd(), cfg.system.sessionDir.replace('./',''));
  fs.mkdirSync(sessionDir, { recursive: true });

  // restore auth mongo
  const restored = await Auth.restoreAuth(db, cfg.system.authId, sessionDir);
  console.log(`📂 [DARK] Sessão: ${restored} arquivo(s) restaurado(s) do Mongo`);

  const backup = Auth.createBackup(db, cfg.system.authId, sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`🔧 Baileys v${version.join('.')} | isLatest: ${isLatest}`);
  console.log(`🔐 Registered: ${state.creds.registered ? 'SIM' : 'NÃO'}`);
  console.log(`📱 Bot Number: ${cfg.bot.botNumber}`);
  console.log(`👑 Owner: ${cfg.bot.ownerNumber} | LID: ${cfg.bot.ownerLid}`);

  // se creds corrompido e não registrado e sem arquivos, limpa
  const sessFiles = fs.existsSync(sessionDir) ? fs.readdirSync(sessionDir).filter(f=>f.endsWith('.json')) : [];
  if(!state.creds.registered && sessFiles.length===0){
    console.log('⚠️ [DARK] Sessão vazia detectada – aguardando Pair Code...');
  }

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    logger,
    printQRInTerminal: cfg.system.pairing.useQr ? true : false,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: true,
    getMessage: async () => undefined,
    defaultQueryTimeoutMs: cfg.system.timeouts.query,
    keepAliveIntervalMs: cfg.system.timeouts.ws,
    connectTimeoutMs: cfg.system.timeouts.connect
  });

  // ===== PAIR CODE ULTRA ROBUSTO =====
  const doPairing = async (attemptNum=1)=>{
    try{
      if(sock?.user || state.creds.registered){
        console.log('✅ Já registrado, pulando pair');
        return true;
      }
      let pairingNumber = String(cfg.system.pairing.number || cfg.bot.botNumber || '').replace(/\D/g,'');
      if(pairingNumber.startsWith('00')) pairingNumber = pairingNumber.slice(2);
      if(pairingNumber.startsWith('0') && pairingNumber.length > 10) pairingNumber = pairingNumber.slice(1);
      if(!pairingNumber || pairingNumber.length < 8){
        console.error('❌ PAIRING_NUMBER inválido:', pairingNumber);
        return false;
      }
      console.log(`\n╔════════════════════════════════════════╗`);
      console.log(`║     🌀 SYTEM DARK - PAIR CODE 🌀     ║`);
      console.log(`║  Tentativa ${attemptNum}/${cfg.system.pairing.attempts}                           ║`);
      console.log(`╚════════════════════════════════════════╝`);
      console.log(`📞 Número para parear: +${pairingNumber}`);
      console.log(`⏳ Solicitando código...`);

      // aguarda socket estar pronto e conectado ao servidor WS
      let waitWs = 0;
      while(!sock?.ws?.isOpen && waitWs < 15){
        await delay(1000);
        waitWs++;
      }
      await delay(2500);

      let code = await sock.requestPairingCode(pairingNumber);
      currentPairCode = code;
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
      console.log(`
╔══════════════════════════════════════════════════════════╗
║             🔑 CÓDIGO SYTEM DARK:  ${formatted.padEnd(14)}            ║
╠══════════════════════════════════════════════════════════╣
║  📱 Número alvo: +${pairingNumber.padEnd(39)}║
║                                                          ║
║  🚨 ATENÇÃO MÁXIMA AO NÚMERO ACIMA!                      ║
║  Se +${pairingNumber} NÃO for o NÚMERO DO SEU CHIP/BOT,  ║
║  o código NÃO vai funcionar no seu celular!              ║
║                                                          ║
║  👉 COMO CORRIGIR O NÚMERO NO RENDER:                    ║
║  1. No painel do Render, vá em "Environment" (Env Vars)  ║
║  2. Edite BOT_NUMBER e PAIRING_NUMBER para o SEU número  ║
║     (ex: 258835384817 ou 5511999999999 - com DDI e DDD)  ║
║  3. Salve e faça "Deploy latest commit"                  ║
║                                                          ║
║  👉 SE O NÚMERO ACIMA JÁ FOR O SEU CHIP:                 ║
║  1. Abra o WhatsApp NESSE celular                        ║
║  2. Aparelhos conectados > Conectar um aparelho          ║
║  3. Toque em "Conectar com número de telefone"           ║
║  4. Digite o código: ${formatted.replace(/-/g,'').padEnd(36)}║
╚══════════════════════════════════════════════════════════╝
`);
      pairTries = attemptNum;
      
      // se não conectar em 65s, renova o código automaticamente
      setTimeout(async ()=>{
        if(!sock?.user && !state.creds.registered && attemptNum < cfg.system.pairing.attempts){
          console.log('⏰ Código anterior expirou (60s). Gerando novo código...');
          doPairing(attemptNum + 1);
        }
      }, 65000);

      return true;
    }catch(e){
      console.error(`❌ Pair tentativa ${attemptNum} falhou:`, e.message);
      if(e?.output?.statusCode === 401 || /logged.?out|bad.?session|invalid/i.test(e.message)){
        console.log('🧹 Sessão inválida detectada – limpando...');
        cleanSession(sessionDir);
        // também limpa Mongo auth
        try{
          if(db.mode==='mongo' && db.cols.auth){
            await db.cols.auth.deleteMany({ authId: cfg.system.authId });
            console.log('🗑️ Auth Mongo limpo');
          }
        }catch(_){}
        console.log('🔄 Reiniciando em 3s para novo pair...');
        setTimeout(()=> { process.exit(1); }, 3000);
        return false;
      }
      if(attemptNum < cfg.system.pairing.attempts){
        console.log(`🔁 Nova tentativa em ${cfg.system.pairing.retryMs/1000}s...`);
        await delay(cfg.system.pairing.retryMs);
        return doPairing(attemptNum+1);
      } else {
        console.log(`
❌❌❌ PAIR CODE FALHOU APÓS ${cfg.system.pairing.attempts} TENTATIVAS ❌❌❌

SOLUÇÕES:
1. rm -rf data/session/*
2. Verifique se o número +${cfg.system.pairing.number} está correto
3. Use um número que NUNCA foi conectado antes, ou desconecte manualmente
4. Tente com USE_QR=true para QR Code
5. Reinicie: node index.js

Aguardando 30s e tentando limpar sessão automaticamente...
`);
        // auto-clean após falha total
        setTimeout(async ()=>{
          console.log('🧹 Auto-limpando sessão após falhas...');
          cleanSession(sessionDir);
          try{
            if(db.mode==='mongo') await db.cols.auth?.deleteMany({ authId: cfg.system.authId });
          }catch(_){}
          console.log('🔄 Restart forçado...');
          process.exit(2);
        }, 30000);
        return false;
      }
    }
  };

  if(cfg.system.pairing.enabled && !state.creds.registered){
    console.log('🔑 [PAIR] creds.registered = false → iniciando Pair Code em 4s...');
    setTimeout(()=> doPairing(1), 4000);
  } else if(state.creds.registered){
    console.log('✅ [PAIR] Sessão já registrada – conectando direto');
  }

  // creds update
  sock.ev.on('creds.update', async ()=>{
    await saveCreds();
    backup.debounce();
    console.log('💾 Creds atualizados');
  });

  // connection update
  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr && cfg.system.pairing.useQr){
      console.log('📸 QR Code gerado – escaneie se Pair Code falhar');
    }
    if(connection==='close'){
      const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
      const reason = DisconnectReason[statusCode] || statusCode || 'unknown';
      console.log(`❌ Conexão fechada: ${reason} (${statusCode})`);
      console.log('Erro completo:', lastDisconnect?.error?.message || lastDisconnect?.error);

      const dontReconnect = [
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        401, 403, 405, 411, 428, 440
      ];
      const shouldReconnect = !dontReconnect.includes(statusCode);

      if(!shouldReconnect){
        console.log('🔒 Sessão inválida / logout – LIMPANDO SESSÃO AUTOMATICAMENTE');
        cleanSession(sessionDir);
        try{
          if(db.mode==='mongo'){
            await db.cols.auth?.deleteMany({ authId: cfg.system.authId });
            console.log('🗑️ Mongo auth limpo após logout');
          }
        }catch(_){}
        console.log('🔄 Reiniciando em 5s para novo Pair Code...');
        setTimeout(()=> process.exit(3), 5000);
        return;
      }

      console.log('🔄 Reconectando Sytem DARK em 5s...');
      setTimeout(startDark, 5000);
    } else if(connection==='open'){
      console.log('');
      console.log('✅╔════════════════════════════════════╗');
      console.log('  ║                                    ║');
      console.log('  ║    🌌 SYTEM DARK ONLINE 🌌        ║');
      console.log('  ║                                    ║');
      console.log('  ║    Owner: Dark Net                 ║');
      console.log('  ║    v5.3 ULTIMATE PLUS              ║');
      console.log('  ║                                    ║');
      console.log('  ╚════════════════════════════════════╝');
      console.log('');
      pairTries = 0;
      currentPairCode = null;
      backup.now();

      // notify owner JID + LID
      const notifyMsg = `🌌 *SYTEM DARK ULTIMATE ONLINE* ✅

📱 Bot: +${cfg.bot.botNumber}
⏰ ${new Date().toLocaleString('pt-BR')}
🤖 ${cfg.bot.name} v${cfg.bot.version}
👑 ${cfg.bot.creator}
🆔 LID: ${cfg.bot.ownerLid}

⚡ Prefixos: ${cfg.bot.prefixes.join(' ')}
💾 DB: ${db.mode.toUpperCase()}
🔐 Pair: OK

✅ Pronto para uso 24/7!`;
      try{ await sock.sendMessage(cfg.bot.ownerJid, { text: notifyMsg }); console.log('📨 Notificação enviada para Owner JID'); }catch(e){ console.log('Falha notify JID:', e.message); }
      try{ await sock.sendMessage(cfg.bot.ownerLid, { text: notifyMsg }); console.log('📨 Notificação enviada para Owner LID'); }catch(e){ console.log('Info: LID notify falhou (normal se LID inválido):', e.message); }
    } else if(connection==='connecting'){
      console.log('🔌 Conectando Sytem DARK ULTIMATE PLUS...');
    }
  });

  // messages
  sock.ev.on('messages.upsert', async ({ messages, type })=>{
    if(type!=='notify') return;
    await Promise.allSettled(messages.map(async m=>{
      try{
        if(!m.message) return;
        const mid = m.key.id;
        if(mid && seenMessages.has(mid)) return;
        if(mid) seenMessages.add(mid);
        if(seenMessages.size>2000) seenMessages.clear();

        if(m.key.remoteJid === 'status@broadcast'){
          try{ await sock.readMessages([m.key]); }catch(_){}
          return;
        }

        const handled = await Manga.handleMangaButton(sock, m, db);
        if(handled) return;

        await routerHandle(sock, m, db);
      }catch(e){ console.error('msg err:', e.message); }
    }));
  });

  // participants
  sock.ev.on('group-participants.update', async ev=>{
    try{
      const gset = await db.getGroup(ev.id);
      const meta = await sock.groupMetadata(ev.id).catch(()=>null);
      const gname = meta?.subject || 'grupo';
      for(const p of ev.participants){
        if(ev.action==='add' && gset?.welcome){
          const txt = gset.welcomeMsg || `🌌 *SYTEM DARK WELCOME*\n\n👋 Bem-vindo @${p.split('@')[0]}!\n📣 Grupo: ${gname}\n\nDigite ${cfg.bot.prefixes[0]}menu\n\n${cfg.bot.style.footer}`;
          await sock.sendMessage(ev.id, { text: txt, mentions:[p] });
        } else if((ev.action==='remove'||ev.action==='kick') && gset?.bye){
          const txt = gset.byeMsg || `👋 @${p.split('@')[0]} saiu.\n${cfg.bot.style.footer}`;
          await sock.sendMessage(ev.id, { text: txt, mentions:[p] });
        }
      }
    }catch(_){}
  });

  // calls
  sock.ev.on('call', async (calls)=>{
    if(!cfg.features.antiCall) return;
    for(const c of calls){
      if(c.status==='offer'){
        try{
          await sock.rejectCall(c.id, c.from);
          await sock.sendMessage(c.from, { text:'🚫 *SYTEM DARK*\nChamadas bloqueadas.' });
          await delay(1000);
          await sock.updateBlockStatus(c.from, 'block');
        }catch(_){}
      }
    }
  });

  // expose pair code via sock for HTTP endpoint
  sock.getPairCode = ()=> currentPairCode;
  sock.doPairing = doPairing;
  sock.cleanSession = ()=> cleanSession(sessionDir);

  return sock;
}

// ===== HTTP SERVER =====
const app = express();
app.use(express.json());

app.get('/', (req,res)=> res.send(`
<h2>🌌 Sytem DARK ULTIMATE PLUS v5.3</h2>
<p><b>Owner:</b> Dark Net</p>
<p><b>LID:</b> 213907088089212@lid</p>
<p><b>Bot:</b> +${cfg.bot.botNumber}</p>
<p><b>Uptime:</b> ${Math.floor(process.uptime())}s</p>
<p><b>Pair Code:</b> ${sock?.getPairCode ? (sock.getPairCode() || 'aguardando / conectado') : 'iniciando...'}</p>
<hr>
<a href="/health">/health</a> | 
<a href="/db">/db</a> | 
<a href="/stats">/stats</a> | 
<a href="/paircode">/paircode</a> |
<a href="/cleansession">/cleansession (owner)</a>
`));

app.get('/health', (req,res)=> res.json({ 
  status:'online', 
  bot: cfg.bot.name, 
  version: cfg.bot.version,
  owner: cfg.bot.creator, 
  ownerLid: cfg.bot.ownerLid,
  uptime: process.uptime(), 
  prefixes: cfg.bot.prefixes,
  pairCode: sock?.getPairCode?.() || null,
  connected: !!sock?.user,
  db: db.status() 
}));

app.get('/db', async (req,res)=> res.json(await db.stats()));
app.get('/stats', async (req,res)=> res.json(await db.stats()));

app.get('/paircode', (req,res)=>{
  const code = sock?.getPairCode?.();
  res.json({ 
    pairing: !!code || !(sock?.user),
    code: code || null,
    formatted: code ? (code.match(/.{1,4}/g)?.join('-') || code) : null,
    number: cfg.system.pairing.number,
    instructions: 'WhatsApp > Aparelhos conectados > Conectar com número de telefone'
  });
});

// endpoint para forçar novo pair e limpar sessão
app.get('/cleansession', async (req,res)=>{
  const token = req.query.token;
  // token simples = OWNER_NUMBER
  if(token !== cfg.bot.ownerNumber && token !== 'darknet'){
    return res.status(403).json({ error:'unauthorized - use ?token=244945280380' });
  }
  try{
    const sessionDir = path.join(process.cwd(), cfg.system.sessionDir.replace('./',''));
    cleanSession(sessionDir);
    if(db.mode==='mongo'){
      await db.cols.auth?.deleteMany({ authId: cfg.system.authId });
    }
    res.json({ ok:true, message:'Sessão limpa. Reinicie o bot: pm2 restart / node index.js' });
    setTimeout(()=> process.exit(9), 2000);
  }catch(e){
    res.status(500).json({ error: e.message });
  }
});

app.get('/ping', (req,res)=> res.send('pong dark ultimate plus'));

app.listen(cfg.system.port, ()=> console.log(`🌐 [DARK-ULTIMATE-PLUS] Health :${cfg.system.port} | /paircode`));

// keepalive
if(cfg.system.keepAlive.url){
  setInterval(()=>{
    fetch(cfg.system.keepAlive.url + '/health').catch(()=>{});
    fetch(`http://localhost:${cfg.system.port}/health`).catch(()=>{});
  }, cfg.system.keepAlive.intervalMs);
  console.log('🔄 KeepAlive ativo:', cfg.system.keepAlive.url);
}

// watchdog
setInterval(()=>{
  if(!sock || !sock.user){
    console.log('⚡ Watchdog: socket offline | PairCode:', currentPairCode || 'nenhum');
  }
}, 45000);

startDark().catch(e=>{ console.error('FATAL:', e); process.exit(1); });

process.on('SIGINT', ()=>{ console.log('\n👋 Sytem DARK desligando...'); process.exit(0); });
process.on('SIGTERM', ()=> process.exit(0));
process.on('uncaughtException', e=> console.error('uncaught:', e.message));
process.on('unhandledRejection', e=> console.error('unhandled:', e?.message||e));
