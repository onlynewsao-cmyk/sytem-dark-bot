const { getTheme, themes } = require('./themes');
const { mainMenu, menuPrincipal, menuDownloads, menuAdmin, menuOwner, menuMembers, menuRpg, menuStore, menuStickers, menuThemes, header } = require('./menus');
const { sendButtons, sendList } = require('./buttons');
const { onlyNumbers, systemInfo, quotedKey } = require('./utils');
const { ytmp3, ytmp4, tiktok, genericDownload, searchYoutube } = require('./downloads');
const { darkRoletaVideo, quotePt, bibleVerse, randomDog, randomCat, githubRepo } = require('./apis');

const linkRegex = /((https?:\/\/)|(www\.))[\w.-]+(\.\w+)+([\w.,@?^=%&:\/~+#-]*[\w@?^=%&\/~+#-])?/gi;

function configFromEnv(base) {
  return {
    ...base,
    prefix: process.env.PREFIX || base.prefix || '.',
    botName: process.env.BOT_NAME || base.botName || 'Sytem DARK',
    Dononame: process.env.OWNER_NAME || base.Dononame || 'Dark Net',
    donoJid: onlyNumbers(process.env.OWNER_NUMBER || base.donoJid || '244945280380'),
    numeroBot: onlyNumbers(process.env.BOT_NUMBER || base.numeroBot || '')
  };
}
async function getTarget(ctx) {
  if (ctx.mentions?.[0]) return ctx.mentions[0];
  const qk = quotedKey(ctx.msg); if (qk?.participant) return qk.participant;
  if (ctx.args[0] && onlyNumbers(ctx.args[0])) return onlyNumbers(ctx.args[0]) + '@s.whatsapp.net';
  return null;
}
async function requireGroup(ctx) { if (!ctx.isGroup) { await ctx.reply('❌ Este comando só funciona em grupos.'); return false; } return true; }
async function requireAdmin(ctx) { if (!(await requireGroup(ctx))) return false; if (!ctx.isAdmin && !ctx.isOwner) { await ctx.reply('🚫 Apenas administradores podem usar este comando.'); return false; } return true; }
async function requireBotAdmin(ctx) { if (!ctx.isBotAdmin) { await ctx.reply('⚠️ Eu preciso ser administrador.'); return false; } return true; }
async function requireOwner(ctx) { if (!ctx.isOwner) { await ctx.reply('🚫 Comando restrito ao dono Dark Net.'); return false; } return true; }

async function preModeration(ctx) {
  if (!ctx.isGroup || !ctx.body) return false;
  const g = ctx.db.group(ctx.from);
  if ((g.blockedCmds || []).includes(ctx.command) && !ctx.isOwner) { await ctx.reply('🚫 Este comando está bloqueado neste grupo.'); return true; }
  if ((g.mutados || []).some(x => onlyNumbers(x) === onlyNumbers(ctx.sender)) && !ctx.isAdmin && !ctx.isOwner) {
    if (ctx.isBotAdmin) await ctx.sock.sendMessage(ctx.from, { delete: ctx.msg.key }).catch(() => {});
    return true;
  }
  if (g.muted && !ctx.isAdmin && !ctx.isOwner) return true;
  if (g.onlyAdmin && ctx.isCmd && !ctx.isAdmin && !ctx.isOwner) { await ctx.reply('🔒 Modo só-admin ativo: apenas administradores podem usar comandos.'); return true; }
  if ((g.antilink || g.antilinkHard) && linkRegex.test(ctx.body) && !ctx.isAdmin && !ctx.isOwner) {
    if (ctx.isBotAdmin) {
      await ctx.sock.sendMessage(ctx.from, { delete: ctx.msg.key }).catch(() => {});
      if (g.antilinkHard) await ctx.sock.groupParticipantsUpdate(ctx.from, [ctx.sender], 'remove').catch(() => {});
    }
    await ctx.reply(`🔗 Link detectado, @${onlyNumbers(ctx.sender)}. ${g.antilinkHard ? 'Usuário removido.' : 'Mensagem removida.'}`, { mentions: [ctx.sender] });
    return true;
  }
  return false;
}
function mainRows(prefix) {
  return [
    { title: '╭─〔👑 CATEGORIAS〕──⬣', rows: [
      { header: '🖼️ PRINCIPAL', title: '📜 MENU PRINCIPAL', description: '◇ comandos essenciais', id: `${prefix}menuprincipal` },
      { header: '🚫 VIP', title: '🚫 MENU +18', description: '◇ funções privadas', id: `${prefix}vip` },
      { header: '📥 DOWNLOAD', title: '🎧 MENU MÍDIA', description: '◇ baixar músicas e vídeos', id: `${prefix}downloads` },
      { header: '🎭 STICKERS', title: '🖼️ MENU FIGURINHAS', description: '◇ criar e editar figurinhas', id: `${prefix}sticker` },
      { header: '👑 DONO', title: '⚜️ MENU DONO', description: '◇ comandos do dono', id: `${prefix}dono` },
      { header: '🛡️ ADM', title: '💠 MENU ADM', description: '◇ controle de grupos', id: `${prefix}admin` },
      { header: '👥 MEMBROS', title: '👤 MENU MEMBROS', description: '◇ funções para membros', id: `${prefix}membrosmenu` },
      { header: '🎮 DIVERSÃO', title: '🤣 MENU BRINCADEIRAS', description: '◇ jogos e zoeiras', id: `${prefix}brincadeiras` },
      { header: '⚔️ RPG', title: '👮 MENU RPG', description: '◇ aventuras e economia', id: `${prefix}rpg` },
      { header: '🛒 LOJA', title: '🛍️ CATÁLOGO', description: '◇ produtos e serviços', id: `${prefix}loja` },
      { header: '🔤 FONTES', title: 'FONTES DISPONÍVEIS', description: '◇ letras decoradas', id: `${prefix}fontes grupo oficial` },
      { header: '🔎 CONSULTAS', title: 'DADOS E APIS', description: '◇ ferramentas gratuitas', id: `${prefix}consultas` },
      { header: '⚙️ SISTEMAS', title: 'ATIVAR / DESATIVAR', description: '◇ gerenciar proteções', id: `${prefix}ativar` },
      { header: '🌀 SYTEM DARK', title: 'SOBRE O BOT', description: '◇ criação Dark Net', id: `${prefix}sobrebot` },
      { header: '🤖 BOT', title: 'PING / STATUS', description: '◇ meus status', id: `${prefix}ping` }
    ] }
  ];
}
function menuBtns(prefix) {
  return [
    { text: '📋 Abrir Menu', id: `${prefix}menulista` }, { text: '📥 Downloads', id: `${prefix}downloads` },
    { text: '🛡️ Admin', id: `${prefix}admin` }, { text: '🔤 Fontes', id: `${prefix}fontes grupo oficial` },
    { text: '📊 Ping', id: `${prefix}ping` }
  ];
}
function fancyFonts(text) {
  const maps = [
    s => `*${s.toUpperCase()}*`, s => `_${s.toUpperCase()}_`, s => '𝗚𝗥𝗨𝗣𝗢 𝗢𝗙𝗜𝗖𝗜𝗔𝗟'.replace('GRUPO OFICIAL', s.toUpperCase()),
    s => s.toUpperCase().split('').join(' '),
    s => s.toLowerCase().replace(/[a-z]/g, c => '𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟'['abcdefghijklmnopqrstuvwxyz'.indexOf(c)] || c),
    s => s.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(0x1D670 + c.charCodeAt(0) - 65)),
    s => s.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(0x24B6 + c.charCodeAt(0) - 65)),
    s => s.toUpperCase().split('').map(c => /[A-Z]/.test(c) ? `▣${c}` : c).join(''),
    s => s.toUpperCase().split('').map(c => /[A-Z]/.test(c) ? `【${c}】` : c).join('')
  ];
  return maps.map(fn => fn(text));
}
async function handleCommand(ctx) {
  const { sock, from, msg, prefix, command, q, args, config, db, pushname } = ctx;
  const g = ctx.isGroup ? db.group(from) : { theme: config.temaPadrao || 'zero' };
  const t = getTheme(g.theme);
  switch (command) {
    case 'menu': case 'help': case 'comandos': case 'start':
      return sendButtons(sock, from, mainMenu({ botName: config.botName, ownerName: config.Dononame, prefix, pushname, theme: t }), menuBtns(prefix), msg, { footer: t.footer });
    case 'menulista': case 'listmenu': case 'abrirmenu':
      return sendList(sock, from, '╭─〔🌀 *SYTEM DARK* 〕─⬣\n◇ escolha uma categoria abaixo', '✦ ABRIR MENU ✦', mainRows(prefix), msg, { footer: t.footer });
    case 'menuprincipal': case 'principal': return ctx.reply(menuPrincipal(prefix, t));
    case 'downloads': case 'download': case 'baixar':
      return sendButtons(sock, from, menuDownloads(prefix, t), [
        { text: '🎵 PLAY', id: `${prefix}play despacito` }, { text: '🎬 YTMP4', id: `${prefix}ytmp4 ` },
        { text: '🎵 TIKTOK MP3', id: `${prefix}tiktokmp3 ` }, { text: '📋 Menu Lista', id: `${prefix}menulista` }
      ], msg, { footer: t.footer });
    case 'ativar': case 'sistemas': {
      if (!(await requireAdmin(ctx))) return;
      return sendList(sock, from, `${header(t, 'ATIVAR SISTEMAS')}

Escolha o sistema que deseja ativar no grupo.`, '⚙️ Ativar sistema', [{ title: 'Proteção e grupo', rows: [
        { header: 'Proteção', title: '🔗 Anti-link', description: 'Apaga links enviados por membros', id: `${prefix}antilink on` },
        { header: 'Proteção', title: '🚷 Anti-link Hard', description: 'Remove quem envia link', id: `${prefix}antilinkhard on` },
        { header: 'Grupo', title: '👋 Boas-vindas', description: 'Mensagem ao entrar', id: `${prefix}boasvindas on` },
        { header: 'Grupo', title: '👋 Despedida', description: 'Mensagem ao sair', id: `${prefix}despedida on` },
        { header: 'Bot', title: '🔒 Só Admin', description: 'Apenas admins usam comandos', id: `${prefix}soadm on` }
      ]}], msg, { footer: t.footer });
    }
    case 'desativar': {
      if (!(await requireAdmin(ctx))) return;
      return sendList(sock, from, `${header(t, 'DESATIVAR SISTEMAS')}

Escolha o sistema que deseja desativar no grupo.`, '⚙️ Desativar sistema', [{ title: 'Proteção e grupo', rows: [
        { header: 'Proteção', title: '🔗 Anti-link', description: 'Desativar anti-link', id: `${prefix}antilink off` },
        { header: 'Proteção', title: '🚷 Anti-link Hard', description: 'Desativar remoção por link', id: `${prefix}antilinkhard off` },
        { header: 'Grupo', title: '👋 Boas-vindas', description: 'Desativar mensagem de entrada', id: `${prefix}boasvindas off` },
        { header: 'Grupo', title: '👋 Despedida', description: 'Desativar mensagem de saída', id: `${prefix}despedida off` },
        { header: 'Bot', title: '🔓 Só Admin', description: 'Liberar comandos para membros', id: `${prefix}soadm off` }
      ]}], msg, { footer: t.footer });
    }
    case 'soadm': case 'so_adm': case 'onlyadm': {
      if (!(await requireAdmin(ctx))) return;
      const val = (args[0] || '').toLowerCase().replace('1','on').replace('0','off');
      if (!['on','off'].includes(val)) return ctx.reply(`Status: *${g.onlyAdmin ? 'ON' : 'OFF'}*
Use: *${prefix + command} on/off*`);
      db.setGroup(from, { onlyAdmin: val === 'on' });
      return ctx.reply(`✅ Modo só-admin ${val === 'on' ? 'ativado' : 'desativado'}.`);
    }
    case 'admin': case 'menuadmin': case 'administrativo': if (!(await requireGroup(ctx))) return; return ctx.reply(menuAdmin(prefix, t));
    case 'dono': case 'menudono': case 'owner': if (!(await requireOwner(ctx))) return; return ctx.reply(menuOwner(prefix, t));
    case 'membrosmenu': case 'menumembros': return ctx.reply(menuMembers(prefix, t));
    case 'rpg': return ctx.reply(menuRpg(prefix, t));
    case 'loja': case 'catalogo': {
      return sendList(sock, from, menuStore(prefix, t), '🛒 Ver Produtos', [{ title: 'Catálogo Dark Net', rows: [
        { header: 'Produto 1', title: '🤖 BOT PERSONALIZÁVEL', description: 'Plano inicial', id: `${prefix}comprar 1` },
        { header: 'Produto 2', title: '🌐 Site HTML', description: 'Página profissional', id: `${prefix}comprar 2` },
        { header: 'Produto 3', title: '🎮 Premium Bot 30 dias', description: 'Recursos VIP', id: `${prefix}comprar 3` },
        { header: 'Produto 4', title: '🛡️ Configuração de grupo', description: 'Proteções e menus', id: `${prefix}comprar 4` }
      ]}], msg, { footer: t.footer });
    }
    case 'sticker': case 'figurinhas': return ctx.reply(menuStickers(prefix, t));
    case 'temas': case 'themes': return ctx.reply(menuThemes(prefix, t));
    case 'devastador': case 'mododevastador': { if (ctx.isGroup && !(await requireAdmin(ctx))) return; if (ctx.isGroup) db.setGroup(from, { theme: 'devastador' }); return ctx.reply('☯️ Tema *Dark Devastador* ativado.'); }
    case 'settema': case 'tema': {
      if (ctx.isGroup && !(await requireAdmin(ctx))) return;
      const id = (args[0] || '').toLowerCase();
      if (!themes[id]) return ctx.reply(menuThemes(prefix, t));
      if (ctx.isGroup) db.setGroup(from, { theme: id });
      return ctx.reply(`✅ Tema alterado para *${getTheme(id).name}*.`);
    }
    case 'sobrebot': case 'criador': case 'creditos': {
      return ctx.reply(`${header(t, 'SOBRE O BOT')}

▣ *Nome:* ${config.botName}
▣ *Criador:* Dark Net
▣ *Dono:* ${config.Dononame}
▣ *Número:* +${config.donoJid}
▣ *Versão:* v24.15.0

🌀 Sytem DARK é uma base profissional criada e personalizada por *Dark Net*, com menus, botões, downloads, administração de grupos, segurança, economia, fontes e ferramentas.`);
    }
    case 'roleta': {
      const opts = q ? q.split(/[|,;]/).map(x=>x.trim()).filter(Boolean) : (ctx.mentions || []).map(x=>onlyNumbers(x));
      if (opts.length < 2) return ctx.reply(`Use: *${prefix}roleta nome1,nome2,nome3* ou marque membros.`);
      await ctx.react('⏳');
      const video = await darkRoletaVideo(opts);
      if (video) { await sock.sendMessage(from, { video: { url: video }, ptv: true, mimetype: 'video/mp4' }, { quoted: msg }); await ctx.react('✅'); return; }
      const escolhido = opts[Math.floor(Math.random() * opts.length)];
      await ctx.react('✅');
      return ctx.reply(`${header(t, 'ROLETA DARK')}\n\n▣ Participantes: ${opts.join(', ')}\n▣ Escolhido: *${escolhido}*`);
    }
    case 'dbstatus': case 'database': {
      return ctx.reply(`${header(t, 'DATABASE')}

▣ *Modo:* ${db.mode}
▣ *MongoDB:* ${db.mongoReady ? 'Conectado ✅' : 'Desconectado/JSON local ⚠️'}
▣ *Usuários:* ${Object.keys(db.users || {}).length}
▣ *Grupos:* ${Object.keys(db.groups || {}).length}`);
    }
    case 'uptime24': case '24h': {
      return ctx.reply(`${header(t, '24/7 UPTIME')}

Para manter online 24/7 no servidor Node:

1. Deixe o Startup Command:
   *node index.js*

2. Configure MongoDB no .env:
   *MONGODB_URI=sua_string*

3. Use um monitor externo gratuito:
   • UptimeRobot
   • cron-job.org

4. URL para ping:
   *https://SEU-DOMINIO/health*

5. Intervalo recomendado:
   *5 minutos*

Se o painel não oferece URL pública, use apenas o processo permanente do host e MongoDB para persistir dados.`);
    }
    case 'status': case 'ping': {
      const s = systemInfo();
      const chats = ctx.isOwner ? Object.keys(await sock.groupFetchAllParticipating().catch(()=>({}))).length : '—';
      return ctx.reply(`${header(t, 'MENU PING')}

▣ *Bot:* ${config.botName}
▣ *Dono:* ${config.Dononame}
▣ *Prefixo:* ${prefix}
▣ *Versão:* v24.15.0
▣ *Plataforma:* ${s.platform}_${s.arch}

✦ *ESTATÍSTICAS* ✦
▣ *Uptime:* ${s.uptime}
▣ *RAM:* ${s.memory.rss}
▣ *Grupos:* ${chats}
▣ *Database:* ${db.mode}${db.mongoReady ? ' ✅' : ''}
▣ *Comandos:* ${db.user(ctx.sender).cmds}`);
    }
    case 'fontes': {
      if (!q) return ctx.reply(`Use: *${prefix}fontes grupo oficial*`);
      const fonts = fancyFonts(q);
      return ctx.reply(`🔤 *FONTES DISPONÍVEIS*\n\n${fonts.map(x => `▢ ${x}`).join('\n\n')}`);
    }
    case 'fontesbot': {
      if (!(await requireOwner(ctx))) return;
      return sendUrlCopy(sock, from, `╭─⊷ 「 FONTES DO BOT 」⊶─╮\n▣ Creator: Dark Net\n▣ BotNome: ${config.botName}\n▣ Runtime: ${systemInfo().uptime}\n╰────────────────╯`, [
        { text: 'Sytem DARK Channel', url: process.env.CHANNEL_URL || 'https://whatsapp.com/channel/' },
        { text: 'Copiar Dono', copy: '+244945280380' }
      ], msg, { footer: t.footer });
    }
    case 'play': case 'play2': case 'play3': case 'tocar': case 'ytmp3': case 'yt3v2': {
      if (!q) return ctx.reply(`Use: *${prefix + command} nome ou link*`);
      await ctx.react('⏳'); try { await ytmp3(sock, from, q, msg); await ctx.react('✅'); } catch (e) { await ctx.react('❌'); await ctx.reply('❌ Erro: ' + e.message); } return;
    }
    case 'playvid': case 'ytmp4': case 'yt4v2': {
      if (!q) return ctx.reply(`Use: *${prefix + command} nome ou link*`);
      await ctx.react('⏳'); try { await ytmp4(sock, from, q, msg); await ctx.react('✅'); } catch (e) { await ctx.react('❌'); await ctx.reply('❌ Erro: ' + e.message); } return;
    }
    case 'tiktok': case 'tt': case 'tiktokmp3': {
      if (!q) return ctx.reply(`Use: *${prefix + command} link*`);
      await ctx.react('⏳'); try { await tiktok(sock, from, q, msg, command === 'tiktokmp3'); await ctx.react('✅'); } catch (e) { await ctx.react('❌'); await ctx.reply('❌ ' + e.message); } return;
    }
    case 'instagram': case 'ig': case 'facebook': case 'fb': case 'twitterdl': case 'twitter': case 'tw': case 'x': case 'spotify': case 'spotify2': case 'soundcloud': case 'sc': case 'scdl': {
      if (!q) return ctx.reply(`Use: *${prefix + command} link*`);
      await ctx.react('⏳'); try { await genericDownload(sock, from, command, q, msg); await ctx.react('✅'); } catch (e) { await ctx.react('❌'); await ctx.reply('❌ ' + e.message); } return;
    }
    case 'ytsearch': case 'pesquisaryt': { if (!q) return ctx.reply(`Use: *${prefix}ytsearch música*`); const v = await searchYoutube(q); return ctx.reply(v ? `🎬 *${v.title}*\n⏱️ ${v.timestamp}\n👤 ${v.author?.name || '-'}\n🔗 ${v.url}` : 'Nada encontrado.'); }
    case 'comprar': {
      const produtos = {
        '1': 'BOT PERSONALIZÁVEL', '2': 'Site HTML', '3': 'Premium Bot 30 dias', '4': 'Configuração de grupo'
      };
      const id = args[0];
      if (!produtos[id]) return ctx.reply(`Use: *${prefix}comprar 1*
Veja: *${prefix}catalogo*`);
      const dono = `${config.donoJid}@s.whatsapp.net`;
      await sock.sendMessage(dono, { text: `🛒 *NOVO INTERESSE DE COMPRA*

▣ Produto: ${produtos[id]}
▣ Usuário: @${onlyNumbers(ctx.sender)}
▣ Grupo/chat: ${from}`, mentions: [ctx.sender] }).catch(()=>{});
      return ctx.reply(`✅ Pedido registrado: *${produtos[id]}*
Dark Net foi avisado.`, { mentions: [ctx.sender] });
    }
    case 'cassino': {
      const u = db.user(ctx.sender); const aposta = Math.max(1, Number(args[0] || 10));
      if ((u.money || 0) < aposta) return ctx.reply(`💰 Saldo insuficiente. Seu saldo: ${u.money || 0}`);
      const win = Math.random() < 0.48; u.money += win ? aposta : -aposta; db.setUser(ctx.sender, u);
      return ctx.reply(`${win ? '🎰 Você venceu!' : '🎰 Você perdeu!'}
Aposta: ${aposta}
Saldo: ${u.money}`);
    }
    case 'moeda': {
      const lado = (args[0] || '').toLowerCase(); if (!['cara','coroa'].includes(lado)) return ctx.reply(`Use: *${prefix}moeda cara* ou *${prefix}moeda coroa*`);
      const res = Math.random() < 0.5 ? 'cara' : 'coroa'; return ctx.reply(`🪙 Resultado: *${res}*
${res === lado ? '✅ Acertou!' : '❌ Errou!'}`);
    }
    case 'ppt': {
      const jog = (args[0] || '').toLowerCase(); const ops = ['pedra','papel','tesoura']; if (!ops.includes(jog)) return ctx.reply(`Use: *${prefix}ppt pedra/papel/tesoura*`);
      const bot = ops[Math.floor(Math.random()*3)]; const win = (jog==='pedra'&&bot==='tesoura')||(jog==='papel'&&bot==='pedra')||(jog==='tesoura'&&bot==='papel');
      return ctx.reply(`Você: ${jog}
Bot: ${bot}
${jog===bot?'Empate 🤝':win?'Você venceu ✅':'Você perdeu ❌'}`);
    }
    case 'brincadeiras': return ctx.reply(`${header(t, 'MENU BRINCADEIRAS')}\n${t.bullet} ${prefix}chance texto\n${t.bullet} ${prefix}gay @\n${t.bullet} ${prefix}gado @\n${t.bullet} ${prefix}corno @\n${t.bullet} ${prefix}ship @ @\n${t.bullet} ${prefix}rank`);
    case 'chance': return ctx.reply(`🎲 Chance de *${q || 'isso'}*: *${Math.floor(Math.random()*101)}%*`);
    case 'gay': case 'gado': case 'corno': { const target = await getTarget(ctx); return ctx.reply(`🏆 @${onlyNumbers(target || ctx.sender)} é ${command} em *${Math.floor(Math.random()*101)}%*`, { mentions: [target || ctx.sender] }); }
    case 'ship': { const ms = ctx.mentions; if (ms.length < 2) return ctx.reply(`Marque 2 pessoas: *${prefix}ship @a @b*`); return ctx.reply(`💘 Compatibilidade de @${onlyNumbers(ms[0])} + @${onlyNumbers(ms[1])}: *${Math.floor(Math.random()*101)}%*`, { mentions: ms }); }
    case 'interacoes': return ctx.reply(`${header(t, 'INTERAÇÕES')}\n${t.bullet} ${prefix}abraco @\n${t.bullet} ${prefix}beijo @\n${t.bullet} ${prefix}tapa @\n${t.bullet} ${prefix}cafune @\n${t.bullet} ${prefix}casar @`);
    case 'abraco': case 'beijo': case 'tapa': case 'cafune': case 'casar': { const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém.'); const phrases = { abraco: 'abraçou', beijo: 'beijou', tapa: 'deu tapa em', cafune: 'fez cafuné em', casar: 'pediu casamento para' }; return ctx.reply(`✨ @${onlyNumbers(ctx.sender)} ${phrases[command]} @${onlyNumbers(target)}.`, { mentions: [ctx.sender, target] }); }
    case 'rank': case 'rankzoeiras': { if (!(await requireGroup(ctx))) return; const users = db.users; const members = (ctx.participants || []).map(p => p.id || p.jid); const top = members.map(j => [j, users[j]?.xp || 0]).sort((a,b)=>b[1]-a[1]).slice(0,10); return ctx.reply(`${header(t, 'RANK ZOEIRAS')}\n\n${top.map((x,i)=>`${i+1}. @${onlyNumbers(x[0])} — ${x[1]} XP`).join('\n') || 'Sem dados.'}`, { mentions: top.map(x=>x[0]) }); }
    case 'perfil': { const u = db.user(ctx.sender); return ctx.reply(`${header(t, 'SEU PERFIL')}\n👤 @${onlyNumbers(ctx.sender)}\n⭐ XP: ${u.xp}\n📈 Level: ${u.level}\n⌨️ Comandos: ${u.cmds}`, { mentions: [ctx.sender] }); }
    case 'level': return ctx.reply(`📈 Seu level: *${db.user(ctx.sender).level}*`);
    case 'saldo': return ctx.reply(`💰 Saldo: *${db.user(ctx.sender).money || 0} DARK coins*`);
    case 'daily': { const u = db.user(ctx.sender); u.money = (u.money || 0) + 100; const all = db.users; all[ctx.sender] = u; db.users = all; return ctx.reply('🎁 Daily recebido: +100 DARK coins.'); }
    case 'minerar': { const u = db.user(ctx.sender); const v = Math.floor(Math.random()*50)+10; u.money = (u.money || 0) + v; const all = db.users; all[ctx.sender]=u; db.users=all; return ctx.reply(`⛏️ Você minerou ${v} DARK coins.`); }
    case 'consultas': return ctx.reply(`${header(t, 'CONSULTAS E DADOS')}\n${t.bullet} ${prefix}clima cidade\n${t.bullet} ${prefix}wiki termo\n${t.bullet} ${prefix}calc 10+5*2\n${t.bullet} ${prefix}frases\n${t.bullet} ${prefix}biblia\n${t.bullet} ${prefix}dog\n${t.bullet} ${prefix}cat\n${t.bullet} ${prefix}github dono/repositorio\n${t.bullet} ${prefix}perfil`);
    case 'frases': case 'frase': { const frase = await quotePt(); return ctx.reply(`💡 *Frase Dark*\n\n${frase}`); }
    case 'biblia': { const verso = await bibleVerse(); return ctx.reply(`📖 *Versículo*\n\n${verso}`); }
    case 'dog': case 'cachorro': { const url = await randomDog(); if (!url) return ctx.reply('❌ API indisponível agora.'); return sock.sendMessage(from, { image: { url }, caption: '🐶 Sytem DARK' }, { quoted: msg }); }
    case 'cat': case 'gato': { const url = await randomCat(); if (!url) return ctx.reply('❌ API indisponível agora.'); return sock.sendMessage(from, { image: { url }, caption: '🐱 Sytem DARK' }, { quoted: msg }); }
    case 'github': { if (!q) return ctx.reply(`Use: *${prefix}github dono/repositorio*`); try { const r = await githubRepo(q); return ctx.reply(`🐙 *GitHub*\n\n▣ Repo: ${r.full_name}\n▣ Stars: ${r.stargazers_count}\n▣ Forks: ${r.forks_count}\n▣ Linguagem: ${r.language || '-'}\n▣ Link: ${r.html_url}`); } catch(e) { return ctx.reply('❌ ' + e.message); } }
    case 'calc': { if (!/^[0-9+\-*/().,%\s]+$/.test(q)) return ctx.reply('Expressão inválida.'); return ctx.reply(`🧮 Resultado: *${Function(`return (${q.replace(/,/g,'.')})`)()}*`); }
    case 'clima': { if (!q) return ctx.reply(`Use: *${prefix}clima Luanda*`); const axios = require('axios'); const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(q)}?format=3`, { timeout: 15000 }); return ctx.reply(`🌦️ ${data}`); }
    case 'wiki': { if (!q) return ctx.reply(`Use: *${prefix}wiki termo*`); const axios = require('axios'); const { data } = await axios.get(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { timeout: 15000 }); return ctx.reply(`📚 *${data.title || q}*\n\n${data.extract || 'Sem resumo.'}\n${data.content_urls?.desktop?.page || ''}`); }
    case 'antilink': case 'antilinkhard': case 'boasvindas': case 'despedida': { if (!(await requireAdmin(ctx))) return; const key = command === 'antilinkhard' ? 'antilinkHard' : command; const val = (args[0] || '').toLowerCase().replace('1','on').replace('0','off'); if (!['on','off'].includes(val)) return ctx.reply(`Status: *${g[key] ? 'ON' : 'OFF'}*\nUse: *${prefix + command} on/off*`); db.setGroup(from, { [key]: val === 'on' }); return ctx.reply(`✅ ${command} ${val === 'on' ? 'ativado' : 'desativado'}.`); }
    case 'statusgp': {
      if (!(await requireGroup(ctx))) return;
      return ctx.reply(`${header(t, 'STATUS DO GRUPO')}
▣ Antilink: ${g.antilink ? '✅' : '❌'}
▣ Antilink Hard: ${g.antilinkHard ? '✅' : '❌'}
▣ Bem-vindo: ${g.boasvindas ? '✅' : '❌'}
▣ Saída: ${g.despedida ? '✅' : '❌'}
▣ Mutados: ${(g.mutados || []).length}
▣ Cmds bloqueados: ${(g.blockedCmds || []).join(', ') || 'nenhum'}`);
    }
    case 'mutar': {
      if (!(await requireAdmin(ctx))) return;
      const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém para mutar.');
      const set = new Set(g.mutados || []); set.add(target); db.setGroup(from, { mutados: [...set] });
      return ctx.reply(`🔇 @${onlyNumbers(target)} foi mutado.`, { mentions: [target] });
    }
    case 'desmutar': {
      if (!(await requireAdmin(ctx))) return;
      const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém para desmutar.');
      db.setGroup(from, { mutados: (g.mutados || []).filter(x => onlyNumbers(x) !== onlyNumbers(target)) });
      return ctx.reply(`🔊 @${onlyNumbers(target)} foi desmutado.`, { mentions: [target] });
    }
    case 'blockcmd': {
      if (!(await requireOwner(ctx))) return;
      const cmd = (args[0] || '').replace(prefix,'').toLowerCase(); if (!cmd) return ctx.reply(`Use: ${prefix}blockcmd comando`);
      const set = new Set(g.blockedCmds || []); set.add(cmd); db.setGroup(from, { blockedCmds: [...set] });
      return ctx.reply(`🚫 Comando bloqueado neste grupo: ${cmd}`);
    }
    case 'unblockcmd': {
      if (!(await requireOwner(ctx))) return;
      const cmd = (args[0] || '').replace(prefix,'').toLowerCase(); if (!cmd) return ctx.reply(`Use: ${prefix}unblockcmd comando`);
      db.setGroup(from, { blockedCmds: (g.blockedCmds || []).filter(x => x !== cmd) });
      return ctx.reply(`✅ Comando desbloqueado: ${cmd}`);
    }
    case 'fechargrupo': case 'fechar': if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; await sock.groupSettingUpdate(from, 'announcement'); return ctx.reply('🔒 Grupo fechado.');
    case 'abrirgrupo': case 'abrir': if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; await sock.groupSettingUpdate(from, 'not_announcement'); return ctx.reply('🔓 Grupo aberto.');
    case 'ban': case 'banir': case 'remover': { if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; const target = await getTarget(ctx); if (!target) return ctx.reply('Marque ou responda alguém.'); await sock.groupParticipantsUpdate(from, [target], 'remove'); return ctx.reply(`✅ Removido: @${onlyNumbers(target)}`, { mentions: [target] }); }
    case 'promover': case 'daradm': { if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém.'); await sock.groupParticipantsUpdate(from, [target], 'promote'); return ctx.reply(`👑 Promovido: @${onlyNumbers(target)}`, { mentions: [target] }); }
    case 'rebaixar': case 'tiraradm': { if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém.'); await sock.groupParticipantsUpdate(from, [target], 'demote'); return ctx.reply(`✅ Rebaixado: @${onlyNumbers(target)}`, { mentions: [target] }); }
    case 'marcar': case 'hidetag': { if (!(await requireAdmin(ctx))) return; const members = ctx.participants.map(p => p.id || p.jid); return sock.sendMessage(from, { text: q || '🌀 Chamando todos...', mentions: members }, { quoted: msg }); }
    case 'marcaradmins': { if (!(await requireAdmin(ctx))) return; return ctx.reply(`👑 *Admins:*\n${ctx.admins.map((a,i)=>`${i+1}. @${onlyNumbers(a)}`).join('\n')}`, { mentions: ctx.admins }); }
    case 'membros': case 'participantes': { if (!(await requireGroup(ctx))) return; return ctx.reply(`👥 Membros: *${ctx.participants.length}*\n👑 Admins: *${ctx.admins.length}*`); }
    case 'infogrupo': { if (!(await requireGroup(ctx))) return; return ctx.reply(`${header(t, 'INFO DO GRUPO')}\n📌 Nome: *${ctx.metadata.subject}*\n👥 Membros: *${ctx.participants.length}*\n👑 Admins: *${ctx.admins.length}*\n📝 Descrição:\n${ctx.metadata.desc || 'Sem descrição.'}`); }
    case 'mudarnome': if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; if (!q) return ctx.reply('Digite o novo nome.'); await sock.groupUpdateSubject(from, q); return ctx.reply('✅ Nome alterado.');
    case 'mudardesc': if (!(await requireAdmin(ctx)) || !(await requireBotAdmin(ctx))) return; await sock.groupUpdateDescription(from, q || ''); return ctx.reply('✅ Descrição alterada.');
    case 'd': case 'del': case 'apagar': { const key = quotedKey(msg); if (!key) return ctx.reply('Responda a mensagem que quer apagar.'); await sock.sendMessage(from, { delete: key }); return; }
    case 'bc': { if (!(await requireOwner(ctx))) return; if (!q) return ctx.reply(`Use: *${prefix}bc mensagem*`); const chats = await sock.groupFetchAllParticipating(); const ids = Object.keys(chats); let ok = 0; for (const id of ids) { await sock.sendMessage(id, { text: `📢 *COMUNICADO DARK NET*\n\n${q}` }).then(()=>ok++).catch(()=>{}); } return ctx.reply(`✅ Broadcast enviado para ${ok}/${ids.length} grupos.`); }
    case 'join': { if (!(await requireOwner(ctx))) return; const code = q.match(/chat\.whatsapp\.com\/([0-9A-Za-z]+)/)?.[1] || q; await sock.groupAcceptInvite(code); return ctx.reply('✅ Entrei no grupo.'); }
    case 'sairgrupo': if (!(await requireOwner(ctx)) || !(await requireGroup(ctx))) return; await ctx.reply('👋 Sytem DARK saindo...'); return sock.groupLeave(from);
    case 'bloquear': case 'desbloquear': { if (!(await requireOwner(ctx))) return; const target = await getTarget(ctx); if (!target) return ctx.reply('Marque alguém.'); await sock.updateBlockStatus(target, command === 'bloquear' ? 'block' : 'unblock'); return ctx.reply('✅ Feito.'); }
    case 'reiniciar': if (!(await requireOwner(ctx))) return; await ctx.reply('🔄 Reiniciando...'); return process.exit(0);
    default: return null;
  }
}
module.exports = { configFromEnv, handleCommand, preModeration };
