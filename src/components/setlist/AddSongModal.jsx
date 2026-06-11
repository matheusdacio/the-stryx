import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/)
  return match ? match[1] : null
}

export default function AddSongModal({ onClose, totalSongs }) {
  const [form, setForm] = useState({ title: '', artist: '', notes: '', status: 'ensaiando', bpm: '', videoUrl: '' })
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)
  const videoId = getYouTubeId(form.videoUrl)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'songs'), {
      ...form,
      bpm: form.bpm ? Number(form.bpm) : null,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      order: totalSongs,
      createdAt: serverTimestamp(),
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adicionar Música</h2>
        <form onSubmit={handleSubmit}>
          <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Eruption" autoFocus /></label>
          <label>Artista / Autor<input name="artist" value={form.artist} onChange={handleChange} placeholder="Ex: Van Halen" /></label>
          <div className="form-row">
            <label>Status
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="ensaiando">Ensaiando</option>
                <option value="pronta">Pronta</option>
                <option value="extra">Extra</option>
              </select>
            </label>
            <label>BPM
              <input name="bpm" type="number" min="20" max="300" value={form.bpm} onChange={handleChange} placeholder="Ex: 120" />
            </label>
          </div>
          <label>
            Link do YouTube
            <input name="videoUrl" value={form.videoUrl} onChange={handleChange} placeholder="https://youtube.com/watch?v=..." />
          </label>
          {videoId && (
            <div className="yt-preview-small">
              <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="preview" />
              <span>✓ Vídeo reconhecido</span>
            </div>
          )}
          <label>
            Tags <span style={{ opacity: 0.6 }}>(separadas por vírgula)</span>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Ex: Acústico, Anos 80" />
          </label>
          <label>Observações<textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notas..." rows={3} /></label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
