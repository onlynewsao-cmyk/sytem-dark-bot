# 🌐 Render Free - Sytem DARK

## Deploy passo a passo

1. GitHub privado > upload do `Sytem-DARK-Independent-v4.zip`
2. Render.com > New > Web Service > Connect GitHub
3. Settings:
   - Build: `npm install`
   - Start: `node index.js`
   - Region: closest
   - Plan: Free
4. Environment:
```
BOT_NUMBER=244949926074
OWNER_NUMBER=244945280380
PREFIX=.
PAIRING_CODE=true
PAIRING_NUMBER=244949926074
MONGODB_URI=mongodb+srv://...
MONGODB_DB=sytem_dark
AUTH_ID=sytem_dark_244949926074
PORT=3000
COPILOT_MODEL=gpt-5
```
5. Deploy > Logs > copie o PAIR CODE
6. Após conectar, o dono recebe DM: "SYTEM DARK ONLINE"

## 24/7 Uptime

- Health endpoint: `/health`
- UptimeRobot ping a cada 5 min: `https://seu-app.onrender.com/health`
- KeepAlive interno: `KEEP_ALIVE_URL=https://seu-app.onrender.com`

Free tier dorme após 15min sem tráfego externo → UptimeRobot resolve.

## MongoDB

Use MongoDB Atlas Free (512MB). Cole a URI em `MONGODB_URI`.

Sessão WA salva automaticamente na coleção `auth_state`.

---

Dark Net • Sytem DARK Independent v4
