import { normalizeName } from './votes'

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

// Nota da música do setlist: as opiniões vivem na sugestão que a originou.
// Casa pelo vínculo gravado na aprovação e, pras aprovadas antigas que não
// têm esse vínculo, pelo título + artista.
export function notasPorMusica(sugestoes) {
  const porId = {}
  const porChave = {}
  ;(sugestoes || []).forEach((sug) => {
    const score = calcSongScore(sug.opinoes)
    if (!score.total) return
    porId[sug.id] = score
    porChave[chaveMusica(sug.title, sug.artist)] = score
  })
  return (song) =>
    (song.sugestaoId && porId[song.sugestaoId]) ||
    porChave[chaveMusica(song.title, song.artist)] ||
    null
}
