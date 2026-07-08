const axios = require('axios');
const config = require('../config');

async function directDownload(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('URL inválida. Use http:// ou https://');
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: config.directDownloadMaxMb * 1024 * 1024,
    headers: { 'user-agent': 'DARK-System-Bot/1.0' }
  });
  const mime = res.headers['content-type'] || 'application/octet-stream';
  const name = decodeURIComponent(String(url).split('/').pop()?.split('?')[0] || 'arquivo.bin');
  return { buffer: Buffer.from(res.data), mime, name };
}

module.exports = { directDownload };
