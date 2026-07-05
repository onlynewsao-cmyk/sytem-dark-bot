/**
 * Sytem DARK - Database Core v5 ULTIMATE
 * MongoDB + JSON fallback
 * Dark Net
 */
const fs = require('fs');
const path = require('path');

let MongoClient = null;
try { MongoClient = require('mongodb').MongoClient; } catch(_){}

const DATA_DIR = path.join(process.cwd(), 'data', 'json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadJson(name, def = {}) {
  const p = path.join(DATA_DIR, `${name}.json`);
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch(e){}
  fs.writeFileSync(p, JSON.stringify(def, null, 2));
  return def;
}
function saveJson(name, obj) {
  const p = path.join(DATA_DIR, `${name}.json`);
  try { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); } catch(e){}
}

class DarkDB {
  constructor(cfg) {
    this.cfg = cfg;
    this.mode = 'json';
    this.mongo = null;
    this.cols = {};
    this.mem = {
      groups: loadJson('groups', {}),
      users: loadJson('users', {}),
      meta: loadJson('meta', { startTime: Date.now() }),
      vips: loadJson('vips', {}),
      hosting: loadJson('hosting', {}),
      procurados: loadJson('procurados', {})
    };
    this.timers = {};
  }

  async init() {
    const uri = this.cfg?.system?.mongo?.uri;
    if (uri && MongoClient) {
      try {
        this.mongo = new MongoClient(uri, { ignoreUndefined: true });
        await this.mongo.connect();
        const dbName = this.cfg.system.mongo.db || 'dark-system';
        const db = this.mongo.db(dbName);
        this.cols.groups = db.collection('groups');
        this.cols.users = db.collection('users');
        this.cols.meta = db.collection('meta');
        this.cols.auth = db.collection('auth_state');
        this.cols.vips = db.collection('vips');
        this.cols.hosting = db.collection('hosting');
        this.cols.procurados = db.collection('procurados');
        this.mode = 'mongo';
        console.log('✅ [DARK-DB] MongoDB conectado:', dbName);
        return true;
      } catch (e) {
        console.log('⚠️ [DARK-DB] Mongo falhou, usando JSON:', e.message);
        this.mode = 'json';
      }
    } else {
      console.log('📁 [DARK-DB] Modo JSON Local');
    }
    return false;
  }

  // GROUPS
  async getGroup(id) {
    if (this.mode === 'mongo') {
      const d = await this.cols.groups.findOne({ _id: id });
      return d ? this._migrateGroup(d) : this._newGroup(id);
    }
    const g = this.mem.groups[id] || this._newGroup(id);
    return this._migrateGroup(g);
  }
  async saveGroup(id, data) {
    data.updatedAt = Date.now();
    if (this.mode === 'mongo') {
      await this.cols.groups.updateOne({ _id: id }, { $set: data }, { upsert: true });
    } else {
      this.mem.groups[id] = data;
      this._debounce('groups', () => saveJson('groups', this.mem.groups));
    }
  }
  _migrateGroup(g){
    const n = this._newGroup(g.id || g._id);
    return Object.assign(n, g);
  }
  _newGroup(id){ 
    return { 
      id, 
      antilink:false, antilinkHard:false, 
      welcome:true, bye:true, 
      welcomeMsg: '', byeMsg: '',
      muted:false, onlyAdmin:false, 
      blockedCmds:[], mutados:[],
      // ULTIMATE v5
      antiStatus: false,
      antiMentionStatus: true,
      antiSpam: true,
      antiCall: true,
      // hosting / vip
      hosted: false,
      hostedExpire: 0,
      hostedBy: '',
      vip: false,
      // config
      statusgp: '',
      prefix_custom: '',
      tempbans: {},
      warnCount: {},
      // stats
      msgCount: 0,
      createdAt: Date.now()
    }; 
  }

  // USERS
  async getUser(id) {
    if (this.mode === 'mongo') {
      const d = await this.cols.users.findOne({ _id: id });
      return d ? this._migrateUser(d) : this._newUser(id);
    }
    const u = this.mem.users[id] || this._newUser(id);
    return this._migrateUser(u);
  }
  async saveUser(id, data) {
    if (this.mode === 'mongo') {
      await this.cols.users.updateOne({ _id: id }, { $set: data }, { upsert: true });
    } else {
      this.mem.users[id] = data;
      this._debounce('users', () => saveJson('users', this.mem.users));
    }
  }
  _migrateUser(u){
    const n = this._newUser(u.id || u._id);
    return Object.assign(n, u);
  }
  _newUser(id){ 
    return { 
      id, xp:0, level:1, coins:100, 
      banned:false, premium:false, daily:0,
      // VIP
      vip: false,
      vipExpire: 0,
      vipPlan: '',
      // procurado
      procurado: false,
      recompensa: 0,
      // spam control
      spamScore: 0,
      lastMsgs: [],
      // stats
      commands: 0,
      createdAt: Date.now()
    }; 
  }

