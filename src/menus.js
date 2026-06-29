const { themes } = require('./themes');
function header(t, title) { return `${t.line}\n ${t.emoji} *${title}* ${t.emoji}\n${t.end}`; }
function deco(title) { return `╭─⊷ 「 ${title} 」⊶─╮`; }
function mainMenu({ botName, ownerName, prefix, pushname, theme, mode='public' }) {
  const t = theme;
  return `${header(t, botName)}

👋 Olá, *${pushname || 'usuário'}*
👑 Dono: *${ownerName}*
⚙️ Prefixo: *${prefix}*
🎨 Tema: *${t.name}*

${deco('CATEGORIAS')}
${t.bullet} ${prefix}menuprincipal — comandos essenciais
${t.bullet} ${prefix}downloads — baixar músicas e vídeos
${t.bullet} ${prefix}sticker — criar e editar figurinhas
${t.bullet} ${prefix}admin — controle de grupos
${t.bullet} ${prefix}membros — funções para membros
${t.bullet} ${prefix}brincadeiras — jogos e zoeiras
${t.bullet} ${prefix}rpg — aventuras e economia
${t.bullet} ${prefix}loja — catálogo/produtos
${t.bullet} ${prefix}fontes texto — fontes bonitas
${t.bullet} ${prefix}dono — comandos do dono
╰────────────────╯

_Use os botões ou abra o menu lista._
${t.footer}`;
}
function menuPrincipal(prefix, t) { return `${header(t, 'MENU PRINCIPAL')}
${t.bullet} ${prefix}ping
${t.bullet} ${prefix}perfil
${t.bullet} ${prefix}rank
${t.bullet} ${prefix}clima cidade
${t.bullet} ${prefix}wiki termo
${t.bullet} ${prefix}calc conta
${t.bullet} ${prefix}fontes texto
${t.bullet} ${prefix}temas`; }
function menuDownloads(prefix, t) { return `${header(t, 'MENU DOWNLOADS')}

${t.bullet} ${prefix}play nome/link
${t.bullet} ${prefix}play2 nome/link
${t.bullet} ${prefix}play3 nome/link
${t.bullet} ${prefix}playvid nome/link
${t.bullet} ${prefix}ytmp3 link
${t.bullet} ${prefix}ytmp4 link
${t.bullet} ${prefix}yt3v2 link
${t.bullet} ${prefix}yt4v2 link
${t.bullet} ${prefix}instagram link
${t.bullet} ${prefix}ig link
${t.bullet} ${prefix}tiktok link
${t.bullet} ${prefix}tt link
${t.bullet} ${prefix}twitter link
${t.bullet} ${prefix}tw link
${t.bullet} ${prefix}spotify link
${t.bullet} ${prefix}soundcloud link
${t.bullet} ${prefix}sc link

⚠️ Baixe apenas conteúdos seus, autorizados ou livres.`; }
function menuAdmin(prefix, t) { return `${header(t, 'MENU ADM')}

${t.bullet} ${prefix}ban @membro
${t.bullet} ${prefix}promover @membro
${t.bullet} ${prefix}rebaixar @membro
${t.bullet} ${prefix}abrirgrupo / ${prefix}fechargrupo
${t.bullet} ${prefix}mudarnome novo nome
${t.bullet} ${prefix}mudardesc descrição
${t.bullet} ${prefix}marcar / ${prefix}marcaradmins
${t.bullet} ${prefix}infogrupo / ${prefix}membros
${t.bullet} ${prefix}antilink on/off
${t.bullet} ${prefix}antilinkhard on/off
${t.bullet} ${prefix}boasvindas on/off
${t.bullet} ${prefix}despedida on/off
${t.bullet} ${prefix}warn @ / ${prefix}unwarn @`; }
function menuOwner(prefix, t) { return `${header(t, 'MENU DONO')}

${t.bullet} ${prefix}status
${t.bullet} ${prefix}fontesbot
${t.bullet} ${prefix}bc mensagem
${t.bullet} ${prefix}join link
${t.bullet} ${prefix}sairgrupo
${t.bullet} ${prefix}bloquear @
${t.bullet} ${prefix}desbloquear @
${t.bullet} ${prefix}reiniciar`; }
function menuMembers(prefix, t) { return `${header(t, 'MENU MEMBROS')}

${t.bullet} ${prefix}perfil
${t.bullet} ${prefix}rank
${t.bullet} ${prefix}level
${t.bullet} ${prefix}minerar
${t.bullet} ${prefix}saldo
${t.bullet} ${prefix}daily`; }
function menuRpg(prefix, t) { return `${header(t, 'MENU RPG')}

${t.bullet} ${prefix}rpg iniciar
${t.bullet} ${prefix}aventura
${t.bullet} ${prefix}inventario
${t.bullet} ${prefix}loja
${t.bullet} ${prefix}comprar item`; }
function menuStore(prefix, t) { return `${header(t, 'CATÁLOGO')}

${t.bullet} ${prefix}planos — tabela de aluguel
${t.bullet} ${prefix}comprarbot — falar com dono
${t.bullet} ${prefix}premium — vantagens`; }
function menuStickers(prefix, t) { return `${header(t, 'MENU FIGURINHAS')}

${t.bullet} ${prefix}s — criar sticker de imagem/vídeo
${t.bullet} ${prefix}sticker — mesmo que s
${t.bullet} ${prefix}toimg — sticker para imagem
${t.bullet} ${prefix}attp texto — sticker texto`; }
function menuThemes(prefix, t) { return `${header(t, 'TEMAS')}

${Object.values(themes).map(x => `${t.bullet} ${prefix}settema ${x.id} — ${x.emoji} ${x.name}`).join('\n')}`; }
module.exports = { mainMenu, menuPrincipal, menuDownloads, menuAdmin, menuOwner, menuMembers, menuRpg, menuStore, menuStickers, menuThemes, header, deco };
