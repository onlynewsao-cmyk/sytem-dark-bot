const pino = require('pino');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const config = require('./config');
const BotSettings = require('./models/BotSettings');
const Group = require('./models/Group');
const User = require('./models/User');
const DynamicCommand = require('./models/DynamicCommand');
const AuditLog = require('./models/AuditLog');
const cases = require('./commands/cases');
const { sendText, sendButtons } = require('./lib/reply');
const {
  getBody,
  getContextInfo,
  getMediaInfo,
  downloadCurrentMedia,
  isAdminParticipant,
  hasGroupInvite,
  hasLink,
  normalizeJid
} = require('./lib/utils');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const groupCache = new Map();

async function getSettings() {
  return BotSettings.findOneAndUpdate(
    { settingsId: 'global' },
    {
      $setOnInsert: {
        settingsId: 'global',
        botName: config.botName,
        ownerName: config.ownerName,
        ownerNumbers: [config.ownerNumber],
        prefixes: config.defaultPrefixes
      }
    },
    { upsert: true, new: true }
  );
}

async function getGroup(chatId, name = '') {
  return Group.findOneAndUpdate(
    { chatId },
    { $setOnInsert: { chatId, name }, $set: { name } },
    { upsert: true, new: true }
  );
}

async function getUser(jid, name = '') {
  const number = String(jid).split('@')[0].split(':')[0];
  return User.findOneAndUpdate(
    { jid },
    { $setOnInsert: { jid, number }, $set: { name } },
    { upsert: true, new: true }
  );
}

async function getGroupMeta(sock, chatId) {
  const cached = groupCache.get(chatId);
  if (cached && Date.now() - cached.t < 20000) return cached.meta;
  const meta = await sock.groupMetadata(chatId);
  groupCache.set(chatId, { t: Date.now(), meta });
  return meta;
}

function detectPrefix(body, prefixes) {
  return prefixes.find((p) => body.startsWith(p));
}

function replaceVars(template, ctx) {
  return template
    .replaceAll('{user}', `@${ctx.senderNumber}`)
    .replaceAll('{nome}', ctx.pushName || ctx.senderNumber)
    .replaceAll('{prefix}', ctx.prefix)
    .replaceAll('{bot}', ctx.settings.botName)
    .replaceAll('{grupo}', ctx.groupName || 'privado')
    .replaceAll('{dono}', config.ownerName);
}

async function runDynamicCommand(ctx) {
  const found = await DynamicCommand.findOne({
    name: ctx.command,
    $or: [
      { scope: 'group', chatId: ctx.chatId },
      { scope: 'global' }
    ]
  }).sort({ scope: -1 });
  if (!found) return false;
  await ctx.reply(replaceVars(found.response, ctx), [ctx.sender]);
  return true;
}

async function antiProtections(sock, msg, ctx) {
  if (!ctx.isGroup || ctx.isOwner) return false;
  const body = ctx.body || '';
  const botCanAct = ctx.isBotAdmin;

  if (ctx.group.antimencaostatus) {
    const ci = getContextInfo(msg);
    if (ci?.remoteJid === 'status@broadcast') {
      if (botCanAct) {
        await sock.sendMessage(ctx.chatId, { delete: msg.key }).catch(() => null);
        await sock.groupParticipantsUpdate(ctx.chatId, [ctx.sender], 'remove').catch(() => null);
      }
      await ctx.reply('⛔ Anti-menção de status ativado: mensagem removida e usuário punido.', [ctx.sender]);
      return true;
    }
  }

  if (ctx.group.antilink && (hasGroupInvite(body) || hasLink(body))) {
    if (ctx.isAdmin) return false;
    if (botCanAct) {
      await sock.sendMessage(ctx.chatId, { delete: msg.key }).catch(() => null);
      if (hasGroupInvite(body)) await sock.groupParticipantsUpdate(ctx.chatId, [ctx.sender], 'remove').catch(() => null);
    }
    await ctx.reply('🚫 Link detectado. Antilink está ativo neste grupo.', [ctx.sender]);
    return true;
  }

  return false;
}

