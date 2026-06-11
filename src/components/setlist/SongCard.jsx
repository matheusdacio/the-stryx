import { useState } from 'react'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import MetronomeButton from './MetronomeButton'

const STATUS_LABELS = { ensaiando: 'Ensaiando', pronta: 'Pronta', extra: 'Extra' }

function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/)
  return match ? match[1] : null
}

export default function SongCard({ song, onMoveUp, onMoveDown, isFirst, isLast, position }) {
  const [editing, setEditing] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const [bpm, setBpm] = useState(song.bpm || '')
  const [videoUrl, setVideoUrl] = useState(song.videoUrl || '')
  const ref = doc(db, 'songs', song.id)

  const changeStatus = (status) => updateDoc(ref, { status })
  const saveNotes = async () => { await updateDoc(ref, { notes }); setEditing(false) }
  const saveMeta = async () => {
    await updateDoc(ref, {
      bpm: bpm ? Number(bpm) : null,
      videoUrl: videoUrl.trim(),
    })
    setEditingMeta(false)
  }
  const remove = () => { if (confirm(`Remover "${song.title}"?`)) deleteDoc(ref) }

  const videoId = getYouTubeId(song.videoUrl)

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

      {/* BPM, metrônomo e vídeo */}
      <div className="song-meta-bar">
        {song.bpm ? (
          <MetronomeButton bpm={song.bpm} />
        ) : (
          <button className="btn-meta-add" onClick={() => setEditingMeta(true)}>♩ + BPM</button>
        )}
        {videoId ? (
          <a
            href={song.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="song-video-link"
            title="Abrir no YouTube"
          >
            ▶ YouTube
          </a>
        ) : (
          <button className="btn-meta-add" onClick={() => setEditingMeta(true)}>🎬 + vídeo</button>
        )}
        <button className="btn-meta-edit" onClick={() => setEditingMeta(!editingMeta)} title="Editar BPM e vídeo">✎</button>
      </div>

      {editingMeta && (
        <div className="song-meta-edit">
          <div className="form-row">
            <label>BPM
              <input type="number" min="20" max="300" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="Ex: 120" />
            </label>
            <label>YouTube
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </label>
          </div>
          <div className="notes-actions">
            <button className="btn-secondary" onClick={() => setEditingMeta(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveMeta}>Salvar</button>
          </div>
        </div>
      )}

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
