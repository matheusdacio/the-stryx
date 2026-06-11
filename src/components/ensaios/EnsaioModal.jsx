import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'

// Fallback caso ainda não tenha membros importados
const DEFAULT_MEMBERS = ['Cristiano', 'Shirleano', 'Marcio Braz', 'Marcos', 'Albano', 'Matheus Dacio']

function toInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
}

export default function EnsaioModal({ ensaio, onClose }) {
  const [bandMembers, setBandMembers] = useState(DEFAULT_MEMBERS)
  const [allSongs, setAllSongs] = useState([])
  const [form, setForm] = useState({
    date: toInputDate(ensaio?.date) || '',
    location: ensaio?.location || '',
    type: ensaio?.type || 'ensaio',
    status: ensaio?.status || 'planejado',
    notes: ensaio?.notes || '',
    members: ensaio?.members || [],
  })
  const [pauta, setPauta] = useState(ensaio?.pauta || [])
  const [setlist, setSetlist] = useState(ensaio?.setlist || [])
  const [newItem, setNewItem] = useState('')
  const [songSearch, setSongSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const dragIndex = useRef(null)

  // Carrega membros do Firestore se existirem
  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setBandMembers(snap.docs.map((d) => d.data().name))
      }
    })
  }, [])

  // Carrega músicas do repertório
  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setAllSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const toggleMember = (m) =>
    setForm((f) => ({
      ...f,
      members: f.members.includes(m) ? f.members.filter((x) => x !== m) : [...f.members, m],
    }))

  const addPauta = () => {
    if (!newItem.trim()) return
    setPauta([...pauta, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const removePauta = (i) => setPauta(pauta.filter((_, idx) => idx !== i))

  // ── Setlist do evento ───────────────────────────────────────────────
  const addSong = (song) => {
    if (setlist.some((s) => s.id === song.id)) return
    setSetlist([...setlist, {
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      bpm: song.bpm || null,
    }])
    setSongSearch('')
  }

  const removeSong = (i) => setSetlist(setlist.filter((_, idx) => idx !== i))

  const moveSong = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= setlist.length) return
    const next = [...setlist]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSetlist(next)
  }

  // Drag and drop (desktop)
  const handleDragStart = (i) => { dragIndex.current = i }
  const handleDragOver = (e, i) => {
    e.preventDefault()
    const from = dragIndex.current
    if (from === null || from === i) return
    const next = [...setlist]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    dragIndex.current = i
    setSetlist(next)
  }
  const handleDragEnd = () => { dragIndex.current = null }

  const searchResults = songSearch.trim()
    ? allSongs.filter((s) =>
        !setlist.some((x) => x.id === s.id) &&
        `${s.title} ${s.artist || ''}`.toLowerCase().includes(songSearch.toLowerCase())
      ).slice(0, 6)
    : []

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    const data = {
      ...form,
      pauta,
      setlist,
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
    }
    if (ensaio) {
      await updateDoc(doc(db, 'ensaios', ensaio.id), data)
    } else {
      await addDoc(collection(db, 'ensaios'), { ...data, createdAt: serverTimestamp() })
    }
    onClose()
  }

  const isApresentacao = form.type === 'apresentacao'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>{ensaio ? 'Editar Evento' : 'Agendar Evento'}</h2>
        <form onSubmit={handleSave}>
          {/* Tipo de evento */}
          <div className="event-type-toggle">
            <button
              type="button"
              className={`btn-event-type ${!isApresentacao ? 'active' : ''}`}
              onClick={() => setForm({ ...form, type: 'ensaio' })}
            >
              🎸 Ensaio
            </button>
            <button
              type="button"
              className={`btn-event-type ${isApresentacao ? 'active apresentacao' : ''}`}
              onClick={() => setForm({ ...form, type: 'apresentacao' })}
            >
              🎤 Apresentação
            </button>
          </div>

          <div className="form-row">
            <label>Data *<input type="date" name="date" value={form.date} onChange={handleChange} required /></label>
            <label>Local<input name="location" value={form.location} onChange={handleChange} placeholder={isApresentacao ? 'Ex: Bar do Zé' : 'Ex: Estúdio X'} /></label>
          </div>
          <label>Status
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="planejado">Planejado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>

          {/* Setlist do evento */}
          <div className="form-group">
            <p className="section-label">
              Músicas do evento {setlist.length > 0 && `(${setlist.length})`}
            </p>
            <input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="Buscar música do repertório..."
            />
            {searchResults.length > 0 && (
              <div className="song-search-results">
                {searchResults.map((s) => (
                  <button key={s.id} type="button" className="song-search-item" onClick={() => addSong(s)}>
                    + {s.title} {s.artist && <span className="song-search-artist">— {s.artist}</span>}
                  </button>
                ))}
              </div>
            )}
            {setlist.length > 0 && (
              <div className="event-setlist">
                {setlist.map((s, i) => (
                  <div
                    key={s.id}
                    className="event-setlist-item"
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="drag-handle" title="Arrastar para reordenar">⠿</span>
                    <span className="event-setlist-pos">{i + 1}</span>
                    <span className="event-setlist-title">
                      {s.title}
                      {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                      {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                    </span>
                    <span className="event-setlist-actions">
                      <button type="button" className="btn-order" onClick={() => moveSong(i, -1)} disabled={i === 0}>▲</button>
                      <button type="button" className="btn-order" onClick={() => moveSong(i, 1)} disabled={i === setlist.length - 1}>▼</button>
                      <button type="button" className="btn-remove" onClick={() => removeSong(i)}>✕</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <p className="section-label">Pauta</p>
            <div className="pauta-input-row">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPauta())}
                placeholder="Adicionar item à pauta..."
              />
              <button type="button" className="btn-primary" onClick={addPauta}>+</button>
            </div>
            {pauta.map((item, i) => (
              <div key={i} className="pauta-item-edit">
                <span>{item.text}</span>
                <button type="button" className="btn-remove" onClick={() => removePauta(i)}>✕</button>
              </div>
            ))}
          </div>

          <div className="form-group">
            <p className="section-label">Membros presentes</p>
            <div className="members-check">
              {bandMembers.map((m) => (
                <label key={m} className="member-check-item">
                  <input type="checkbox" checked={form.members.includes(m)} onChange={() => toggleMember(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <label>Observações
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Notas do evento..." />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
