// Sytem DARK bootstrap - criado por Dark Net
// Este arquivo não usa dependências externas. Ele instala as dependências se o host ainda não instalou.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
process.chdir(root);

function exists(p) { return fs.existsSync(path.join(root, p)); }
function log(msg) { console.log(`[SYTEM DARK] ${msg}`); }

function ensureProjectFiles() {
  const required = ['package.json', 'src/main.js', 'src/commands.js', 'dono/config.json'];
  const missing = required.filter(f => !exists(f));
  if (missing.length) {
    console.error('\n[SYTEM DARK] Arquivos obrigatórios ausentes:');
    missing.forEach(f => console.error(' - ' + f));
    console.error('\nEnvie o ZIP completo e extraia todos os arquivos na raiz /home/container.');
    process.exit(1);
  }
}

function depsMissing() {
  const deps = [
    'node_modules/@whiskeysockets/baileys',
    'node_modules/axios',
    'node_modules/express',
    'node_modules/pino',
    'node_modules/node-cache',
    'node_modules/qrcode-terminal',
    'node_modules/yt-search',
    'node_modules/@distube/ytdl-core'
  ];
  return deps.filter(d => !exists(d));
}

function ensureDependencies() {
  const missing = depsMissing();
  if (!missing.length) return;
  log('Dependências não encontradas. Instalando automaticamente...');
  log('Isto pode demorar alguns minutos no primeiro arranque.');
  try {
    execSync('npm install --omit=dev --no-audit --no-fund', { stdio: 'inherit', cwd: root, env: process.env });
  } catch (e) {
    console.error('\n[SYTEM DARK] Falha ao instalar dependências automaticamente.');
    console.error('No painel, use Startup Command: npm install --omit=dev && node index.js');
    console.error('Erro:', e.message);
    process.exit(1);
  }
}

ensureProjectFiles();
ensureDependencies();
require('./src/main.js');
