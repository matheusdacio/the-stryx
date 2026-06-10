import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import SongCard from './SongCard'
import AddSongModal from './AddSongModal'

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'ensaiando', label: 'Ensaiando' },
  { value: 'pronta', label: 'Prontas' },
  { value: 'descartada', label: 'Descartadas' },
]

export default function SetlistPage() {
  const [songs, setSongs] = useState([])
  const [filter, setFilter] = useState('all')
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

  const filtered = filter === 'all' ? songs : songs.filter((s) => s.status === filter)

  const counts = {
    all: songs.length,
    ensaiando: songs.filter((s) => s.status === 'ensaiando').length,
    pronta: songs.filter((s) => s.status === 'pronta').length,
    descartada: songs.filter((s) => s.status === 'descartada').length,
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
          {filtered.map((song, i) => {
            const globalIndex = songs.findIndex((s) => s.id === song.id)
            return (
              <SongCard
                key={song.id}
                song={song}
                onMoveUp={() => moveUp(globalIndex)}
                onMoveDown={() => moveDown(globalIndex)}
                isFirst={globalIndex === 0}
                isLast={globalIndex === songs.length - 1}
                position={globalIndex + 1}
              />
            )
          })}
        </div>
      )}

      {showModal && <AddSongModal onClose={() => setShowModal(false)} totalSongs={songs.length} />}
    </div>
  )
}
