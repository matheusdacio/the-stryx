import { useState } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'

const BAND_MEMBERS = ['Matheus', 'Vocalista 1', 'Vocalista 2', 'Guitarrista Base', 'Baixista', 'Baterista']

function toInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
}

export default function EnsaioModal({ ensaio, onClose }) {
  const [form, setForm] = useState({
    date: toInputDate(ensaio?.date) || '',
    location: ensaio?.location || '',
    status: ensaio?.status || 'planejado',
    notes: ensaio?.notes || '',
    members: ensaio?.members || [],
  })
  const [pauta, setPauta] = useState(ensaio?.pauta || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const toggleMember = (m) => {
    setForm((f) => ({
      ...f,
      members: f.members.includes(m) ? f.members.filter((x) => x !== m) : [...f.members, m],
    }))
  }

  const addPauta = () => {
    if (!newItem.trim()) return
    setPauta([...pauta, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const removePauta = (i) => setPauta(pauta.filter((_, idx) => idx !== i))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    const data = {
      ...form,
      pauta,
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
    }
    if (ensaio) {
      await updateDoc(doc(db, 'ensaios', ensaio.id), data)
    } else {
      await addDoc(collection(db, 'ensaios'), { ...data, createdAt: serverTimestamp() })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>{ensaio ? 'Editar Ensaio' : 'Agendar Ensaio'}</h2>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label>Data *<input type="date" name="date" value={form.date} onChange={handleChange} required /></label>
            <label>Local<input name="location" value={form.location} onChange={handleChange} placeholder="Ex: Estúdio X" /></label>
          </div>
          <label>Status
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="planejado">Planejado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>

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
              {BAND_MEMBERS.map((m) => (
                <label key={m} className="member-check-item">
                  <input type="checkbox" checked={form.members.includes(m)} onChange={() => toggleMember(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <label>Observações<textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Notas do ensaio..." /></label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
