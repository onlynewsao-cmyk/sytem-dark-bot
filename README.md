# Sytem DARK

Bot WhatsApp profissional criado por **Dark Net**.

## Dono e número do bot

```txt
Dono: Dark Net
Dono número: +244945280380
Bot número: +244949926074
```

## Estrutura obrigatória no servidor

Extraia tudo na raiz do servidor Node:

```txt
index.js
package.json
.env
src/
dono/
dados/
```

## Startup Command

```bash
node index.js
```

O `index.js` instala as dependências automaticamente se ainda não existirem.

Se quiser instalar manualmente:

```bash
npm install --omit=dev
node index.js
```

## .env configurado

O arquivo `.env` já vem com:

```env
BOT_NUMBER=244949926074
OWNER_NUMBER=244945280380
BOT_NAME=Sytem DARK
OWNER_NAME=Dark Net
```

## MongoDB

Para persistência real 24/7, crie um banco gratuito no MongoDB Atlas e cole a connection string:

```env
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=sytem_dark
```

Se `MONGODB_URI` ficar vazio, o bot usa JSON local em `dados/json`.

## 24/7 Uptime

O bot tem endpoint:

```txt
/health
```

Se o seu host tiver domínio público, configure no `.env`:

```env
PUBLIC_URL=https://seu-dominio-ou-ip
KEEP_ALIVE_URL=https://seu-dominio-ou-ip
KEEP_ALIVE_INTERVAL_MS=300000
```

Também pode usar gratuitamente:

- UptimeRobot
- cron-job.org

Configure para pingar:

```txt
https://seu-dominio/health
```

a cada 5 minutos.

## APIs gratuitas

O bot já usa métodos gratuitos para:

```txt
.clima
.wiki
.frases
.biblia
.dog
.cat
.github
.roleta
```

Para downloads extras, opcional:

```env
DOWNLOAD_API_BASE=
DOWNLOAD_API_KEY=
```

## Comandos úteis

```txt
.ping
.dbstatus
.uptime24
.menu
.menulista
.downloads
.admin
.dono
```