  // VIP SYSTEM
  async addVip(targetId, days=30, plan='vip'){
    const expire = Date.now() + days*24*60*60*1000;
    const rec = { _id: targetId, targetId, days, plan, expire, createdAt: Date.now(), active: true };
    if (this.mode==='mongo'){
      await this.cols.vips.updateOne({_id: targetId}, {$set: rec}, {upsert:true});
    } else {
      this.mem.vips[targetId]=rec;
      saveJson('vips', this.mem.vips);
    }
    // update user
    const u = await this.getUser(targetId);
    u.vip = true; u.vipExpire = expire; u.vipPlan = plan; u.premium = true;
    await this.saveUser(targetId, u);
    return rec;
  }
  async isVip(id){
    let rec;
    if(this.mode==='mongo'){
      rec = await this.cols.vips.findOne({_id:id});
    } else { rec = this.mem.vips[id]; }
    if(!rec) return false;
    if(rec.expire && rec.expire < Date.now()){ await this.removeVip(id); return false; }
    return rec.active !== false;
  }
  async removeVip(id){
    if(this.mode==='mongo'){ await this.cols.vips.deleteOne({_id:id}); }
    else { delete this.mem.vips[id]; saveJson('vips', this.mem.vips); }
    const u = await this.getUser(id);
    u.vip=false; u.vipExpire=0; await this.saveUser(id,u);
  }
  async listVips(){
    if(this.mode==='mongo') return await this.cols.vips.find({active:true}).toArray();
    return Object.values(this.mem.vips);
  }

  // HOSTING SYSTEM
  async addHosting(groupId, days=30, by='Dark Net'){
    const expire = Date.now() + days*24*60*60*1000;
    const rec = { _id: groupId, groupId, expire, by, createdAt: Date.now(), active: true };
    if(this.mode==='mongo'){
      await this.cols.hosting.updateOne({_id:groupId}, {$set:rec}, {upsert:true});
    } else {
      this.mem.hosting[groupId]=rec;
      saveJson('hosting', this.mem.hosting);
    }
    const g = await this.getGroup(groupId);
    g.hosted = true; g.hostedExpire = expire; g.hostedBy = by;
    await this.saveGroup(groupId, g);
    return rec;
  }
  async isHosted(groupId){
    let rec;
    if(this.mode==='mongo') rec = await this.cols.hosting.findOne({_id:groupId});
    else rec = this.mem.hosting[groupId];
    if(!rec) return false;
    if(rec.expire < Date.now()){ await this.removeHosting(groupId); return false; }
    return true;
  }
  async removeHosting(groupId){
    if(this.mode==='mongo') await this.cols.hosting.deleteOne({_id:groupId});
    else { delete this.mem.hosting[groupId]; saveJson('hosting', this.mem.hosting); }
    const g = await this.getGroup(groupId);
    g.hosted=false; g.hostedExpire=0;
    await this.saveGroup(groupId,g);
  }

  // PROCURADOS
  async addProcurado(userId, motivo='Foragido da lei', recompensa=5000){
    const rec = { _id:userId, userId, motivo, recompensa, createdAt: Date.now() };
    if(this.mode==='mongo') await this.cols.procurados.updateOne({_id:userId}, {$set:rec}, {upsert:true});
    else { this.mem.procurados[userId]=rec; saveJson('procurados', this.mem.procurados); }
    const u = await this.getUser(userId);
    u.procurado = true; u.recompensa = recompensa;
    await this.saveUser(userId, u);
    return rec;
  }
  async isProcurado(userId){
    if(this.mode==='mongo') return !!(await this.cols.procurados.findOne({_id:userId}));
    return !!this.mem.procurados[userId];
  }
  async removeProcurado(userId){
    if(this.mode==='mongo') await this.cols.procurados.deleteOne({_id:userId});
    else { delete this.mem.procurados[userId]; saveJson('procurados', this.mem.procurados); }
    const u = await this.getUser(userId);
    u.procurado=false; u.recompensa=0;
    await this.saveUser(userId,u);
  }

  // META
  async getMeta(k, def=null){
    if (this.mode==='mongo'){
      const d = await this.cols.meta.findOne({_id:k});
      return d? d.value : def;
    }
    return this.mem.meta[k] ?? def;
  }
  async setMeta(k, v){
    if (this.mode==='mongo'){
      await this.cols.meta.updateOne({_id:k}, {$set:{value:v}}, {upsert:true});
    } else {
      this.mem.meta[k]=v;
      this._debounce('meta', ()=> saveJson('meta', this.mem.meta));
    }
  }

  // AUTH STATE (Mongo)
  async saveAuthFile(authId, filename, buffer){
    if (this.mode!=='mongo') return false;
    try {
      await this.cols.auth.updateOne(
        { authId, filename },
        { $set: { data: buffer.toString('base64'), updatedAt: new Date() } },
        { upsert: true }
      );
      return true;
    } catch(e){ return false; }
  }
  async loadAuthFiles(authId){
    if (this.mode!=='mongo') return [];
    return await this.cols.auth.find({ authId }).toArray();
  }

  _debounce(key, fn, ms=1200){
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(fn, ms);
  }

  status(){
    return {
      mode: this.mode,
      mongo: this.mode==='mongo',
      db: this.cfg.system.mongo.db,
      uptime: Math.floor((Date.now() - (this.mem.meta.startTime||Date.now()))/1000)
    };
  }

  async stats(){
    const vips = await this.listVips();
    return {
      ...this.status(),
      vips: vips.length,
      version: '5.0 ULTIMATE'
    };
  }
}

module.exports = DarkDB;
