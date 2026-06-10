import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function AddSongModal({ onClose, totalSongs }) {
  const [form, setForm] = useState({ title: '', artist: '', notes: '', status: 'ensaiando' })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'songs'), {
      ...form,
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
          <label>Status
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="ensaiando">Ensaiando</option>
              <option value="pronta">Pronta</option>
              <option value="descartada">Descartada</option>
            </select>
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
