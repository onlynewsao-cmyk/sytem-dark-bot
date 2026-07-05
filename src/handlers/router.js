/**
 * Sytem DARK - Command Router v5 ULTIMATE
 * Dark Net - 1000+ features ready
 */
const cfg = require('../config');
const { sendDark, sendButtons, sendList, sendImage, wrap, S } = require('../lib/msg');
const U = require('../lib/utils');
const Dl = require('../modules/downloads');
const AI = require('../modules/ai');
const Manga = require('../modules/manga');
const axios = require('axios');

const prefixes = cfg.bot.prefixes || [cfg.bot.prefix];

function isOwner(jid){
  return U.isOwnerFull(jid, cfg);
}

async function checkHosting(sock, jid, msg, db, gset){
  if(!cfg.hosting.required) return true;
  if(!jid.endsWith('@g.us')) return true;
  if(isOwner(msg.key.participant||jid)) return true;
  // check hosted
  try{
    const hosted = gset?.hosted || await db.isHosted(jid);
    if(hosted) return true;
    // also vip group?
    if(gset?.vip) return true;
  }catch(_){}
  await sock.sendMessage(jid, { text: `🚫 *SYTEM DARK - HOSPEDAGEM*\n\n${cfg.hosting.warning}\n\n📞 Dono: @${cfg.bot.ownerNumber}\n💎 Planos VIP: 20d / 30d / premium\n\nUse: ${prefixes[0]}invokedono`, mentions:[cfg.bot.ownerJid] }, { quoted: msg });
  return false;
}

// foragido words
const FORAGIDO_WORDS = ['foragido','procurado','fugitivo','policia','pf','interpol','captura','recompensa','wanted','procura-se','forajido','forajido da lei'];
function isForagidoText(t){
  if(!t) return false;
  t=t.toLowerCase();
  return FORAGIDO_WORDS.some(w=> t.includes(w));
}

