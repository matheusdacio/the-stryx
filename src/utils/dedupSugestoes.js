import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { chaveMusica, fundirVotos } from './score'

// Duas sugestões da mesma música deixam a nota ambígua e escondem votos: a que
// não virou música some da lista levando as opiniões junto.
//
// Funde em vez de descartar: a sugestão que fica recebe as opiniões que só
// existiam na outra. Quem votou nas duas mantém o voto da que fica — ninguém
// conta duas vezes, nem quando votou com nome importado num lado e com login
// no outro. Se alguma do grupo estava aprovada, a que fica assume esse status.
// Idempotente.
export async function dedupSugestoes({ dryRun = false } = {}) {
  const [sugSnap, songsSnap] = await Promise.all([
    getDocs(collection(db, 'sugestoes')),
    getDocs(collection(db, 'songs')),
  ])

  const sugestoes = sugSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const musicas = songsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const grupos = {}
  sugestoes.forEach((sug) => {
    const k = chaveMusica(sug.title, sug.artist)
    grupos[k] = [...(grupos[k] || []), sug]
  })

  const conta = (mapa) => Object.keys(mapa || {}).length

  const changes = []
  Object.values(grupos).forEach((grupo) => {
    if (grupo.length < 2) return

    const ordenado = [...grupo].sort((a, b) => conta(b.opinoes) - conta(a.opinoes))
    const [fica, ...saem] = ordenado

    let opinoes = fica.opinoes || {}
    let dificuldade = fica.dificuldade || {}
    const preencher = {}
    saem.forEach((s) => {
      opinoes = fundirVotos(s.opinoes, opinoes)
      dificuldade = fundirVotos(s.dificuldade, dificuldade)
      // Campo que só a duplicada tinha não se perde
      ;['videoUrl', 'notes', 'description', 'tom'].forEach((campo) => {
        if (!fica[campo] && !preencher[campo] && s[campo]) preencher[campo] = s[campo]
      })
      if (!fica.bpm && !preencher.bpm && s.bpm) preencher.bpm = s.bpm
    })

    const status = grupo.some((s) => s.status === 'aprovada') ? 'aprovada' : fica.status

    const idsQueSaem = new Set(saem.map((s) => s.id))
    const repontar = musicas.filter((m) => idsQueSaem.has(m.sugestaoId)).map((m) => m.id)

    changes.push({
      titulo: `${fica.title}${fica.artist ? ` — ${fica.artist}` : ''}`,
      fica: { id: fica.id, votosAntes: conta(fica.opinoes), status: fica.status },
      resultado: { votos: conta(opinoes), status },
      saem: saem.map((s) => ({ id: s.id, votos: conta(s.opinoes), status: s.status })),
      repontar,
      update: { opinoes, dificuldade, status, ...preencher },
    })
  })

  if (!dryRun && changes.length) {
    const batch = writeBatch(db)
    changes.forEach((c) => {
      batch.update(doc(db, 'sugestoes', c.fica.id), c.update)
      c.saem.forEach((s) => batch.delete(doc(db, 'sugestoes', s.id)))
      c.repontar.forEach((id) => batch.update(doc(db, 'songs', id), { sugestaoId: c.fica.id }))
    })
    await batch.commit()
  }

  return { changes, updated: dryRun ? 0 : changes.length }
}