async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;
    const chatId = msg.key.remoteJid;
    if (!chatId || chatId === 'status@broadcast') return;

    const isGroup = chatId.endsWith('@g.us');
    const sender = normalizeJid(isGroup ? msg.key.participant : chatId);
    if (!sender || sender === 'status@broadcast') return;

    const pushName = msg.pushName || '';
    const body = String(getBody(msg) || '').trim();

    const settings = await getSettings();
    const ownerNumbers = new Set([...(settings.ownerNumbers || []), config.ownerNumber].map(config.onlyDigits));
    const senderNumber = sender.split('@')[0];
    const isOwner = ownerNumbers.has(config.onlyDigits(senderNumber));
    const user = await getUser(sender, pushName);

    if (settings.blockedUsers.includes(sender) || user.banned) return;

    let group = null;
    let metadata = null;
    let participants = [];
    let isAdmin = false;
    let isBotAdmin = false;
    let groupName = '';

    if (isGroup) {
      metadata = await getGroupMeta(sock, chatId).catch(() => null);
      groupName = metadata?.subject || '';
      group = await getGroup(chatId, groupName);
      participants = metadata?.participants || [];
      const botJid = jidNormalizedUser(sock.user?.id || config.botJid);
      const senderP = participants.find((p) => jidNormalizedUser(p.id) === sender);
      const botP = participants.find((p) => jidNormalizedUser(p.id) === botJid);
      isAdmin = isAdminParticipant(senderP) || isOwner;
      isBotAdmin = isAdminParticipant(botP);
    }

    const baseCtx = {
      sock,
      msg,
      chatId,
      sender,
      senderNumber,
      pushName,
      body,
      isGroup,
      group,
      groupName,
      metadata,
      participants,
      isAdmin,
      isBotAdmin,
      isOwner,
      settings,
      user,
      now: new Intl.DateTimeFormat('pt-AO', { timeZone: config.tz, dateStyle: 'short', timeStyle: 'medium' }).format(new Date()),
      get mediaInfo() { return getMediaInfo(msg); },
      downloadMedia: () => downloadCurrentMedia(msg),
      reply: (text, mentions = []) => sendText(sock, chatId, text, msg, mentions),
      buttons: (text, buttons, footer) => sendButtons(sock, chatId, text, buttons, msg, footer)
    };

    if (isGroup && await antiProtections(sock, msg, baseCtx)) return;
    if (!body) return;

    await BotSettings.updateOne({ settingsId: 'global' }, { $inc: { 'stats.messages': 1 } });

    const prefixes = (isGroup && group.prefixes?.length ? group.prefixes : settings.prefixes?.length ? settings.prefixes : config.defaultPrefixes);
    const prefix = detectPrefix(body, prefixes);
    if (!prefix) return;

    const noPrefix = body.slice(prefix.length).trim();
    if (!noPrefix) return;
    const [rawCommand, ...args] = noPrefix.split(/\s+/);
    const command = String(rawCommand || '').toLowerCase();
    const text = noPrefix.slice(rawCommand.length).trim();

    if (settings.maintenance && !isOwner) return sendText(sock, chatId, '🛠️ DARK System está em manutenção. Tente mais tarde.', msg);
    if (isGroup && (settings.blockedGroups.includes(chatId) || group.enabled === false) && !isOwner) {
      return sendText(sock, chatId, '⛔ Este grupo está desativado no DARK System.', msg);
    }
    if (isGroup && group.disabledUsers.includes(sender) && !isOwner) return;
    if (isGroup && group.disabledCommands.includes(command) && !isOwner) {
      return sendText(sock, chatId, `⛔ O comando ${prefix}${command} está desativado neste grupo.`, msg);
    }
    if (isGroup && group.adminOnly && !isAdmin) {
      return sendText(sock, chatId, '🔒 O modo somente administradores está ativo.', msg);
    }

    const allowWhenBotNotAdmin = new Set(['menu', 'ping', 'dono', 'prefixos', 'idgp', 'infogp']);
    if (isGroup && config.renderFreeRequiresBotAdmin && !isBotAdmin && !isOwner && !allowWhenBotNotAdmin.has(command)) {
      return sendText(sock, chatId,
        '⚠️ Grupo sem hospedagem válida no plano FREE.\n\nPara usar o DARK System neste grupo, coloque o bot como administrador. Comandos de administração/proteção precisam de ADM para funcionar corretamente.', msg);
    }

    const ctx = { ...baseCtx, prefix, prefixes, command, args, text };
    await BotSettings.updateOne({ settingsId: 'global' }, { $inc: { 'stats.commands': 1 } });
    await AuditLog.create({ chatId, sender, command, args: text, ok: true }).catch(() => null);

    const handled = await cases(ctx);
    if (!handled) {
      const dyn = await runDynamicCommand(ctx);
      if (!dyn) await ctx.reply(`❓ Comando não encontrado: ${prefix}${command}\nUse ${prefix}menu para ver as opções.`);
    }
  } catch (err) {
    logger.error(err, '[handler] erro');
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro interno: ${err.message}` }, { quoted: msg });
    } catch (_) {}
  }
}

module.exports = { handleMessage, getSettings, getGroup, getUser };
