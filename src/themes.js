const themes = {
  dark: { id: 'dark', name: 'Sytem DARK', emoji: '🌀', line: '╔══════════════════╗', end: '╚══════════════════╝', bullet: '➼', footer: 'Sytem DARK • Dark Net' },
  diamond: { id: 'diamond', name: 'Dark Diamond', emoji: '💎', line: '┏━━━━━━━◇◇◇━━━━━━━┓', end: '┗━━━━━━━◇◇◇━━━━━━━┛', bullet: '◇', footer: '💎 Sytem DARK 💎' },
  neon: { id: 'neon', name: 'Dark Neon', emoji: '⚡', line: '╭───────────────╮', end: '╰───────────────╯', bullet: '⟡', footer: 'Sytem DARK Neon' },
  minimal: { id: 'minimal', name: 'Dark Minimal', emoji: '◾', line: '───────────────', end: '───────────────', bullet: '•', footer: 'Sytem DARK' },
  elite: { id: 'elite', name: 'Dark Elite', emoji: '👑', line: '╔═══════[ DARK ELITE ]═══════╗', end: '╚══════════════════════════╝', bullet: '♛', footer: 'Dark Net Empire' },
  zero: { id: 'zero', name: 'Dark Zero', emoji: '▣', line: '╭─⊷ 「✦」 ⊶─╮', end: '╰─━━━━━━━━━━─╯', bullet: '▣', footer: 'Sytem DARK • Dark Net' },
  kay: { id: 'kay', name: 'Dark Purple', emoji: '💜', line: '╭─〔💜 SYTEM DARK 〕─⬣', end: '╰─────────────────⬣', bullet: '◇', footer: 'Sytem DARK • Dark Net' },
  invader: { id: 'invader', name: 'Dark Invader', emoji: '👾', line: '✦ ABRIR MENU DARK ✦', end: '━━━━━━━━━━━━━━', bullet: '👾', footer: '👾 Sytem DARK 👾' },
  devastador: { id: 'devastador', name: 'Dark Devastador', emoji: '☯️', line: '╔═━───────━━▒۞▒━━───────━═╗', end: '╚═━───────━━▒۞▒━━───────━═╝', bullet: '⟡⃟☯️', footer: '🌌☯️ Sytem DARK • Dark Net ☯️🌌' }
};
function getTheme(id) { return themes[id] || themes.dark; }
module.exports = { themes, getTheme };
