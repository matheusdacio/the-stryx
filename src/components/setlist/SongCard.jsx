import { useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

const STATUS_LABELS = { ensaiando: 'Ensaiando', pronta: 'Pronta', extra: 'Extra' }

export default function SongCard({ song, onMoveUp, onMoveDown, isFirst, isLast, position }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const ref = doc(db, 'songs', song.id)

  const changeStatus = (status) => updateDoc(ref, { status })
  const saveNotes = async () => { await updateDoc(ref, { notes }); setEditing(false) }
  const remove = () => { if (confirm(`Remover "${song.title}"?`)) deleteDoc(ref) }

  return (
    <div className={`song-card status-${song.status}`}>
      <div className="song-header">
        <div className="song-order-wrap">
          <span className="song-position">{position}</span>
          <div className="order-btns">
            <button className="btn-order" onClick={onMoveUp} disabled={isFirst} title="Mover para cima">▲</button>
            <button className="btn-order" onClick={onMoveDown} disabled={isLast} title="Mover para baixo">▼</button>
          </div>
        </div>
        <div className="song-info">
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
