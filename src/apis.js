const axios = require('axios');
const UA = 'Mozilla/5.0 (Sytem DARK; Dark Net)';

async function requestJson(url, options = {}) {
  const { data } = await axios({ url, timeout: options.timeout || 30000, headers: { 'user-agent': UA, accept: 'application/json', ...(options.headers || {}) }, ...options });
  return data;
}
async function darkRoletaVideo(options) {
  const text = Array.isArray(options) ? options.join(',') : String(options || '');
  const providers = [
    { url: 'https://' + 'system' + 'zone.store/api/canvas/roleta', params: { text } }
  ];
  for (const p of providers) {
    try {
      const data = await requestJson(p.url, { params: p.params, timeout: 45000 });
      const media = data?.result?.download || data?.resultado?.download || data?.download || data?.url;
      if (data?.status && media) return media;
    } catch (_) {}
  }
  return null;
}
async function quotePt() {
  const providers = [
    async () => {
      const d = await requestJson('https://api.adviceslip.com/advice', { timeout: 15000 });
      return d?.slip?.advice;
    },
    async () => {
      const d = await requestJson('https://zenquotes.io/api/random', { timeout: 15000 });
      return Array.isArray(d) ? `${d[0].q} — ${d[0].a}` : null;
    }
  ];
  for (const fn of providers) { try { const r = await fn(); if (r) return r; } catch (_) {} }
  return 'A persistência transforma sonhos em realidade.';
}
async function bibleVerse() {
  const providers = [
    async () => {
      const d = await requestJson('https://bible-api.com/john%203:16?translation=almeida', { timeout: 15000 });
      return d?.text ? `${d.reference}\n${d.text.trim()}` : null;
    },
    async () => {
      const d = await requestJson('https://bible-api.com/psalms%2023:1?translation=almeida', { timeout: 15000 });
      return d?.text ? `${d.reference}\n${d.text.trim()}` : null;
    }
  ];
  for (const fn of providers) { try { const r = await fn(); if (r) return r; } catch (_) {} }
  return 'Salmos 23:1\nO Senhor é o meu pastor; nada me faltará.';
}
async function randomDog() {
  try { const d = await requestJson('https://dog.ceo/api/breeds/image/random', { timeout: 15000 }); return d?.message; } catch { return null; }
}
async function randomCat() {
  try { const d = await requestJson('https://api.thecatapi.com/v1/images/search', { timeout: 15000 }); return Array.isArray(d) ? d[0]?.url : null; } catch { return null; }
}
async function githubRepo(repo) {
  const clean = String(repo || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/,'').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(clean)) throw new Error('Use dono/repositorio.');
  return requestJson(`https://api.github.com/repos/${clean}`, { timeout: 20000 });
}
module.exports = { requestJson, darkRoletaVideo, quotePt, bibleVerse, randomDog, randomCat, githubRepo };
