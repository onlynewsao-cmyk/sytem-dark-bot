const axios = require('axios');
const QRCode = require('qrcode');
const sharp = require('sharp');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const config = require('../config');
const User = require('../models/User');
const Group = require('../models/Group');
const BotSettings = require('../models/BotSettings');
const DynamicCommand = require('../models/DynamicCommand');
const GameSession = require('../models/GameSession');
const Media = require('../models/Media');
const menus = require('../menus');
const mediaStore = require('../services/mediaStore');
const { directDownload } = require('../services/downloaders');
const { vcard } = require('../lib/reply');
const {
  targetJid,
  mentionedJids,
  pick,
  rand,
  money,
  parseAmount,
  human,
  cooldown,
  addXp,
  renderProgress,
  extractInviteCode
} = require('../lib/utils');

function yesNo(value, current = false) {
  const v = String(value || '').toLowerCase();
  if (['on', '1', 'sim', 'true', 'ativar', 'ativo'].includes(v)) return true;
  if (['off', '0', 'nao', 'não', 'false', 'desativar'].includes(v)) return false;
  return !current;
}

function splitCsv(text) {
  return String(text || '').split(',').map((x) => x.trim()).filter(Boolean);
}

function jidToMention(jid) {
  return `@${String(jid).split('@')[0]}`;
}

async function needOwner(ctx) {
  if (!ctx.isOwner) {
    await ctx.reply('👑 Apenas o dono/donos do DARK System podem usar este comando.');
    return false;
  }
  return true;
}

async function needAdmin(ctx) {
  if (!ctx.isGroup) {
    await ctx.reply('👥 Este comando só funciona em grupos.');
    return false;
  }
  if (!ctx.isAdmin && !ctx.isOwner) {
    await ctx.reply('🛡️ Apenas administradores podem usar este comando.');
    return false;
  }
  return true;
}

async function needBotAdmin(ctx) {
  if (!ctx.isGroup) {
    await ctx.reply('👥 Este comando só funciona em grupos.');
    return false;
  }
  if (!ctx.isBotAdmin) {
    await ctx.reply('⚠️ Preciso ser administrador do grupo para executar isto.');
    return false;
  }
  return true;
}

async function getTargetUser(ctx, fallbackSelf = false) {
  const jid = targetJid(ctx.msg, ctx.args) || (fallbackSelf ? ctx.sender : '');
  if (!jid) return null;
  return User.findOneAndUpdate(
    { jid },
    { $setOnInsert: { jid, number: jid.split('@')[0] } },
    { upsert: true, new: true }
  );
}

async function saveUser(user) {
  user.markModified('cooldowns');
  user.markModified('inventory');
  user.markModified('rpg');
  return user.save();
}

function renderBoard(board) {
  return board.map((v, i) => v || String(i + 1)).reduce((acc, v, i) => {
    acc += ` ${v} `;
    if (i % 3 !== 2) acc += '┃';
    if (i % 3 === 2 && i !== 8) acc += '\n━━━╋━━━╋━━━\n';
    return acc;
  }, '');
}

function winner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  if (board.every(Boolean)) return 'draw';
  return '';
}

const quizBank = [
  { q: 'Qual é a capital de Angola?', a: 'luanda' },
  { q: 'Quanto é 12 x 12?', a: '144' },
  { q: 'Qual elemento químico tem símbolo O?', a: 'oxigenio' },
  { q: 'Em que continente fica Angola?', a: 'africa' },
  { q: 'Qual protocolo inicia URLs seguras na web?', a: 'https' }
];
const forcaWords = ['luanda', 'mongodb', 'render', 'whatsapp', 'baileys', 'darknet', 'arsenal'];

