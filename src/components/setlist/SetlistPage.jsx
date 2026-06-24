import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SongCard from './SongCard'
import AddSongModal from './AddSongModal'

const FILTERS = [
  { value: 'all',       label: 'Todas' },
  { value: 'ensaiando', label: 'Ensaiando' },
  { value: 'pronta',    label: 'Prontas' },
  { value: 'extra',     label: 'Extras' },
]

// Ordenações extras dentro do filtro "Ensaiando"
const ENSAIANDO_SORTS = [
  { value: 'manual',      label: 'Padrão' },
  { value: 'data',        label: '📅 Mais antigas' },
  { value: 'dificuldade', label: '🎯 Mais fáceis' },
]

// Peso de cada nível de dificuldade (mesma ordem do "Como tá pra você?")
const DIFF_WEIGHT = { de_boa: 1, ok: 2, sofrendo: 3, travado: 4, moises: 5 }

// Média de dificuldade da banda; null se ninguém votou ainda
function avgDifficulty(song) {
  const votes = Object.values(song.dificuldade || {})
  if (!votes.length) return null
  return votes.reduce((acc, v) => acc + (DIFF_WEIGHT[v.level] || 0), 0) / votes.length
}

export default function SetlistPage() {
  const [songs, setSongs] = useState([])
  const [filter, setFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  const [ensaiandoSort, setEnsaiandoSort] = useState('manual')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const moveUp = async (index) => {
    if (index === 0) return
    const a = songs[index]
    const b = songs[index - 1]
    const batch = writeBatch(db)
    batch.update(doc(db, 'songs', a.id), { order: b.order })
    batch.update(doc(db, 'songs', b.id), { order: a.order })
    await batch.commit()
  }

  const moveDown = async (index) => {
    if (index === songs.length - 1) return
    const a = songs[index]
    const b = songs[index + 1]
    const batch = writeBatch(db)
    batch.update(doc(db, 'songs', a.id), { order: b.order })
    batch.update(doc(db, 'songs', b.id), { order: a.order })
    await batch.commit()
  }

  const allTags = [...new Set(songs.flatMap((s) => s.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )

  const filtered = songs.filter((s) =>
    (filter === 'all' || s.status === filter) &&
    (!tagFilter || (s.tags || []).includes(tagFilter))
  )

  // Aplica a ordenação extra só no filtro "Ensaiando"
  const sortActive = filter === 'ensaiando' && ensaiandoSort !== 'manual'
  let displayed = filtered
  if (sortActive) {
    displayed = [...filtered].sort((a, b) => {
      if (ensaiandoSort === 'data') {
        // Mais antiga → mais nova
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      }
      // Dificuldade: mais fácil → mais difícil; sem votos vai pro fim
      const da = avgDifficulty(a)
      const db_ = avgDifficulty(b)
      if (da === null && db_ === null) return 0
      if (da === null) return 1
      if (db_ === null) return -1
      return da - db_
    })
  }

  const counts = {
    all:       songs.length,
    ensaiando: songs.filter((s) => s.status === 'ensaiando').length,
    pronta:    songs.filter((s) => s.status === 'pronta').length,
    extra:     songs.filter((s) => s.status === 'extra').length,
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Setlist</h2>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ Música</button>
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

      {/* Ordenação extra — só no filtro Ensaiando */}
      {filter === 'ensaiando' && (
        <div className="sort-bar">
          <span className="sort-label">Ordenar:</span>
          {ENSAIANDO_SORTS.map((s) => (
            <button
              key={s.value}
              className={`btn-sort ${ensaiandoSort === s.value ? 'active' : ''}`}
              onClick={() => setEnsaiandoSort(s.value)}
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

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma música aqui ainda.</p>
          {filter === 'all' && (
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              Adicionar primeira música
            </button>
          )}
        </div>
      ) : (
        <div className="song-list">
          {displayed.map((song, i) => {
            const globalIndex = songs.findIndex((s) => s.id === song.id)
            return (
              <SongCard
                key={song.id}
                song={song}
                onMoveUp={() => moveUp(globalIndex)}
                onMoveDown={() => moveDown(globalIndex)}
                isFirst={globalIndex === 0}
                isLast={globalIndex === songs.length - 1}
                position={sortActive ? i + 1 : globalIndex + 1}
                hideReorder={sortActive}
              />
            )
          })}
        </div>
      )}

      {showModal && <AddSongModal onClose={() => setShowModal(false)} totalSongs={songs.length} />}
    </div>
  )
}
