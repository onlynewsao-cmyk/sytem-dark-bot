const fs = require('fs');
const path = require('path');

function ensureFile(file, fallback = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
}
function readJson(file, fallback = {}) {
  try { ensureFile(file, fallback); return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function groupDefault() {
  return {
    antilink: false,
    antilinkHard: false,
    boasvindas: false,
    despedida: false,
    autoreplies: false,
    antifake: false,
    antifakePrefix: ['91', '92', '93', '94', '95', '99', '244'],
    onlyAdmin: false,
    theme: 'dark',
    muted: false,
    warn: {},
    mutados: [],
    blockedCmds: []
  };
}
function userDefault() {
  return { xp: 0, level: 1, money: 0, cmds: 0, warns: 0, premium: false };
}

class JsonDB {
  constructor(base = './dados/json') {
    this.base = base;
    this.files = {
      groups: path.join(base, 'grupos.json'),
      users: path.join(base, 'usuarios.json'),
      autoreplies: path.join(base, 'autoreplies.json'),
      afks: path.join(base, 'afks.json'),
      premium: path.join(base, 'premium.json')
    };
    Object.values(this.files).forEach(f => ensureFile(f, {}));

    this.mode = 'json';
    this.cache = { groups: this.groups, users: this.users };
    this.mongo = null;
    this.mongoReady = false;
    this.initMongo();
  }

  async initMongo() {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
    if (!uri) return;
    try {
      const { MongoClient } = require('mongodb');
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000, maxPoolSize: 5 });
      await client.connect();
      const dbName = process.env.MONGODB_DB || 'sytem_dark';
      const db = client.db(dbName);
      this.mongo = {
        client,
        groups: db.collection('groups'),
        users: db.collection('users'),
        meta: db.collection('meta')
      };
      const [groupsDoc, usersDoc] = await Promise.all([
        this.mongo.meta.findOne({ _id: 'groups' }),
        this.mongo.meta.findOne({ _id: 'users' })
      ]);
      if (groupsDoc?.data) this.cache.groups = groupsDoc.data;
      if (usersDoc?.data) this.cache.users = usersDoc.data;
      this.mode = 'mongodb';
      this.mongoReady = true;
      console.log(`[DB] MongoDB conectado: ${dbName}`);
    } catch (e) {
      console.log(`[DB] MongoDB indisponível, usando JSON local. Motivo: ${e.message}`);
      this.mode = 'json';
      this.mongoReady = false;
    }
  }

  persist(kind, data) {
    if (this.mode === 'mongodb' && this.mongoReady && this.mongo?.meta) {
      this.mongo.meta.updateOne({ _id: kind }, { $set: { data, updatedAt: new Date() } }, { upsert: true }).catch(() => {});
    } else {
      writeJson(this.files[kind], data);
    }
  }

  get groups() { return this.mode === 'mongodb' ? this.cache.groups : readJson(this.files.groups, {}); }
  set groups(v) { this.cache.groups = v; this.persist('groups', v); }
  get users() { return this.mode === 'mongodb' ? this.cache.users : readJson(this.files.users, {}); }
  set users(v) { this.cache.users = v; this.persist('users', v); }

  group(jid) {
    const all = this.groups;
    if (!all[jid]) {
      all[jid] = groupDefault();
      this.groups = all;
    }
    return all[jid];
  }
  setGroup(jid, patch) {
    const all = this.groups;
    all[jid] = { ...this.group(jid), ...patch };
    this.groups = all;
    return all[jid];
  }
  user(jid) {
    const all = this.users;
    if (!all[jid]) {
      all[jid] = userDefault();
      this.users = all;
    }
    return all[jid];
  }
  setUser(jid, patch) {
    const all = this.users;
    all[jid] = { ...this.user(jid), ...patch };
    this.users = all;
    return all[jid];
  }
  addXp(jid, amount = 1) {
    const all = this.users;
    const u = this.user(jid);
    u.xp += amount;
    u.cmds += 1;
    u.level = Math.max(1, Math.floor(Math.sqrt(u.xp / 10)) + 1);
    all[jid] = u;
    this.users = all;
    return u;
  }
}
module.exports = { JsonDB, readJson, writeJson, groupDefault, userDefault };
