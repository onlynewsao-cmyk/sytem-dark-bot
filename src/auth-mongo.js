const fs = require('fs');
const path = require('path');

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}
async function getMongo() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) return null;
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000, maxPoolSize: 3 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'sytem_dark');
  return { client, col: db.collection('auth_state') };
}
function authId() {
  return process.env.AUTH_ID || process.env.BOT_NUMBER || process.env.PAIRING_NUMBER || 'sytem_dark_auth';
}
async function restoreAuthFromMongo(authDir) {
  let mongo;
  try {
    mongo = await getMongo();
    if (!mongo) return false;
    const doc = await mongo.col.findOne({ _id: authId() });
    if (!doc?.files?.length) return false;
    fs.mkdirSync(authDir, { recursive: true });
    for (const f of doc.files) {
      const target = path.join(authDir, f.name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(f.data, 'base64'));
    }
    console.log(`[AUTH] Sessão restaurada do MongoDB (${doc.files.length} arquivos).`);
    return true;
  } catch (e) {
    console.log(`[AUTH] Não foi possível restaurar sessão MongoDB: ${e.message}`);
    return false;
  } finally {
    try { await mongo?.client?.close(); } catch {}
  }
}
async function backupAuthToMongo(authDir) {
  let mongo;
  try {
    mongo = await getMongo();
    if (!mongo) return false;
    const files = walkFiles(authDir).map(file => ({
      name: path.relative(authDir, file).replace(/\\/g, '/'),
      data: fs.readFileSync(file).toString('base64')
    }));
    if (!files.length) return false;
    await mongo.col.updateOne({ _id: authId() }, { $set: { files, updatedAt: new Date(), bot: process.env.BOT_NUMBER || '' } }, { upsert: true });
    return true;
  } catch (e) {
    console.log(`[AUTH] Backup MongoDB falhou: ${e.message}`);
    return false;
  } finally {
    try { await mongo?.client?.close(); } catch {}
  }
}
function debounceBackup(authDir, delay = 2500) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => backupAuthToMongo(authDir).then(ok => ok && console.log('[AUTH] Sessão salva no MongoDB.')), delay);
  };
}
module.exports = { restoreAuthFromMongo, backupAuthToMongo, debounceBackup };
