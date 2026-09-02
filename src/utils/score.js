import { namesMatch, normalizeName } from './votes'

// O que a banda acha da música. Vale na sugestão e no setlist: música
// importada nunca passou por votação, e é aqui que ela ganha nota
export const OPINIONS = [
  { value: 'hino',     label: 'Hino',                        color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  { value: 'escopo',   label: '✓ Entra no escopo',           color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ajustar',  label: '~ Ajustar pro nosso estilo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'fora',     label: '✕ Não faz sentido',           color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'nao_gosto',label: '– Não curti',                 color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
]

// Pontuação por tipo de opinião da banda sobre a música
export const SCORES = { hino: 1.2, escopo: 1, ajustar: 0.6, fora: 0.2, nao_gosto: 0 }

/** Pontuação de um mapa de opiniões: soma, média e quantos votaram */
export function calcSongScore(opinoes) {
  const list = Object.values(opinoes || {})
  if (!list.length) return { soma: 0, media: 0, total: 0 }
  const soma = list.reduce((acc, v) => acc + (SCORES[v.opinion] ?? 0), 0)
  const rounded = (n) => Math.round(n * 100) / 100
  return { soma: rounded(soma), media: rounded(soma / list.length), total: list.length }
}

// Identidade da música pra cruzar sugestão com setlist sem depender de acento
// ou caixa. Título e artista juntos: só o título casaria versões diferentes
export const chaveMusica = (titulo, artista) =>
  `${normalizeName(titulo)}|${normalizeName(artista)}`

// Junta dois mapas de voto sem deixar a mesma pessoa entrar duas vezes —
// nem quando votou com nome importado ("import_Nome") de um lado e com login
// do outro. O que vem em `preferido` vence.
export function fundirVotos(base, preferido) {
  const out = { ...(preferido || {}) }
  Object.entries(base || {}).forEach(([chave, voto]) => {
    const jaTem =
      out[chave] !== undefined ||
      Object.values(out).some((v) => v.userName && voto.userName && namesMatch(v.userName, voto.userName))
    if (!jaTem) out[chave] = voto
  })
  return out
}

// Nota da música do setlist: as opiniões vivem na sugestão que a originou.
// Casa pelo vínculo gravado na aprovação e, pras aprovadas antigas que não
// têm esse vínculo, pelo título + artista.
export function opinioesPorMusica(sugestoes) {
  const porId = {}
  const porChave = {}
  ;(sugestoes || []).forEach((sug) => {
    porId[sug.id] = sug.opinoes || {}
    porChave[chaveMusica(sug.title, sug.artist)] = sug.opinoes || {}
  })

  return (song) => {
    const daSugestao =
      (song.sugestaoId && porId[song.sugestaoId]) ||
      porChave[chaveMusica(song.title, song.artist)] ||
      {}
    // Voto dado no setlist vence o que veio da sugestão: é o mais recente
    return fundirVotos(daSugestao, song.opinoes)
  }
}

export function notasPorMusica(sugestoes) {
  const opinioesDe = opinioesPorMusica(sugestoes)
  return (song) => {
    const score = calcSongScore(opinioesDe(song))
    return score.total ? score : null
  }
}
