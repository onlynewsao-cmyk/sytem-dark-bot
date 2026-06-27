# Sytem DARK Bot WhatsApp

Bot profissional para WhatsApp baseado na ideia do arquivo fixado `blinders.js`, com menus por botões/lista, downloads, interações, gestão de grupo, proteção e temas.

**Nome:** Sytem DARK  
**Dono:** Dark Net  
**Número do dono:** +244945280380

## Recursos

- Menu principal com botões rápidos e menu de lista estilo WhatsApp.
- Downloads: YouTube MP3 nativo e suporte a API para YTMP4/TikTok/Instagram/Facebook.
- Administração de grupos: ban, promover, rebaixar, abrir/fechar, marcar, infos.
- Proteção: antilink normal e hard, boas-vindas e despedida.
- Interações e brincadeiras: ship, chance, gay/gado/corno, abraço/beijo/tapa etc.
- Consultas: clima, wiki, calculadora, perfil/rank XP.
- Temas: dark, diamond, neon, minimal e elite.
- Preparado para Render Free com servidor Express `/health`.

## Instalação local

```bash
npm install
cp .env.example .env
npm start
```

No primeiro start, veja no terminal o **código de pareamento** e coloque no WhatsApp:

WhatsApp > Aparelhos conectados > Conectar aparelho > Conectar com número.

## Rodar no Render Free

1. Suba esta pasta para um repositório GitHub.
2. No Render, crie **New Web Service**.
3. Build command: `npm install`
4. Start command: `npm start`
5. Configure variáveis:
   - `BOT_NUMBER`: número do bot com DDI, exemplo `2449XXXXXXXX`
   - `OWNER_NUMBER`: `244945280380`
   - `BOT_NAME`: `Sytem DARK`
   - `OWNER_NAME`: `Dark Net`
   - `PREFIX`: `.`
6. Abra os **Logs** do Render e copie o código de pareamento.

> Observação: Render Free pode hibernar. O bot reconecta quando o serviço acorda, mas a sessão pode precisar persistência melhor em produção.

## APIs de download

O comando `play/ytmp3` funciona usando YouTube direto, respeitando limite de 20 minutos para não sobrecarregar Render Free.

Para `ytmp4`, `tiktok`, `instagram` e `facebook`, configure uma API externa:

```env
DOWNLOAD_API_BASE=https://sua-api.com
DOWNLOAD_API_KEY=sua-chave
```

Formato esperado:

`GET /ytmp4?url=LINK&apikey=KEY` retornando `{ "url": "https://...mp4" }` ou `{ "result": { "url": "..." } }`.

## Comandos principais

- `.menu` — menu principal
- `.menulista` — menu em lista
- `.downloads` — menu downloads
- `.admin` — menu administrativo
- `.dono` — painel do dono
- `.temas` / `.settema neon`
- `.play nome ou link`
- `.antilink on/off`
- `.antilinkhard on/off`
- `.boasvindas on/off`
- `.ban @user`, `.promover @user`, `.rebaixar @user`
- `.rank`, `.perfil`, `.chance texto`, `.ship @ @`

## Segurança

Use apenas no seu número e grupos autorizados. Não use para spam, invasão de privacidade, golpes ou downloads sem direito/autorização.
