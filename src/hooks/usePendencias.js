import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { chaveMusica } from '../utils/score'
import { countSugestoesPendentes } from '../utils/pendencias'

// Quantas sugestões faltam EU votar — mesma regra da página de Sugestões,
// usada aqui pro badge do rodapé nunca mostrar um número diferente do da página
export function usePendencias(user) {
  const [sugestoes, setSugestoes] = useState([])
  const [noSetlist, setNoSetlist] = useState({ ids: new Set(), chaves: new Set() })
  const [bandMembers, setBandMembers] = useState([])

  useEffect(() => (
    onSnapshot(collection(db, 'sugestoes'), (snap) =>
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  ), [])

  useEffect(() => (
    onSnapshot(collection(db, 'songs'), (snap) => {
      const ids = new Set()
      const chaves = new Set()
      snap.docs.forEach((d) => {
        const song = d.data()
        if (song.sugestaoId) ids.add(song.sugestaoId)
        chaves.add(chaveMusica(song.title, song.artist))
      })
      setNoSetlist({ ids, chaves })
    })
  ), [])

  useEffect(() => (
    onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.map((d) => ({
        name: d.data().name,
        aliases: d.data().aliases || [],
        firebaseUid: d.data().firebaseUid || null,
      }))))
  ), [])

  return { sugestoesPendentes: countSugestoesPendentes(sugestoes, user, noSetlist, bandMembers) }
}
