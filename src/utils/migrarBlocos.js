import { collection, getDocs, writeBatch, doc, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { formatData } from './data'
import { novoBlocoId } from './blocos'

// Evento antigo só tinha `setlist`; a leitura já trata isso como um bloco
// único (blocosDe), mas quem edita grava `blocos` de verdade. Essa
// migração completa de vez quem nunca foi reaberto no modal depois da
// mudança. Idempotente: só pega quem ainda tem `setlist` (mesmo vazio) e
// não tem `blocos` array.
export async function migrarBlocos({ dryRun = false } = {}) {
  const snap = await getDocs(collection(db, 'ensaios'))

  const changes = []
  snap.forEach((docSnap) => {
    const ev = docSnap.data()
    if (ev.setlist === undefined || Array.isArray(ev.blocos)) return
    const setlist = ev.setlist || []
    changes.push({
      id: docSnap.id,
      label: `${formatData(ev.date, { curta: true })} · ${ev.location || 'sem local'}`,
      n: setlist.length,
      update: {
        blocos: setlist.length ? [{ id: novoBlocoId(), nome: '', musicas: setlist }] : [],
        setlist: deleteField(),
      },
    })
  })

  if (!dryRun && changes.length) {
    // writeBatch aceita até 500 operações — lotes de 400 pra sobrar margem
    for (let i = 0; i < changes.length; i += 400) {
      const batch = writeBatch(db)
      changes.slice(i, i + 400).forEach((c) => batch.update(doc(db, 'ensaios', c.id), c.update))
      await batch.commit()
    }
  }

  return { changes }
}
