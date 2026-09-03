import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'

// A banda anotava o tom no texto livre das observações ("Tonalidade: F").
// Agora existe campo próprio, que aparece em destaque no modo palco — então
// o valor sai da observação e vai pro campo. Idempotente.
const PADRAO = /^\s*(?:tonalidade|tom)\s*[:-]\s*(.+?)\s*$/im

export async function migrarTom({ dryRun = false } = {}) {
  const snap = await getDocs(collection(db, 'songs'))

  const changes = []
  snap.forEach((docSnap) => {
    const song = docSnap.data()
    const notes = song.notes || ''
    const achado = notes.match(PADRAO)
    if (!achado) return

    const tom = achado[1].trim()
    // Já tem tom preenchido e diferente? Não sobrescreve — deixa pro humano
    if (song.tom && song.tom.trim() && song.tom.trim() !== tom) {
      changes.push({ id: docSnap.id, titulo: song.title, tom, conflito: song.tom.trim() })
      return
    }

    const notesLimpo = notes.replace(PADRAO, '').replace(/\n{3,}/g, '\n\n').trim()
    changes.push({
      id: docSnap.id,
      titulo: song.title,
      tom,
      notesAntes: notes,
      notesDepois: notesLimpo,
      update: { tom, notes: notesLimpo },
    })
  })

  const aplicaveis = changes.filter((c) => c.update)
  if (!dryRun && aplicaveis.length) {
    const batch = writeBatch(db)
    aplicaveis.forEach((c) => batch.update(doc(db, 'songs', c.id), c.update))
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : aplicaveis.length }
}
