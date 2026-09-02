import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, writeBatch, doc } from 'firebase/firestore'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../../firebase/config'
import SongCard from './SongCard'
import { notasPorMusica } from '../../utils/score'
import AddSongModal from './AddSongModal'
import SearchLupa from '../SearchLupa'
import { matchesSearch } from '../../utils/search'
import { DOMINIOS, calcDominio, dominioPorPeso } from '../../utils/dominio'

// O setlist é organizado pelo domínio da banda, no pior cenário votado:
// basta uma pessoa insegura pra música contar como precisando de ensaio
const FILTERS = [
  { value: 'all', label: 'Todas' },
  ...[...DOMINIOS].reverse().map((d) => ({ value: d.value, label: d.label })),
  { value: 'sem_voto', label: 'Sem voto' },
]

// Nível da música pra filtro e contagem
const nivelDe = (song) => dominioPorPeso(calcDominio(song.dominio).pior)?.value || 'sem_voto'

// Wrapper sortable: liga o card ao dnd-kit e passa o handle (a bolinha da posição)
function SortableSongCard({ song, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {}),
  }
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'dragging' : ''}>
      <SongCard song={song} dragHandleProps={{ ...attributes, ...listeners }} {...props} />
    </div>
  )
}

export default function SetlistPage() {
  const [songs, setSongs] = useState([])
  const [sugestoes, setSugestoes] = useState([])
  const [filter, setFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  // Pointer: arrasta depois de mover 6px (clique normal continua funcionando).
  // Touch: segurar 250ms pra começar a arrastar (scroll normal continua funcionando).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // As opiniões da banda vivem na sugestão que originou a música — é de lá
  // que vem a nota mostrada no setlist
  useEffect(() => {
    return onSnapshot(collection(db, 'sugestoes'), (snap) =>
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
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

  // Arrastou e soltou: reordena a lista inteira e normaliza order = índice
  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex((s) => s.id === active.id)
    const newIndex = songs.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(songs, oldIndex, newIndex)
    setSongs(reordered)
    const batch = writeBatch(db)
    reordered.forEach((s, i) => {
      if (s.order !== i) batch.update(doc(db, 'songs', s.id), { order: i })
    })
    await batch.commit()
  }

  const notaDe = notasPorMusica(sugestoes)

  const allTags = [...new Set(songs.flatMap((s) => s.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )

  const filtered = songs.filter((s) =>
    (filter === 'all' || nivelDe(s) === filter) &&
    (!tagFilter || (s.tags || []).includes(tagFilter)) &&
    matchesSearch(search, s.title, s.artist)
  )

  // A ordem do setlist é a que a banda arrumou na mão: sem ordenação
  // automática, arrastar vale em qualquer filtro, tag ou busca
  const dragEnabled = true
  const displayed = filtered

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
          <SearchLupa value={search} onChange={setSearch} />
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
      ) : dragEnabled ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayed.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="song-list">
              {displayed.map((song) => {
                const globalIndex = songs.findIndex((s) => s.id === song.id)
                return (
                  <SortableSongCard
                    nota={notaDe(song)}
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
          </SortableContext>
        </DndContext>
      ) : (
        <div className="song-list">
          {displayed.map((song, i) => (
            <SongCard
              nota={notaDe(song)}
              key={song.id}
              song={song}
              position={i + 1}
              hideReorder
            />
          ))}
        </div>
      )}

      {showModal && <AddSongModal onClose={() => setShowModal(false)} totalSongs={songs.length} />}
    </div>
  )
}
