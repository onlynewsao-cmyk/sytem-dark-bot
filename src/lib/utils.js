const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');

const onlyNumbers = s => String(s||'').replace(/\D/g,'');
const sameNumber = (a,b)=>{
  a=onlyNumbers(a); b=onlyNumbers(b);
  if(!a||!b) return false;
  return a===b || a.endsWith(b) || b.endsWith(a);
};
const sameJid = (a,b)=>{
  if(!a||!b) return false;
  if(a===b) return true;
  return sameNumber(a,b);
};
const participantIds = p => {
  if(!p) return [];
  if(typeof p==='string') return [p];
  return [p.id,p.jid,p.lid,p.phoneNumber,p.lidJid,p.jidPn,p.phoneJid,p._serialized,p.user,p?.phone]
    .filter(Boolean).map(String);
};
const getGroupAdmins = participants => {
  const admins=[];
  for(const p of participants||[]){
    const isAdmin = p.admin==='admin' || p.admin==='superadmin' || p?.isAdmin || p?.isSuperAdmin;
    if(isAdmin) admins.push(...participantIds(p));
  }
  return [...new Set(admins)];
};
function isBotAdmin(sock, participants){
  const admins = getGroupAdmins(participants);
  const bot = sock?.user;
  const candidates = [
    bot?.id, bot?.jid, bot?.lid,
    process.env.BOT_NUMBER && process.env.BOT_NUMBER+'@s.whatsapp.net',
    '244949926074@s.whatsapp.net',
    '244949926074@lid'
  ].filter(Boolean);
  return admins.some(a => candidates.some(c => sameJid(a,c) || sameNumber(a,c)));
}
function isAdmin(participants, userJid){
  const admins = getGroupAdmins(participants);
  return admins.some(a=> sameJid(a, userJid) || sameNumber(a, userJid));
}

// Multi-prefix parser
function parseCmdMulti(body, prefixes){
  if(!body) return null;
  body = body.trim();
  if(!prefixes || !prefixes.length) prefixes = ['.'];
  // sort longer first
  const prefs = [...prefixes].sort((a,b)=> b.length - a.length);
  let used = null;
  for(const p of prefs){
    if(p === '') { used = ''; break; }
    if(body.startsWith(p)){ used = p; break; }
  }
  if(used===null) return null;
  const rest = used ? body.slice(used.length).trim() : body;
  if(!rest) return { cmd:'', args:[], text:'', prefix: used };
  const parts = rest.split(/\s+/);
  return { cmd: (parts[0]||'').toLowerCase(), args: parts.slice(1), text: parts.slice(1).join(' '), prefix: used };
}
function parseCmd(body, prefix){
  // backward compat
  return parseCmdMulti(body, [prefix]);
}

function msToTime(ms){
  const s=Math.floor(ms/1000);
  const h=Math.floor(s/3600);
  const m=Math.floor((s%3600)/60);
  const sec=s%60;
  return `${h}h ${m}m ${sec}s`;
}
function fmtBytes(b){
  if(!b) return '0 B';
  const u=['B','KB','MB','GB']; let i=0; let n=b;
  while(n>=1024 && i<u.length-1){ n/=1024; i++; }
  return `${n.toFixed(2)} ${u[i]}`;
}
async function getBuffer(url, opts={}){
  const res = await axios.get(url, { responseType:'arraybuffer', timeout: opts.timeout||30000, headers:{'User-Agent':'SytemDARK/5.0', ...opts.headers} });
  return Buffer.from(res.data);
}
async function downloadQuoted(sock, msg){
  try {
    const m = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
    if(!m) return null;
    const q = { key: { remoteJid: msg.key.remoteJid, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant }, message: m };
    return await downloadMediaMessage(q, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
  } catch(e){ return null; }
}
function extractText(msg){
  return msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || msg.message?.imageMessage?.caption
    || msg.message?.videoMessage?.caption
    || '';
}

// Anti-spam tracker
const spamMap = new Map();
function checkSpam(userId, limitCfg){
  const now = Date.now();
  const cfg = limitCfg || { max:7, windowMs:8000, banMs:60000 };
  let e = spamMap.get(userId);
  if(!e) e = { times: [], bannedUntil:0 };
  if(e.bannedUntil > now) return { spam:true, banned:true, remaining: e.bannedUntil-now };
  e.times = e.times.filter(t => now - t < cfg.windowMs);
  e.times.push(now);
  spamMap.set(userId, e);
  if(e.times.length > cfg.max){
    e.bannedUntil = now + cfg.banMs;
    e.times = [];
    return { spam:true, banned:false, justBanned:true };
  }
  return { spam:false };
}

// owner check with LID
function isOwnerFull(jid, cfg){
  if(!jid) return false;
  const ownerNumbers = [
    cfg?.bot?.ownerNumber+'@s.whatsapp.net',
    cfg?.bot?.ownerJid,
    cfg?.bot?.ownerLid,
    '244945280380@s.whatsapp.net',
    '213907088089212@lid',
    '213907088089212@s.whatsapp.net'
  ].filter(Boolean);
  return ownerNumbers.some(o => sameJid(jid,o) || sameNumber(jid,o));
}

function extractMentioned(msg){
  return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

module.exports = { onlyNumbers, sameNumber, sameJid, participantIds, getGroupAdmins, isBotAdmin, isAdmin, parseCmd, parseCmdMulti, msToTime, fmtBytes, getBuffer, downloadQuoted, extractText, checkSpam, isOwnerFull, extractMentioned, sleep };
