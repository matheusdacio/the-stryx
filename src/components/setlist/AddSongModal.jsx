import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { getYouTubeId } from '../../utils/youtube'
import { checarDuplicata } from '../../utils/duplicata'

export default function AddSongModal({ onClose, totalSongs, acervo }) {
  const [form, setForm] = useState({ title: '', artist: '', notes: '', tom: '', bpm: '', videoUrl: '' })
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)
  const videoId = getYouTubeId(form.videoUrl)

  const { bloqueio, titulo: jaExiste, parecidas } = checarDuplicata(form.title, form.artist, acervo)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || bloqueio) return
    setSaving(true)
    await addDoc(collection(db, 'songs'), {
      ...form,
      tom: form.tom.trim(),
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
          {bloqueio && (
            <p className="aviso-duplicata bloqueio">
              ⛔ <strong>{jaExiste}</strong> {bloqueio === 'setlist' ? 'já está no setlist.' : 'já foi sugerida.'}
            </p>
          )}
          {!bloqueio && parecidas?.length > 0 && (
            <p className="aviso-duplicata">
              ⚠️ Já existe algo parecido: {parecidas.join(' · ')} — confira o artista.
            </p>
          )}
          <div className="form-row">
            <label>Tom
              <input name="tom" value={form.tom} onChange={handleChange} placeholder="Ex: Sol, Am" />
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
            <button type="submit" className="btn-primary" disabled={saving || !!bloqueio}>{saving ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
