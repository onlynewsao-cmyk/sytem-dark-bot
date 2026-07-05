/**
 * Sytem DARK - Auth Persist
 * Dark Net
 */
const fs = require('fs');
const path = require('path');

async function restoreAuth(db, authId, sessionDir){
  if (db.mode!=='mongo') return 0;
  try {
    const files = await db.loadAuthFiles(authId);
    if (!files.length) return 0;
    fs.mkdirSync(sessionDir, { recursive: true });
    let c=0;
    for (const f of files){
      try {
        fs.writeFileSync(path.join(sessionDir, f.filename), Buffer.from(f.data, 'base64'));
        c++;
      } catch(_){}
    }
    if (c) console.log(`🔐 [DARK-AUTH] Restaurado ${c} arquivo(s) do Mongo`);
    return c;
  } catch(e){
    console.log('Auth restore falhou:', e.message);
    return 0;
  }
}

function createBackup(db, authId, sessionDir){
  let timer = null;
  let running = false;
  const run = async()=>{
    if (running || db.mode!=='mongo') return;
    running = true;
    try {
      if (!fs.existsSync(sessionDir)) { running=false; return; }
      const files = fs.readdirSync(sessionDir).filter(f=>f.endsWith('.json'));
      let ok=0;
      for (const fn of files){
        try {
          const buf = fs.readFileSync(path.join(sessionDir, fn));
          if (await db.saveAuthFile(authId, fn, buf)) ok++;
        } catch(_){}
      }
      if (ok) console.log(`💾 [DARK-AUTH] Backup ${ok} sessão`);
    } finally { running=false; }
  };
  return {
    debounce(ms=2500){ clearTimeout(timer); timer=setTimeout(run, ms); },
    now: run
  };
}

module.exports = { restoreAuth, createBackup };
