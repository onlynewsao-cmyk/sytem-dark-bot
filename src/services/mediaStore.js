const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');

let bucket;

function initMediaStore(connection) {
  bucket = new GridFSBucket(connection.db, { bucketName: 'dark_gallery' });
}

function requireBucket() {
  if (!bucket) throw new Error('MediaStore não inicializado');
  return bucket;
}

async function uploadBuffer(buffer, filename, metadata = {}) {
  const b = requireBucket();
  return new Promise((resolve, reject) => {
    const upload = b.openUploadStream(filename, { metadata });
    Readable.from(buffer).pipe(upload)
      .on('error', reject)
      .on('finish', () => resolve(upload.id));
  });
}

async function downloadBuffer(id) {
  const b = requireBucket();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  return new Promise((resolve, reject) => {
    const chunks = [];
    b.openDownloadStream(objectId)
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', reject)
      .on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function streamFile(id) {
  const b = requireBucket();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  return b.openDownloadStream(objectId);
}

module.exports = { initMediaStore, uploadBuffer, downloadBuffer, streamFile };