async function handle(sock, msg, db){
  const jid = msg.key.remoteJid;
  const isGroup = jid.endsWith('@g.us');
  const sender = isGroup ? (msg.key.participant || msg.participant || jid) : jid;
  const senderLid = msg.key.participantPn || sender;

  // === BUTTON / INTERACTIVE EXTRACT ULTIMATE ===
  let body = U.extractText(msg) || '';
  // button response ids
  const btnId = U.extractButtonId ? U.extractButtonId(msg) : (
    msg.message?.buttonsResponseMessage?.selectedButtonId ||
    msg.message?.templateButtonReplyMessage?.selectedId ||
    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    (()=>{ try{ const p = msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson; if(p){ const j=JSON.parse(p); return j.id || j.selectedId || j?.selected_row_id || ''; } }catch(_){} return ''; })() ||
    ''
  );
  if(btnId) body = btnId;
  // if still empty, try conversation
  if(!body) {
    const m = U.unwrapMessage ? U.unwrapMessage(msg) : msg.message;
    body = m?.conversation || '';
  }

  const lowerBody = body.toLowerCase().trim();

  // respond to "prefixo" word
  if(['prefixo','prefix','pref','qual prefixo'].includes(lowerBody)){
    return sock.sendMessage(jid, { text: `🌀 *PREFIXOS SYTEM DARK*\n\n${prefixes.map(p=>p?`• \`${p}\``:'• sem prefixo').join('\n')}\n\nPrincipal: \`${prefixes[0]}\`\n\n${S.footer}` }, { quoted: msg });
  }

  // FORAGIDO DETECTOR
  if(isForagidoText(body)){
    try{
      const isPro = await db.isProcurado(sender).catch(()=>false);
      // always attack if word detected
      let mentions = [];
      if(isGroup){
        try{ const meta = await sock.groupMetadata(jid); mentions = meta.participants.map(p=>p.id).slice(0,50); }catch(_){}
      }
      const attacked = `🚨 *FORAGIDO DETECTADO - SYTEM DARK* 🚨\n\n👤 Suspeito: @${sender.split('@')[0]}\n📍 Local: ${isGroup?'GRUPO': 'PV'}\n⚖️ Status: ${isPro ? 'PROCURADO CONFIRMADO' : 'EM ANÁLISE'}\n💰 Recompensa: ${isPro ? '5.000 coins' : 'Verificando...'}\n\n🔒 *AÇÃO DARK ATIVADA*\n${mentions.map(m=>'@'+m.split('@')[0]).join(' ')}\n\n🌌 *Sytem DARK Polícia Virtual*\n👑 Dark Net`;
      await sock.sendMessage(jid, { text: attacked, mentions: [sender, ...mentions] }, { quoted: msg });
      // if procurado, auto add warn?
    }catch(_){}
    // continue processing command too
  }

  // group settings
  let gset = null;
  let participants = [];
  let botAdmin = false;
  let userAdmin = false;
  if(isGroup){
    gset = await db.getGroup(jid);
    try{
      const meta = await sock.groupMetadata(jid);
      participants = meta.participants || [];
      botAdmin = U.isBotAdmin(sock, participants);
      userAdmin = U.isAdmin(participants, sender) || isOwner(sender) || U.sameJid(sender, cfg.bot.ownerLid);
    }catch(_){}
    // anti spam
    if(cfg.features.antiSpam && gset?.antiSpam){
      const spam = U.checkSpam(sender, cfg.limits.antiSpam);
      if(spam.spam){
        if(spam.justBanned){
          await sock.sendMessage(jid, { text: `🚫 @${sender.split('@')[0]} anti-spam ativado! Ban temporário 60s`, mentions:[sender] });
          // temp mute?
          if(!gset.mutados.includes(sender)){
            gset.mutados.push(sender);
            await db.saveGroup(jid, gset);
            setTimeout(async ()=>{
              const gg = await db.getGroup(jid);
              gg.mutados = (gg.mutados||[]).filter(x=>x!==sender);
              await db.saveGroup(jid, gg);
            }, cfg.limits.antiSpam.banMs);
          }
        }
        try{ await sock.sendMessage(jid, { delete: msg.key }); }catch(_){}
        return;
      }
    }
    // pre-moderation existing
    if(gset?.mutados?.includes(sender) && !userAdmin){
      try{ await sock.sendMessage(jid,{ delete: msg.key }); }catch(_){}
      return;
    }
    // anti pagamento / pix
    if(gset?.antiPay && !userAdmin){
      const payWords = ['pix','pagamento','pagar','chave pix','qr code',' qrcode','boleto','transferencia','paypal','pagou','valor',' r$','00,','reais','\u0024'];
      const low = body.toLowerCase();
      if(payWords.some(w=> low.includes(w))){
        try{ await sock.sendMessage(jid,{ delete: msg.key }); }catch(_){}
        await sock.sendMessage(jid, { text:`💰 @${sender.split('@')[0]} mensagem de pagamento detectada e removida!\n\nAntiPix ativo • Sytem DARK`, mentions:[sender] });
        // avisar donos
        try{ await sock.sendMessage(cfg.bot.ownerJid, { text:`💸 AntiPix acionado\nGrupo: ${jid}\nUser: @${sender.split('@')[0]}\nMsg: ${body.slice(0,120)}`, mentions:[sender]}); }catch(_){}
        return;
      }
    }
    // anti menção status
    if(gset?.antiMentionStatus && !userAdmin){
      // detecta se mensagem menciona muita gente (status forward)
      const mentioned = U.extractMentioned(msg);
      if(mentioned && mentioned.length > 5){
        try{ await sock.sendMessage(jid,{ delete: msg.key }); }catch(_){}
        await sock.sendMessage(jid, { text:`🚫 AntiMencaoStatus: @${sender.split('@')[0]} menção em massa bloqueada`, mentions:[sender] });
        return;
      }
    }
  }

  const parsed = U.parseCmdMulti(body, prefixes);
  if(!parsed){
    return;
  }
  const { cmd, args, text, prefix } = parsed;
  const pfx = prefix || prefixes[0];
  if(!cmd) return;

  // helper
  const reply = (t,b)=> sendDark(sock, jid, t, b, msg);
  const needAdmin = async()=>{
    if(!isGroup) { await reply('ERRO','Só em grupos'); return true; }
    if(!userAdmin){ 
      await reply('SEM PERMISSÃO','Apenas admins');
      // if admin tried but bot not admin
      if(!botAdmin){
        await U.sleep(800);
        await sock.sendMessage(jid, { text: `⚠️ Para usar o Sytem DARK 100%:\n\n1️⃣ Adicione o bot como *ADMIN*\n2️⃣ Dê permissões completas\n\n🤖 Bot atual: ${botAdmin?'✅ ADMIN':'❌ MEMBRO'}\n\n👑 Dono: @${cfg.bot.ownerNumber}\n${S.footer}`, mentions:[cfg.bot.ownerJid] }, { quoted: msg });
      }
      return true; 
    }
    // admin usando mas bot não é admin -> avisa
    if(userAdmin && !botAdmin){
      await sock.sendMessage(jid, { text: `⚡ @${sender.split('@')[0]} você é ADM, mas eu preciso ser ADM para executar!\n\n🔧 Me promova a administrador para liberar 100% dos recursos Sytem DARK.\n\n${S.footer}`, mentions:[sender] }, { quoted: msg });
      return true;
    }
    return false;
  };
  const needBotAdmin = async()=>{
    if(!botAdmin){ await reply('BOT NÃO É ADMIN','Preciso ser admin\n\n👉 Promova o Sytem DARK para usar 100%'); return true; }
    return false;
  };
  const needHost = async()=>{
    const ok = await checkHosting(sock, jid, msg, db, gset);
    return !ok;
  };

  // increment user command count
  try{ const u = await db.getUser(sender); u.commands=(u.commands||0)+1; await db.saveUser(sender,u);}catch(_){}

  // ================= MENU SYSTEM =================
  if(['menu','help','start','sytem','dark','comandos'].includes(cmd)){
    const timeStr = new Date().toLocaleTimeString('pt-BR', { timeZone: 'Africa/Luanda' });
    const menuTxt = `|~---✨---✨---✨---✨---✨---✨---|
|      🌌 SYTEM DARK BOT 🌌      |
|___✨___✨___✨___✨___✨___✨___|
|  *   *   *
|~---✨---✨---✨---✨---✨---✨---|
|| 🌌 .° NOME: ❄️SYTEM-DARK v5.3
|| 🌌 .° USER: DARK|NET
|| 🌌 .° PREFIXO: ${pfx}
|| 🌌 .° HORARIO: ${timeStr}
|___✨___✨___✨___✨___✨___✨___|
❄️SYTEM-DARK v5.3`;
    await sendButtons(sock, jid, menuTxt, [
      { id: `${pfx}menulista`, text: '📋 MENU' },
      { type:'url', text:'↗️ NODE.JS POCKET', url:'https://github.com/onlynewsao-cmyk/sytem-dark-bot', id:'repo' }
    ], '❄️SYTEM-DARK v5.3 • DARK|NET', msg);
    return;
  }

  if(['menulista','menuprincipal','menucompleto'].includes(cmd)){
    const sections = [
      { title:'MENUS DIVERSOS', rows:[
        { title:'MENU-PRINCIPAL', rowId:`${pfx}menu`, description:'_comandos principais e..._' },
        { title:'MENU-DOWNLOADS', rowId:`${pfx}downloads`, description:'_comandos de dowload e criação._' },
        { title:'MENU-BRINCAFEIRAS', rowId:`${pfx}menudiversao`, description:'_comando de diversão e zoeras para gr..._' },
        { title:'MENU-COINS', rowId:`${pfx}vip`, description:'_comando de coin, Aventura e diversão_' },
        { title:'MENU-ALTERADORES', rowId:`${pfx}menuia`, description:'_comando de edição de música e alter..._' },
        { title:'MENU-LOGOS', rowId:`${pfx}pinterest`, description:'_comando de logo criação de imagem_' },
        { title:'MENU+18', rowId:`${pfx}manga one piece`, description:'_comando para adultos só vips tem ac..._' },
        { title:'MENU-ADM', rowId:`${pfx}menugrupo`, description:'_comandos pará grupo só adm tem ac..._' },
        { title:'MENU-DONO', rowId:`${pfx}invokedono`, description:'_apenas dono_' }
      ]},
      { title:'FUNÇÕES EXTRAS', rows:[
        { title:'CRIADOR', rowId:`owner`, description:'_informações do criado..._' },
        { title:'PERFIL', rowId:`${pfx}ping`, description:'_comandos de dados do usuário_' },
        { title:'PING / INFO', rowId:`${pfx}dbstatus`, description:'_informação do bot_' },
        { title:'DONOS', rowId:`${pfx}invokedono`, description:'_lista de dono e de sub donos_' },
        { title:'ALUGAR BOT', rowId:`${pfx}vip`, description:'_informações de planos de aluguel do ..._' }
      ]}
    ];
    return sendList(sock, jid, 'MENU', 'Selecione uma categoria abaixo:', sections, 'Selecionar', msg);
  }

  // submenus
  if(cmd==='menuia' || cmd==='ia'){
    return reply('IA SYTEM DARK ULTIMATE',
`${pfx}copilot <pergunta> - IA GPT-5
${pfx}nano <prompt> - Edita imagem
${pfx}addai - Adiciona Meta AI
${pfx}ttkstalk <user> - Stalk TikTok
${pfx}gemini <txt> - Gemini AI`);
  }
  if(cmd==='downloads' || cmd==='dl'){
    return reply('DOWNLOADS ULTIMATE',
`${pfx}play <nome>
${pfx}ytmp4 <url> - 1080p
${pfx}tiktok <url>
${pfx}instagram <url>
${pfx}pinterest <termo>
${pfx}pin <url>
${pfx}mediafire <url>
${pfx}apk <nome>
${pfx}ytsearch <termo>`);
  }
  if(cmd==='menugrupo'){
    return reply('GRUPO ULTIMATE',
`${pfx}ban @
${pfx}tempban @ 10m
${pfx}promover @ / ${pfx}rebaixar @
${pfx}marcar / ${pfx}hidetag <msg>
${pfx}add <numero>
${pfx}fechargrupo / ${pfx}abrirgrupo
${pfx}antilink on/hard/off
${pfx}antistatus on/off
${pfx}antimencao on/off
${pfx}antispam on/off
${pfx}welcome on/off
${pfx}despedida on/off
${pfx}statusgp <texto>
${pfx}infogrupo`);
  }
  if(cmd==='menudiversao' || cmd==='interacoes'){
    return reply('INTERAÇÕES DARK',
`${pfx}abraço @
${pfx}beijo @
${pfx}tapa @
${pfx}soco @
${pfx}matar @
${pfx}cafune @
${pfx}ship @ @
${pfx}gay @
${pfx}chance <txt>
${pfx}chance100 <txt>
${pfx}dado / ${pfx}moeda`);
  }

  // ========== IA ==========
  if(cmd==='copilot'){
    if(!text) return reply('COPILOT', `cade a pergunta?\nExemplo: *${pfx}copilot Qual a capital do Brasil?*`);
    if(await needHost()) return;
    await sock.sendMessage(jid, { react:{ text:'👀', key: msg.key }});
    try{
      const res = await AI.copilot(text);
      await sock.sendMessage(jid, { react:{ text:'✅', key: msg.key }});
      return sendDark(sock, jid, 'COPILOT DARK', res, msg);
    }catch(e){
      await sock.sendMessage(jid, { react:{ text:'💔', key: msg.key }});
      return reply('ERRO', 'Erro ao consultar o Copilot.');
    }
  }
  // === IA ULTIMATE: copilot / gemini / grok / systemzero ===
  // === IA ULTIMATE PLUS ===
  if(cmd==='gemini'){
    if(!text) return reply('GEMINI','Use: '+pfx+'gemini sua pergunta');
    if(await needHost()) return;
    try{
      await sock.sendMessage(jid, { react:{ text:'✨', key: msg.key }});
      const out = await AI.gemini(text);
      await sock.sendMessage(jid, { react:{ text:'✅', key: msg.key }});
      return sendDark(sock, jid, 'GEMINI DARK', out || 'Sem resposta', msg);
    }catch(e){ await sock.sendMessage(jid, { react:{ text:'💔', key: msg.key }}); return reply('ERRO GEMINI', e.message); }
  }

  if(cmd==='grok' || cmd==='grokai'){
    if(!text) return reply('GROK','Use: '+pfx+'grok pergunta');
    if(await needHost()) return;
    try{
      await sock.sendMessage(jid, { react:{ text:'🚀', key: msg.key }});
      const out = await AI.grok(text);
      await sock.sendMessage(jid, { react:{ text:'✅', key: msg.key }});
      return sendDark(sock, jid, 'GROK DARK', out, msg);
    }catch(e){ await sock.sendMessage(jid, { react:{ text:'💔', key: msg.key }}); return reply('ERRO GROK', e.message); }
  }

  if(['sytemzero','szia','zeroai','systemzero'].includes(cmd)){
    if(!text) return reply('SYSTEM ZERO','Use: '+pfx+'sytemzero pergunta');
    try{
      await sock.sendMessage(jid, { react:{ text:'⚡', key: msg.key }});
      const res = await AI.systemZero(text);
      await sock.sendMessage(jid, { react:{ text:'✅', key: msg.key }});
      return sendDark(sock, jid, 'SYSTEM ZERO • DARK NET', res, msg);
    }catch(e){ return reply('ERRO', e.message); }
  }

  if(cmd==='addai' || cmd==='metaai'){
    if(!isGroup) return reply('ERRO','Só em grupos');
    if(await needBotAdmin()) return;
    const ok = await AI.addMetaAI(sock, jid);
    return reply(ok ? 'META AI':'ERRO', ok ? '✅ ᴍᴇᴛᴀ ᴀɪ ꜰᴏɪ ᴀᴅɪᴄɪᴏɴᴀᴅᴀ ᴀᴏ ɢʀᴜᴘᴏ ᴄᴏᴍ sᴜᴄᴇssᴏ.' : '❌ ɴãᴏ ꜰᴏɪ ᴘᴏssíᴠᴇʟ ᴀᴅɪᴄɪᴏɴᴀʀ ᴀ ᴍᴇᴛᴀ ᴀɪ ᴀᴏ ɢʀᴜᴘᴏ.');
  }
  if(cmd==='nano' || cmd==='deepedit'){
    if(await needHost()) return;
    const prompt = text || 'enhance quality, dark style';
    const buf = await U.downloadQuoted(sock, msg);
    if(!buf) return reply('NANO','Responda a uma imagem com o prompt desejado.\nExemplo: *'+pfx+'nano transforme em anime*');
    await sock.sendMessage(jid, { react:{ text:'⏳', key: msg.key }});
    try{
      const url = await AI.nanoEdit(buf, prompt);
      await sock.sendMessage(jid, { react:{ text:'✅', key: msg.key }});
      if(url && url.startsWith('http')){
        const img = await U.getBuffer(url);
        return sendImage(sock, jid, img, `╔━᳀『 *DEEP EDIT* 』═᳀\n⌬ *Prompt:* ${prompt}\n╚━═━═━═━═━═━═━═━═━═᳀`, msg);
      }
      return reply('NANO', String(url).slice(0,1000));
    }catch(e){
      await sock.sendMessage(jid, { react:{ text:'❌', key: msg.key }});
      return reply('ERRO NANO', `_Erro ao processar a imagem:_ ${e?.message || 'Tente novamente.'}`);
    }
  }
  if(['ttkstalk','tiktokstalk','ttstalk'].includes(cmd)){
    const user = (args[0]||'').replace('@','');
    if(!user) return reply('TTKSTALK','exempro: .ttkstalk neymar');
    await reply('TTKSTALK', 'Consultando perfil');
    try{
      const d = await Dl.tiktokStalk(user);
      if(!d || (!d.status && !d.username)) return reply('TTKSTALK', 'Usuário não encontrado.');
      const segs = d.estatisticas?.seguidores || d.followers || 0;
      const seguindo = d.estatisticas?.seguindo || d.following || 0;
      const likes = d.estatisticas?.likes || d.likes || 0;
      const videos = d.estatisticas?.videos || d.videos || 0;
      const priv = d.privado !== undefined ? d.privado : (d.private ? 'Sim' : 'Não');
      const verif = d.verificado !== undefined ? d.verificado : (d.verified ? 'Sim' : 'Não');
      const txt = `
👤 ${d.nickname||''} (@${d.username||user})

📝 ${d.bio||'-'}

---
🔒 Privado: ${priv}
✔️ Verificado: ${verif}

👥 Seguidores: ${segs}
➡️ Seguindo: ${seguindo}
❤️ Likes: ${likes}
📽️ Videos: ${videos}

🔗 ${d.link || `https://tiktok.com/@${user}`}
`.trim();
      const avatar = d.avatar || d.avatarThumb || d.image;
      if(avatar) return sendImage(sock, jid, avatar, txt, msg);
      return reply('TTKSTALK', txt);
    }catch(e){ return reply('TTKSTALK', 'Erro ao consultar API.'); }
  }

  // ========== MANGA ==========
  if(['manga','mangá','ler','capitulo'].includes(cmd)){
    if(await needHost()) return;
    const nome = text;
    if(!nome) return reply('MANGÁ','Use: '+pfx+'manga nome do mangá\nEx: '+pfx+'manga one piece');
    try{
      await reply('MANGÁ','Buscando capítulos...');
      await Manga.sendMangaMenu(sock, jid, nome, msg);
    }catch(e){ return reply('ERRO MANGÁ', e.message); }
    return;
  }

  // ========== DOWNLOADS ULTIMATE ==========
  if(['play','ytmp3','song','music','mp3'].includes(cmd)){
    const q = text;
    if(!q) return reply('PLAY','Use: '+pfx+'play nome da música');
    try{
      await reply('PLAY','Buscando música Dark...');
      const vids = await Dl.searchYoutube(q);
      const vid = vids[0];
      if(!vid) return reply('NÃO ENCONTRADO','Nada encontrado');
      await sock.sendMessage(jid,{ text:`🎵 Baixando áudio: ${vid.title}\n⏱️ ${vid.timestamp}\n\n${S.footer}` }, { quoted: msg });
      const audioRes = await Dl.szYtmp3(vid.url);
      const audioUrl = typeof audioRes === 'string' ? audioRes : (audioRes?.url || audioRes?.download_url || audioRes?.audio);
      if (audioUrl && audioUrl.startsWith('http')) {
        await sock.sendMessage(jid, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${vid.title}.mp3` }, { quoted: msg });
      } else {
        return reply('PLAY INFO', `${vid.title}\n${vid.url}\n\nUse ${pfx}ytmp4 para vídeo 1080p.`);
      }
    }catch(e){ return reply('ERRO', e.message); }
  }
  if(['ytmp4','ytplay4','video'].includes(cmd)){
    if(await needHost()) return;
    const url = args[0];
    if(!url) return reply('YTMP4', `Informe uma url do YouTube.\n\nExemplo:\n${pfx}ytmp4 https://youtu.be/TxfFHeQkb7k`);
    await reply('DOWNLOAD', 'Baixando seu vídeo mn...');
    try{
      const res = await Dl.ytmp4(url);
      if(!res?.status && !res?.url) return reply('YTMP4', 'Não foi possível baixar este vídeo.');
      await sock.sendMessage(jid, {
        video: { url: res.url },
        mimetype: 'video/mp4',
        caption: `🎬 *${res.title}*\n\n• *Duração:* ${res.duration}\n• *Qualidade:* ${res.quality}\n• *Tamanho:* ${res.size}`,
        gifPlayback: false
      }, { quoted: msg });
    }catch(e){ return reply('YTMP4', 'Ocorreu um erro ao baixar o vídeo.'); }
  }
  if(['tiktok','tt','tiktokdl'].includes(cmd)){
    const url = args[0];
    if(!url || !url.includes('tiktok')) return reply('TIKTOK','Use: '+pfx+'tiktok <url>');
    try{
      const d = await Dl.tiktokDl(url);
      if(!d?.video) return reply('ERRO','Não consegui baixar');
      await sock.sendMessage(jid, { video:{ url:d.video }, caption:`🎵 TikTok • Sytem DARK\n\n${S.footer}` }, { quoted: msg });
    }catch(e){ return reply('ERRO', e.message); }
  }
  if(['ytsearch','yts'].includes(cmd)){
    const q = text;
    if(!q) return reply('YTSEARCH','Use: '+pfx+'ytsearch termo');
    const v = await Dl.searchYoutube(q);
    const txt = v.map((x,i)=>`${i+1}. ${x.title}\n⏱️ ${x.timestamp} • ${x.url}`).join('\n\n');
    return reply('YOUTUBE SEARCH', txt);
  }

  // PINTEREST
  if(['pinterest','pin','pinterestdl'].includes(cmd)){
    const q = text;
    if(!q) return reply('PINTEREST', `${pfx}pinterest <termo>  ou  ${pfx}pin <url>`);
    try{
      if(q.startsWith('http')){
        // pin url download - simple via systemzone?
        const api = `${cfg.apis.systemzone.url}/api/download/pinterest?url=${encodeURIComponent(q)}&apikey=${cfg.apis.systemzone.key}`;
        try{
          const { data } = await axios.get(api, { timeout: 20000 });
          const imgUrl = data?.result?.download || data?.url || data?.image;
          if(imgUrl){
            const buf = await U.getBuffer(imgUrl);
            return sendImage(sock, jid, buf, `📌 Pinterest • Sytem DARK\n\n${S.footer}`, msg);
          }
        }catch(_){}
        return reply('PINTEREST','Não consegui baixar esse pin. Tente buscar por termo.');
      } else {
        // search - use sample images
        await reply('PINTEREST', `🔎 Buscando: ${q}`);
        // fake 3 images from unsplash/picsum as demo, or systemzone if available
        const searchUrl = `${cfg.apis.systemzone.url}/api/search/pinterest?text=${encodeURIComponent(q)}&apikey=${cfg.apis.systemzone.key}`;
        try{
          const { data } = await axios.get(searchUrl, { timeout:15000 });
          const list = data?.result || data?.data || [];
          if(Array.isArray(list) && list[0]){
            const img = list[0].image || list[0].url || list[0].download;
            if(img){
              const buf = await U.getBuffer(img);
              return sendImage(sock, jid, buf, `📌 ${q}\n\n${S.footer}`, msg);
            }
          }
        }catch(_){}
        // fallback
        const fallback = `https://picsum.photos/800/1000?random=${Math.floor(Math.random()*1000)}`;
        const buf = await U.getBuffer(fallback);
        return sendImage(sock, jid, buf, `📌 Pinterest: ${q}\n(preview)\n\n${S.footer}`, msg);
      }
    }catch(e){ return reply('ERRO PIN', e.message); }
  }

  // Instagram / Facebook / Mediafire / APK (stubs integrados)
  if(['instagram','ig','insta'].includes(cmd)){
    const url = args[0];
    if(!url) return reply('INSTAGRAM',`Use: ${pfx}instagram <url>`);
    try{
      const api = `${cfg.apis.systemzone.url}/api/download/instagram?url=${encodeURIComponent(url)}&apikey=${cfg.apis.systemzone.key}`;
      const { data } = await axios.get(api, { timeout:25000 });
      const dl = data?.result?.url || data?.url;
      if(dl){
        await sock.sendMessage(jid, { video:{ url: dl }, caption: `📸 Instagram • Sytem DARK\n${S.footer}` }, { quoted: msg });
      } else {
        return reply('INSTAGRAM','Não consegui baixar. API pode estar offline.');
      }
    }catch(e){ return reply('ERRO IG', e.message); }
    return;
  }
  if(['facebook','fb'].includes(cmd)){
    return reply('FACEBOOK','Use: '+pfx+'fb <url> - em breve API full');
  }
  if(['mediafire','mf'].includes(cmd)){
    const url = args[0];
    if(!url) return reply('MEDIAFIRE',`${pfx}mediafire <url>`);
    try{
      const api = `${cfg.apis.systemzone.url}/api/download/mediafire?url=${encodeURIComponent(url)}&apikey=${cfg.apis.systemzone.key}`;
      const { data } = await axios.get(api, { timeout:20000 });
      return reply('MEDIAFIRE', `📁 ${data?.result?.filename||'arquivo'}\n${data?.result?.size||''}\n${data?.result?.link||''}`);
    }catch(e){ return reply('ERRO MF', e.message); }
  }
  if(['apk','apkdl'].includes(cmd)){
    const q = text;
    if(!q) return reply('APK',`${pfx}apk nome do app`);
    return reply('APK SEARCH', `🔎 Buscando APK: ${q}\n\nEm breve download direto via SystemZone.`);
  }
  if(['spotify','sp'].includes(cmd)){
    return reply('SPOTIFY', `${pfx}spotify <url/nome> - módulo em expansão`);
  }

  // ========== GRUPO ADMIN ULTIMATE ==========
  if(cmd==='add' || cmd==='adduser' || cmd==='adicionar'){
    if(await needAdmin()) return;
    if(await needBotAdmin()) return;
    const num = (args[0]||'').replace(/\D/g,'');
    if(!num) return reply('ADD','Use: '+pfx+'add 2449xxxxxxx');
    try{
      await sock.groupParticipantsUpdate(jid, [num+'@s.whatsapp.net'], 'add');
      return reply('ADD', `✅ Tentando adicionar +${num}`);
    }catch(e){ return reply('ERRO ADD', e.message); }
  }

  if(cmd==='ban' || cmd==='kick' || cmd==='remover'){
    if(await needAdmin()) return;
    if(await needBotAdmin()) return;
    const target = U.extractMentioned(msg)[0] || (args[0]?.replace(/[^0-9]/g,'')+'@s.whatsapp.net');
    if(!target || !target.includes('@')) return reply('BAN','Marque alguém');
    await sock.groupParticipantsUpdate(jid, [target], 'remove');
    return reply('BANIDO', `Usuário removido • Sytem DARK`);
  }

  if(cmd==='tempban'){
    if(await needAdmin()) return;
    if(await needBotAdmin()) return;
    const target = U.extractMentioned(msg)[0];
    const tempo = args[1] || '10m';
    if(!target) return reply('TEMPBAN',`${pfx}tempban @user 10m`);
    // parse tempo
    let ms = 10*60*1000;
    const m = tempo.match(/^(\d+)(s|m|h|d)$/);
    if(m){ const n=parseInt(m[1]); const u=m[2]; ms = u==='s'?n*1000:u==='m'?n*60000:u==='h'?n*3600000:n*86400000; }
    await sock.groupParticipantsUpdate(jid, [target], 'remove');
    if(!gset.tempbans) gset.tempbans={};
    gset.tempbans[target] = Date.now()+ms;
    await db.saveGroup(jid,gset);
    await reply('TEMPBAN', `@${target.split('@')[0]} banido por ${tempo}\n\n${S.footer}`);
    setTimeout(async ()=>{
      try{ /* grupo pode re-add? WhatsApp não permite auto */ }catch(_){}
    }, ms);
    return;
  }

  if(cmd==='promover' || cmd==='promote'){
    if(await needAdmin()) return;
    if(await needBotAdmin()) return;
    const target = U.extractMentioned(msg)[0];
    if(!target) return reply('PROMOVER','Marque alguém');
    await sock.groupParticipantsUpdate(jid, [target], 'promote');
    return reply('PROMOVIDO','Admin concedido 👑');
  }
  if(cmd==='rebaixar' || cmd==='demote'){
    if(await needAdmin()) return;
    if(await needBotAdmin()) return;
    const target = U.extractMentioned(msg)[0];
    if(!target) return reply('REBAIXAR','Marque alguém');
    await sock.groupParticipantsUpdate(jid, [target], 'demote');
    return reply('REBAIXADO','Admin removido');
  }

  if(cmd==='marcar' || cmd==='todos' || cmd==='tagall'){
    if(await needAdmin()) return;
    const meta = await sock.groupMetadata(jid);
    const mentions = meta.participants.map(p=>p.id);
    const txt = args.join(' ') || '📢 ATENÇÃO GRUPO - SYTEM DARK';
    await sock.sendMessage(jid, { text: `${S.top}\n${txt}\n${S.bottom}\n${S.footer}`, mentions });
    return;
  }
  if(cmd==='hidetag' || cmd==='marcaroculto' || cmd==='totag'){
    if(await needAdmin()) return;
    const meta = await sock.groupMetadata(jid);
    const mentions = meta.participants.map(p=>p.id);
    const txt = text || '🔔 Sytem DARK';
    await sock.sendMessage(jid, { text: txt, mentions });
    return;
  }
  if(cmd==='marcaradmins' || cmd==='admins'){
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants.filter(p=>p.admin).map(p=>p.id);
    await sock.sendMessage(jid, { text: `👑 Admins:\n`+admins.map(a=>'@'+a.split('@')[0]).join('\n')+`\n\n${S.footer}`, mentions: admins });
    return;
  }

  if(cmd==='fechargrupo' || cmd==='fechar'){
    if(await needAdmin()) return;
    await sock.groupSettingUpdate(jid, 'announcement');
    return reply('GRUPO FECHADO','Apenas admins falam');
  }
  if(cmd==='abrirgrupo' || cmd==='abrir'){
    if(await needAdmin()) return;
    await sock.groupSettingUpdate(jid, 'not_announcement');
    return reply('GRUPO ABERTO','Todos podem falar');
  }

  // ANTILINK
  if(cmd==='antilink'){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(!gset) gset = await db.getGroup(jid);
    if(['on','1','ativar'].includes(mode)){ gset.antilink=true; gset.antilinkHard=false; }
    else if(['hard','forte'].includes(mode)){ gset.antilink=true; gset.antilinkHard=true; }
    else if(['off','0','desativar'].includes(mode)){ gset.antilink=false; gset.antilinkHard=false; }
    else return reply('ANTILINK', `Atual: ${gset.antilink ? (gset.antilinkHard?'HARD':'ON'):'OFF'}\nUse: on / hard / off`);
    await db.saveGroup(jid, gset);
    return reply('ANTILINK', `Modo: ${gset.antilink ? (gset.antilinkHard?'HARD':'ON'):'OFF'}`);
  }

  // ANTISTATUS
  if(cmd==='antistatus'){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    gset.antiStatus = ['on','1','ativar'].includes(mode) ? true : ['off','0'].includes(mode) ? false : !gset.antiStatus;
    await db.saveGroup(jid, gset);
    return reply('ANTISTATUS', gset.antiStatus ? '✅ Ativado - vou deletar status enviados no grupo' : '❌ Desativado');
  }

  // ANTIMENCAO / ANTIMENCION
  if(['antimencao','antimention','antimencionar','antimarcar'].includes(cmd)){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.antiMentionStatus = true;
    else if(['off','0'].includes(mode)) gset.antiMentionStatus = false;
    else gset.antiMentionStatus = !gset.antiMentionStatus;
    await db.saveGroup(jid, gset);
    return reply('ANTIMENÇÃO', gset.antiMentionStatus ? '✅ Bloqueando menções de status' : '❌ Liberado');
  }

  // ANTISPAM
  if(cmd==='antispam'){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.antiSpam = true;
    else if(['off','0'].includes(mode)) gset.antiSpam = false;
    else gset.antiSpam = !gset.antiSpam;
    await db.saveGroup(jid, gset);
    return reply('ANTISPAM', gset.antiSpam ? '✅ AntiSpam ativo (7msg/8s = 60s mute)' : '❌ Desativado');
  }

  // WELCOME / DESPEDIDA
  if(cmd==='welcome' || cmd==='boasvindas'){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.welcome=true;
    else if(['off','0'].includes(mode)) gset.welcome=false;
    else if(text && text.length>5){ gset.welcomeMsg = text; gset.welcome=true; await db.saveGroup(jid,gset); return reply('WELCOME','Mensagem personalizada salva!'); }
    else return reply('WELCOME', `Atual: ${gset.welcome?'ON':'OFF'}\nUse: on/off ou envie a mensagem após o comando`);
    await db.saveGroup(jid, gset);
    return reply('WELCOME', `Welcome ${gset.welcome?'ativado':'desativado'}`);
  }
  if(['despedida','bye','goodbye'].includes(cmd)){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.bye=true;
    else if(['off','0'].includes(mode)) gset.bye=false;
    else if(text && text.length>5){ gset.byeMsg = text; gset.bye=true; await db.saveGroup(jid,gset); return reply('DESPEDIDA','Mensagem salva!'); }
    else return reply('DESPEDIDA', `Atual: ${gset.bye?'ON':'OFF'}`);
    await db.saveGroup(jid, gset);
    return reply('DESPEDIDA', gset.bye?'ativado':'desativado');
  }

  // STATUSGP
  if(cmd==='statusgp' || cmd==='setdescgp'){
    if(await needAdmin()) return;
    const st = text;
    if(!st) return reply('STATUSGP', `Atual: ${gset.statusgp||'-'}\nUse: ${pfx}statusgp seu texto`);
    gset.statusgp = st;
    await db.saveGroup(jid,gset);
    try{ await sock.groupUpdateDescription(jid, st); }catch(_){}
    return reply('STATUSGP','✅ Status do grupo atualizado!');
  }

  if(cmd==='infogrupo' || cmd==='groupinfo'){
    if(!isGroup) return;
    const meta = await sock.groupMetadata(jid);
    const hosted = await db.isHosted(jid);
    return reply('INFO GRUPO', `Nome: ${meta.subject}\nID: ${meta.id}\nMembros: ${meta.participants.length}\nAdmins: ${meta.participants.filter(p=>p.admin).length}\nHosted: ${hosted?'✅ SIM':'❌ NÃO'}\nVIP: ${gset?.vip?'✅': '❌'}\nStatusGP: ${gset?.statusgp||'-'}\nCriado: ${meta.creation ? new Date(meta.creation*1000).toLocaleDateString('pt-BR') : '-'}`);
  }

  // ========== VIP / HOSTING ==========
  if(cmd==='vip' || cmd==='myvip' || cmd==='meuvip'){
    const u = await db.getUser(sender);
    const isV = u.vip && u.vipExpire > Date.now();
    const left = isV ? Math.ceil((u.vipExpire - Date.now())/86400000) : 0;
    return reply('VIP STATUS', isV ? `💎 VIP ATIVO\nPlano: ${u.vipPlan}\nExpira em: ${left} dias\n\nObrigado por apoiar Sytem DARK!` : `❌ Você não é VIP\n\nCompre com Dark Net:\n• 20 dias\n• 30 dias\n• Premium 90 dias\n\n📞 +${cfg.bot.ownerNumber}`);
  }

  if(['addvip','darvip','setvip'].includes(cmd)){
    if(!isOwner(sender)) return reply('OWNER ONLY','Apenas Dark Net');
    const target = U.extractMentioned(msg)[0] || (args[0]?.replace(/\D/g,'')+'@s.whatsapp.net');
    const days = parseInt(args[1]) || 30;
    if(!target.includes('@')) return reply('ADDVIP',`${pfx}addvip @user 30`);
    const rec = await db.addVip(target, days, 'vip');
    await sock.sendMessage(jid, { text: `💎 VIP ADICIONADO\n\n👤 @${target.split('@')[0]}\n📅 ${days} dias\n⏰ Expira: ${new Date(rec.expire).toLocaleDateString('pt-BR')}\n\n${S.footer}`, mentions:[target] }, { quoted: msg });
    return;
  }
  if(cmd==='delvip' || cmd==='remvip'){
    if(!isOwner(sender)) return;
    const target = U.extractMentioned(msg)[0] || args[0]+'@s.whatsapp.net';
    await db.removeVip(target);
    return reply('VIP REMOVIDO','OK');
  }
  if(cmd==='add20d' || cmd==='vip20'){
    if(!isOwner(sender)) return;
    const target = U.extractMentioned(msg)[0] || sender;
    await db.addVip(target, 20, '20d');
    return reply('VIP 20D', `@${target.split('@')[0]} VIP 20 dias ativado!`);
  }
  if(cmd==='add30d' || cmd==='vip30'){
    if(!isOwner(sender)) return;
    const target = U.extractMentioned(msg)[0] || sender;
    await db.addVip(target, 30, '30d');
    await sock.sendMessage(jid, { text:`💎 @${target.split('@')[0]} VIP 30 dias!`, mentions:[target] });
    return;
  }

  if(['host','hospedagem','addhost','addhosting'].includes(cmd)){
    if(!isGroup) return reply('HOST','Só em grupos');
    if(!isOwner(sender)){
      const hosted = await db.isHosted(jid);
      return reply('HOSPEDAGEM', hosted ? `✅ Grupo hospedado até ${new Date(gset.hostedExpire).toLocaleDateString('pt-BR')}` : cfg.hosting.warning + `\n\nFale com Dark Net`);
    }
    // owner adding host
    const days = parseInt(args[0]) || 30;
    const rec = await db.addHosting(jid, days, 'Dark Net');
    return reply('HOST ATIVADO', `✅ Hospedagem ativada!\n📅 ${days} dias\n⏰ Expira: ${new Date(rec.expire).toLocaleDateString('pt-BR')}\n\nGrupo liberado 100%`);
  }
  if(cmd==='delhost'){
    if(!isOwner(sender)) return;
    await db.removeHosting(jid);
    return reply('HOST REMOVIDO','Hospedagem removida');
  }
  if(cmd==='invokedono' || cmd==='donoadd' || cmd==='callowner'){
    await sock.sendMessage(jid, { text:`📞 *INVOCANDO DONO*\n\n👑 @${cfg.bot.ownerNumber}\n🆔 LID: ${cfg.bot.ownerLid}\n\nGrupo: ${isGroup ? (await sock.groupMetadata(jid).catch(()=>({subject:'-'}))).subject : 'PV'}\nSolicitante: @${sender.split('@')[0]}\n\n📝 Mensagem: ${text||'Preciso de hospedagem / VIP'}\n\n${S.footer}`, mentions:[sender, cfg.bot.ownerJid, cfg.bot.ownerLid] }, { quoted: msg });
    // notify owner pv
    try{ await sock.sendMessage(cfg.bot.ownerJid, { text:`🔔 Invocação DARK\nDe: @${sender.split('@')[0]}\nGrupo: ${jid}\nMsg: ${text||'-'}` , mentions:[sender]}); }catch(_){}
    try{ await sock.sendMessage(cfg.bot.ownerLid, { text:`🔔 Invocação via LID\n${sender}`}); }catch(_){}
    return;
  }

  // ========== PROCURADO ==========
  if(cmd==='procurado' || cmd==='foragido' || cmd==='procurados'){
    const list = await db.listVips?.() // placeholder - actually procurados
    // simple list from json
    let pros = [];
    if(db.mode==='mongo' && db.cols.procurados){
      pros = await db.cols.procurados.find({}).toArray();
    } else {
      pros = Object.values(db.mem.procurados || {});
    }
    if(!pros.length) return reply('PROCURADOS','Nenhum foragido no momento ✅');
    const txt = pros.map((p,i)=>`${i+1}. @${String(p.userId).split('@')[0]} - ${p.motivo} - 💰 ${p.recompensa}`).join('\n');
    const mentions = pros.map(p=>p.userId);
    await sock.sendMessage(jid, { text: `🚨 *LISTA DE PROCURADOS - SYTEM DARK*\n\n${txt}\n\n${S.footer}`, mentions }, { quoted: msg });
    return;
  }
  if(['addprocurado','setprocurado','wanted'].includes(cmd)){
    if(!userAdmin) return reply('SEM PERM','Admin only');
    const target = U.extractMentioned(msg)[0];
    if(!target) return reply('ADDPROCURADO',`${pfx}addprocurado @user motivo`);
    const motivo = args.slice(1).join(' ') || 'Foragido da lei';
    const recompensa = 5000 + Math.floor(Math.random()*5000);
    await db.addProcurado(target, motivo, recompensa);
    // attack message mentioning all
    let mentions=[];
    if(isGroup){ try{ const meta=await sock.groupMetadata(jid); mentions=meta.participants.map(p=>p.id);}catch(_){ } }
    await sock.sendMessage(jid, { text:`🚨🚨🚨 *PROCURADO ADICIONADO* 🚨🚨🚨\n\n👤 @${target.split('@')[0]}\n📋 Motivo: ${motivo}\n💰 Recompensa: ${recompensa} coins\n\n⚠️ TODOS ALERTA ⚠️\n${mentions.map(m=>'@'+m.split('@')[0]).join(' ')}\n\n🌌 Sytem DARK Polícia`, mentions: [target, ...mentions] }, { quoted: msg });
    return;
  }
  if(['delprocurado','remprocurado'].includes(cmd)){
    if(!isOwner(sender) && !userAdmin) return;
    const target = U.extractMentioned(msg)[0];
    if(!target) return;
    await db.removeProcurado(target);
    return reply('PROCURADO','Removido da lista');
  }

  // ========== INTERAÇÕES ==========
  const interacoes = {
    'abraço': ['🤗', 'abraçou'],
    'abraco': ['🤗', 'abraçou'],
    'beijo': ['💋', 'beijou'],
    'tapa': ['👋', 'deu um tapa em'],
    'soco': ['👊', 'deu um soco em'],
    'matar': ['🔪', 'matou'],
    'matou': ['🔪', 'matou'],
    'cafune': ['🥰', 'fez cafuné em'],
    'chutar': ['🦶', 'chutou'],
    'hug': ['🤗', 'abraçou']
  };
  if(interacoes[cmd]){
    const target = U.extractMentioned(msg)[0] || sender;
    const [emoji, verbo] = interacoes[cmd];
    return sock.sendMessage(jid, { text: `${emoji} @${sender.split('@')[0]} ${verbo} @${target.split('@')[0]}\n\n${S.footer}`, mentions:[sender, target] }, { quoted: msg });
  }

  // ========== FUN ==========
  if(cmd==='chance'){
    const t = text || '???';
    const n = Math.floor(Math.random()*101);
    return reply('CHANCE DARK', `${t}\n🎯 Chance: ${n}%`);
  }
  if(cmd==='chance100' || cmd==='chance100%'){
    const t = text || '???';
    return reply('CHANCE100 DARK', `${t}\n🎯 Chance: 100%\n✅ Confirmado pelo System DARK`);
  }
  if(['gay','corno','gado','lindo','feio','corno','safado'].includes(cmd)){
    const target = U.extractMentioned(msg)[0] || sender;
    const n = Math.floor(Math.random()*101);
    return sock.sendMessage(jid, { text: `🔮 ${cmd.toUpperCase()}\n@${target.split('@')[0]} é ${n}% ${cmd}\n\n${S.footer}`, mentions:[target] }, { quoted: msg });
  }
  if(cmd==='ship'){
    const m = U.extractMentioned(msg);
    const a = m[0] || sender;
    const b = m[1] || a;
    const n = Math.floor(Math.random()*101);
    return sock.sendMessage(jid, { text: `💞 SHIP DARK\n@${a.split('@')[0]} + @${b.split('@')[0]}\n💘 ${n}%\n${n>70?'💍 Casem!': n>40?'💓 Pode rolar':'💔 Amizade'}\n\n${S.footer}`, mentions:[a,b] }, { quoted: msg });
  }
  if(cmd==='dado' || cmd==='dice'){
    return reply('DADO', `🎲 ${Math.floor(Math.random()*6)+1}`);
  }
  if(cmd==='moeda'){
    return reply('MOEDA', Math.random()>0.5?'👑 Cara':'🥈 Coroa');
  }

  // ========== INFO / SISTEMA ==========
  if(cmd==='ping'){
    const start = Date.now();
    await sock.sendMessage(jid, { text:'🏓 Pong!' }, { quoted: msg });
    return reply('PING', `${Date.now()-start} ms\n🌌 Sytem DARK Online\n⚡ Prefixos: ${prefixes.join(' ')}`);
  }
  if(cmd==='uptime' || cmd==='uptime24'){
    const up = process.uptime()*1000;
    return reply('UPTIME', U.msToTime(up) + '\n24/7 System DARK ULTIMATE');
  }
  if(cmd==='dbstatus' || cmd==='status'){
    const st = await db.stats();
    return reply('DATABASE ULTIMATE', `Modo: ${st.mode}\nMongo: ${st.mongo?'✅':'❌'}\nDB: ${st.db}\nVIPs: ${st.vips||0}\nUptime: ${U.msToTime(st.uptime*1000)}\nVersão: ${st.version}`);
  }
  if(cmd==='statusgp'){
    if(!isGroup) return;
    if(!gset) gset = await db.getGroup(jid);
    return reply('STATUS GP', `Hosted: ${gset.hosted?'✅':'❌'}\nVIP: ${gset.vip?'✅':'❌'}\nAntiLink: ${gset.antilink?'ON':'OFF'}\nAntiStatus: ${gset.antiStatus?'ON':'OFF'}\nAntiSpam: ${gset.antiSpam?'ON':'OFF'}\nWelcome: ${gset.welcome?'ON':'OFF'}\nMutados: ${(gset.mutados||[]).length}\n\n${gset.statusgp||'Sem status definido'}`);
  }
  if(cmd==='sobrebot' || cmd==='botinfo' || cmd==='sytem'){
    return reply('SYTEM DARK ULTIMATE', `🤖 ${cfg.bot.name}
📦 v${cfg.bot.version}
👑 Criador: ${cfg.bot.creator}
📱 Bot: +${cfg.bot.botNumber}
👤 Dono: +${cfg.bot.ownerNumber}
🆔 LID: ${cfg.bot.ownerLid}
🌐 Independente • 24/7 • ULTIMATE
⚡ MongoDB • Pair Code • VIP • Host
🎯 Prefixos: ${prefixes.join(' ')}

${S.footer}`);
  }

  if(cmd==='dono' || cmd==='owner' || cmd==='darknet'){
    return sock.sendMessage(jid, { text:`👑 Dono: @${cfg.bot.ownerNumber}\n🆔 LID: @${cfg.bot.ownerLid.split('@')[0]}\n🤖 ${cfg.bot.name} ULTIMATE\n\n${S.footer}`, mentions:[cfg.bot.ownerJid, cfg.bot.ownerLid] }, { quoted: msg });
  }

  if(cmd==='prefixo' || cmd==='prefixos' || cmd==='prefix'){
    return sock.sendMessage(jid, { text: `🌀 *PREFIXOS SYTEM DARK*\n\n${prefixes.map((p,i)=>`${i+1}. ${p ? `\`${p}\`` : '`sem prefixo`'}`).join('\n')}\n\nPrincipal: \`${prefixes[0]}\`\n\nDigite \`${prefixes[0]}menu\`\n${S.footer}` }, { quoted: msg });
  }

  // ========== REMOVE AI / ANTI PAYMENT / ANTIMENCAO STATUS ==========
  if(['removeai','delai','tirarai','removerai'].includes(cmd)){
    if(await needAdmin()) return;
    if(!isGroup) return reply('ERRO','Só grupos');
    try{
      // tenta remover  Meta AI 867051314767696@bot
      await sock.groupParticipantsUpdate(jid, ['867051314767696@lid','867051314767696@s.whatsapp.net','867051314767696@bot'], 'remove').catch(()=>{});
      return reply('REMOVE AI','✅ Meta AI removida (se estava no grupo)\n\n🌌 Sytem DARK');
    }catch(e){ return reply('ERRO', e.message); }
  }

  // antimencaostatus (alias melhorado)
  if(['antimencaostatus','antimencao_status','antistatusmention'].includes(cmd)){
    if(await needAdmin()) return;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.antiMentionStatus = true;
    else if(['off','0'].includes(mode)) gset.antiMentionStatus = false;
    else gset.antiMentionStatus = !gset.antiMentionStatus;
    await db.saveGroup(jid, gset);
    // avisar donos
    try{
      await sock.sendMessage(cfg.bot.ownerJid, { text:`🔔 AntiMencaoStatus alterado\nGrupo: ${jid}\nNovo: ${gset.antiMentionStatus?'ON':'OFF'}\nPor: @${sender.split('@')[0]}`, mentions:[sender] });
      await sock.sendMessage(cfg.bot.ownerLid, { text:`AntiMencaoStatus ${gset.antiMentionStatus?'ON':'OFF'} em ${jid}` }).catch(()=>{});
    }catch(_){}
    return reply('ANTIMENCAO STATUS', gset.antiMentionStatus ? '✅ Ativado e donos notificados' : '❌ Desativado');
  }

  // anti pagamento / antipix
  if(['antipix','antipagamento','antipay','antipv'].includes(cmd)){
    if(await needAdmin()) return;
    if(!gset.antiPay) gset.antiPay = false;
    const mode = (args[0]||'').toLowerCase();
    if(['on','1'].includes(mode)) gset.antiPay = true;
    else if(['off','0'].includes(mode)) gset.antiPay = false;
    else gset.antiPay = !gset.antiPay;
    await db.saveGroup(jid, gset);
    // avisar donos
    try{
      await sock.sendMessage(cfg.bot.ownerJid, { text:`💰 AntiPagamento ${gset.antiPay?'ATIVADO':'DESATIVADO'}\nGrupo: ${isGroup ? (await sock.groupMetadata(jid).catch(()=>({subject:jid}))).subject : jid}\nPor: @${sender.split('@')[0]}`, mentions:[sender]});
    }catch(_){}
    return reply('ANTI PAGAMENTO', gset.antiPay ? '✅ Mensagens de pagamento / pix serão deletadas' : '❌ Liberado');
  }

  // SystemZero downloads - música / vídeo YouTube
  if(['szplay','systemzero','szmusic','szmp3'].includes(cmd)){
    const q = text;
    if(!q) return reply('SZPLAY',`Use: ${pfx}szplay nome da música`);
    try{
      await reply('SYSTEM ZERO','🔎 Buscando via SystemZero...');
      // tenta systemzone search + download
      const search = await Dl.searchYoutube(q);
      const vid = search[0];
      if(!vid) return reply('NÃO ENCONTRADO','-');
      // SystemZero API
      const apiUrl = `${cfg.apis.systemzone.url}/api/download/ytmp3?url=${encodeURIComponent(vid.url)}&apikey=${cfg.apis.systemzone.key}`;
      try{
        const { data } = await axios.get(apiUrl, { timeout: 45000 });
        const dl = data?.result?.download || data?.url || data?.link;
        if(dl){
          await sock.sendMessage(jid, { audio:{ url: dl }, mimetype:'audio/mpeg', fileName: `${vid.title}.mp3` }, { quoted: msg });
          return;
        }
      }catch(_){}
      return reply('SZPLAY INFO', `${vid.title}\n${vid.url}\n\nAPI SystemZero indisponível no momento, tente ${pfx}play`);
    }catch(e){ return reply('ERRO SZ', e.message); }
  }

  if(['szvideo','szmp4','systemzerovideo'].includes(cmd)){
    const url = args[0] || text;
    if(!url) return reply('SZVIDEO',`${pfx}szvideo <url ou termo>`);
    try{
      let videoUrl = url;
      if(!url.includes('http')){
        const s = await Dl.searchYoutube(url);
        if(s[0]) videoUrl = s[0].url;
      }
      await reply('SYSTEM ZERO VIDEO','Baixando via SystemZero API...');
      const api = `${cfg.apis.systemzone.url}/v1/exp?url=${encodeURIComponent(videoUrl)}&quality=1080`;
      const { data } = await axios.get(api, { timeout: 60000 });
      const dl = data?.download_url || data?.url;
      if(dl){
        await sock.sendMessage(jid, { video:{ url: dl }, caption:`🎬 SystemZero • ${data.title||''}\n${S.footer}` }, { quoted: msg });
        return;
      }
      return reply('ERRO','SystemZero sem retorno');
    }catch(e){ return reply('ERRO SZVIDEO', e.message); }
  }

  // OWNER ONLY
  if(['reiniciar','restart'].includes(cmd)){
    if(!isOwner(sender)) return;
    await reply('RESTART','Reiniciando System DARK ULTIMATE...');
    process.exit(0);
  }
  if(cmd==='bc' || cmd==='broadcast'){
    if(!isOwner(sender)) return;
    return reply('BROADCAST','Use: em desenvolvimento - Ultimate v5.1');
  }

  // unknown - silent
}

module.exports = { handle, isOwner };
