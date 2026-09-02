import { chaveMusica } from './score'
import { normalizeName } from './votes'

// Impede cadastrar duas vezes a mesma música. Devolve:
//   { bloqueio: 'setlist' | 'sugestao' }  → título + artista idênticos
//   { parecidas: [...] }                  → mesmo título, artista diferente
// O primeiro caso trava o cadastro; o segundo só avisa, porque pode ser
// versão diferente (ao vivo, cover) ou artista digitado de outro jeito.
export function checarDuplicata(title, artist, { musicas = [], sugestoes = [] }) {
  const t = (title || '').trim()
  if (!t) return {}

  const chave = chaveMusica(t, artist)
  const noSetlist = musicas.find((m) => chaveMusica(m.title, m.artist) === chave)
  if (noSetlist) return { bloqueio: 'setlist', titulo: rotulo(noSetlist) }

  const jaSugerida = sugestoes.find((s) => chaveMusica(s.title, s.artist) === chave)
  if (jaSugerida) return { bloqueio: 'sugestao', titulo: rotulo(jaSugerida) }

  // A mesma música pode estar no setlist e na sugestão de origem: mostra o
  // rótulo uma vez só
  const mesmoTitulo = (x) => normalizeName(x.title) === normalizeName(t)
  const parecidas = [
    ...new Set([...musicas.filter(mesmoTitulo), ...sugestoes.filter(mesmoTitulo)].map(rotulo)),
  ].slice(0, 3)
  return parecidas.length ? { parecidas } : {}
}

const rotulo = (x) => `${x.title}${x.artist ? ` — ${x.artist}` : ''}`
