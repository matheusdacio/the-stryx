import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { DIFF_BY_VALUE } from './dificuldade'

// O setlist usava uma escala de 6 níveis e a sugestão uma de 3, com o mesmo
// nome de campo. Agora a escala é uma só: converte os votos antigos.
// "Ainda não vi" some — era ausência de voto, não um nível.
const CONVERSAO = {
  de_boa: 'facil',
  ok: 'ok',
  sofrendo: 'dificil',
  travado: 'dificil',
  moises: 'dificil',
  nao_vi: null,
}

/** Converte os votos de dificuldade das músicas pra escala única. Idempotente. */
export async function migrarDificuldade({ dryRun = false } = {}) {
  const snap = await getDocs(collection(db, 'songs'))

  const changes = []
  snap.forEach((docSnap) => {
    const song = docSnap.data()
    const antes = song.dificuldade || {}
    if (!Object.keys(antes).length) return

    const depois = {}
    const descartados = []
    let mudou = false
    Object.entries(antes).forEach(([uid, voto]) => {
      if (DIFF_BY_VALUE[voto.level]) {
        depois[uid] = voto
        return
      }
      const novo = CONVERSAO[voto.level]
      mudou = true
      if (novo) depois[uid] = { ...voto, level: novo }
      else descartados.push(voto.userName || uid)
    })
    if (!mudou) return

    changes.push({
      id: docSnap.id,
      titulo: song.title,
      antes: Object.values(antes).map((v) => v.level),
      depois: Object.values(depois).map((v) => v.level),
      descartados,
      update: { dificuldade: depois },
    })
  })

  if (!dryRun && changes.length) {
    const batch = writeBatch(db)
    changes.forEach((c) => batch.update(doc(db, 'songs', c.id), c.update))
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : changes.length }
}
