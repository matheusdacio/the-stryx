import { chaveMusica } from './score'
import { estaRejeitada } from './rejeicao'

// Falta EU votar nessa sugestão: em aberto, não vetada, fora do setlist e
// sem meu voto de opinião OU de dificuldade — os dois são obrigatórios
export function faltaVotar(s, user, noSetlist, bandMembers) {
  return !noSetlist.ids.has(s.id) &&
    !noSetlist.chaves.has(chaveMusica(s.title, s.artist)) &&
    s.status === 'aberta' &&
    !estaRejeitada(s, bandMembers) &&
    (!(s.opinoes || {})[user.uid] || !(s.dificuldade || {})[user.uid])
}

export function countSugestoesPendentes(sugestoes, user, noSetlist, bandMembers) {
  if (!user) return 0
  return sugestoes.filter((s) => faltaVotar(s, user, noSetlist, bandMembers)).length
}
