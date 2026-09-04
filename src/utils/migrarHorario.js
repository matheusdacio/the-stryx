import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { formatData } from './data'

// Ensaio sem horário grava 9h–17h de uma vez, pra completar quem ficou pra
// trás desde que o campo passou a existir. Apresentação não recebe padrão —
// só informa quem ainda está sem, pro dono preencher pelo Editar.
export async function migrarHorario({ dryRun = false } = {}) {
  const snap = await getDocs(collection(db, 'ensaios'))

  const changes = []
  const apresentacoesSemHorario = []
  snap.forEach((docSnap) => {
    const ev = docSnap.data()
    if (ev.horaInicio) return
    const label = `${formatData(ev.date, { curta: true })} · ${ev.location || 'sem local'}`
    if ((ev.type || 'ensaio') === 'ensaio') {
      changes.push({ id: docSnap.id, label })
    } else {
      apresentacoesSemHorario.push(label)
    }
  })

  if (!dryRun && changes.length) {
    // writeBatch aceita até 500 operações — lotes de 400 pra sobrar margem
    for (let i = 0; i < changes.length; i += 400) {
      const batch = writeBatch(db)
      changes.slice(i, i + 400).forEach((c) => batch.update(doc(db, 'ensaios', c.id), { horaInicio: '09:00', horaFim: '17:00' }))
      await batch.commit()
    }
  }

  return { changes, apresentacoesSemHorario }
}
