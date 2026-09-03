import { chaveMusica } from './score'
import { normalizeName } from './votes'
import { estaRejeitada } from './rejeicao'

// Impede cadastrar duas vezes a mesma música. Devolve:
//   { bloqueio: 'setlist', titulo }                       → já é música do setlist
//   { bloqueio: 'sugestao', titulo, sugestaoExistente }    → já foi sugerida
//   { parecidas: [...] }                                  → mesmo título, artista diferente (só avisa)
// Título + artista idênticos travam; artista diferente ou em branco só avisa,
// porque pode ser versão diferente (ao vivo, cover) ou o artista escrito de
// outro jeito.
export function checarDuplicata(title, artist, { musicas = [], sugestoes = [], bandMembers = [] } = {}) {
  const t = (title || '').trim()
  if (!t) return {}

  const chave = chaveMusica(t, artist)
  const noSetlist = musicas.find((m) => chaveMusica(m.title, m.artist) === chave)
  if (noSetlist) return { bloqueio: 'setlist', titulo: rotulo(noSetlist) }

  const jaSugerida = sugestoes.find((s) => chaveMusica(s.title, s.artist) === chave)
  if (jaSugerida) {
    return {
      bloqueio: 'sugestao',
      titulo: rotulo(jaSugerida),
      // Devolve a sugestão inteira (não só o status) pra quem tiver o modal
      // de detalhe por perto poder abrir ela direto (ver F70)
      sugestaoExistente: { ...jaSugerida, rejeitada: estaRejeitada(jaSugerida, bandMembers) },
    }
  }

  // A mesma música pode estar no setlist e na sugestão de origem: mostra o
  // rótulo uma vez só
  const mesmoTitulo = (x) => normalizeName(x.title) === normalizeName(t)
  const parecidas = [
    ...new Set([...musicas.filter(mesmoTitulo), ...sugestoes.filter(mesmoTitulo)].map(rotulo)),
  ].slice(0, 3)
  return parecidas.length ? { parecidas } : {}
}

const rotulo = (x) => `${x.title}${x.artist ? ` — ${x.artist}` : ''}`

// Texto do bloqueio conforme o estado da sugestão encontrada — "já foi
// sugerida" sozinho não dizia se estava em aberto, rejeitada ou já aprovada
// (e possivelmente removida do setlist depois)
export function mensagemBloqueio({ bloqueio, titulo, sugestaoExistente }) {
  if (bloqueio === 'setlist') return `${titulo} já está no setlist.`
  const s = sugestaoExistente
  if (s.rejeitada) return `${titulo} já foi sugerida por ${s.suggestedBy} e foi rejeitada.`
  if (s.status === 'aprovada') return `${titulo} já foi sugerida por ${s.suggestedBy} e aprovada antes (pode ter saído do setlist).`
  return `${titulo} já foi sugerida por ${s.suggestedBy} e está em aberto.`
}
