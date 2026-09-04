import { namesMatch, normalizeName } from './votes'

// O que a banda acha da música. Vale na sugestão e no setlist: música
// importada nunca passou por votação, e é aqui que ela ganha nota
// "· tira da fila" só faz sentido em Sugestões (existe um veto, uma fila
// de aprovação). No Setlist a mesma opinião não tira nada de lugar nenhum
// — daí o labelSetlist separado, sem essa parte
export const OPINIONS = [
  { value: 'hino',     short: 'Hino',     label: 'Hino',                        labelSetlist: 'Hino',                       color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  { value: 'escopo',   short: 'Escopo',   label: '✓ Entra no escopo',           labelSetlist: '✓ Entra no escopo',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ajustar',  short: 'Ajustar',  label: '~ Ajustar pro nosso estilo',  labelSetlist: '~ Ajustar pro nosso estilo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'fora',     short: 'Fora',     label: '✕ Não faz sentido · tira da fila', labelSetlist: '✕ Não faz sentido',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { value: 'nao_gosto',short: 'Não curti',label: '– Não curti · tira da fila',       labelSetlist: '– Não curti',           color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
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

// Acha a cifra da música pelo título+artista — sem precisar de um campo de
// vínculo novo, funciona com o que já foi cadastrado. Cifra sem artista
// (comum: quem cadastrou não preencheu) casa só pelo título
export function acharCifra(cifras, titulo, artista) {
  const chave = chaveMusica(titulo, artista)
  const exata = (cifras || []).find((c) => chaveMusica(c.title, c.artist) === chave)
  if (exata) return exata
  const t = normalizeName(titulo)
  return (cifras || []).find((c) => !c.artist && normalizeName(c.title) === t) || null
}

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
