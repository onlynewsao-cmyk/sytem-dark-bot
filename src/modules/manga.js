/**
 * Sytem DARK - Manga PDF
 * Dark Net
 */
const axios = require('axios');
const cheerio = require('cheerio');
const PDFDocument = require('pdfkit');
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require('@whiskeysockets/baileys');
const cfg = require('../config');

async function fetchHtml(url){
  const { data } = await axios.get(url, { timeout: 25000, headers:{ 'User-Agent':'Mozilla/5.0', 'Accept-Language':'pt-BR' }});
  return data;
}
function toSlug(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

async function getChapters(name){
  const slug = toSlug(name);
  const url = `https://mangalivre.blog/manga/${slug}/`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const chapters=[];
  $('.chapter-grid-link, a[href*="/ler/"], .chapters-list a').each((_,el)=>{
    const href=$(el).attr('href')||'';
    const m = href.match(/(\d+(?:\.\d+)?)\/?$/);
    if(m){ const num=parseFloat(m[1]); if(!chapters.find(c=>c.num===num)) chapters.push({ num, url: href.startsWith('http')? href : 'https://mangalivre.blog'+href }); }
  });
  chapters.sort((a,b)=> a.num - b.num);
  return { slug, url, chapters };
}

async function getChapterPages(chUrl){
  const html = await fetchHtml(chUrl);
  const $ = cheerio.load(html);
  const urls = new Set();
  $('.chapter-content img, .reading-content img, .page-break img, img.chapter-img, img.js-page').each((_,img)=>{
    const src = $(img).attr('data-src') || $(img).attr('data-lazy-src') || $(img).attr('src');
    if(src && /^https?:\/\//.test(src) && !src.includes('logo')) urls.add(src.split('?')[0]);
  });
  return [...urls];
}

async function buildPdf(pages, title){
  return new Promise(async (resolve, reject)=>{
    try {
      const doc = new PDFDocument({ autoFirstPage:false });
      const bufs=[];
      doc.on('data', d=>bufs.push(d));
      doc.on('end', ()=> resolve(Buffer.concat(bufs)));
      for(let i=0;i<pages.length;i++){
        try{
          const { data } = await axios.get(pages[i], { responseType:'arraybuffer', timeout:20000, headers:{ Referer:'https://mangalivre.blog/', 'User-Agent':'Mozilla/5.0' }});
          const img = Buffer.from(data);
          const im = doc.openImage(img);
          doc.addPage({ size:[im.width, im.height] });
          doc.image(img,0,0);
        }catch(_){}
      }
      if(bufs.length===0 && doc.page===null) doc.addPage().fontSize(20).text(title||'Manga',100,100);
      doc.end();
    } catch(e){ reject(e); }
  });
}

async function sendMangaMenu(sock, jid, mangaName, quoted){
  const info = await getChapters(mangaName);
  if(!info.chapters.length) throw new Error('Mangá não encontrado');
  const last = info.chapters.slice(-12);
  const sections=[{
    title: `Sytem DARK - ${mangaName}`,
    rows: last.map(c=>({ title:`Capítulo ${c.num}`, rowId:`dark_manga_${info.slug}_${c.num}`, description:`Baixar PDF` }))
  }];
  const msg = generateWAMessageFromContent(jid, {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({ text: `📖 *${mangaName}*\n${info.chapters.length} capítulos encontrados\n\nSelecione:` }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: '🌌☯️ Sytem DARK • Dark Net ☯️🌌' }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [{ name:'single_select', buttonParamsJson: JSON.stringify({ title:'📚 CAPÍTULOS', sections }) }]
      })
    })
  }, { quoted });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return info;
}

async function handleMangaButton(sock, msg, db){
  const btnId = msg.message?.buttonsResponseMessage?.selectedButtonId
    || msg.message?.templateButtonReplyMessage?.selectedId
    || msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson && JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id;
  const sel = btnId || '';
  if(!sel.startsWith('dark_manga_')) return false;
  const parts = sel.replace('dark_manga_','').split('_');
  const cap = parseFloat(parts.pop());
  const slug = parts.join('_');
  const jid = msg.key.remoteJid;
  try{
    await sock.sendMessage(jid, { text: `📖 Baixando Capítulo ${cap}... Sytem DARK` }, { quoted: msg });
    const info = await getChapters(slug);
    const ch = info.chapters.find(c=> c.num===cap) || info.chapters[0];
    if(!ch) throw new Error('Capítulo não encontrado');
    const pages = await getChapterPages(ch.url);
    if(!pages.length) throw new Error('Páginas vazias');
    const pdf = await buildPdf(pages, `${slug} cap ${cap}`);
    await sock.sendMessage(jid, { document: pdf, mimetype:'application/pdf', fileName: `SytemDARK_${slug}_cap${cap}.pdf`, caption: `✅ ${slug} - Cap ${cap}\n${pages.length} páginas\n🌌 Sytem DARK` }, { quoted: msg });
  }catch(e){
    await sock.sendMessage(jid, { text: `❌ Erro manga: ${e.message}` }, { quoted: msg });
  }
  return true;
}

module.exports = { getChapters, sendMangaMenu, handleMangaButton };
