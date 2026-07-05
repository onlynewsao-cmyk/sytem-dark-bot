/**
 * Sytem DARK - AI Module ULTIMATE PLUS v5.2
 * Dark Net
 * Integrado: Copilot, Gemini, Grok, SystemZero, Nano
 */
const axios = require('axios');
const FormData = require('form-data');
const cfg = require('../config');

async function copilot(text){
  const { data } = await axios.get('https://systemzone.store/api/copilot2', {
    params: { text, model: cfg.features.copilotModel },
    timeout: 45000
  });
  if (data?.status && data.result) return data.result;
  throw new Error(data?.message || 'copilot falhou');
}

async function nanoEdit(imageBuffer, prompt){
  const form = new FormData();
  form.append('image', imageBuffer, { filename:'dark.jpg', contentType:'image/jpeg' });
  form.append('prompt', prompt || 'enhance');
  const { data } = await axios.post('https://systemzone.store/api/v2/edit/deepai', form, {
    headers: form.getHeaders(),
    timeout: 120000,
    maxBodyLength: Infinity
  });
  if (data?.imagem || data?.image || data?.result) return data.imagem || data.image || data.result;
  throw new Error('nano sem retorno');
}

async function addMetaAI(sock, groupJid){
  try {
    await sock.groupParticipantsUpdate(groupJid, ['867051314767696@s.whatsapp.net','867051314767696@lid','867051314767696@bot'], 'add');
    return true;
  } catch(e){ return false; }
}

async function removeMetaAI(sock, groupJid){
  try {
    await sock.groupParticipantsUpdate(groupJid, ['867051314767696@s.whatsapp.net','867051314767696@lid','867051314767696@bot'], 'remove');
    return true;
  } catch(e){ return false; }
}

async function gemini(text){
  // 1) tenta GEMINI_API_KEY direta
  const gkey = cfg.apis.gemini;
  if(gkey){
    try{
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${gkey}`;
      const { data } = await axios.post(url, {
        contents: [{ parts:[{ text }] }]
      }, { timeout: 25000 });
      const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(out) return out;
    }catch(e){ /* fallback */ }
  }
  // 2) systemzone
  const base = cfg.apis.systemzone.url || 'https://systemzone.store';
  const key = cfg.apis.systemzone.key || 'freekey';
  try{
    const { data } = await axios.get(`${base}/api/ai/gemini`, { params:{ text, apikey:key }, timeout:30000 });
    if(data?.result) return data.result;
  }catch(_){}
  // 3) fallback copilot
  return copilot(text);
}

async function grok(text){
  // 1) GROQ API (rápido)
  const groqKey = cfg.apis.groq;
  if(groqKey){
    try{
      const { data } = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama3-70b-8192',
        messages: [{ role:'user', content: text }],
        temperature: 0.7,
        max_tokens: 1024
      }, {
        headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type':'application/json' },
        timeout: 25000
      });
      const out = data?.choices?.[0]?.message?.content;
      if(out) return out;
    }catch(_){}
  }
  // 2) systemzone
  const base = cfg.apis.systemzone.url || 'https://systemzone.store';
  const key = cfg.apis.systemzone.key || 'freekey';
  try{
    const { data } = await axios.get(`${base}/api/ai/grok`, { params:{ text, apikey:key }, timeout:30000 });
    if(data?.result) return data.result;
  }catch(_){}
  return copilot(text);
}

async function systemZero(text){
  // SystemZero = copilot com prompt especial + groq fallback
  try{
    return await grok(`[SystemZero • Dark Net] ${text}`);
  }catch(_){
    return copilot(`[SystemZero Mode] ${text}`);
  }
}

module.exports = { copilot, nanoEdit, addMetaAI, removeMetaAI, gemini, grok, systemZero };
