#!/usr/bin/env node
/**
 * Sytem DARK - Independent Core
 * Owner: Dark Net
 * v4.0.0 - Zero Dependencies Branding
 */

try { require('dotenv').config(); } catch(_){}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

console.log('\x1b[35m╔══════════════════════════════════════╗');
console.log('║     SYTEM DARK - INDEPENDENT       ║');
console.log('║     Owner: Dark Net                ║');
console.log('║     v4.0.0                         ║');
console.log('╚══════════════════════════════════════╝\x1b[0m');

const requiredFiles = [
  'src/main.js',
  'src/config.js',
  'src/core/database.js',
  'src/handlers/router.js'
];

let missing = requiredFiles.filter(f => !fs.existsSync(path.join(__dirname, f)));
if (missing.length) {
  console.error('❌ Arquivos essenciais faltando:', missing.join(', '));
  process.exit(1);
}

if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('📦 Instalando dependências...');
  const r = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { stdio: 'inherit', cwd: __dirname, shell: true });
  if (r.status !== 0) {
    console.error('Falha no npm install, tentando continuar...');
  }
}

process.on('uncaughtException', e => {
  console.error('uncaughtException:', e?.message || e);
});
process.on('unhandledRejection', e => {
  console.error('unhandledRejection:', e?.message || e);
});

require('./src/main.js');
