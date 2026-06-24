import { useState } from 'react'
import { doc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import MetronomeButton from './MetronomeButton'

const STATUS_LABELS = { ensaiando: 'Ensaiando', pronta: 'Pronta', extra: 'Extra' }

// Níveis de dificuldade (votados por cada membro nas músicas em Ensaiando)
const DIFFICULTIES = [
  { value: 'de_boa',   label: 'De boa',             short: 'De boa',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ok',       label: 'OK',                 short: 'OK',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'sofrendo', label: 'Estou sofrendo',     short: 'Sofrendo',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'travado',  label: 'Preciso de um tempo', short: 'Travado',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/)
  return match ? match[1] : null
}

const firstName = (n) => (n || '').trim().split(' ')[0]

export default function SongCard({ song, onMoveUp, onMoveDown, isFirst, isLast, position }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const [bpm, setBpm] = useState(song.bpm || '')
  const [videoUrl, setVideoUrl] = useState(song.videoUrl || '')
  const [tags, setTags] = useState(song.tags || [])
  const [newTag, setNewTag] = useState('')
  const ref = doc(db, 'songs', song.id)

  // Dificuldade — voto de cada membro (mapa keyed por uid)
  const dificuldade = song.dificuldade || {}
  const myDiff = dificuldade[user.uid]?.level
  const voteDiff = (level) => {
    if (myDiff === level) {
      // Clicou no mesmo nível → remove o voto
      updateDoc(ref, { [`dificuldade.${user.uid}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`dificuldade.${user.uid}`]: {
          userName: user.displayName || user.email,
          level,
          at: new Date().toISOString(),
        },
      })
    }
  }

  const changeStatus = (status) => updateDoc(ref, { status })
  const saveNotes = async () => { await updateDoc(ref, { notes }); setEditing(false) }
  const saveMeta = async () => {
    await updateDoc(ref, {
      bpm: bpm ? Number(bpm) : null,
      videoUrl: videoUrl.trim(),
      tags,
    })
    setEditingMeta(false)
  }
  const addTag = () => {
    const t = newTag.trim()
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setNewTag(''); return }
    setTags([...tags, t])
    setNewTag('')
  }
  const removeTag = (t) => setTags(tags.filter((x) => x !== t))
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

      {/* Dificuldade — só nas músicas em Ensaiando */}
      {song.status === 'ensaiando' && (
        <div className="difficulty-section">
          <p className="section-label">Como tá pra você?</p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={`btn-diff ${myDiff === d.value ? 'active' : ''}`}
                style={myDiff === d.value ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
                onClick={() => voteDiff(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {Object.keys(dificuldade).length > 0 && (
            <div className="difficulty-summary">
              {DIFFICULTIES.map((d) => {
                const voters = Object.values(dificuldade).filter((v) => v.level === d.value)
                if (!voters.length) return null
                return (
                  <span key={d.value} className="diff-pill" style={{ color: d.color, background: d.bg }}>
                    {d.short}: {voters.map((v) => firstName(v.userName)).join(', ')}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

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
        {(song.tags || []).map((t) => (
          <span key={t} className="song-tag">🏷 {t}</span>
        ))}
        <button className="btn-meta-edit" onClick={() => setEditingMeta(!editingMeta)} title="Editar BPM, vídeo e tags">✎</button>
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
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Tags
            <div className="tag-edit-row">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Ex: Acústico, Show Bar do Zé..."
              />
              <button type="button" className="btn-primary" onClick={addTag}>+</button>
            </div>
          </label>
          {tags.length > 0 && (
            <div className="tag-chips">
              {tags.map((t) => (
                <span key={t} className="song-tag editable">
                  {t}
                  <button type="button" className="tag-remove" onClick={() => removeTag(t)}>✕</button>
                </span>
              ))}
            </div>
          )}
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
