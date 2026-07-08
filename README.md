# ⚡ DARK System — WhatsApp Bot

Bot WhatsApp em **Node.js + Baileys + MongoDB** pronto para GitHub, Render Free e UptimeRobot.

**Identidade padrão**

- Nome do bot: `DARK System`
- Dono: `Dark Net`
- Número do dono: `244945280380`
- Número do bot: `244949926074`
- Prefixos globais: `! . / #`

> Importante: o WhatsApp não permite “forçar” selo verde/verificado. O bot consegue configurar nome, foto, bio/status e enviar contacto Business/vCard, mas a verificação oficial é feita apenas pela Meta/WhatsApp Business.

---

## ✅ Recursos incluídos

### Núcleo
- Conexão principal por **código de pareamento** em `/pair?key=SUA_CHAVE`.
- QR Code reserva no terminal e página `/qr?key=SUA_CHAVE` quando `USE_PAIRING_CODE=false`.
- Sessão Baileys persistida no MongoDB, ideal para Render Free.
- API HTTP com `/health` para UptimeRobot.
- Multiprefixo global e prefixos por grupo.
- Sistema de planos: no Render Free, grupos só funcionam se o bot for ADM.
- Handler por **cases** em `src/commands/cases.js`.
- `addcase`, `remcase`, `listcases` com comandos dinâmicos seguros no MongoDB.
- Bloqueio/desbloqueio de grupo, comando e usuário.
- Galeria de mídias/GIFs usando MongoDB GridFS.

### Administração de grupo
`ban`, `add`, `promover`, `rebaixar`, `abrirgp`, `fechargp`, `linkgp`, `revogarlink`, `setnomegp`, `setdesc`, `tagall`, `hidetag`, `advertir`, `zeraradv`, `advs`, `antilink`, `antibot`, `antistatus`, `antimencaostatus`, `bemvindo`, `statusgp`, `setprefix`, `regras`, `setregras`.

### Dono
`painel`, `setprefixglobal`, `addowner`, `delowner`, `addvip`, `delvip`, `banuser`, `unbanuser`, `bangp`, `unbangp`, `desativargp`, `ativargp`, `desativarcmd`, `ativarcmd`, `desativaruser`, `ativaruser`, `addcase`, `remcase`, `keepout`, `entergp`, `ressurgeme`, `grupos`, `broadcast`, `setbio`, `setnomebot`, `setppbot`, `setcontato`, `setmenumidia`.

### Economia, sociais e ranking global
`saldo`, `daily`, `work`, `pay`, `depositar`, `sacar`, `loja`, `comprar`, `inventario`, `rankcoins`, `perfil`, `reputar`, `fama`, `rankfama`, `casar`, `divorciar`, `ship`, interações sociais.

### Jogos e RPG
`dado`, `moeda`, `slot`, `roleta`, `jokenpo`, `matematica`, `quiz`, `responder`, `forca`, `pista`, `velha`, `jogarvelha`, `duelo`, `rankjogos`, `rpg`, `classe`, `cacar`, `minerar`, `pescar`, `explorar`, `curar`, `boss`, `rankrpg`.

### Utilitários e mídia
`baixarurl`, `get`, `sticker`, `toimg`, `calc`, `cep`, `clima`, `encurtar`, `numero`, `idgp`, `infogp`, `qrcode`, `galeria`, `gif`.

---

## 🚀 Rodar localmente

1. Instale Node.js 20+.
2. Crie um cluster no MongoDB Atlas.
3. Configure o `.env`:

```bash
cp .env.example .env
# edite MONGODB_URI e QR_WEB_KEY
```

4. Instale e inicie:

```bash
npm install
npm start
```

5. Escaneie o QR no terminal:

WhatsApp → **Aparelhos conectados** → **Conectar aparelho**.

---

## ☁️ Deploy no Render Free

1. Envie este projeto para um repositório GitHub.
2. No Render: **New → Web Service → Connect GitHub**.
3. Configurações:
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: `Free`
   - Health Check Path: `/health`
