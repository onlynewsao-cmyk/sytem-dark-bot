# Sytem DARK no Render Free

## Variáveis obrigatórias

No Render, configure:

```env
BOT_NUMBER=244949926074
PAIRING_NUMBER=244949926074
OWNER_NUMBER=244945280380
BOT_NAME=Sytem DARK
OWNER_NAME=Dark Net
PREFIX=.
PAIRING_CODE=true
USE_QR=false
MONGODB_URI=sua_connection_string_do_mongodb_atlas
MONGODB_DB=sytem_dark
AUTH_ID=sytem_dark_244949926074
AUTH_DIR=./dono/sytem-dark-session
```

## Build e Start

```bash
Build Command: npm install --omit=dev --no-audit --no-fund
Start Command: node index.js
```

## Por que MongoDB é importante no Render Free?

O Render Free pode reiniciar/dormir e apagar estado local. Esta versão salva:

- database de usuários/grupos no MongoDB;
- sessão de login WhatsApp no MongoDB.

Assim o bot reconecta sem perder dados.

## Uptime 24/7

O Render Free pode hibernar. Use UptimeRobot ou cron-job.org para pingar:

```txt
https://SEU-APP.onrender.com/health
```

a cada 5 minutos.

Também coloque:

```env
PUBLIC_URL=https://SEU-APP.onrender.com
KEEP_ALIVE_URL=https://SEU-APP.onrender.com
KEEP_ALIVE_INTERVAL_MS=300000
```