module.exports = async function cases(ctx) {
  const { sock, chatId, msg, prefix, command, args, text, user } = ctx;

  switch (command) {
    // ───────────── MENUS / BASE ─────────────
    case 'menu':
    case 'help':
    case 'comandos':
      await ctx.buttons(menus.menuPrincipal(ctx), [
        { id: `${prefix}menuadm`, text: '🛡️ ADM' },
        { id: `${prefix}menujogos`, text: '🎮 Jogos' },
        { id: `${prefix}menudono`, text: '👑 Dono' }
      ]);
      return true;
    case 'menuadm': await ctx.reply(menus.menuAdm(ctx)); return true;
    case 'menuprotecao': case 'menuproteção': await ctx.reply(menus.menuProtecao(ctx)); return true;
    case 'menudono': await ctx.reply(menus.menuDono(ctx)); return true;
    case 'menuhosp': case 'menuhospedagem': await ctx.reply(menus.menuHosp(ctx)); return true;
    case 'menuvip': await ctx.reply(menus.menuVip(ctx)); return true;
    case 'menueconomia': await ctx.reply(menus.menuEconomia(ctx)); return true;
    case 'menujogos': await ctx.reply(menus.menuJogos(ctx)); return true;
    case 'menurpg': await ctx.reply(menus.menuRpg(ctx)); return true;
    case 'menusocial': await ctx.reply(menus.menuSocial(ctx)); return true;
    case 'menudiversao': case 'menudiversão': await ctx.reply(menus.menuDiversao(ctx)); return true;
    case 'menuranks': case 'menurank': await ctx.reply(menus.menuRanks(ctx)); return true;
    case 'menudownload': await ctx.reply(menus.menuDownload(ctx)); return true;
    case 'menufig': case 'menufigurinhas': await ctx.reply(menus.menuFig(ctx)); return true;
    case 'menuutil': await ctx.reply(menus.menuUtil(ctx)); return true;
    case 'menugaleria': await ctx.reply(menus.menuGaleria(ctx)); return true;

    case 'ping': {
      const up = human(process.uptime() * 1000);
      await ctx.reply(`🏓 Pong!\n🤖 ${ctx.settings.botName}\n⏱️ Uptime: ${up}\n🕒 ${ctx.now}`);
      return true;
    }
    case 'hora': await ctx.reply(`🕒 Hora local: ${ctx.now}`); return true;
    case 'data': await ctx.reply(`📅 Data/hora em Luanda: ${ctx.now}`); return true;
    case 'statusbot': case 'botinfo': case 'runtime': { const groups = await Group.countDocuments(); const users = await User.countDocuments(); const media = await Media.countDocuments(); await ctx.reply(`⚡ STATUS DARK SYSTEM\nBot: ${ctx.settings.botName}\nDono: Dark Net\nUptime: ${human(process.uptime()*1000)}\nGrupos salvos: ${groups}\nUsuários salvos: ${users}\nMídias: ${media}\nModo manutenção: ${ctx.settings.maintenance ? 'ON' : 'OFF'}\nConexão: Pair Code ${config.usePairingCode ? 'ON' : 'OFF'}\nNúmero do bot: +${config.botNumber}`); return true; }
    case 'pairinfo': { if (!await needOwner(ctx)) return true; await ctx.reply(`🔐 PAIR CODE\nUSE_PAIRING_CODE: ${config.usePairingCode ? 'true' : 'false'}\nPAIRING_NUMBER: +${config.pairingNumber}\nRota web: /pair?key=SUA_QR_WEB_KEY\n\nSe já existe sessão no MongoDB, o código não aparece. Para parear novamente, apague a coleção baileys_auth no MongoDB e reinicie.`); return true; }
    case 'dono': {
      const contact = ctx.settings.businessContact || {};
      await sock.sendMessage(chatId, {
        contacts: {
          displayName: contact.name || config.ownerName,
          contacts: [{ vcard: vcard({ name: contact.name || config.ownerName, phone: contact.phone || config.ownerNumber, org: contact.org || 'DARK System', email: contact.email, site: contact.site }) }]
        }
      }, { quoted: msg });
      await ctx.reply('👑 Dono oficial: Dark Net\n📌 Observação: selo verde/verificado oficial só é fornecido pela Meta/WhatsApp Business; o bot não falsifica verificação.');
      return true;
    }

    // ───────────── ADMIN GRUPO ─────────────
    case 'ban':
    case 'kick': {
      if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true;
      const jid = targetJid(msg, args);
      if (!jid) return ctx.reply(`Marque ou responda alguém. Ex: ${prefix}ban @membro`), true;
      await sock.groupParticipantsUpdate(chatId, [jid], 'remove');
      await ctx.reply(`✅ ${jidToMention(jid)} foi removido.`, [jid]);
      return true;
    }
    case 'add': {
      if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true;
      const jid = config.toUserJid(args[0]);
      if (!jid) return ctx.reply(`Use: ${prefix}add 2449xxxxxxx`), true;
      await sock.groupParticipantsUpdate(chatId, [jid], 'add');
      await ctx.reply(`✅ Convite/adicionar solicitado para ${jidToMention(jid)}.`, [jid]);
      return true;
    }
    case 'promover':
    case 'promote': {
      if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true;
      const jid = targetJid(msg, args);
      if (!jid) return ctx.reply('Marque o alvo.'), true;
      await sock.groupParticipantsUpdate(chatId, [jid], 'promote');
      await ctx.reply(`🛡️ ${jidToMention(jid)} promovido a ADM.`, [jid]);
      return true;
    }
    case 'rebaixar':
    case 'demote': {
      if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true;
      const jid = targetJid(msg, args);
      if (!jid) return ctx.reply('Marque o alvo.'), true;
      await sock.groupParticipantsUpdate(chatId, [jid], 'demote');
      await ctx.reply(`⬇️ ${jidToMention(jid)} rebaixado.`, [jid]);
      return true;
    }
    case 'abrirgp': if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; await sock.groupSettingUpdate(chatId, 'not_announcement'); await ctx.reply('🔓 Grupo aberto.'); return true;
    case 'fechargp': if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; await sock.groupSettingUpdate(chatId, 'announcement'); await ctx.reply('🔒 Grupo fechado.'); return true;
    case 'mutargp': { if (!await needAdmin(ctx)) return true; ctx.group.adminOnly = true; await ctx.group.save(); await ctx.reply('🔇 Modo ADM ativado: só administradores usam comandos.'); return true; }
    case 'desmutargp': { if (!await needAdmin(ctx)) return true; ctx.group.adminOnly = false; await ctx.group.save(); await ctx.reply('🔊 Modo ADM desativado.'); return true; }
    case 'modoadm': { if (!await needAdmin(ctx)) return true; ctx.group.adminOnly = yesNo(args[0], ctx.group.adminOnly); await ctx.group.save(); await ctx.reply(`🔐 Modo ADM: ${ctx.group.adminOnly ? 'ON' : 'OFF'}`); return true; }
    case 'admins': { if (!ctx.isGroup) return ctx.reply('Use em grupo.'), true; const admins = ctx.participants.filter((p)=>p.admin).map((p)=>p.id); await ctx.reply(`🛡️ Administradores (${admins.length})\n${admins.map(jidToMention).join('\n') || 'Nenhum.'}`, admins); return true; }
    case 'membros': { if (!ctx.isGroup) return ctx.reply('Use em grupo.'), true; await ctx.reply(`👥 Membros do grupo: ${ctx.participants.length}`); return true; }
    case 'limpar': { if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; await sock.sendMessage(chatId, { delete: msg.key }).catch(() => null); await ctx.reply('🧹 Limpeza solicitada. O WhatsApp não permite apagar mensagens antigas em massa pelo bot; posso apagar mensagens específicas quando o bot tem permissão.'); return true; }
    case 'linkgp': { if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; const code = await sock.groupInviteCode(chatId); ctx.group.inviteCode = code; await ctx.group.save(); await ctx.reply(`🔗 Link do grupo:\nhttps://chat.whatsapp.com/${code}`); return true; }
    case 'revogarlink': { if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; const code = await sock.groupRevokeInvite(chatId); ctx.group.inviteCode = code; await ctx.group.save(); await ctx.reply(`🔄 Link revogado. Novo link:\nhttps://chat.whatsapp.com/${code}`); return true; }
    case 'setnomegp': { if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}setnomegp novo nome`), true; await sock.groupUpdateSubject(chatId, text.slice(0, 75)); await ctx.reply('✅ Nome do grupo atualizado.'); return true; }
    case 'setdesc': { if (!await needAdmin(ctx) || !await needBotAdmin(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}setdesc descrição`), true; await sock.groupUpdateDescription(chatId, text); await ctx.reply('✅ Descrição atualizada.'); return true; }
    case 'tagall': { if (!await needAdmin(ctx)) return true; const mentions = ctx.participants.map((p) => p.id); await ctx.reply(`📢 Chamada geral\n${text || ''}\n\n${mentions.map(jidToMention).join(' ')}`, mentions); return true; }
    case 'hidetag': { if (!await needAdmin(ctx)) return true; const mentions = ctx.participants.map((p) => p.id); await ctx.reply(text || '📢', mentions); return true; }
    case 'antilink': case 'antibot': case 'antistatus': case 'antimencaostatus': case 'bemvindo': {
      if (!await needAdmin(ctx)) return true;
      const prop = command === 'bemvindo' ? 'welcome' : command;
      ctx.group[prop] = yesNo(args[0], ctx.group[prop]);
      await ctx.group.save();
      await ctx.reply(`✅ ${command}: ${ctx.group[prop] ? 'ON' : 'OFF'}`);
      return true;
    }
    case 'statusgp': {
      if (!ctx.isGroup) return ctx.reply('Este comando só funciona em grupos.'), true;
      await ctx.reply(`📊 STATUS DO GRUPO\nNome: ${ctx.groupName}\nPlano: ${ctx.group.plan}\nBot ADM: ${ctx.isBotAdmin ? 'sim' : 'não'}\nAntilink: ${ctx.group.antilink ? 'ON' : 'OFF'}\nAntistatus: ${ctx.group.antistatus ? 'ON' : 'OFF'}\nAntiMençãoStatus: ${ctx.group.antimencaostatus ? 'ON' : 'OFF'}\nBem-vindo: ${ctx.group.welcome ? 'ON' : 'OFF'}\nPrefixos: ${(ctx.group.prefixes?.length ? ctx.group.prefixes : ctx.settings.prefixes).join(' ')}`);
      return true;
    }
    case 'setprefix': {
      if (!await needAdmin(ctx)) return true;
      const list = splitCsv(text || args.join(','));
      if (!list.length) return ctx.reply(`Use: ${prefix}setprefix !,.,/`), true;
      ctx.group.prefixes = list;
      await ctx.group.save();
      await ctx.reply(`✅ Prefixos deste grupo: ${list.join(' ')}`);
      return true;
    }
    case 'prefixos': await ctx.reply(`🔣 Prefixos ativos: ${(ctx.prefixes || []).join(' ')}`); return true;
    case 'setregras': { if (!await needAdmin(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}setregras texto`), true; ctx.group.rules = text; await ctx.group.save(); await ctx.reply('✅ Regras atualizadas.'); return true; }
    case 'regras': await ctx.reply(`📜 Regras do grupo:\n${ctx.group?.rules || 'Sem regras cadastradas.'}`); return true;
    case 'advertir': { if (!await needAdmin(ctx)) return true; const jid = targetJid(msg, args); if (!jid) return ctx.reply('Marque o alvo.'), true; const n = Number(ctx.group.warnings.get(jid) || 0) + 1; ctx.group.warnings.set(jid, n); ctx.group.markModified('warnings'); await ctx.group.save(); await ctx.reply(`⚠️ ${jidToMention(jid)} recebeu advertência ${n}/3.`, [jid]); if (n >= 3 && ctx.isBotAdmin) await sock.groupParticipantsUpdate(chatId, [jid], 'remove').catch(() => null); return true; }
    case 'zeraradv': { if (!await needAdmin(ctx)) return true; const jid = targetJid(msg, args); if (!jid) return ctx.reply('Marque o alvo.'), true; ctx.group.warnings.set(jid, 0); ctx.group.markModified('warnings'); await ctx.group.save(); await ctx.reply(`✅ Advertências de ${jidToMention(jid)} zeradas.`, [jid]); return true; }
    case 'advs': { const jid = targetJid(msg, args) || ctx.sender; const n = Number(ctx.group?.warnings?.get(jid) || 0); await ctx.reply(`⚠️ ${jidToMention(jid)} tem ${n}/3 advertências.`, [jid]); return true; }

    // ───────────── DONO ─────────────
    case 'painel': {
      if (!await needOwner(ctx)) return true;
      const groups = await Group.countDocuments();
      const users = await User.countDocuments();
      const dyn = await DynamicCommand.countDocuments();
      await ctx.reply(`👑 PAINEL DARK SYSTEM\nGrupos: ${groups}\nUsuários: ${users}\nCases dinâmicos: ${dyn}\nComandos executados: ${ctx.settings.stats.commands}\nMensagens vistas: ${ctx.settings.stats.messages}\nUptime: ${human(process.uptime()*1000)}`);
      return true;
    }
    case 'manutencao': case 'manutenção': { if (!await needOwner(ctx)) return true; ctx.settings.maintenance = yesNo(args[0], ctx.settings.maintenance); await ctx.settings.save(); await ctx.reply(`🛠️ Manutenção: ${ctx.settings.maintenance ? 'ON' : 'OFF'}`); return true; }
    case 'reiniciar': { if (!await needOwner(ctx)) return true; await ctx.reply('♻️ Reiniciando DARK System. No Render, o serviço sobe novamente automaticamente.'); setTimeout(() => process.exit(0), 1200); return true; }
    case 'setplan': { if (!await needOwner(ctx)) return true; if (!ctx.isGroup) return ctx.reply('Use dentro do grupo.'), true; const plan = String(args[0] || '').toLowerCase(); if (!['free','vip','premium'].includes(plan)) return ctx.reply(`Use: ${prefix}setplan free/vip/premium`), true; ctx.group.plan = plan; await ctx.group.save(); await ctx.reply(`✅ Plano do grupo definido como: ${plan}`); return true; }
    case 'viplist': { if (!await needOwner(ctx)) return true; const list = await User.find({ vipUntil: { $gt: new Date() } }).sort({ vipUntil: -1 }).limit(50); await ctx.reply(`💎 VIPs ativos\n${list.map((u)=>`• @${u.number} até ${u.vipUntil.toLocaleDateString('pt-AO')}`).join('\n') || 'Nenhum VIP ativo.'}`, list.map((u)=>u.jid)); return true; }
    case 'addcoins': case 'remcoins': case 'setcoins': case 'addxp': case 'setlevel': case 'setfama': { if (!await needOwner(ctx)) return true; const u = await getTargetUser(ctx); const amount = parseAmount(args.at(-1)); if (!u || !Number.isFinite(amount)) return ctx.reply(`Use: ${prefix}${command} @user valor`), true; if (command === 'addcoins') u.coins += amount; if (command === 'remcoins') u.coins = Math.max(0, u.coins - amount); if (command === 'setcoins') u.coins = amount; if (command === 'addxp') addXp(u, amount); if (command === 'setlevel') u.level = Math.max(1, amount); if (command === 'setfama') u.fame = amount; await saveUser(u); await ctx.reply(`✅ Cheat aplicado em ${jidToMention(u.jid)}: ${command} ${amount}.`, [u.jid]); return true; }
    case 'resetuser': { if (!await needOwner(ctx)) return true; const u = await getTargetUser(ctx); if (!u) return ctx.reply('Marque o usuário.'), true; u.coins = 500; u.bank = 0; u.xp = 0; u.level = 1; u.rep = 0; u.fame = 0; u.wins = 0; u.losses = 0; u.inventory = new Map(); u.rpg = { className: 'Sem classe', hp: 100, maxHp: 100, atk: 12, def: 5, area: 'Luanda Sombria', monsters: 0, bossKills: 0, power: 10 }; await saveUser(u); await ctx.reply(`🔄 Usuário resetado: ${jidToMention(u.jid)}`, [u.jid]); return true; }
    case 'setprefixglobal': { if (!await needOwner(ctx)) return true; const list = splitCsv(text); if (!list.length) return ctx.reply(`Use: ${prefix}setprefixglobal !,.,/`), true; ctx.settings.prefixes = list; await ctx.settings.save(); await ctx.reply(`✅ Prefixos globais: ${list.join(' ')}`); return true; }
    case 'addowner': case 'delowner': { if (!await needOwner(ctx)) return true; const n = config.onlyDigits(args[0] || text); if (!n) return ctx.reply(`Use: ${prefix}${command} 2449xxxxxxx`), true; const set = new Set(ctx.settings.ownerNumbers || []); command === 'addowner' ? set.add(n) : set.delete(n); set.add(config.ownerNumber); ctx.settings.ownerNumbers = [...set]; await ctx.settings.save(); await ctx.reply(`✅ Donos: ${ctx.settings.ownerNumbers.join(', ')}`); return true; }
    case 'addvip': { if (!await needOwner(ctx)) return true; const u = await getTargetUser(ctx); const days = parseAmount(args[1] || args[0], 30); if (!u) return ctx.reply('Marque o usuário e informe dias.'), true; u.vipUntil = new Date(Date.now() + days*86400000); await u.save(); await ctx.reply(`💎 VIP ativado para ${jidToMention(u.jid)} por ${days} dias.`, [u.jid]); return true; }
    case 'delvip': { if (!await needOwner(ctx)) return true; const u = await getTargetUser(ctx); if (!u) return ctx.reply('Marque o usuário.'), true; u.vipUntil = null; await u.save(); await ctx.reply(`💎 VIP removido de ${jidToMention(u.jid)}.`, [u.jid]); return true; }
    case 'banuser': case 'unbanuser': { if (!await needOwner(ctx)) return true; const u = await getTargetUser(ctx); if (!u) return ctx.reply('Marque o usuário.'), true; u.banned = command === 'banuser'; await u.save(); await ctx.reply(`${u.banned ? '⛔ Banido' : '✅ Desbanido'}: ${jidToMention(u.jid)}`, [u.jid]); return true; }
    case 'bangp': case 'desativargp': { if (!await needOwner(ctx)) return true; if (!ctx.isGroup) return ctx.reply('Use dentro do grupo.'), true; ctx.group.enabled = false; await ctx.group.save(); await ctx.reply('⛔ Grupo desativado no DARK System.'); return true; }
    case 'unbangp': case 'ativargp': { if (!await needOwner(ctx)) return true; if (!ctx.isGroup) return ctx.reply('Use dentro do grupo.'), true; ctx.group.enabled = true; await ctx.group.save(); await ctx.reply('✅ Grupo ativado no DARK System.'); return true; }
    case 'desativarcmd': { if (!await needAdmin(ctx)) return true; const c = String(args[0] || '').toLowerCase(); if (!c) return ctx.reply(`Use: ${prefix}desativarcmd nome`), true; if (!ctx.group.disabledCommands.includes(c)) ctx.group.disabledCommands.push(c); await ctx.group.save(); await ctx.reply(`⛔ Comando desativado: ${c}`); return true; }
    case 'ativarcmd': { if (!await needAdmin(ctx)) return true; const c = String(args[0] || '').toLowerCase(); ctx.group.disabledCommands = ctx.group.disabledCommands.filter((x) => x !== c); await ctx.group.save(); await ctx.reply(`✅ Comando ativado: ${c}`); return true; }
    case 'desativaruser': { if (!await needAdmin(ctx)) return true; const jid = targetJid(msg, args); if (!jid) return ctx.reply('Marque o alvo.'), true; if (!ctx.group.disabledUsers.includes(jid)) ctx.group.disabledUsers.push(jid); await ctx.group.save(); await ctx.reply(`⛔ Usuário silenciado no bot: ${jidToMention(jid)}`, [jid]); return true; }
    case 'ativaruser': { if (!await needAdmin(ctx)) return true; const jid = targetJid(msg, args); ctx.group.disabledUsers = ctx.group.disabledUsers.filter((x) => x !== jid); await ctx.group.save(); await ctx.reply(`✅ Usuário liberado: ${jidToMention(jid)}`, [jid]); return true; }
    case 'addcase': case 'addcmd': { if (!await needOwner(ctx)) return true; const [nameRaw, ...resp] = text.split('|'); const name = String(nameRaw || '').trim().toLowerCase(); const response = resp.join('|').trim(); if (!name || !response) return ctx.reply(`Use: ${prefix}addcase nome|resposta\nVariáveis: {user} {nome} {prefix} {bot} {grupo} {dono}`), true; await DynamicCommand.findOneAndUpdate({ name, scope: 'global', chatId: '' }, { name, response, scope: 'global', chatId: '', createdBy: ctx.sender }, { upsert: true }); await ctx.reply(`✅ Case dinâmico criado: ${prefix}${name}`); return true; }
    case 'remcase': case 'delcase': { if (!await needOwner(ctx)) return true; const name = String(args[0] || '').toLowerCase(); await DynamicCommand.deleteMany({ name }); await ctx.reply(`🗑️ Case removido: ${name}`); return true; }
    case 'listcases': { const list = await DynamicCommand.find().sort({ name: 1 }).limit(80); await ctx.reply(`📦 Cases dinâmicos:\n${list.map((c) => `• ${prefix}${c.name} (${c.scope})`).join('\n') || 'Nenhum.'}`); return true; }
    case 'keepout': case 'sairgp': { if (!await needOwner(ctx)) return true; if (!ctx.isGroup) return ctx.reply('Use em um grupo.'), true; await ctx.reply('👋 DARK System saindo do grupo por ordem do dono.'); await sock.groupLeave(chatId); return true; }
    case 'entergp': case 'ressurgeme': { if (!await needOwner(ctx)) return true; const code = extractInviteCode(text); if (!code) return ctx.reply(`Use: ${prefix}entergp link-do-grupo`), true; const jid = await sock.groupAcceptInvite(code); await ctx.reply(`✅ Entrei/solicitei entrada no grupo: ${jid}`); return true; }
    case 'grupos': { if (!await needOwner(ctx)) return true; const groups = await Group.find().sort({ updatedAt: -1 }).limit(30); await ctx.reply(`👥 Grupos cadastrados:\n${groups.map((g) => `• ${g.name || g.chatId}\n  ${g.chatId} | ${g.enabled ? 'ON' : 'OFF'} | ${g.plan}`).join('\n')}`); return true; }
    case 'broadcast': { if (!await needOwner(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}broadcast texto`), true; const groups = await Group.find({ enabled: true }); let ok = 0; for (const g of groups) { await sock.sendMessage(g.chatId, { text: `📣 DARK Broadcast\n\n${text}` }).then(() => ok++).catch(() => null); } await ctx.reply(`✅ Broadcast enviado para ${ok}/${groups.length} grupos.`); return true; }
    case 'setbio': { if (!await needOwner(ctx)) return true; await sock.updateProfileStatus(text || ctx.settings.verifiedStatusText); ctx.settings.verifiedStatusText = text || ctx.settings.verifiedStatusText; await ctx.settings.save(); await ctx.reply('✅ Bio/status do bot atualizado.'); return true; }
    case 'setnomebot': { if (!await needOwner(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}setnomebot nome`), true; await sock.updateProfileName(text); ctx.settings.botName = text; await ctx.settings.save(); await ctx.reply('✅ Nome do bot atualizado.'); return true; }
    case 'setppbot': { if (!await needOwner(ctx)) return true; if (!ctx.mediaInfo?.type?.includes('image')) return ctx.reply('Envie uma imagem com a legenda do comando setppbot.'), true; const buffer = await ctx.downloadMedia(); await sock.updateProfilePicture(sock.user.id, buffer); await ctx.reply('✅ Foto do bot atualizada.'); return true; }
    case 'setcontato': { if (!await needOwner(ctx)) return true; const [name, phone, org, email, site] = text.split('|').map((x) => x?.trim() || ''); if (!name || !phone) return ctx.reply(`Use: ${prefix}setcontato nome|fone|org|email|site`), true; ctx.settings.businessContact = { name, phone, org, email, site }; await ctx.settings.save(); await ctx.reply('✅ Contacto Business do menu atualizado.'); return true; }
    case 'setmenumidia': { if (!await needOwner(ctx)) return true; if (!text) return ctx.reply(`Use: ${prefix}setmenumidia url-ou-id`), true; if (ctx.isGroup) { if (/^https?:/i.test(text)) ctx.group.menuMediaUrl = text; else ctx.group.menuMediaId = text; await ctx.group.save(); } else { if (/^https?:/i.test(text)) ctx.settings.menuMediaUrl = text; else ctx.settings.menuMediaId = text; await ctx.settings.save(); } await ctx.reply('✅ Mídia do menu configurada.'); return true; }

    // ───────────── ECONOMIA ─────────────
    case 'saldo': { const u = await getTargetUser(ctx, true); await ctx.reply(`💰 Saldo de ${jidToMention(u.jid)}\nCarteira: ${money(u.coins)}\nBanco: ${money(u.bank)}\nLevel: ${u.level}\nXP: ${u.xp}/${u.level*120}`, [u.jid]); return true; }
    case 'daily': { const cd = cooldown(user, 'daily', 24*60*60*1000); if (!cd.ok) return ctx.reply(`⏳ Volte em ${human(cd.wait)}.`), true; const reward = rand(700, 1800); user.coins += reward; user.fame += 1; addXp(user, 30); await saveUser(user); await ctx.reply(`🎁 Daily coletado: ${money(reward)} +30 XP.`); return true; }
    case 'work': { const cd = cooldown(user, 'work', 45*60*1000); if (!cd.ok) return ctx.reply(`⏳ Descanse ${human(cd.wait)}.`), true; const jobs = ['caçou bugs no sistema', 'moderou um grupo VIP', 'minerou dados legais', 'organizou a galeria', 'venceu um mini game']; const reward = rand(120, 450); user.coins += reward; addXp(user, rand(10, 25)); await saveUser(user); await ctx.reply(`💼 Você ${pick(jobs)} e ganhou ${money(reward)}.`); return true; }
    case 'crime': { const cd = cooldown(user, 'crime', 2*60*60*1000); if (!cd.ok) return ctx.reply(`⏳ Aguarde ${human(cd.wait)}.`), true; const success = Math.random() < 0.48; if (success) { const reward = rand(600, 1600); user.coins += reward; user.fame += 2; addXp(user, 35); await saveUser(user); await ctx.reply(`😈 Crime bem-sucedido no universo DARK: +${money(reward)} +35 XP.`); } else { const fine = Math.min(user.coins, rand(250, 900)); user.coins -= fine; user.losses++; await saveUser(user); await ctx.reply(`🚓 Deu errado. Multa: ${money(fine)}.`); } return true; }
    case 'roubar': { const target = await getTargetUser(ctx); if (!target || target.jid === user.jid) return ctx.reply(`Use: ${prefix}roubar @user`), true; const cd = cooldown(user, 'roubar', 3*60*60*1000); if (!cd.ok) return ctx.reply(`⏳ Aguarde ${human(cd.wait)}.`), true; const success = Math.random() < 0.35; if (success) { const amount = Math.min(target.coins, rand(100, 800)); target.coins -= amount; user.coins += amount; user.fame += 1; await saveUser(target); await saveUser(user); await ctx.reply(`🥷 Você roubou ${money(amount)} de ${jidToMention(target.jid)}.`, [target.jid]); } else { const fine = Math.min(user.coins, rand(150, 700)); user.coins -= fine; target.coins += Math.floor(fine/2); await saveUser(target); await saveUser(user); await ctx.reply(`🚨 Falhou! Você pagou ${money(fine)} de multa.`, [target.jid]); } return true; }
    case 'pay': case 'pagar': { const to = await getTargetUser(ctx); const amount = parseAmount(args.at(-1)); if (!to || !amount) return ctx.reply(`Use: ${prefix}pay @user valor`), true; if (to.jid === user.jid) return ctx.reply('Você não pode pagar a si mesmo.'), true; if (user.coins < amount) return ctx.reply('Saldo insuficiente.'), true; user.coins -= amount; to.coins += amount; await saveUser(user); await saveUser(to); await ctx.reply(`✅ Transferiu ${money(amount)} para ${jidToMention(to.jid)}.`, [to.jid]); return true; }
    case 'depositar': { const amount = parseAmount(args[0]); if (!amount || user.coins < amount) return ctx.reply('Valor inválido ou saldo insuficiente.'), true; user.coins -= amount; user.bank += amount; await saveUser(user); await ctx.reply(`🏦 Depositado: ${money(amount)}`); return true; }
    case 'sacar': { const amount = parseAmount(args[0]); if (!amount || user.bank < amount) return ctx.reply('Valor inválido ou banco insuficiente.'), true; user.bank -= amount; user.coins += amount; await saveUser(user); await ctx.reply(`🏦 Sacado: ${money(amount)}`); return true; }
    case 'loja': await ctx.reply(`🏪 LOJA DARK\n• poção — ${money(250)}\n• escudo — ${money(900)}\n• espada — ${money(1500)}\n• vipfake — ${money(5000)}\n\nUse: ${prefix}comprar item qtd`); return true;
    case 'comprar': { const item = String(args[0] || '').toLowerCase(); const qty = parseAmount(args[1], 1); const prices = { 'poção':250, 'pocao':250, escudo:900, espada:1500, vipfake:5000 }; const price = prices[item]; if (!price) return ctx.reply('Item inexistente. Use loja.'), true; const total = price * qty; if (user.coins < total) return ctx.reply('Saldo insuficiente.'), true; user.coins -= total; const key = item === 'pocao' ? 'poção' : item; user.inventory.set(key, Number(user.inventory.get(key) || 0) + qty); await saveUser(user); await ctx.reply(`✅ Comprou ${qty}x ${key} por ${money(total)}.`); return true; }
    case 'vender': { const item = String(args[0] || '').toLowerCase(); const qty = parseAmount(args[1], 1); const prices = { 'poção':125, 'pocao':125, escudo:450, espada:750, vipfake:2500, pele:80, 'minério':120, minerio:120, peixe:60, 'relíquia':200, reliquia:200 }; const key = item === 'pocao' ? 'poção' : item === 'minerio' ? 'minério' : item === 'reliquia' ? 'relíquia' : item; const have = Number(user.inventory.get(key) || 0); if (!prices[item] || have < qty) return ctx.reply('Item inválido ou quantidade insuficiente.'), true; user.inventory.set(key, have - qty); const gain = prices[item] * qty; user.coins += gain; await saveUser(user); await ctx.reply(`✅ Vendeu ${qty}x ${key} por ${money(gain)}.`); return true; }
    case 'inventario': case 'mochila': { const inv = [...(user.inventory || new Map()).entries()].map(([k,v]) => `• ${k}: ${v}`).join('\n') || 'Vazio'; await ctx.reply(`🎒 Inventário de ${jidToMention(user.jid)}\n${inv}`, [user.jid]); return true; }
    case 'rankcoins': { const top = await User.find().sort({ coins: -1 }).limit(10); await ctx.reply(`🏆 Rank Coins Global\n${top.map((u,i)=>`${i+1}. @${u.number} — ${money(u.coins)}`).join('\n')}`, top.map(u=>u.jid)); return true; }
    case 'ranklevel': { const top = await User.find().sort({ level: -1, xp: -1 }).limit(10); await ctx.reply(`📈 Rank Level Global\n${top.map((u,i)=>`${i+1}. @${u.number} — Lv ${u.level} (${u.xp} XP)`).join('\n')}`, top.map(u=>u.jid)); return true; }
    case 'rankrep': { const top = await User.find().sort({ rep: -1 }).limit(10); await ctx.reply(`⭐ Rank Reputação Global\n${top.map((u,i)=>`${i+1}. @${u.number} — ${u.rep} rep`).join('\n')}`, top.map(u=>u.jid)); return true; }
    case 'rankvip': { const top = await User.find({ vipUntil: { $gt: new Date() } }).sort({ vipUntil: -1 }).limit(10); await ctx.reply(`💎 Rank/VIP Ativos\n${top.map((u,i)=>`${i+1}. @${u.number} — até ${u.vipUntil.toLocaleDateString('pt-AO')}`).join('\n') || 'Nenhum VIP ativo.'}`, top.map(u=>u.jid)); return true; }
    case 'topgrupo': { if (!ctx.isGroup) return ctx.reply('Use em grupo.'), true; const ids = ctx.participants.map((p)=>p.id); const top = await User.find({ jid: { $in: ids } }).sort({ level: -1, fame: -1 }).limit(10); await ctx.reply(`👥 Top do Grupo\n${top.map((u,i)=>`${i+1}. @${u.number} — Lv ${u.level} | Fama ${u.fame}`).join('\n') || 'Sem dados.'}`, top.map(u=>u.jid)); return true; }

    // ───────────── SOCIAIS ─────────────
    case 'perfil': { const u = await getTargetUser(ctx, true); const vip = u.vipUntil && u.vipUntil > new Date() ? `sim, até ${u.vipUntil.toLocaleDateString('pt-AO')}` : 'não'; await ctx.reply(`👤 PERFIL\nUsuário: ${jidToMention(u.jid)}\nLevel: ${u.level}\nXP: ${u.xp}/${u.level*120}\nFama: ${u.fame}\nRep: ${u.rep}\nVitórias: ${u.wins}\nDerrotas: ${u.losses}\nVIP: ${vip}\nCasado com: ${u.marriedWith ? jidToMention(u.marriedWith) : 'ninguém'}`, [u.jid, u.marriedWith].filter(Boolean)); return true; }
    case 'reputar': { const to = await getTargetUser(ctx); if (!to || to.jid === user.jid) return ctx.reply('Marque outro usuário.'), true; const cd = cooldown(user, `rep_${to.jid}`, 12*60*60*1000); if (!cd.ok) return ctx.reply(`⏳ Aguarde ${human(cd.wait)} para reputar novamente.`), true; to.rep += 1; to.fame += 1; await saveUser(user); await saveUser(to); await ctx.reply(`⭐ ${jidToMention(to.jid)} recebeu +1 reputação.`, [to.jid]); return true; }
    case 'fama': { const u = await getTargetUser(ctx, true); await ctx.reply(`🌟 Fama global de ${jidToMention(u.jid)}: ${u.fame}`, [u.jid]); return true; }
    case 'rankfama': { const top = await User.find().sort({ fame: -1 }).limit(10); await ctx.reply(`🌟 Arsenal da Fama Global\n${top.map((u,i)=>`${i+1}. @${u.number} — ${u.fame}`).join('\n')}`, top.map(u=>u.jid)); return true; }
    case 'casar': { const to = await getTargetUser(ctx); if (!to || to.jid === user.jid) return ctx.reply('Marque alguém para casar.'), true; if (user.marriedWith || to.marriedWith) return ctx.reply('Um dos dois já está casado.'), true; user.marriedWith = to.jid; to.marriedWith = user.jid; user.fame += 3; to.fame += 3; await saveUser(user); await saveUser(to); await ctx.reply(`💍 ${jidToMention(user.jid)} casou com ${jidToMention(to.jid)}!`, [user.jid, to.jid]); return true; }
    case 'divorciar': { if (!user.marriedWith) return ctx.reply('Você não está casado.'), true; const other = await User.findOne({ jid: user.marriedWith }); if (other) { other.marriedWith = ''; await other.save(); } user.marriedWith = ''; await saveUser(user); await ctx.reply('💔 Divórcio concluído.'); return true; }
    case 'ship': { const ms = mentionedJids(msg); const a = ms[0] || ctx.sender; const b = ms[1] || targetJid(msg, args); if (!b) return ctx.reply(`Use: ${prefix}ship @a @b`), true; const pct = rand(0,100); await ctx.reply(`💘 Ship: ${jidToMention(a)} + ${jidToMention(b)} = ${pct}%\n${renderProgress(pct,100)}`, [a,b]); return true; }
    case 'abraçar': case 'abracar': case 'beijar': case 'tapa': case 'carinho': case 'elogiar': case 'cafune': case 'cafuné': case 'mordida': { const jid = targetJid(msg, args); if (!jid) return ctx.reply('Marque alguém.'), true; const verbs = { 'abraçar':'abraçou 🤗', abracar:'abraçou 🤗', beijar:'beijou 😘', tapa:'deu um tapa 😵', carinho:'fez carinho 🥰', elogiar:'elogiou ✨', cafune:'fez cafuné 💆', 'cafuné':'fez cafuné 💆', mordida:'deu uma mordidinha 😼' }; await ctx.reply(`${jidToMention(ctx.sender)} ${verbs[command]} ${jidToMention(jid)}!`, [ctx.sender, jid]); return true; }

    // ───────────── DIVERSÃO ─────────────
    case 'chance': { if (!text) return ctx.reply(`Use: ${prefix}chance algo`), true; const pct = rand(0,100); await ctx.reply(`🔮 Chance de "${text}": ${pct}%\n${renderProgress(pct,100)}`); return true; }
    case 'escolher': case 'sortear': { const opts = text.split('|').map((x)=>x.trim()).filter(Boolean); if (opts.length < 2) return ctx.reply(`Use: ${prefix}${command} opção1|opção2|opção3`), true; await ctx.reply(`🎯 Escolha DARK: ${pick(opts)}`); return true; }
    case 'verdade': { const list = ['Qual segredo você nunca contou no grupo?', 'Quem aqui você acha mais engraçado?', 'Qual foi a maior vergonha que você já passou?', 'Você já silenciou este grupo?', 'Qual pessoa do grupo você chamaria para um projeto?']; await ctx.reply(`🗣️ Verdade: ${pick(list)}`); return true; }
    case 'desafio': { const list = ['Envie um áudio de 5 segundos rindo.', 'Elogie 3 pessoas do grupo.', 'Fique 10 minutos sem mandar figurinha.', 'Troque seu nome do WhatsApp por DARK por 5 minutos.', 'Mande uma frase motivacional agora.']; await ctx.reply(`🔥 Desafio: ${pick(list)}`); return true; }
    case 'conselho': { const list = ['Não confie em link estranho, confie no DARK System.', 'Faça backup antes de mexer em produção.', 'Quem configura prefixo certo evita confusão.', 'ADM bom lê as regras antes de banir.', 'Persistência vence sorte.']; await ctx.reply(`🧠 Conselho: ${pick(list)}`); return true; }
    case 'frase': { const list = ['A noite é escura, mas o sistema é DARK.', 'Código limpo, mente tranquila.', 'Quem domina o grupo domina o caos.', 'O impossível é só uma função ainda não implementada.']; await ctx.reply(`💬 ${pick(list)}`); return true; }
    case 'piada': { const list = ['Por que o bot foi ao médico? Porque estava com bug no coração.', 'O que o MongoDB disse ao Render? Salva-me que eu te acordo.', 'Por que o ADM não se perde? Porque sempre tem link do grupo.']; await ctx.reply(`😂 ${pick(list)}`); return true; }
    case 'personalidade': { const jid = targetJid(msg, args) || ctx.sender; const list = ['líder sombrio', 'mago dos comandos', 'rei das figurinhas', 'caçador de bugs', 'admin lendário', 'vip misterioso']; await ctx.reply(`🧬 Personalidade de ${jidToMention(jid)}: ${pick(list)} (${rand(1,100)}% de poder DARK)`, [jid]); return true; }
    case 'nivelgay': case 'nivelgado': { const jid = targetJid(msg, args) || ctx.sender; const pct = rand(0,100); await ctx.reply(`📊 ${command} de ${jidToMention(jid)}: ${pct}%\n${renderProgress(pct,100)}`, [jid]); return true; }
    case 'rankaleatorio': { if (!ctx.isGroup) return ctx.reply('Use em grupo.'), true; const shuffled = [...ctx.participants].sort(()=>Math.random()-0.5).slice(0,10); await ctx.reply(`🎲 Rank Aleatório DARK\n${shuffled.map((p,i)=>`${i+1}. ${jidToMention(p.id)} — ${rand(1,100)} pts`).join('\n')}`, shuffled.map((p)=>p.id)); return true; }

    // ───────────── JOGOS ─────────────
    case 'dado': { const sides = Math.min(1000, parseAmount(args[0], 6)); await ctx.reply(`🎲 D${sides}: ${rand(1, sides)}`); return true; }
    case 'moeda': await ctx.reply(`🪙 ${pick(['Cara', 'Coroa'])}`); return true;
    case 'parimpar': { const choice = String(args[0] || '').toLowerCase(); const bet = parseAmount(args[1], 50); if (!['par','impar','ímpar'].includes(choice)) return ctx.reply(`Use: ${prefix}parimpar par/impar valor`), true; if (user.coins < bet) return ctx.reply('Saldo insuficiente.'), true; const a = rand(0,10), b = rand(0,10); const result = (a+b)%2===0 ? 'par' : 'impar'; const win = (choice === 'ímpar' ? 'impar' : choice) === result; user.coins += win ? bet : -bet; win ? user.wins++ : user.losses++; await saveUser(user); await ctx.reply(`✋ Par ou Ímpar\nVocê: ${choice}\nNúmeros: ${a} + ${b} = ${a+b} (${result})\n${win ? `Venceu ${money(bet)}` : `Perdeu ${money(bet)}`}`); return true; }
    case 'slot': { const bet = parseAmount(args[0], 50); if (user.coins < bet) return ctx.reply('Saldo insuficiente.'), true; const icons = ['🍒','🍋','💎','7️⃣','🔔']; const r = [pick(icons), pick(icons), pick(icons)]; let mult = r[0] === r[1] && r[1] === r[2] ? 5 : r[0] === r[1] || r[1] === r[2] || r[0] === r[2] ? 2 : 0; user.coins += bet * mult - bet; mult ? user.wins++ : user.losses++; addXp(user, 10); await saveUser(user); await ctx.reply(`🎰 ${r.join(' | ')}\n${mult ? `Ganhou ${money(bet*mult)}!` : `Perdeu ${money(bet)}.`}`); return true; }
    case 'roleta': { const bet = parseAmount(args[0], 50); const chosen = Number(args[1]); if (!Number.isInteger(chosen) || chosen < 0 || chosen > 36) return ctx.reply(`Use: ${prefix}roleta valor numero(0-36)`), true; if (user.coins < bet) return ctx.reply('Saldo insuficiente.'), true; const n = rand(0,36); if (n === chosen) { user.coins += bet*35; user.wins++; await ctx.reply(`🎡 Caiu ${n}. Jackpot! +${money(bet*35)}`); } else { user.coins -= bet; user.losses++; await ctx.reply(`🎡 Caiu ${n}. Você perdeu ${money(bet)}.`); } await saveUser(user); return true; }
    case 'jokenpo': { const choice = String(args[0] || '').toLowerCase(); const opts = ['pedra','papel','tesoura']; if (!opts.includes(choice)) return ctx.reply(`Use: ${prefix}jokenpo pedra/papel/tesoura`), true; const bot = pick(opts); const win = (choice==='pedra'&&bot==='tesoura')||(choice==='papel'&&bot==='pedra')||(choice==='tesoura'&&bot==='papel'); const draw = choice === bot; if (win) { user.coins += 120; user.wins++; } else if (!draw) { user.coins -= Math.min(user.coins, 60); user.losses++; } addXp(user, 8); await saveUser(user); await ctx.reply(`✊ Você: ${choice}\n🤖 Bot: ${bot}\n${draw ? 'Empate.' : win ? 'Você venceu +Ð120!' : 'Você perdeu -Ð60.'}`); return true; }
    case 'matematica': { const a = rand(2, 99), b = rand(2, 99), ops = ['+','-','*'], op = pick(ops); const ans = op==='+' ? a+b : op==='-' ? a-b : a*b; await GameSession.findOneAndUpdate({ chatId, game: 'math', players: ctx.sender }, { chatId, game: 'math', players: [ctx.sender], state: { answer: String(ans) }, expiresAt: new Date(Date.now()+120000) }, { upsert: true }); await ctx.reply(`🧮 Quanto é ${a} ${op} ${b}?\nResponda com: ${prefix}responder resultado`); return true; }
    case 'quiz': { const q = pick(quizBank); await GameSession.findOneAndUpdate({ chatId, game: 'quiz' }, { chatId, game: 'quiz', players: [ctx.sender], state: q, expiresAt: new Date(Date.now()+180000) }, { upsert: true }); await ctx.reply(`❔ Quiz: ${q.q}\nResponda: ${prefix}responder resposta`); return true; }
    case 'responder': { const answer = String(text || args.join(' ')).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); const s = await GameSession.findOne({ chatId, game: { $in: ['quiz','math'] } }).sort({ createdAt: -1 }); if (!s) return ctx.reply('Nenhum quiz/matemática ativo.'), true; if (answer === String(s.state.answer || s.state.a).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) { user.coins += 250; user.wins++; user.fame += 1; addXp(user, 25); await saveUser(user); await s.deleteOne(); await ctx.reply(`✅ Resposta certa! +${money(250)} +25 XP.`); } else await ctx.reply('❌ Resposta errada.'); return true; }
    case 'forca': { const word = pick(forcaWords); await GameSession.findOneAndUpdate({ chatId, game: 'forca' }, { chatId, game: 'forca', players: [ctx.sender], state: { word, guesses: [], tries: 6 }, expiresAt: new Date(Date.now()+600000) }, { upsert: true }); await ctx.reply(`🪢 Forca iniciada: ${'_ '.repeat(word.length)}\nUse ${prefix}pista letra`); return true; }
    case 'pista': { const s = await GameSession.findOne({ chatId, game: 'forca' }); if (!s) return ctx.reply('Nenhuma forca ativa.'), true; const letter = String(args[0] || '').toLowerCase()[0]; if (!letter) return ctx.reply(`Use: ${prefix}pista letra`), true; if (!s.state.guesses.includes(letter)) s.state.guesses.push(letter); if (!s.state.word.includes(letter)) s.state.tries -= 1; const mask = s.state.word.split('').map((c)=>s.state.guesses.includes(c)?c:'_').join(' '); if (!mask.includes('_')) { user.coins += 400; user.wins++; addXp(user,30); await saveUser(user); await s.deleteOne(); await ctx.reply(`🎉 Palavra: ${s.state.word}. Você venceu +${money(400)}!`); } else if (s.state.tries <= 0) { await s.deleteOne(); await ctx.reply(`💀 Você perdeu. Palavra: ${s.state.word}`); } else { s.markModified('state'); await s.save(); await ctx.reply(`🪢 ${mask}\nTentativas: ${s.state.tries}\nLetras: ${s.state.guesses.join(', ')}`); } return true; }
    case 'velha': { const target = targetJid(msg, args); if (!target || target === ctx.sender) return ctx.reply(`Use: ${prefix}velha @jogador`), true; await GameSession.findOneAndUpdate({ chatId, game: 'velha' }, { chatId, game: 'velha', players: [ctx.sender, target], state: { board: Array(9).fill(''), turn: 0 }, expiresAt: new Date(Date.now()+900000) }, { upsert: true }); await ctx.reply(`⭕ Jogo da velha iniciado!\nX: ${jidToMention(ctx.sender)}\nO: ${jidToMention(target)}\n\n${renderBoard(Array(9).fill(''))}\n\nTurno: ${jidToMention(ctx.sender)}\nUse ${prefix}jogarvelha 1-9`, [ctx.sender, target]); return true; }
    case 'jogarvelha': { const s = await GameSession.findOne({ chatId, game: 'velha' }); if (!s) return ctx.reply('Nenhum jogo da velha ativo.'), true; const turnJid = s.players[s.state.turn]; if (ctx.sender !== turnJid) return ctx.reply(`Turno de ${jidToMention(turnJid)}.`, [turnJid]), true; const pos = parseAmount(args[0]) - 1; if (pos < 0 || pos > 8 || s.state.board[pos]) return ctx.reply('Posição inválida.'), true; s.state.board[pos] = s.state.turn === 0 ? 'X' : 'O'; const w = winner(s.state.board); if (w) { if (w === 'draw') await ctx.reply(`🤝 Empate!\n${renderBoard(s.state.board)}`); else { const winJid = s.players[w === 'X' ? 0 : 1]; const wu = await User.findOne({ jid: winJid }); if (wu) { wu.coins += 500; wu.wins++; wu.fame += 2; await saveUser(wu); } await ctx.reply(`🏆 ${jidToMention(winJid)} venceu +${money(500)}!\n${renderBoard(s.state.board)}`, [winJid]); } await s.deleteOne(); } else { s.state.turn = s.state.turn ? 0 : 1; s.markModified('state'); await s.save(); await ctx.reply(`${renderBoard(s.state.board)}\n\nTurno: ${jidToMention(s.players[s.state.turn])}`, [s.players[s.state.turn]]); } return true; }
    case 'duelo': { const opponent = await getTargetUser(ctx); const bet = parseAmount(args.at(-1), 100); if (!opponent || opponent.jid === user.jid) return ctx.reply(`Use: ${prefix}duelo @jogador valor`), true; if (user.coins < bet || opponent.coins < bet) return ctx.reply('Ambos precisam ter saldo para a aposta.'), true; const p1 = user.level + rand(1,20); const p2 = opponent.level + rand(1,20); const winUser = p1 >= p2 ? user : opponent; const loseUser = p1 >= p2 ? opponent : user; winUser.coins += bet; loseUser.coins -= bet; winUser.wins++; loseUser.losses++; winUser.fame += 2; await saveUser(winUser); await saveUser(loseUser); await ctx.reply(`⚔️ Duelo DARK\n${jidToMention(user.jid)} poder ${p1}\n${jidToMention(opponent.jid)} poder ${p2}\n🏆 Vencedor: ${jidToMention(winUser.jid)} ganhou ${money(bet)}.`, [user.jid, opponent.jid, winUser.jid]); return true; }
    case 'rankjogos': { const top = await User.find().sort({ wins: -1 }).limit(10); await ctx.reply(`🎮 Rank Global de Jogos\n${top.map((u,i)=>`${i+1}. @${u.number} — ${u.wins}V/${u.losses}D`).join('\n')}`, top.map(u=>u.jid)); return true; }

    // ───────────── RPG ─────────────
    case 'rpg': await ctx.reply(`🧙 RPG DARK\nClasse: ${user.rpg.className}\nHP: ${user.rpg.hp}/${user.rpg.maxHp} ${renderProgress(user.rpg.hp,user.rpg.maxHp)}\nATK: ${user.rpg.atk} DEF: ${user.rpg.def}\nÁrea: ${user.rpg.area}\nMonstros: ${user.rpg.monsters}\nBoss kills: ${user.rpg.bossKills}\nPoder: ${user.rpg.power}`); return true;
    case 'classe': { const c = String(args[0] || '').toLowerCase(); const map = { guerreiro:[120,16,7], mago:[90,22,3], assassino:[95,19,4], tanque:[160,10,12] }; if (!map[c]) return ctx.reply(`Use: ${prefix}classe guerreiro/mago/assassino/tanque`), true; if (user.rpg.className !== 'Sem classe') return ctx.reply('Você já escolheu classe.'), true; const [hp, atk, def] = map[c]; user.rpg.className = c; user.rpg.maxHp = hp; user.rpg.hp = hp; user.rpg.atk = atk; user.rpg.def = def; user.rpg.power = atk + def; await saveUser(user); await ctx.reply(`✅ Classe escolhida: ${c}`); return true; }
    case 'treinar': { const cd = cooldown(user, 'treinar', 20*60*1000); if (!cd.ok) return ctx.reply(`⏳ Treino disponível em ${human(cd.wait)}.`), true; const atk = rand(0,2), def = rand(0,2), hp = rand(1,6); user.rpg.atk += atk; user.rpg.def += def; user.rpg.maxHp += hp; user.rpg.hp = Math.min(user.rpg.maxHp, user.rpg.hp + hp); user.rpg.power = user.rpg.atk + user.rpg.def + Math.floor(user.rpg.maxHp/20); addXp(user, 25); await saveUser(user); await ctx.reply(`🏋️ Treino concluído!\nATK +${atk} | DEF +${def} | HP +${hp} | +25 XP`); return true; }
    case 'cacar': case 'minerar': case 'pescar': case 'explorar': { const cd = cooldown(user, command, 8*60*1000); if (!cd.ok) return ctx.reply(`⏳ Aguarde ${human(cd.wait)}.`), true; const rewards = { cacar:['pele', rand(100,350)], minerar:['minério', rand(150,450)], pescar:['peixe', rand(80,300)], explorar:['relíquia', rand(180,550)] }; const [item, cash] = rewards[command]; const dmg = rand(0, 20); user.rpg.hp = Math.max(1, user.rpg.hp - Math.max(0, dmg - user.rpg.def)); user.rpg.monsters += command === 'cacar' ? 1 : 0; user.coins += cash; user.inventory.set(item, Number(user.inventory.get(item) || 0) + 1); user.fame += 1; addXp(user, rand(15,35)); await saveUser(user); await ctx.reply(`🗺️ Você foi ${command} e encontrou 1x ${item} + ${money(cash)}.\nDano sofrido: ${dmg}. HP: ${user.rpg.hp}/${user.rpg.maxHp}`); return true; }
    case 'curar': { const price = 150; const pot = Number(user.inventory.get('poção') || 0) + Number(user.inventory.get('pocao') || 0); if (pot > 0) { user.inventory.set('poção', pot - 1); user.rpg.hp = user.rpg.maxHp; await saveUser(user); return ctx.reply('🧪 Poção usada. HP restaurado.'), true; } if (user.coins < price) return ctx.reply(`Sem poção e sem ${money(price)} para cura.`), true; user.coins -= price; user.rpg.hp = user.rpg.maxHp; await saveUser(user); await ctx.reply(`❤️ Curado por ${money(price)}.`); return true; }
    case 'boss': { const cd = cooldown(user, 'boss', 60*60*1000); if (!cd.ok) return ctx.reply(`⏳ Boss volta em ${human(cd.wait)}.`), true; const bossPower = rand(20, 80) + user.level; const playerPower = user.rpg.atk + user.rpg.def + user.level + rand(1, 50); if (playerPower >= bossPower) { const reward = rand(800, 2200); user.coins += reward; user.rpg.bossKills++; user.wins++; user.fame += 5; addXp(user, 80); await ctx.reply(`🐉 Boss derrotado! Poder ${playerPower} vs ${bossPower}.\nRecompensa: ${money(reward)} +80 XP.`); } else { user.rpg.hp = Math.max(1, user.rpg.hp - rand(20,60)); user.losses++; await ctx.reply(`🐉 Boss venceu. Poder ${playerPower} vs ${bossPower}.\nHP atual: ${user.rpg.hp}/${user.rpg.maxHp}`); } await saveUser(user); return true; }
    case 'rankrpg': { const top = await User.find().sort({ 'rpg.bossKills': -1, level: -1 }).limit(10); await ctx.reply(`🐉 Rank RPG Global\n${top.map((u,i)=>`${i+1}. @${u.number} — Boss ${u.rpg.bossKills} | Lv ${u.level}`).join('\n')}`, top.map(u=>u.jid)); return true; }

    // ───────────── GALERIA / GIF ─────────────
    case 'galeria': {
      const sub = String(args[0] || '').toLowerCase();
      if (sub === 'add') {
        if (!ctx.mediaInfo) return ctx.reply(`Envie imagem/GIF/vídeo/documento com legenda: ${prefix}galeria add nome|tags`), true;
        const rest = text.replace(/^add\s*/i, '');
        const [nameRaw, tagsRaw] = rest.split('|');
        const name = String(nameRaw || '').trim().toLowerCase();
        if (!name) return ctx.reply(`Use: ${prefix}galeria add nome|tag1,tag2`), true;
        const buffer = await ctx.downloadMedia();
        if (buffer.length > config.maxMediaMb * 1024 * 1024) return ctx.reply(`Mídia maior que ${config.maxMediaMb}MB.`), true;
        const id = await mediaStore.uploadBuffer(buffer, name, { uploadedBy: ctx.sender, mime: ctx.mediaInfo.mime });
        await Media.findOneAndUpdate({ name }, { name, tags: splitCsv(tagsRaw), fileId: String(id), mime: ctx.mediaInfo.mime, size: buffer.length, uploadedBy: ctx.sender }, { upsert: true });
        await ctx.reply(`✅ Mídia salva na galeria: ${name}\nID: ${id}`);
        return true;
      }
      if (sub === 'list') { const list = await Media.find().sort({ createdAt: -1 }).limit(20); await ctx.reply(`🖼️ Galeria DARK\n${list.map((m)=>`• ${m.name} [${m.mime}] ${Math.round(m.size/1024)}KB`).join('\n') || 'Vazia.'}`); return true; }
      if (sub === 'ver') { const name = String(args.slice(1).join(' ')).trim().toLowerCase(); const m = await Media.findOne({ name }); if (!m) return ctx.reply('Mídia não encontrada.'), true; const buffer = await mediaStore.downloadBuffer(m.fileId); const type = m.mime.startsWith('image/') ? 'image' : m.mime.startsWith('video/') ? 'video' : m.mime.startsWith('audio/') ? 'audio' : 'document'; await sock.sendMessage(chatId, { [type]: buffer, mimetype: m.mime, caption: `🖼️ ${m.name}` }, { quoted: msg }); return true; }
      if (sub === 'del') { if (!await needOwner(ctx)) return true; const name = String(args.slice(1).join(' ')).trim().toLowerCase(); await Media.deleteOne({ name }); await ctx.reply(`🗑️ Removida: ${name}`); return true; }
      await ctx.reply(menus.menuGaleria(ctx)); return true;
    }
    case 'gif': { const name = String(text || args.join(' ')).trim().toLowerCase(); const m = await Media.findOne({ name }); if (!m) return ctx.reply(`GIF/mídia não encontrado. Use ${prefix}galeria list`), true; const buffer = await mediaStore.downloadBuffer(m.fileId); await sock.sendMessage(chatId, { video: buffer, gifPlayback: true, mimetype: m.mime, caption: `✨ ${m.name}` }, { quoted: msg }); return true; }

    // ───────────── DOWNLOAD / UTIL ─────────────
    case 'baixarurl': case 'get': { if (!text) return ctx.reply(`Use: ${prefix}${command} https://...`), true; const file = await directDownload(text); const type = file.mime.startsWith('image/') ? 'image' : file.mime.startsWith('video/') ? 'video' : file.mime.startsWith('audio/') ? 'audio' : 'document'; await sock.sendMessage(chatId, { [type]: file.buffer, mimetype: file.mime, fileName: file.name, caption: `📥 ${file.name}` }, { quoted: msg }); return true; }
    case 'sticker': case 's': { if (!ctx.mediaInfo) return ctx.reply('Envie imagem/vídeo/GIF com legenda sticker.'), true; const buffer = await ctx.downloadMedia(); const sticker = new Sticker(buffer, { pack: 'DARK System', author: 'Dark Net', type: StickerTypes.FULL, quality: 50 }); await sock.sendMessage(chatId, { sticker: await sticker.toBuffer() }, { quoted: msg }); return true; }
    case 'toimg': { if (ctx.mediaInfo?.type !== 'sticker') return ctx.reply('Envie um sticker com legenda toimg.'), true; const buffer = await ctx.downloadMedia(); const png = await sharp(buffer).png().toBuffer(); await sock.sendMessage(chatId, { image: png, caption: '🖼️ Sticker convertido.' }, { quoted: msg }); return true; }
    case 'calc': { const expr = text.replace(/,/g, '.'); if (!/^[0-9+\-*/().%\s]+$/.test(expr)) return ctx.reply('Expressão inválida. Use apenas números e operadores.'), true; // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${expr.replace(/%/g, '/100')})`)(); await ctx.reply(`🧮 Resultado: ${result}`); return true; }
    case 'cep': { const cep = config.onlyDigits(args[0]); if (!cep) return ctx.reply(`Use: ${prefix}cep 01001000`), true; const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`, { timeout: 15000 }); if (data.erro) return ctx.reply('CEP não encontrado.'), true; await ctx.reply(`📍 CEP ${cep}\n${data.logradouro || ''}\n${data.bairro || ''}\n${data.localidade || ''} - ${data.uf || ''}`); return true; }
    case 'clima': { const city = text || 'Luanda'; const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', { params: { name: city, count: 1, language: 'pt', format: 'json' }, timeout: 15000 }); const loc = geo.data.results?.[0]; if (!loc) return ctx.reply('Cidade não encontrada.'), true; const met = await axios.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: loc.latitude, longitude: loc.longitude, current: 'temperature_2m,relative_humidity_2m,wind_speed_10m' }, timeout: 15000 }); const c = met.data.current; await ctx.reply(`🌦️ Clima em ${loc.name}, ${loc.country}\nTemperatura: ${c.temperature_2m}°C\nHumidade: ${c.relative_humidity_2m}%\nVento: ${c.wind_speed_10m} km/h`); return true; }
    case 'encurtar': { if (!text) return ctx.reply(`Use: ${prefix}encurtar https://...`), true; const { data } = await axios.get('https://is.gd/create.php', { params: { format: 'simple', url: text }, timeout: 15000 }); await ctx.reply(`🔗 ${data}`); return true; }
    case 'numero': { const jid = targetJid(msg, args) || ctx.sender; await ctx.reply(`📞 Número: +${jid.split('@')[0]}`, [jid]); return true; }
    case 'idgp': await ctx.reply(`🆔 Chat ID:\n${chatId}`); return true;
    case 'infogp': { if (!ctx.isGroup) return ctx.reply('Use em grupo.'), true; await ctx.reply(`ℹ️ ${ctx.groupName}\nID: ${chatId}\nMembros: ${ctx.participants.length}\nBot ADM: ${ctx.isBotAdmin ? 'sim' : 'não'}`); return true; }
    case 'qrcode': { if (!text) return ctx.reply(`Use: ${prefix}qrcode texto`), true; const buffer = await QRCode.toBuffer(text, { margin: 1, width: 600 }); await sock.sendMessage(chatId, { image: buffer, caption: '🔳 QR Code' }, { quoted: msg }); return true; }
    case 'base64': { if (!text) return ctx.reply(`Use: ${prefix}base64 texto`), true; await ctx.reply(Buffer.from(text, 'utf8').toString('base64')); return true; }
    case 'unbase64': { if (!text) return ctx.reply(`Use: ${prefix}unbase64 texto`), true; try { await ctx.reply(Buffer.from(text, 'base64').toString('utf8')); } catch (_) { await ctx.reply('Base64 inválido.'); } return true; }
    case 'inverter': { if (!text) return ctx.reply(`Use: ${prefix}inverter texto`), true; await ctx.reply(text.split('').reverse().join('')); return true; }
    case 'contar': { if (!text) return ctx.reply(`Use: ${prefix}contar texto`), true; const words = text.trim().split(/\s+/).filter(Boolean).length; await ctx.reply(`🔢 Caracteres: ${text.length}\nPalavras: ${words}\nLinhas: ${text.split('\n').length}`); return true; }
    case 'maiusculo': { if (!text) return ctx.reply(`Use: ${prefix}maiusculo texto`), true; await ctx.reply(text.toUpperCase()); return true; }
    case 'minusculo': { if (!text) return ctx.reply(`Use: ${prefix}minusculo texto`), true; await ctx.reply(text.toLowerCase()); return true; }
    case 'senha': { const len = Math.min(64, Math.max(6, parseAmount(args[0], 12))); const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'; let pass = ''; for (let i=0;i<len;i++) pass += chars[rand(0, chars.length-1)]; await ctx.reply(`🔐 Senha gerada:\n${pass}`); return true; }

    default:
      return false;
  }
};
