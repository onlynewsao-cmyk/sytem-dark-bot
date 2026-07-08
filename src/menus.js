function line() { return '╠══════════════════════╣'; }
function head(title) { return `╔══════════════════════╗\n║   ⚡ ${title}\n${line()}`; }
function foot(prefix) { return `${line()}\n║ Prefixo: ${prefix}\n║ DARK System © Dark Net\n╚══════════════════════╝`; }

function menuPrincipal(ctx) {
  const p = ctx.prefix;
  return `${head('DARK SYSTEM')}\n║ 👑 Dono: Dark Net\n║ 🤖 Bot: ${ctx.settings.botName}\n║ 🕒 ${ctx.now}\n${line()}\n║ ${p}menuadm       • grupo/admin\n║ ${p}menuprotecao  • anti-links/status\n║ ${p}menudono      • painel dono\n║ ${p}menuhosp      • hospedagem/grupos\n║ ${p}menuvip       • vip e cheats dono\n║ ${p}menueconomia  • moedas e loja\n║ ${p}menujogos     • jogos + multiplayer\n║ ${p}menurpg       • RPG global\n║ ${p}menusocial    • interação/social\n║ ${p}menudiversao  • brincadeiras\n║ ${p}menuranks     • rankings globais\n║ ${p}menudownload  • downloads\n║ ${p}menufig       • stickers/mídia\n║ ${p}menuutil      • utilitários\n║ ${p}menugaleria   • mídias e GIFs\n${line()}\n║ ${p}ping • ${p}dono • ${p}perfil\n${foot(p)}`;
}

function menuAdm(ctx) {
  const p = ctx.prefix;
  return `${head('MENU ADMIN')}\n║ ${p}ban @membro / responder\n║ ${p}add 2449xxxxxxx\n║ ${p}promover @membro\n║ ${p}rebaixar @membro\n║ ${p}abrirgp | ${p}fechargp\n║ ${p}mutargp | ${p}desmutargp\n║ ${p}linkgp | ${p}revogarlink\n║ ${p}setnomegp texto\n║ ${p}setdesc texto\n║ ${p}admins\n║ ${p}membros\n║ ${p}tagall texto\n║ ${p}hidetag texto\n║ ${p}advertir @membro\n║ ${p}zeraradv @membro\n║ ${p}advs @membro\n║ ${p}limpar fake\n${line()}\n║ ${p}statusgp\n║ ${p}setprefix !,.,/\n║ ${p}prefixos\n║ ${p}regras | ${p}setregras texto\n${foot(p)}`;
}

function menuProtecao(ctx) {
  const p = ctx.prefix;
  return `${head('PROTEÇÕES')}\n║ ${p}antilink on/off\n║ ${p}antibot on/off\n║ ${p}antistatus on/off\n║ ${p}antimencaostatus on/off\n║ ${p}bemvindo on/off\n║ ${p}modoadm on/off\n║ ${p}statusgp\n║ ${p}desativarcmd nome\n║ ${p}ativarcmd nome\n║ ${p}desativaruser @user\n║ ${p}ativaruser @user\n║ ${p}advertir @user\n║ ${p}zeraradv @user\n${foot(p)}`;
}

function menuDono(ctx) {
  const p = ctx.prefix;
  return `${head('MENU DONO PRO')}\n║ ${p}painel\n║ ${p}statusbot\n║ ${p}pairinfo\n║ ${p}manutencao on/off\n║ ${p}reiniciar\n║ ${p}setprefixglobal !,.,/\n║ ${p}addowner 2449xxxxxxx\n║ ${p}delowner 2449xxxxxxx\n║ ${p}addvip @user dias\n║ ${p}delvip @user\n║ ${p}banuser @user | ${p}unbanuser @user\n║ ${p}bangp | ${p}unbangp\n║ ${p}desativargp | ${p}ativargp\n${line()}\n║ CASES DINÂMICOS\n║ ${p}addcase nome|resposta\n║ ${p}remcase nome\n║ ${p}listcases\n${line()}\n║ PERFIL DO BOT\n║ ${p}setbio texto\n║ ${p}setnomebot texto\n║ ${p}setppbot 〔imagem com legenda〕\n║ ${p}setcontato nome|fone|org|email|site\n║ ${p}setmenumidia url/id\n${foot(p)}`;
}

function menuHosp(ctx) {
  const p = ctx.prefix;
  return `${head('HOSPEDAGEM / GRUPOS')}\n║ ${p}keepout\n║ ${p}entergp link\n║ ${p}ressurgeme link\n║ ${p}grupos\n║ ${p}setplan free/vip/premium\n║ ${p}broadcast texto\n║ ${p}idgp\n║ ${p}infogp\n║ ${p}statusgp\n║ ${p}linkgp\n║ ${p}revogarlink\n${foot(p)}`;
}

function menuVip(ctx) {
  const p = ctx.prefix;
  return `${head('VIP / CHEATS DONO')}\n║ ${p}addvip @user dias\n║ ${p}delvip @user\n║ ${p}viplist\n║ ${p}addcoins @user valor\n║ ${p}remcoins @user valor\n║ ${p}setcoins @user valor\n║ ${p}addxp @user valor\n║ ${p}setlevel @user valor\n║ ${p}setfama @user valor\n║ ${p}resetuser @user\n${foot(p)}`;
}

