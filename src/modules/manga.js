/**
 * Sytem DARK - Manga Module ULTIMATE v5.3
 * Integrado com scraping mangalivre, SVG thumbnail, multi-capítulo PDF e Interactive UI
 */
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { generateWAMessageFromContent, prepareWAMessageMedia, proto } = require("@whiskeysockets/baileys");
const mangaCache = new Map();

function gerarThumbnailPadrao(titulo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#1a1a2e"/><rect x="20" y="20" width="260" height="360" rx="10" fill="#16213e" stroke="#0f3460" stroke-width="2"/><text x="150" y="180" font-family="Arial" font-size="24" fill="#e94560" text-anchor="middle">📚</text><text x="150" y="220" font-family="Arial" font-size="16" fill="#ffffff" text-anchor="middle" font-weight="bold">${titulo || "Manga"}</text><text x="150" y="250" font-family="Arial" font-size="12" fill="#888888" text-anchor="middle">Capítulos disponíveis</text></svg>`;
  return Buffer.from(svg);
}

async function buscarTodosCapitulos(manga) {
  try {
    let slug = manga;
    if (manga.startsWith("http")) {
      const urlObj = new URL(manga);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      slug = pathParts[pathParts.length - 1] || pathParts[0];
    } else {
      slug = manga.trim().toLowerCase().replace(/\s+/g, "-");
    }
    const url = `https://mangalivre.blog/manga/${slug}/`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    let titulo = $("h1").first().text().trim();
    if (!titulo) titulo = $(".manga-title").text().trim();
    if (!titulo) titulo = $(".entry-title").text().trim();
    if (!titulo) titulo = $("title").text().trim().replace(" - Mangá Livre", "");
    if (!titulo) titulo = slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    let mangaThumbnail = null;
    $("img").each((_, e) => {
      const src = $(e).attr("src") || $(e).attr("data-src");
      if (src && !src.includes("avatar") && !src.includes("logo") && !src.includes("icon")) {
        if (src.includes("/wp-content/uploads/") || src.includes("manga")) {
          mangaThumbnail = src;
          return false;
        }
      }
    });
    const capitulos = [];
    $(".chapter-grid-link").each((i, el) => {
      const numero = $(el).find(".chapter-grid-number span").text().trim();
      const nome = $(el).find(".chapter-grid-title").text().trim();
      const urlCap = $(el).attr("href");
      let thumbnail = null;
      const imgElement = $(el).find("img");
      if (imgElement.length) {
        thumbnail = imgElement.attr("src") || imgElement.attr("data-src");
      }
      if (!thumbnail || thumbnail.includes("placeholder")) {
        thumbnail = mangaThumbnail;
      }
      capitulos.push({
        numero: numero || `Capítulo ${i + 1}`,
        nome: nome || `Capítulo ${i + 1}`,
        url: urlCap,
        thumbnail: thumbnail,
        index: i
      });
    });
    if (!capitulos.length) {
      throw new Error("Nenhum capítulo encontrado.");
    }
    capitulos.reverse();
    capitulos.forEach((cap, idx) => cap.index = idx);
    return {
      titulo: titulo,
      thumbnail: mangaThumbnail,
      capitulos: capitulos
    };
  } catch (error) {
    throw new Error(`Erro ao buscar mangá: ${error.message}`);
  }
}

async function pegarPaginas(urlCapitulo) {
  try {
    const { data } = await axios.get(urlCapitulo, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 20000
    });
    const $ = cheerio.load(data);
    const paginas = [];
    $(".chapter-content img, .reading-content img, .page-break img").each((_, e) => {
      const src = $(e).attr("src") || $(e).attr("data-src") || $(e).attr("data-lazy-src");
      if (src && /\.(jpg|jpeg|png|webp|gif)$/i.test(src)) {
        if (!src.includes("ads") && !src.includes("banner") && !src.includes("logo")) {
          paginas.push(src);
        }
      }
    });
    if (!paginas.length) {
      $("img").each((_, e) => {
        const src = $(e).attr("src") || $(e).attr("data-src") || $(e).attr("data-lazy-src");
        if (src && (src.includes("/wp-content/uploads/") || src.includes("manga")) && /\.(jpg|jpeg|png|webp)$/i.test(src) && !src.includes("avatar") && !src.includes("logo")) {
          paginas.push(src);
        }
      });
    }
    const uniquePages = [...new Set(paginas)];
    uniquePages.sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] || 0);
      const numB = parseInt(b.match(/(\d+)/)?.[1] || 0);
      return numA - numB;
    });
    return uniquePages;
  } catch (error) {
    throw new Error(`Erro ao buscar páginas: ${error.message}`);
  }
}