4. Variáveis obrigatórias:
   - `MONGODB_URI`
   - `QR_WEB_KEY`
   - `OWNER_NUMBER=244945280380`
   - `BOT_NUMBER=244949926074`
5. Depois do deploy, abra:

```text
https://SEU-SERVICO.onrender.com/pair?key=SUA_QR_WEB_KEY
```

No WhatsApp do número do bot (`244949926074`):

1. Abra **Aparelhos conectados**.
2. Toque em **Conectar aparelho**.
3. Escolha a opção de conectar com número/código quando aparecer.
4. Digite o código exibido na página `/pair`.

A sessão será guardada no MongoDB. Se quiser usar QR em vez de pair code, defina `USE_PAIRING_CODE=false` e use `/qr?key=...`.

---

## ⏱️ UptimeRobot

Para reduzir o sleep do Render Free:

1. Crie uma conta em https://uptimerobot.com/
2. Add New Monitor:
   - Type: HTTP(s)
   - URL: `https://SEU-SERVICO.onrender.com/health`
   - Interval: 5 minutos

> Mesmo com UptimeRobot, o plano Free pode reiniciar. A sessão é persistida no MongoDB.

---

## 🔐 Segurança

- Não exponha `/qr` sem `QR_WEB_KEY` forte.
- `addcase` não executa JavaScript; cria respostas dinâmicas seguras.
- Comandos de dono validam o número do dono configurado.
- Admin commands exigem permissões no grupo e o bot precisa ser ADM.
- Download por URL deve ser usado apenas para conteúdo próprio, autorizado ou livre.

---

## 🧩 Onde editar os comandos

Todos os comandos principais estão em:

```text
src/commands/cases.js
```

Menus:

```text
src/menus.js
```

Modelos MongoDB:

```text
src/models/
```

---

## 🆘 Primeiros comandos

Depois de conectar, envie no WhatsApp:

```text
!menu
!menudono
!painel
!statusgp
!pairinfo
!menuhosp
!menuprotecao
!menuvip
!menudiversao
!menuranks
!setprefix !,.,/,#
!antilink on
!galeria list
```

Para grupos no Render Free: coloque o bot como **administrador** antes de usar comandos.


---

## 🔗 Pair Code

O projeto agora vem com pareamento por código ativado por padrão:

```env
USE_PAIRING_CODE="true"
PAIRING_NUMBER="244949926074"
```

Rotas:

- `/pair?key=SUA_QR_WEB_KEY` — mostra o código de pareamento.
- `/qr?key=SUA_QR_WEB_KEY` — QR reserva, útil se `USE_PAIRING_CODE=false`.

Se o código não aparecer, normalmente é porque já existe sessão salva no MongoDB. Para parear outro número, apague a coleção `baileys_auth` no banco e reinicie o Render.

## 🆕 Submenus adicionados

- `menuprotecao`
- `menuhosp`
- `menuvip`
- `menudiversao`
- `menuranks`
- `menufig`

## 🆕 Comandos adicionados nesta versão

`pairinfo`, `statusbot`, `botinfo`, `runtime`, `data`, `mutargp`, `desmutargp`, `modoadm`, `admins`, `membros`, `limpar`, `manutencao`, `reiniciar`, `setplan`, `viplist`, `addcoins`, `remcoins`, `setcoins`, `addxp`, `setlevel`, `setfama`, `resetuser`, `crime`, `roubar`, `vender`, `ranklevel`, `rankrep`, `rankvip`, `topgrupo`, `cafune`, `mordida`, `chance`, `escolher`, `sortear`, `verdade`, `desafio`, `conselho`, `frase`, `piada`, `personalidade`, `nivelgay`, `nivelgado`, `rankaleatorio`, `parimpar`, `treinar`, `base64`, `unbase64`, `inverter`, `contar`, `maiusculo`, `minusculo`, `senha`.
