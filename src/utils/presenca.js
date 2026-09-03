import { collection, getDocs, writeBatch, doc, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { canonicalMemberName } from './members'
import { formatData } from './data'

// Cada pessoa indica a própria presença no evento
export const PRESENCAS = [
  { value: 'vai', label: 'Vou',     short: 'Vai',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'nao', label: 'Não vou', short: 'Não vai', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

const isPast = (ts) => {
  if (!ts) return false
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d < new Date()
}

// Separa a banda entre quem confirmou, quem recusou e quem não respondeu.
// A ordem segue o cadastro, e quem não é membro (convidado) fica à parte.
export function splitPresenca(ensaio, bandMembers) {
  const p = ensaio.presenca || {}
  const vao = []
  const nao = []
  const pendentes = []
  bandMembers.forEach((m) => {
    const status = m.firebaseUid ? p[m.firebaseUid]?.status : null
    if (status === 'vai') vao.push(m)
    else if (status === 'nao') nao.push(m)
    else pendentes.push(m)
  })
  return { vao, nao, pendentes, convidados: ensaio.convidados || [] }
}

// Ainda falta esta pessoa responder neste evento?
export const faltaResponder = (ensaio, uid) => !(ensaio.presenca || {})[uid]

// Migração única: a lista de "membros presentes" (texto) vira presença por
// pessoa. Eventos já realizados guardam o histórico como "Vou"; os futuros
// nascem em branco, pra banda confirmar de verdade. Quem não está no cadastro
// (convidado de um ensaio antigo) é preservado em 'convidados'.
export async function migrateEventPresence({ dryRun = false } = {}) {
  const [membersSnap, ensaiosSnap] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(collection(db, 'ensaios')),
  ])

  const bandMembers = membersSnap.docs.map((d) => ({
    name: d.data().name,
    aliases: d.data().aliases || [],
    firebaseUid: d.data().firebaseUid || null,
  }))
  const byName = Object.fromEntries(bandMembers.map((m) => [m.name, m]))

  const changes = []
  ensaiosSnap.forEach((docSnap) => {
    const data = docSnap.data()
    const nomes = data.members || []
    if (!nomes.length && !data.presenca) return

    const passado = isPast(data.date)
    const presenca = {}
    const convidados = []

    if (passado) {
      nomes.forEach((n) => {
        const canon = canonicalMemberName(n, bandMembers)
        const membro = canon ? byName[canon] : null
        if (membro?.firebaseUid) {
          presenca[membro.firebaseUid] = { status: 'vai', name: membro.name, at: null }
        } else if (!convidados.includes(n)) {
          convidados.push(n)
        }
      })
    }

    changes.push({
      id: docSnap.id,
      date: formatData(data.date, { curta: true }) || 's/ data',
      passado,
      antes: nomes,
      vai: Object.values(presenca).map((v) => v.name),
      convidados,
    })
  })

  if (!dryRun && changes.length) {
    const batch = writeBatch(db)
    changes.forEach((c) => {
      const update = { members: deleteField() }
      if (c.passado) {
        const presenca = {}
        c.vai.forEach((name) => {
          const uid = bandMembers.find((m) => m.name === name)?.firebaseUid
          if (uid) presenca[uid] = { status: 'vai', name, at: null }
        })
        update.presenca = presenca
        if (c.convidados.length) update.convidados = c.convidados
      } else {
        update.presenca = {}
      }
      batch.update(doc(db, 'ensaios', c.id), update)
    })
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : changes.length }
}