async function baixarThumbnail(url, titulo) {
  if (!url) return gerarThumbnailPadrao(titulo);
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://mangalivre.blog/"
      }
    });
    if (response.data && response.data.length > 1000) {
      return Buffer.from(response.data);
    }
    return gerarThumbnailPadrao(titulo);
  } catch (e) {
    return gerarThumbnailPadrao(titulo);
  }
}

async function criarPDFMultiplo(capitulosInfo) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ autoFirstPage: false });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
      for (let idx = 0; idx < capitulosInfo.length; idx++) {
        const { imagens } = capitulosInfo[idx];
        for (let i = 0; i < imagens.length; i++) {
          try {
            const imgUrl = imagens[i];
            const response = await axios({
              method: "GET",
              url: imgUrl,
              responseType: "arraybuffer",
              timeout: 30000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://mangalivre.blog/"
              }
            });
            const imgBuffer = Buffer.from(response.data);
            const isJPEG = imgBuffer[0] === 0xFF && imgBuffer[1] === 0xD8;
            const isPNG = imgBuffer[0] === 0x89 && imgBuffer[1] === 0x50 && imgBuffer[2] === 0x4E && imgBuffer[3] === 0x47;
            if (isJPEG || isPNG) {
              const tempDir = path.join(__dirname, "..", "..", "temp");
              if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
              const tempImgPath = path.join(tempDir, `temp_img_${Date.now()}_${i}.jpg`);
              fs.writeFileSync(tempImgPath, imgBuffer);
              doc.addPage();
              const pageWidth = doc.page.width;
              const pageHeight = doc.page.height;
              doc.image(tempImgPath, 0, 0, {
                width: pageWidth,
                height: pageHeight,
                fit: [pageWidth, pageHeight],
                align: 'center',
                valign: 'center'
              });
              try { fs.unlinkSync(tempImgPath); } catch (e) {}
            }
          } catch (e) {
            continue;
          }
        }
      }
      doc.end();
    } catch (error) {
      reject(new Error(`Erro ao criar PDF: ${error.message}`));
    }
  });
}

async function sendMangaMenu(sock, jid, mangaName, quoted) {
  const react = async (emoji) => {
    try { await sock.sendMessage(jid, { react: { text: emoji, key: quoted?.key } }); } catch {}
  };
  await react("🔍");
  const resultado = await buscarTodosCapitulos(mangaName);
  if (!resultado || !resultado.capitulos.length) {
    await react("❌");
    throw new Error(`Nenhum capítulo encontrado para "${mangaName}"`);
  }
  const tempDir = path.join(__dirname, "..", "..", "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const thumbBuffer = await baixarThumbnail(resultado.thumbnail, resultado.titulo);
  const tempThumbPath = path.join(tempDir, `thumb_manga_${Date.now()}.jpg`);
  fs.writeFileSync(tempThumbPath, thumbBuffer);
  const media = await prepareWAMessageMedia({ image: { url: tempThumbPath } }, { upload: sock.waUploadToServer });
  try { fs.unlinkSync(tempThumbPath); } catch (e) {}

  const sections = [];
  const capitulosPorGrupo = 2;
  const totalCapitulos = resultado.capitulos.length;
  for (let i = 0; i < totalCapitulos; i += capitulosPorGrupo) {
    const fim = Math.min(i + capitulosPorGrupo, totalCapitulos);
    const grupo = resultado.capitulos.slice(i, fim);
    const groupId = `manga_${Date.now()}_${i}_${fim}`;
    const numInicio = i + 1;
    const numFim = fim;
    const label = numInicio === numFim ? `${numInicio}` : `${numInicio}_${numFim}`;
    mangaCache.set(groupId, {
      type: 'grupo',
      manga: resultado.titulo,
      capitulos: grupo.map(cap => ({ numero: cap.numero, nome: cap.nome, url: cap.url })),
      inicio: numInicio,
      fim: numFim,
      label: label
    });
    setTimeout(() => mangaCache.delete(groupId), 10 * 60 * 1000);
    const rows = [{
      title: `📚 Capítulo ${label}`,
      description: `${grupo.length} capítulo${grupo.length > 1 ? 's' : ''}`,
      rowId: groupId
    }];
    sections.push({
      title: `📚 Capítulo ${label}`,
      rows: rows
    });
  }

  const text = `❄️═════════════════❄️\n 📚 *${resultado.titulo}*\n❄️═══════════════❄️\n📖 Total: ${totalCapitulos} capítulos\n💡 Selecione um capítulo:`.trim();
  
  // Constrói mensagem interativa compatível com Baileys moderno (viewOnceMessage + deviceListMetadata)
  const message = generateWAMessageFromContent(jid, {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          header: proto.Message.InteractiveMessage.Header.create({
            hasMediaAttachment: true,
            imageMessage: media.imageMessage,
            title: `📚 ${resultado.titulo}`,
            subtitle: ""
          }),
          body: proto.Message.InteractiveMessage.Body.create({ text }),
          footer: proto.Message.InteractiveMessage.Footer.create({
            text: `📖 ${resultado.titulo} • Selecione um capítulo`
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: [{
              name: "single_select",
              buttonParamsJson: JSON.stringify({
                title: "📖 SELECIONAR CAPÍTULO",
                sections
              })
            }]
          })
        })
      }
    }
  }, { userJid: sock?.user?.id || sock?.user?.jid, quoted });

  await sock.relayMessage(jid, message.message, { messageId: message.key.id });
  await react("✅");
  return resultado;
}

