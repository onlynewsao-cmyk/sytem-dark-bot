/**
 * Sytem DARK - Downloads
 */
const axios = require('axios');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const cfg = require('../config');

async function searchYoutube(q){
  const r = await yts(q);
  return r.videos.slice(0,5);
}

async function ytmp4(url){
  // systemzone 1080p prefer
  try {
    const api = `https://systemzone.store/v1/exp?url=${encodeURIComponent(url)}&quality=1080`;
    const { data } = await axios.get(api, { timeout: 45000 });
    if (data?.status || data?.download_url) {
      return {
        url: data.download_url || data.url,
        title: data.title || 'Video',
        quality: data.quality || '1080p',
        duration: data.duration || 'N/A',
        size: data.size || 'N/A',
        status: true
      };
    }
  } catch(_){}
  // fallback ytdl info
  try {
    const info = await ytdl.getInfo(url);
    const f = ytdl.chooseFormat(info.formats, { quality:'18' });
    const duration = info.videoDetails.lengthSeconds ? `${Math.floor(info.videoDetails.lengthSeconds/60)}m ${info.videoDetails.lengthSeconds%60}s` : 'N/A';
    return {
      url: f.url,
      title: info.videoDetails.title,
      quality: f.qualityLabel || '360p',
      duration,
      size: 'N/A',
      status: true
    };
  } catch(e) {
    throw new Error('Não foi possível baixar este vídeo.');
  }
}

async function tiktokDl(url){
  try {
    const { data } = await axios.get('https://tikwm.com/api/', { params:{ url, hd:1 }, timeout:20000 });
    if (data?.data?.play) return { video: data.data.play, music: data.data.music, title: data.data.title };
  } catch(_){}
  return null;
}

async function tiktokStalk(user){
  const { data } = await axios.get(`https://systemzone.store/api/tiktok/stalk`, { params:{ user }, timeout:20000 });
  return data;
}

// SystemZero YT Music
async function szYtmp3(queryOrUrl){
  const base = cfg.apis.systemzone.url || 'https://systemzone.store';
  const key = cfg.apis.systemzone.key || 'freekey';
  let url = queryOrUrl;
  if(!url.includes('http')){
    const vids = await searchYoutube(queryOrUrl);
    if(vids[0]) url = vids[0].url;
  }
  try{
    const { data } = await axios.get(`${base}/api/download/ytmp3`, { params:{ url, apikey:key }, timeout:45000 });
    return data?.result || data;
  }catch(e){
    // fallback to ytmp4 audio
    return await ytmp4(url);
  }
}

async function szYtmp4(queryOrUrl){
  const base = cfg.apis.systemzone.url || 'https://systemzone.store';
  let url = queryOrUrl;
  if(!url.includes('http')){
    const vids = await searchYoutube(queryOrUrl);
    if(vids[0]) url = vids[0].url;
  }
  // use existing 1080p
  return ytmp4(url);
}

module.exports = { searchYoutube, ytmp4, tiktokDl, tiktokStalk, szYtmp3, szYtmp4 };
