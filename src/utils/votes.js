import { collection, getDocs, writeBatch, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'

// Remove acentos, underscores e normaliza espaços/caixa
export const normalizeName = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// "Albano" casa com "Albano Borba"; "Matheus Dacio" casa com "Matheus Dácio".
// Regra: os tokens do nome mais curto devem ser prefixo dos tokens do mais longo.
export function namesMatch(a, b) {
  const ta = normalizeName(a).split(' ').filter(Boolean)
  const tb = normalizeName(b).split(' ').filter(Boolean)
  if (!ta.length || !tb.length) return false
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return short.every((t, i) => t === long[i])
}

// Funde TODOS os votos import_* com os UIDs reais dos membros vinculados.
// Idempotente — pode rodar quantas vezes quiser.
// Só age quando o match é único (sem ambiguidade entre membros).
export async function mergeAllImportedVotes() {
  const [membersSnap, sugSnap] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(collection(db, 'sugestoes')),
  ])

  const linked = membersSnap.docs
    .map((d) => d.data())
    .filter((m) => m.firebaseUid)

  const batch = writeBatch(db)
  let merged = 0
  let removed = 0

  sugSnap.forEach((docSnap) => {
    const opinoes = docSnap.data().opinoes || {}
    const updates = {}

    Object.keys(opinoes).forEach((key) => {
      if (!key.startsWith('import_')) return
      const importName = key.slice(7).replace(/_/g, ' ')

      const matches = linked.filter(
        (m) => namesMatch(importName, m.name) || namesMatch(importName, m.displayName)
      )
      const uids = [...new Set(matches.map((m) => m.firebaseUid))]
      if (uids.length !== 1) return // 0 = ninguém logou ainda; >1 = ambíguo, não arrisca

      const uid = uids[0]
      if (opinoes[uid] || updates[`opinoes.${uid}`]) {
        // Voto real já existe → descarta o importado duplicado
        updates[`opinoes.${key}`] = deleteField()
        removed++
      } else {
        // Move o voto importado para o UID real
        updates[`opinoes.${uid}`] = { ...opinoes[key], userName: matches[0].name }
        updates[`opinoes.${key}`] = deleteField()
        merged++
      }
    })

    if (Object.keys(updates).length) batch.update(docSnap.ref, updates)
  })

  if (merged + removed > 0) await batch.commit()
  return { merged, removed }
}
