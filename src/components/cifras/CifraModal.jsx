import { useState } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function CifraModal({ cifra, onClose, KEYS }) {
  const isView = cifra && !cifra._editing
  const [editing, setEditing] = useState(!cifra)
  const [form, setForm] = useState({
    title: cifra?.title || '',
    artist: cifra?.artist || '',
    key: cifra?.key || '',
    bpm: cifra?.bpm || '',
    content: cifra?.content || '',
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    if (cifra) {
      await updateDoc(doc(db, 'cifras', cifra.id), form)
    } else {
      await addDoc(collection(db, 'cifras'), { ...form, createdAt: serverTimestamp() })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2>{editing ? (cifra ? 'Editar Cifra' : 'Nova Cifra') : form.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {cifra && !editing && <button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>}
            <button className="btn-secondary" onClick={onClose}>Fechar</button>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave}>
            <div className="form-row">
              <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Nome da música" autoFocus /></label>
              <label>Artista<input name="artist" value={form.artist} onChange={handleChange} placeholder="Banda / Artista" /></label>
            </div>
            <div className="form-row">
              <label>Tom
                <select name="key" value={form.key} onChange={handleChange}>
                  <option value="">— selecionar —</option>
                  {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label>BPM<input name="bpm" type="number" value={form.bpm} onChange={handleChange} placeholder="120" /></label>
            </div>
            <label>
              Cifra / Tabs
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                placeholder={`Ex:\n[Intro]\nE|--0--2--3--|\nB|--0--3--3--|\n\n[Verso]\nAm   G   F   E\nLorem ipsum...`}
                rows={14}
                className="cifra-textarea"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        ) : (
          <div className="cifra-view">
            <div className="cifra-meta" style={{ marginBottom: 16 }}>
              {form.key && <span className="badge badge-key">Tom: {form.key}</span>}
              {form.bpm && <span className="badge badge-bpm">{form.bpm} BPM</span>}
              {form.artist && <span className="badge">{form.artist}</span>}
            </div>
            <pre className="cifra-content">{form.content || 'Sem conteúdo.'}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
