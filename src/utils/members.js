import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
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

// Regrava os membros dos eventos com os nomes como estão hoje em 'members'.
// Eventos guardam os membros como texto, então um evento criado quando o
// cadastro dizia "Cristiano" ficou com esse nome; se depois alguém marcou
// "Cristiano Dácio", o documento passou a ter a mesma pessoa duas vezes.
// Toca só o campo members. Idempotente — pode rodar quantas vezes quiser.
export async function normalizeEventMembers({ dryRun = false } = {}) {
  const [membersSnap, ensaiosSnap] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(collection(db, 'ensaios')),
  ])

  const bandMembers = membersSnap.docs.map((d) => ({
    name: d.data().name,
    aliases: d.data().aliases || [],
  }))

  const changes = []
  ensaiosSnap.forEach((docSnap) => {
    const before = docSnap.data().members || []
    if (!before.length) return
    const after = dedupMemberNames(
      before.map((m) => canonicalMemberName(m, bandMembers) || m)
    )
    const igual = after.length === before.length && after.every((n, i) => n === before[i])
    if (igual) return
    changes.push({
      id: docSnap.id,
      date: docSnap.data().date?.toDate?.().toLocaleDateString('pt-BR') || 's/ data',
      before,
      after,
    })
  })

  if (!dryRun && changes.length) {
    const batch = writeBatch(db)
    changes.forEach((c) => batch.update(doc(db, 'ensaios', c.id), { members: c.after }))
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : changes.length }
}