function menuEconomia(ctx) {
  const p = ctx.prefix;
  return `${head('ECONOMIA DARK')}\n║ ${p}saldo [@user]\n║ ${p}daily\n║ ${p}work\n║ ${p}crime\n║ ${p}roubar @user\n║ ${p}pay @user valor\n║ ${p}depositar valor\n║ ${p}sacar valor\n║ ${p}loja\n║ ${p}comprar item qtd\n║ ${p}vender item qtd\n║ ${p}inventario\n║ ${p}rankcoins\n${foot(p)}`;
}

function menuJogos(ctx) {
  const p = ctx.prefix;
  return `${head('JOGOS / MULTIPLAYER')}\n║ ${p}dado [lados]\n║ ${p}moeda\n║ ${p}parimpar par/impar valor\n║ ${p}slot valor\n║ ${p}roleta valor numero(0-36)\n║ ${p}jokenpo pedra/papel/tesoura\n║ ${p}matematica\n║ ${p}quiz\n║ ${p}responder resposta\n║ ${p}forca\n║ ${p}pista letra\n║ ${p}velha @jogador\n║ ${p}jogarvelha posição(1-9)\n║ ${p}duelo @jogador valor\n║ ${p}rankjogos\n${foot(p)}`;
}

function menuRpg(ctx) {
  const p = ctx.prefix;
  return `${head('RPG GLOBAL DARK')}\n║ ${p}rpg\n║ ${p}classe guerreiro/mago/assassino/tanque\n║ ${p}treinar\n║ ${p}cacar\n║ ${p}minerar\n║ ${p}pescar\n║ ${p}explorar\n║ ${p}curar\n║ ${p}boss\n║ ${p}mochila\n║ ${p}rankrpg\n${foot(p)}`;
}

function menuSocial(ctx) {
  const p = ctx.prefix;
  return `${head('SOCIAIS / INTERAÇÃO')}\n║ ${p}perfil [@user]\n║ ${p}reputar @user\n║ ${p}fama [@user]\n║ ${p}casar @user\n║ ${p}divorciar\n║ ${p}ship @a @b\n║ ${p}abraçar @user\n║ ${p}beijar @user\n║ ${p}tapa @user\n║ ${p}carinho @user\n║ ${p}elogiar @user\n║ ${p}cafune @user\n║ ${p}mordida @user\n║ ${p}rankfama\n${foot(p)}`;
}

function menuDiversao(ctx) {
  const p = ctx.prefix;
  return `${head('DIVERSÃO')}\n║ ${p}chance texto\n║ ${p}escolher opção1|opção2|opção3\n║ ${p}sortear item1|item2|item3\n║ ${p}verdade\n║ ${p}desafio\n║ ${p}conselho\n║ ${p}frase\n║ ${p}piada\n║ ${p}personalidade [@user]\n║ ${p}nivelgay [@user]\n║ ${p}nivelgado [@user]\n║ ${p}rankaleatorio\n${foot(p)}`;
}

function menuRanks(ctx) {
  const p = ctx.prefix;
  return `${head('RANKS GLOBAIS')}\n║ ${p}rankcoins\n║ ${p}ranklevel\n║ ${p}rankrep\n║ ${p}rankfama\n║ ${p}rankjogos\n║ ${p}rankrpg\n║ ${p}rankvip\n║ ${p}topgrupo\n${foot(p)}`;
}

function menuDownload(ctx) {
  const p = ctx.prefix;
  return `${head('DOWNLOADS')}\n║ ${p}baixarurl https://...\n║ ${p}get https://...\n║ Nota: use apenas conteúdos seus, autorizados\n║ ou livres de direitos.\n${foot(p)}`;
}

function menuFig(ctx) {
  const p = ctx.prefix;
  return `${head('STICKERS / MÍDIA')}\n║ ${p}sticker 〔imagem/vídeo com legenda〕\n║ ${p}s 〔atalho de sticker〕\n║ ${p}toimg 〔sticker com legenda〕\n║ ${p}qrcode texto\n║ ${p}galeria add nome|tags\n║ ${p}galeria ver nome\n║ ${p}gif nome\n${foot(p)}`;
}

function menuUtil(ctx) {
  const p = ctx.prefix;
  return `${head('UTILITÁRIOS')}\n║ ${p}ping\n║ ${p}statusbot\n║ ${p}hora | ${p}data\n║ ${p}calc 2+2*5\n║ ${p}cep 01001000\n║ ${p}clima Luanda\n║ ${p}encurtar https://...\n║ ${p}numero @user\n║ ${p}idgp\n║ ${p}infogp\n║ ${p}qrcode texto\n║ ${p}base64 texto\n║ ${p}unbase64 texto\n║ ${p}inverter texto\n║ ${p}contar texto\n║ ${p}maiusculo texto\n║ ${p}minusculo texto\n║ ${p}senha tamanho\n${foot(p)}`;
}

function menuGaleria(ctx) {
  const p = ctx.prefix;
  return `${head('GALERIA DE MÍDIAS')}\n║ ${p}galeria add nome|tag1,tag2\n║   Envie como legenda de imagem/GIF/vídeo.\n║ ${p}galeria list\n║ ${p}galeria ver nome\n║ ${p}galeria del nome\n║ ${p}setmenumidia url/id\n║ ${p}gif nome\n${foot(p)}`;
}

module.exports = {
  menuPrincipal,
  menuAdm,
  menuProtecao,
  menuDono,
  menuHosp,
  menuVip,
  menuEconomia,
  menuJogos,
  menuRpg,
  menuSocial,
  menuDiversao,
  menuRanks,
  menuDownload,
  menuFig,
  menuUtil,
  menuGaleria
};
