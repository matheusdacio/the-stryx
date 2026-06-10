import { useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

const STATUS_LABELS = {
  ensaiando: 'Ensaiando',
  pronta: 'Pronta',
  descartada: 'Descartada',
}

export default function SongCard({ song }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const ref = doc(db, 'songs', song.id)

  const changeStatus = (status) => updateDoc(ref, { status })

  const saveNotes = async () => {
    await updateDoc(ref, { notes })
    setEditing(false)
  }

  const remove = () => {
    if (confirm(`Remover "${song.title}" do setlist?`)) deleteDoc(ref)
  }

  return (
    <div className={`song-card status-${song.status}`}>
      <div className="song-header">
        <div>
          <span className="song-title">{song.title}</span>
          {song.artist && <span className="song-artist"> — {song.artist}</span>}
        </div>
        <button className="btn-remove" onClick={remove} title="Remover">✕</button>
      </div>

      <div className="song-status-bar">
        {Object.keys(STATUS_LABELS).map((s) => (
          <button
            key={s}
            className={`btn-status ${song.status === s ? 'active' : ''} status-btn-${s}`}
            onClick={() => changeStatus(s)}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {editing ? (
        <div className="notes-edit">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus />
          <div className="notes-actions">
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveNotes}>Salvar</button>
          </div>
        </div>
      ) : (
        <p className="song-notes" onClick={() => setEditing(true)}>
          {song.notes || <span className="placeholder">Clique para adicionar observações...</span>}
        </p>
      )}
    </div>
  )
}
