import { namesMatch, normalizeName } from './votes'

// Primeiro nome — os chips e listas mostram só ele, pra não misturar
// "Marcio Braz" com "Marcos" na mesma linha
export const firstName = (n) => (n || '').trim().split(' ')[0]

// Colapsa nomes que são a mesma pessoa, mantendo o mais completo.
// Usa a mesma regra de identidade do resto do app (namesMatch), então
// "Cristiano" + "Cristiano Dácio" viram um só, igual "Albano" + "Albano Borba".
export function dedupMemberNames(names) {
  const out = []
  ;(names || []).forEach((n) => {
    if (!n) return
    const i = out.findIndex((x) => namesMatch(x, n))
    if (i === -1) out.push(n)
    else if (n.length > out[i].length) out[i] = n
  })
  return out
}

// Nome como está cadastrado em 'members'. Casa pelo nome ou por um apelido
// da página Banda — é o que resolve "Marcio Braz" (guardado no evento antigo)
// virar "Marcio Filho" (nome de hoje), que a comparação por nome não pega.
// null quando ninguém casa: nome órfão, de quem saiu da banda
export function canonicalMemberName(name, bandMembers) {
  const found = (bandMembers || []).find(
    (m) =>
      namesMatch(m.name, name) ||
      (m.aliases || []).some(
        (a) => namesMatch(a, name) || normalizeName(a) === normalizeName(name)
      )
  )
  return found ? found.name : null
}