async function handleMangaButton(sock, message) {
  try {
    const U = require('../lib/utils');
    const selectedId = U.extractButtonId ? U.extractButtonId(message) : (
      message.message?.buttonsResponseMessage?.selectedButtonId ||
      message.message?.templateButtonReplyMessage?.selectedId ||
      (message.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson && JSON.parse(message.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).id) ||
      (message.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson && JSON.parse(message.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson).rowId)
    );
    if (!selectedId || !selectedId.startsWith('manga_') && !selectedId.startsWith('dark_manga_')) return false;

    const dados = mangaCache.get(selectedId);
    if (!dados) {
      try { await sock.sendMessage(message.key.remoteJid, { react: { text: "❌", key: message.key } }); } catch (e) {}
      return true;
    }
    mangaCache.delete(selectedId);

    if (dados.type === 'grupo') {
      const { manga, capitulos, inicio, fim, label } = dados;
      try { await sock.sendMessage(message.key.remoteJid, { react: { text: "⏳", key: message.key } }); } catch (e) {}
      let todosOsCapitulosInfo = [];
      let totalPaginas = 0;
      for (let idx = 0; idx < capitulos.length; idx++) {
        const cap = capitulos[idx];
        try {
          const paginas = await pegarPaginas(cap.url);
          if (paginas && paginas.length > 0) {
            todosOsCapitulosInfo.push({ titulo: manga, capitulo: cap.numero, imagens: paginas });
            totalPaginas += paginas.length;
          }
        } catch (err) {}
      }
      if (todosOsCapitulosInfo.length === 0) {
        try { await sock.sendMessage(message.key.remoteJid, { react: { text: "❌", key: message.key } }); } catch (e) {}
        return true;
      }
      const pdfBuffer = await criarPDFMultiplo(todosOsCapitulosInfo);
      const nomeArquivo = `${manga}_Cap${label}.pdf`.replace(/[^a-zA-Z0-9_]/g, '_');
      const tempDir = path.join(__dirname, "..", "..", "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const pdfPath = path.join(tempDir, `${Date.now()}_${nomeArquivo}`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      await sock.sendMessage(message.key.remoteJid, {
        document: { url: pdfPath },
        mimetype: "application/pdf",
        fileName: nomeArquivo,
        caption: `📚 *${manga}*\n📖 Capítulo ${label}\n📄 ${totalPaginas} páginas\n✅ ${todosOsCapitulosInfo.length} capítulo${todosOsCapitulosInfo.length > 1 ? 's' : ''} processado${todosOsCapitulosInfo.length > 1 ? 's' : ''} com sucesso!\n\n🌌 Sytem DARK • Dark Net`
      }, { quoted: message });
      try { fs.unlinkSync(pdfPath); } catch (e) {}
      try { await sock.sendMessage(message.key.remoteJid, { react: { text: "✅", key: message.key } }); } catch (e) {}
    }
    return true;
  } catch (err) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: "❌", key: message.key } }); } catch (e) {}
    return false;
  }
}

module.exports = {
  name: "manga",
  alias: ["mangá", "ler", "capitulo"],
  category: "Leitura",
  gerarThumbnailPadrao,
  buscarTodosCapitulos,
  pegarPaginas,
  baixarThumbnail,
  criarPDFMultiplo,
  sendMangaMenu,
  handleMangaButton
};