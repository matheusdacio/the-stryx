import { namesMatch } from './votes'

// Opiniões que barram a música
export const VETOS = ['fora', 'nao_gosto']
export const temVeto = (sugestao) =>
  Object.values(sugestao.opinoes || {}).some((v) => VETOS.includes(v.opinion))

// Votos antigos do Glissandoo entraram com chave "import_Nome" em vez do uid,
// então também vale o nome de quem votou — inclusive os apelidos da página
// Banda, que são o que liga "Marcio Braz" ao "Marcio Filho" de hoje
const votou = (sugestao, membro) => {
  const opinoes = sugestao.opinoes || {}
  if (membro.firebaseUid && opinoes[membro.firebaseUid]) return true
  const nomes = [membro.name, ...(membro.aliases || [])]
  return Object.values(opinoes).some((v) => nomes.some((n) => namesMatch(v.userName, n)))
}

export const todosVotaram = (sugestao, bandMembers) =>
  bandMembers.length > 0 && bandMembers.every((m) => votou(sugestao, m))

// Só é rejeitada depois que a banda inteira opinou e alguém vetou. Enquanto
// falta gente votar, a música continua em aberto por mais veto que tenha.
// (A rejeição manual não existe mais; o status antigo continua valendo pras
// que já foram rejeitadas assim.)
export const estaRejeitada = (sugestao, bandMembers) =>
  sugestao.status === 'rejeitada' || (todosVotaram(sugestao, bandMembers) && temVeto(sugestao))
