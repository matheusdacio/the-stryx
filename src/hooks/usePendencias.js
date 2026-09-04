import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { chaveMusica, opinioesPorMusica } from '../utils/score'
import { countSugestoesPendentes } from '../utils/pendencias'
import { todosVotaram } from '../utils/rejeicao'
import { faltaResponder } from '../utils/presenca'
import { jaPassou } from '../utils/data'

// O que falta EU fazer em cada aba — mesma regra usada na própria página,
// pra os badges do rodapé nunca mostrarem um número diferente do que a
// pessoa vê ao entrar
export function usePendencias(user) {
  const [sugestoes, setSugestoes] = useState([])
  const [songs, setSongs] = useState([])
  const [ensaios, setEnsaios] = useState([])
  const [bandMembers, setBandMembers] = useState([])

  useEffect(() => (
    onSnapshot(collection(db, 'sugestoes'), (snap) =>
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  ), [])

  useEffect(() => (
    onSnapshot(collection(db, 'songs'), (snap) =>
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  ), [])

  useEffect(() => (
    onSnapshot(collection(db, 'ensaios'), (snap) =>
      setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  ), [])

  useEffect(() => (
    // Quem saiu da banda (ativo:false) fica fora — mesmo filtro do Setlist e
    // das Sugestões, senão um ex-membro trava "todo mundo votou" pra sempre
    onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.filter((d) => d.data().ativo !== false).map((d) => ({
        name: d.data().name,
        aliases: d.data().aliases || [],
        firebaseUid: d.data().firebaseUid || null,
      }))))
  ), [])

  const noSetlist = {
    ids: new Set(songs.filter((s) => s.sugestaoId).map((s) => s.sugestaoId)),
    chaves: new Set(songs.map((s) => chaveMusica(s.title, s.artist))),
  }
  const sugestoesPendentes = countSugestoesPendentes(sugestoes, user, noSetlist, bandMembers)

  // Mesma regra de "Falta meu voto" do Setlist: domínio, dificuldade ou
  // opinião (a opinião só conta enquanto a sugestão de origem não fechou)
  const opinioesDe = opinioesPorMusica(sugestoes)
  const setlistPendentes = user ? songs.filter((s) => {
    const opinoes = opinioesDe(s)
    return !(s.dominio || {})[user.uid] ||
      !(s.dificuldade || {})[user.uid] ||
      (!todosVotaram({ opinoes }, bandMembers) && !opinoes[user.uid])
  }).length : 0

  // Mesma regra da aba "⏳ Falta eu responder": só eventos futuros, não
  // cancelados, em que a pessoa ainda não respondeu Vou/Não vou
  const eventosPendentes = user ? ensaios.filter((e) =>
    !jaPassou(e.date) && e.status !== 'cancelado' && faltaResponder(e, user.uid)
  ).length : 0

  return { sugestoesPendentes, setlistPendentes, eventosPendentes }
}
