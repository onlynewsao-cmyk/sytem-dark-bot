const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = require('@whiskeysockets/baileys');

const mangaCache = new Map();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari';

function tempDir() {
  const dir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function safeName(name) { return String(name || 'manga').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 80); }
function gerarThumbnailPadrao(titulo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#05040a"/><rect x="18" y="18" width="264" height="364" rx="14" fill="#151027" stroke="#8a2bff" stroke-width="3"/><text x="150" y="170" font-family="Arial" font-size="46" fill="#ffffff" text-anchor="middle">📚</text><text x="150" y="225" font-family="Arial" font-size="19" fill="#ffffff" text-anchor="middle" font-weight="bold">${String(titulo || 'Manga').replace(/[<&>]/g, '')}</text><text x="150" y="255" font-family="Arial" font-size="13" fill="#a9a0ff" text-anchor="middle">Sytem DARK</text></svg>`;
  return Buffer.from(svg);
}
async function buscarTodosCapitulos(manga) {
  let slug = manga;
  if (/^https?:\/\//i.test(manga)) {
    const urlObj = new URL(manga);
    const parts = urlObj.pathname.split('/').filter(Boolean);
    slug = parts[parts.length - 1] || parts[0];
  } else slug = manga.trim().toLowerCase().replace(/\s+/g, '-');
  const url = `https://mangalivre.blog/manga/${slug}/`;
  const { data } = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 });
  const $ = cheerio.load(data);
  let titulo = $('h1').first().text().trim() || $('.manga-title').text().trim() || $('.entry-title').text().trim() || $('title').text().trim().replace(/ - .+$/, '') || slug.replace(/-/g, ' ');
  let mangaThumbnail = null;
  $('img').each((_, e) => {
    const src = $(e).attr('src') || $(e).attr('data-src');
    if (src && !/avatar|logo|icon/i.test(src) && (/\/wp-content\/uploads\//i.test(src) || /manga/i.test(src))) { mangaThumbnail = src; return false; }
  });
  const capitulos = [];
  $('.chapter-grid-link, a[href*="/capitulo"], a[href*="chapter"]').each((i, el) => {
    const urlCap = $(el).attr('href');
    if (!urlCap) return;
    const numero = $(el).find('.chapter-grid-number span').text().trim() || $(el).text().match(/cap[ií]tulo\s*([\d.]+)/i)?.[0] || `Capítulo ${i + 1}`;
    const nome = $(el).find('.chapter-grid-title').text().trim() || numero;
    const img = $(el).find('img');
    let thumbnail = img.attr('src') || img.attr('data-src') || mangaThumbnail;
    capitulos.push({ numero, nome, url: urlCap.startsWith('http') ? urlCap : new URL(urlCap, url).href, thumbnail, index: i });
  });
  const unique = [];
  const seen = new Set();
  for (const c of capitulos) { if (!seen.has(c.url)) { seen.add(c.url); unique.push(c); } }
  if (!unique.length) throw new Error('Nenhum capítulo encontrado.');
  unique.reverse(); unique.forEach((c, i) => c.index = i);
  return { titulo, thumbnail: mangaThumbnail, capitulos: unique };
}
async function pegarPaginas(urlCapitulo) {
  const { data } = await axios.get(urlCapitulo, { headers: { 'User-Agent': UA, Referer: 'https://mangalivre.blog/' }, timeout: 25000 });
  const $ = cheerio.load(data);
  const paginas = [];
  $('.chapter-content img, .reading-content img, .page-break img, img').each((_, e) => {
    const src = $(e).attr('src') || $(e).attr('data-src') || $(e).attr('data-lazy-src');
    if (src && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src) && !/ads|banner|logo|avatar/i.test(src)) paginas.push(src.startsWith('http') ? src : new URL(src, urlCapitulo).href);
  });
  return [...new Set(paginas)];
}
async function baixarThumbnail(url, titulo) {
  if (!url) return gerarThumbnailPadrao(titulo);
  try {
    const response = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 12000, headers: { 'User-Agent': UA, Referer: 'https://mangalivre.blog/' } });
    if (response.data && response.data.length > 1000) return Buffer.from(response.data);
  } catch {}
  return gerarThumbnailPadrao(titulo);
}
async function criarPDFMultiplo(capitulosInfo) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers = [];
      doc.on('data', d => buffers.push(d));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
      for (const capInfo of capitulosInfo) {
        for (let i = 0; i < capInfo.imagens.length; i++) {
          try {
            const response = await axios({ method: 'GET', url: capInfo.imagens[i], responseType: 'arraybuffer', timeout: 30000, headers: { 'User-Agent': UA, Referer: 'https://mangalivre.blog/' } });
            const imgBuffer = Buffer.from(response.data);
            const tempImg = path.join(tempDir(), `manga_${Date.now()}_${i}.jpg`);
            fs.writeFileSync(tempImg, imgBuffer);
            doc.addPage();
            doc.image(tempImg, 0, 0, { width: doc.page.width, height: doc.page.height, fit: [doc.page.width, doc.page.height], align: 'center', valign: 'center' });
            try { fs.unlinkSync(tempImg); } catch {}
          } catch {}
        }
      }
      doc.end();
    } catch (e) { reject(e); }
  });
}
async function mangaCommand(sock, ctx) {
  const query = ctx.q.trim();
  if (!query) return ctx.reply(`📚 *Como usar:*\n\n${ctx.prefix}manga nome do mangá\n${ctx.prefix}manga https://mangalivre.blog/manga/nano-machine/`);
  await ctx.react('🔍');
  const resultado = await buscarTodosCapitulos(query);
  const thumb = await baixarThumbnail(resultado.thumbnail, resultado.titulo);
  const thumbPath = path.join(tempDir(), `thumb_${Date.now()}.jpg`);
  fs.writeFileSync(thumbPath, thumb);
  const media = await prepareWAMessageMedia({ image: { url: thumbPath } }, { upload: sock.waUploadToServer });
  try { fs.unlinkSync(thumbPath); } catch {}
  const sections = [];
  const perGroup = Number(process.env.MANGA_CHAPTERS_PER_PDF || 2);
  for (let i = 0; i < resultado.capitulos.length; i += perGroup) {
    const fim = Math.min(i + perGroup, resultado.capitulos.length);
    const grupo = resultado.capitulos.slice(i, fim);
    const id = `manga_${Date.now()}_${i}_${fim}_${Math.random().toString(16).slice(2)}`;
    mangaCache.set(id, { manga: resultado.titulo, capitulos: grupo.map(c => ({ numero: c.numero, nome: c.nome, url: c.url })), label: i + 1 === fim ? `${i + 1}` : `${i + 1}_${fim}` });
    setTimeout(() => mangaCache.delete(id), 10 * 60 * 1000);
    sections.push({ title: `📚 Capítulo ${i + 1}${fim > i + 1 ? ` até ${fim}` : ''}`, rows: [{ title: `📚 Capítulo ${i + 1}${fim > i + 1 ? `_${fim}` : ''}`, description: `${grupo.length} capítulo(s) em PDF`, id }] });
  }
  const text = `❄️═════════════════❄️\n📚 *${resultado.titulo}*\n❄️═════════════════❄️\n📖 Total: ${resultado.capitulos.length} capítulos\n💡 Selecione um capítulo:`;
  const card = {
    header: proto.Message.InteractiveMessage.Header.fromObject({ hasMediaAttachment: true, imageMessage: media.imageMessage }),
    body: proto.Message.InteractiveMessage.Body.fromObject({ text }),
    footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: `📖 ${resultado.titulo} • Sytem DARK` }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({ buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify({ title: '📖 SELECIONAR CAPÍTULO', sections }) }] })
  };
  const message = generateWAMessageFromContent(ctx.from, { interactiveMessage: { carouselMessage: { cards: [card] } } }, { quoted: ctx.msg });
  await sock.relayMessage(ctx.from, message.message, { messageId: message.key.id });
  await ctx.react('✅');
}
async function handleMangaButton(sock, message) {
  try {
    const interactiveMsg = message.message?.interactiveResponseMessage;
    if (!interactiveMsg) return false;
    const nativeFlow = interactiveMsg.nativeFlowResponseMessage;
    if (!nativeFlow) return false;
    const params = JSON.parse(nativeFlow.paramsJson || '{}');
    const selectedId = params.selectedId || params.id || params.selectedRowId;
    if (!selectedId || !mangaCache.has(selectedId)) return false;
    const dados = mangaCache.get(selectedId); mangaCache.delete(selectedId);
    const jid = message.key.remoteJid;
    await sock.sendMessage(jid, { react: { text: '⏳', key: message.key } }).catch(() => {});
    const info = []; let totalPaginas = 0;
    for (const cap of dados.capitulos) {
      const paginas = await pegarPaginas(cap.url).catch(() => []);
      if (paginas.length) { info.push({ titulo: dados.manga, capitulo: cap.numero, imagens: paginas }); totalPaginas += paginas.length; }
    }
    if (!info.length) { await sock.sendMessage(jid, { react: { text: '❌', key: message.key } }).catch(() => {}); return true; }
    const pdfBuffer = await criarPDFMultiplo(info);
    const fileName = `${safeName(dados.manga)}_Cap${dados.label}.pdf`;
    const pdfPath = path.join(tempDir(), `${Date.now()}_${fileName}`);
    fs.writeFileSync(pdfPath, pdfBuffer);
    await sock.sendMessage(jid, { document: { url: pdfPath }, mimetype: 'application/pdf', fileName, caption: `📚 *${dados.manga}*\n📖 Capítulo ${dados.label}\n📄 ${totalPaginas} páginas\n✅ Sytem DARK` }, { quoted: message });
    try { fs.unlinkSync(pdfPath); } catch {}
    await sock.sendMessage(jid, { react: { text: '✅', key: message.key } }).catch(() => {});
    return true;
  } catch (e) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: '❌', key: message.key } }); } catch {}
    return false;
  }
}
module.exports = { mangaCommand, handleMangaButton };
