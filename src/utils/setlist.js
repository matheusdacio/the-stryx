import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'

// O setlist não tem mais status (Ensaiando / Pronta / Extra) — quem organiza
// a lista agora é o domínio votado por cada um. As que eram "Extra" ganham
// esta tag pra não perderem a marcação que a banda já tinha feito.
export const TAG_SEM_SENTIDO = 'Não faz sentido'

/** Converte o status 'extra' na tag. Idempotente. */
export async function migrarExtrasParaTag({ dryRun = false } = {}) {
  const snap = await getDocs(collection(db, 'songs'))

  const changes = []
  snap.forEach((docSnap) => {
    const song = docSnap.data()
    if (song.status !== 'extra') return
    const tags = song.tags || []
    if (tags.some((t) => t.toLowerCase() === TAG_SEM_SENTIDO.toLowerCase())) return
    changes.push({
      id: docSnap.id,
      title: song.title,
      artist: song.artist || '',
      tags: [...tags, TAG_SEM_SENTIDO],
    })
  })

  if (!dryRun && changes.length) {
    const batch = writeBatch(db)
    changes.forEach((c) => batch.update(doc(db, 'songs', c.id), { tags: c.tags }))
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : changes.length }
}
