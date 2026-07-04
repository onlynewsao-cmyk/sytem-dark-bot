const axios = require('axios');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const { safeUnlink } = require('./utils');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const isUrl = v => /^https?:\/\//i.test(String(v || ''));
const clean = s => String(s || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 80) || 'Sytem-DARK';

function pickUrl(obj) {
  if (!obj) return null;
  if (typeof obj === 'string' && isUrl(obj)) return obj;
  if (Array.isArray(obj)) return obj.map(pickUrl).find(Boolean) || null;
  if (typeof obj !== 'object') return null;
  const preferred = ['url','download','downloadUrl','dl_link','link','media','video','audio','play','wmplay','hdplay','music','no_watermark','nowm','href'];
  for (const k of preferred) if (isUrl(obj[k])) return obj[k];
  for (const v of Object.values(obj)) { const u = pickUrl(v); if (u) return u; }
  return null;
}
function pickMany(obj) {
  const out = [];
  const walk = v => {
    if (!v) return;
    if (typeof v === 'string' && isUrl(v)) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(obj);
  return [...new Set(out)];
}
async function headSize(url) {
  try {
    const r = await axios.head(url, { timeout: 15000, headers: { 'user-agent': UA } });
    return Number(r.headers['content-length'] || 0);
  } catch { return 0; }
}
async function sendRemote(sock, jid, url, quoted, opts = {}) {
  const mimetype = opts.mimetype || (opts.audio ? 'audio/mpeg' : 'video/mp4');
  const caption = opts.caption || '🌀 *Sytem DARK Download*';
  if (opts.audio) return sock.sendMessage(jid, { audio: { url }, mimetype, fileName: opts.fileName || 'Sytem-DARK.mp3' }, { quoted });
  return sock.sendMessage(jid, { video: { url }, mimetype, caption, fileName: opts.fileName || 'Sytem-DARK.mp4' }, { quoted });
}
async function apiDownload(type, url, extra = {}) {
  const providers = (process.env.DOWNLOAD_API_BASE || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const base of providers) {
    const apikey = process.env.DOWNLOAD_API_KEY || '';
    const endpoint = `${base.replace(/\/$/, '')}/${type}`;
    try {
      const { data } = await axios.get(endpoint, { params: { url, apikey, ...extra }, timeout: 45000, headers: { 'user-agent': UA } });
      const mediaUrl = pickUrl(data);
      if (mediaUrl) return { data, url: mediaUrl, provider: endpoint };
    } catch {}
  }
  return null;
}
async function cobalt(url, opts = {}) {
  const endpoints = [
    'https://api.cobalt.tools/api/json',
    'https://co.wuk.sh/api/json'
  ];
  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.post(endpoint, {
        url,
        vQuality: opts.quality || '720',
        aFormat: 'mp3',
        isAudioOnly: !!opts.audio,
        isNoTTWatermark: true
      }, { timeout: 60000, headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA } });
      let mediaUrl = data?.url || data?.audio || pickUrl(data?.picker) || pickUrl(data);
      if (mediaUrl) return { data, url: mediaUrl, provider: 'cobalt' };
    } catch {}
  }
  return null;
}
async function tikwm(url) {
  const { data } = await axios.get('https://www.tikwm.com/api/', { params: { url }, timeout: 45000, headers: { 'user-agent': UA } });
  if (data?.code !== 0 || !data?.data) throw new Error('Não consegui baixar este TikTok.');
  const d = data.data;
  const video = d.hdplay || d.play || d.wmplay;
  return {
    video: video?.startsWith('http') ? video : `https://www.tikwm.com${video}`,
    audio: d.music?.startsWith('http') ? d.music : d.music ? `https://www.tikwm.com${d.music}` : null,
    meta: d
  };
}
async function searchYoutube(query) {
  const res = await yts(query);
  return res.videos?.[0] || null;
}
async function youtubeInfo(queryOrUrl) {
  let url = queryOrUrl;
  let search = null;
  if (!isUrl(url)) { search = await searchYoutube(queryOrUrl); if (!search) throw new Error('Nada encontrado no YouTube.'); url = search.url; }
  const info = await ytdl.getInfo(url);
  return { url, search, info, details: info.videoDetails };
}
async function ytmp3(sock, jid, queryOrUrl, quoted) {
  const { url, search, info, details } = await youtubeInfo(queryOrUrl);
  const api = await apiDownload('ytmp3', url, { audio: 1 }).catch(() => null) || await cobalt(url, { audio: true }).catch(() => null);
  if (api?.url) return sendRemote(sock, jid, api.url, quoted, { audio: true, fileName: `${clean(details.title || search?.title)}.mp3` });
  if (Number(details.lengthSeconds || 0) > Number(process.env.YT_MAX_SECONDS || 1800)) throw new Error('Vídeo muito grande para esta hospedagem. Limite configurado: 30 minutos.');
  const file = path.join('temp', `audio-${Date.now()}.mp3`);
  await new Promise((resolve, reject) => {
    ytdl.downloadFromInfo(info, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 })
      .pipe(fs.createWriteStream(file)).on('finish', resolve).on('error', reject);
  });
  await sock.sendMessage(jid, { audio: fs.readFileSync(file), mimetype: 'audio/mpeg', fileName: `${clean(details.title)}.mp3` }, { quoted });
  await safeUnlink(file);
}
async function ytmp4(sock, jid, queryOrUrl, quoted) {
  const { url, details } = await youtubeInfo(queryOrUrl);
  const api = await apiDownload('ytmp4', url).catch(() => null) || await cobalt(url, { audio: false }).catch(() => null);
  if (api?.url) return sendRemote(sock, jid, api.url, quoted, { caption: ytCaption(details, url), fileName: `${clean(details.title)}.mp4` });
  if (Number(details.lengthSeconds || 0) > Number(process.env.YT_MAX_SECONDS || 1200)) throw new Error('Vídeo muito grande para download direto.');
  const formats = ytdl.filterFormats(details.formats || [], 'audioandvideo').filter(f => f.container === 'mp4');
  const best = formats.sort((a,b) => (b.height || 0) - (a.height || 0))[0];
  if (!best?.url) throw new Error('Não encontrei formato MP4 com áudio. Configure uma API externa.');
  return sendRemote(sock, jid, best.url, quoted, { caption: ytCaption(details, url), fileName: `${clean(details.title)}.mp4` });
}
function ytCaption(d, url) {
  return `╭─⊷ 「 🎬 YOUTUBE 」⊶─╮\n`+
    `▣ *Título:* ${d.title}\n`+
    `▣ *Canal:* ${d.author?.name || '-'}\n`+
    `▣ *Duração:* ${Math.floor((d.lengthSeconds||0)/60)}:${String((d.lengthSeconds||0)%60).padStart(2,'0')}\n`+
    `▣ *Views:* ${Number(d.viewCount || 0).toLocaleString('pt-BR')}\n`+
    `▣ *Link:* ${url}\n╰────────────────╯`;
}
async function tiktok(sock, jid, url, quoted, audio = false) {
  let tk = null;
  try { tk = await tikwm(url); } catch {}
  if (!tk?.video) {
    const api = await apiDownload(audio ? 'tiktokmp3' : 'tiktok', url).catch(() => null) || await cobalt(url, { audio }).catch(() => null);
    if (!api?.url) throw new Error('Não consegui baixar este TikTok. Tente outro link ou configure DOWNLOAD_API_BASE.');
    return sendRemote(sock, jid, api.url, quoted, { audio, caption: `╭─⊷ 「 TIKTOK 」⊶─╮\n▣ Link: ${url}\n╰────────────────╯` });
  }
  const d = tk.meta || {};
  const caption = `╭─⊷ 「 TIKTOK 」⊶─╮\n`+
    `▣ *Título:* ${d.title || '-'}\n`+
    `▣ *Duração:* ${d.duration || '-'} segundos\n`+
    `▣ *Região:* ${d.region || '-'}\n`+
    `▣ *Autor:* ${d.author?.nickname || d.author?.unique_id || '-'}\n`+
    `▣ *Likes:* ${Number(d.digg_count || 0).toLocaleString('pt-BR')}\n`+
    `▣ *Views:* ${Number(d.play_count || 0).toLocaleString('pt-BR')}\n`+
    `▣ *Comentários:* ${Number(d.comment_count || 0).toLocaleString('pt-BR')}\n`+
    `▣ *Música:* ${d.music_info?.title || '-'}\n╰────────────────╯`;
  return sendRemote(sock, jid, audio ? tk.audio : tk.video, quoted, { audio, caption, fileName: audio ? 'tiktok.mp3' : 'tiktok.mp4' });
}
async function genericDownload(sock, jid, type, url, quoted) {
  const providerType = ({ ig: 'instagram', fb: 'facebook', tt: 'tiktok', tw: 'twitter', x: 'twitter', sc: 'soundcloud' })[type] || type;
  if (providerType === 'tiktok') return tiktok(sock, jid, url, quoted, false);
  const audioTypes = ['spotify','spotify2','soundcloud','sc','scdl','twittermp3'];
  const api = await apiDownload(providerType, url).catch(() => null) || await cobalt(url, { audio: audioTypes.includes(providerType) }).catch(() => null);
  if (!api?.url) throw new Error(`Método não encontrado para ${providerType}. Configure DOWNLOAD_API_BASE ou tente link público válido.`);
  const mediaUrl = api.url;
  const size = await headSize(mediaUrl);
  const caption = `╭─⊷ 「 ${providerType.toUpperCase()} 」⊶─╮\n▣ *Fonte:* ${url}\n▣ *Tamanho:* ${size ? (size/1024/1024).toFixed(1)+' MB' : 'desconhecido'}\n▣ *Bot:* Sytem DARK\n╰────────────────╯`;
  const audio = /mp3|spotify|soundcloud|scdl|sc$/.test(providerType);
  return sendRemote(sock, jid, mediaUrl, quoted, { audio, caption });
}
module.exports = { searchYoutube, ytmp3, ytmp4, tiktok, genericDownload, apiDownload, cobalt, pickUrl, pickMany };
