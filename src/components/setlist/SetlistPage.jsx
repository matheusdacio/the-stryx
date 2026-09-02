import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SongCard from './SongCard'
import { notasPorMusica, opinioesPorMusica } from '../../utils/score'
import AddSongModal from './AddSongModal'
import SearchLupa from '../SearchLupa'
import SetPlayer from '../SetPlayer'
import { matchesSearch } from '../../utils/search'
import { DOMINIOS, calcDominio, dominioPorPeso } from '../../utils/dominio'
import { calcDifficulty } from '../../utils/dificuldade'

// O setlist é organizado pelo domínio da banda, no pior cenário votado:
// basta uma pessoa insegura pra música contar como precisando de ensaio
const FILTERS = [
  { value: 'all', label: 'Todas' },
  ...[...DOMINIOS].reverse().map((d) => ({ value: d.value, label: d.label })),
  { value: 'sem_voto', label: 'Sem voto' },
]

// Nível da música pra filtro e contagem
const nivelDe = (song) => dominioPorPeso(calcDominio(song.dominio).pior)?.value || 'sem_voto'

const SORTS = [
  { value: 'recentes',    label: '🕐 Recentes' },
  { value: 'balanceada',  label: '⚖️ Melhores e fáceis' },
  { value: 'media',       label: '⭐ Média' },
  { value: 'dificuldade', label: '🎯 Dificuldade' },
  { value: 'data',        label: '📅 Antigas' },
]

const avgDifficulty = (song) => calcDifficulty(song.dificuldade).avg

// Desconto pela dificuldade, no mesmo espírito da ordenação das sugestões:
// a nota manda e a dificuldade só penaliza. Fácil não desconta, Difícil
// desconta 30%. Sem voto conta como o meio da escala.
function facilidade(song) {
  const peso = avgDifficulty(song) ?? 2
  return 1 - (peso - 1) * 0.15
}

export default function SetlistPage() {
  const [songs, setSongs] = useState([])
  const [sugestoes, setSugestoes] = useState([])
  const [filter, setFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  // O setlist é um acervo, não uma sequência: a ordem vem sempre de um
  // critério. Montar sequência é papel do repertório do evento
  const [sortBy, setSortBy] = useState('recentes')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  // Um id só: null = nada tocando, 'lista' = o SetPlayer da lista,
  // ou o id da música cujo player inline está aberto. Ligar um sempre
  // fecha o outro (D08) — nunca dois áudios ao mesmo tempo
  const [tocandoId, setTocandoId] = useState(null)
  const [bandMembers, setBandMembers] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  // As opiniões da banda vivem na sugestão que originou a música — é de lá
  // que vem a nota mostrada no setlist
  useEffect(() => {
    return onSnapshot(collection(db, 'sugestoes'), (snap) =>
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.map((d) => ({
        name: d.data().name,
        aliases: d.data().aliases || [],
        firebaseUid: d.data().firebaseUid || null,
      })))
    )
  }, [])

  const notaDe = notasPorMusica(sugestoes)
  const opinioesDe = opinioesPorMusica(sugestoes)

  const allTags = [...new Set(songs.flatMap((s) => s.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )

  const filtered = songs.filter((s) =>
    (filter === 'all' || nivelDe(s) === filter) &&
    (!tagFilter || (s.tags || []).includes(tagFilter)) &&
    matchesSearch(search, s.title, s.artist)
  )

  // Música sem nota vai pro fim nas ordenações por nota: quem nunca passou
  // por votação não tem como competir com quem a banda avaliou
  const porNota = (fator) => (a, b) => {
    const na = notaDe(a)
    const nb = notaDe(b)
    if (!na && !nb) return 0
    if (!na) return 1
    if (!nb) return -1
    return nb.media * fator(b) - na.media * fator(a)
  }
  const semDesconto = () => 1

  const displayed = [...filtered].sort((a, b) => {
    if (sortBy === 'balanceada') return porNota(facilidade)(a, b)
    if (sortBy === 'media') return porNota(semDesconto)(a, b)
    if (sortBy === 'data') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    if (sortBy === 'recentes') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    // Dificuldade: mais fácil → mais difícil; sem votos vai pro fim
    const da = avgDifficulty(a)
    const db_ = avgDifficulty(b)
    if (da === null && db_ === null) return 0
    if (da === null) return 1
    if (db_ === null) return -1
    return da - db_
  })

  // Toca o que está na tela: filtro, tag, busca e ordenação valem pra fila
  const comVideo = displayed.filter((s) => s.videoUrl)

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all'
      ? songs.length
      : songs.filter((s) => nivelDe(s) === f.value).length
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <h2>Setlist</h2>
        <div className="page-header-actions">
          <SearchLupa value={search} onChange={setSearch} placeholder="Filtrar por nome ou artista..." />
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Música</button>
        </div>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`btn-filter ${filter === f.value ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label} <span className="count">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {/* Ordenação extra */}
      {(
        <div className="sort-bar">
          <span className="sort-label">Ordenar:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              className={`btn-sort ${sortBy === s.value ? 'active' : ''}`}
              onClick={() => setSortBy(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Filtro por tags customizadas */}
      {allTags.length > 0 && (
        <div className="tag-bar">
          <span className="sort-label">🏷</span>
          {allTags.map((t) => (
            <button
              key={t}
              className={`btn-tag ${tagFilter === t ? 'active' : ''}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              {t}
              <span className="count">{songs.filter((s) => (s.tags || []).includes(t)).length}</span>
            </button>
          ))}
          {tagFilter && (
            <button className="btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setTagFilter(null)}>
              ✕ limpar
            </button>
          )}
        </div>
      )}

      {comVideo.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setTocandoId(tocandoId === 'lista' ? null : 'lista')}
          >
            {tocandoId === 'lista' ? '■ Parar' : `▶ Tocar as ${comVideo.length} músicas da lista`}
          </button>
          {tocandoId === 'lista' && <SetPlayer setlist={comVideo} />}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <p>Nenhuma música encontrada pra "{search.trim()}".</p>
          ) : (
            <>
              <p>Nenhuma música aqui ainda.</p>
              {filter === 'all' && (
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  Adicionar primeira música
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="song-list">
          {displayed.map((song, i) => (
            <SongCard
              nota={notaDe(song)}
              opinoes={opinioesDe(song)}
              bandMembers={bandMembers}
              key={song.id}
              song={song}
              position={i + 1}
              tocandoVideo={tocandoId === song.id}
              onTocarVideo={setTocandoId}
            />
          ))}
        </div>
      )}

      {showModal && <AddSongModal onClose={() => setShowModal(false)} totalSongs={songs.length} acervo={{ musicas: songs, sugestoes, bandMembers }} />}
    </div>
  )
}
