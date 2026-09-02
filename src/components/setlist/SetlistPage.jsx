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

const SORTS = [
  { value: 'recentes',    label: '🕐 Recentes' },
  { value: 'manual',      label: 'Padrão' },
  { value: 'balanceada',  label: '⚖️ Melhores e fáceis' },
  { value: 'media',       label: '⭐ Média' },
  { value: 'dificuldade', label: '🎯 Dificuldade' },
  { value: 'data',        label: '📅 Antigas' },
]

// Peso de cada nível de dificuldade (mesma ordem do "Como tá pra você?")
// 'nao_vi' não está aqui de propósito: é neutro e não entra na média.
const DIFF_WEIGHT = { de_boa: 1, ok: 2, sofrendo: 3, travado: 4, moises: 5 }

// Média de dificuldade da banda; null se ninguém deu um voto que conte
function avgDifficulty(song) {
  const votes = Object.values(song.dificuldade || {}).filter((v) => DIFF_WEIGHT[v.level])
  if (!votes.length) return null
  return votes.reduce((acc, v) => acc + DIFF_WEIGHT[v.level], 0) / votes.length
}

// Desconto pela dificuldade, no mesmo espírito da ordenação das sugestões:
// a nota manda e a dificuldade só penaliza. De boa não desconta nada,
// "Moisés" desconta 30%. Sem voto conta como o meio da escala.
function facilidade(song) {
  const peso = avgDifficulty(song) ?? 3
  return 1 - (peso - 1) * 0.075
}

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
  // Recentes por padrão: música nova é a que a banda está mexendo agora.
  // "Padrão" continua na lista porque é a única em que dá pra arrastar
  const [sortBy, setSortBy] = useState('recentes')
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

  const sortActive = sortBy !== 'manual'

  // Arrastar vale em qualquer filtro/tag/busca: soltar em cima de uma música
  // move a arrastada pra posição global dela. Só desliga nas ordenações
  // automáticas (Mais antigas / Mais fáceis), onde ordem manual não se aplica.
  const dragEnabled = !sortActive
  let displayed = filtered
  if (sortActive) {
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

    displayed = [...filtered].sort((a, b) => {
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
  }

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
