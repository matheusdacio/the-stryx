import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const TYPES = [
  { value: 'ideia', label: 'Ideia', color: '#a855f7' },
  { value: 'letra', label: 'Letra', color: '#3b82f6' },
  { value: 'riff', label: 'Riff', color: '#f59e0b' },
  { value: 'estrutura', label: 'Estrutura', color: '#10b981' },
]

function RascunhoCard({ r, onEdit, onDelete }) {
  const type = TYPES.find((t) => t.value === r.type) || TYPES[0]
  return (
    <div className="rascunho-card" onClick={() => onEdit(r)}>
      <div className="rascunho-header">
        <span className="rascunho-title">{r.title}</span>
        <button className="btn-remove" onClick={(e) => { e.stopPropagation(); onDelete(r) }}>✕</button>
      </div>
      <span className="badge" style={{ background: type.color + '33', color: type.color, borderColor: type.color + '55' }}>
        {type.label}
      </span>
      <p className="rascunho-preview">{r.content?.slice(0, 120)}{r.content?.length > 120 ? '...' : ''}</p>
      <p className="rascunho-author">{r.createdBy}</p>
    </div>
  )
}

function RascunhoModal({ rascunho, onClose }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ title: rascunho?.title || '', type: rascunho?.type || 'ideia', content: rascunho?.content || '' })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    if (rascunho) {
      await updateDoc(doc(db, 'rascunhos', rascunho.id), form)
    } else {
      await addDoc(collection(db, 'rascunhos'), { ...form, createdBy: user.displayName, createdAt: serverTimestamp() })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>{rascunho ? 'Editar Rascunho' : 'Novo Rascunho'}</h2>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Ideia pro refrão" autoFocus /></label>
            <label>Tipo
              <select name="type" value={form.type} onChange={handleChange}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
          </div>
          <label>
            Conteúdo
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              rows={10}
              placeholder="Descreva sua ideia, letra, riff ou estrutura..."
              style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
            />
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

export default function RascunhosPage() {
  const [rascunhos, setRascunhos] = useState([])
  const [modal, setModal] = useState(null)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    const q = query(collection(db, 'rascunhos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setRascunhos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  const filtered = filterType === 'all' ? rascunhos : rascunhos.filter((r) => r.type === filterType)

  const remove = (r) => { if (confirm(`Remover "${r.title}"?`)) deleteDoc(doc(db, 'rascunhos', r.id)) }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Rascunhos</h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Rascunho</button>
      </div>

      <div className="filter-bar">
        <button className={`btn-filter ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
          Todos <span className="count">{rascunhos.length}</span>
        </button>
        {TYPES.map((t) => (
          <button
            key={t.value}
            className={`btn-filter ${filterType === t.value ? 'active' : ''}`}
            onClick={() => setFilterType(t.value)}
          >
            {t.label} <span className="count">{rascunhos.filter((r) => r.type === t.value).length}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum rascunho ainda.</p>
          {filterType === 'all' && <button className="btn-primary" onClick={() => setModal('add')}>Criar primeiro rascunho</button>}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((r) => (
            <RascunhoCard key={r.id} r={r} onEdit={setModal} onDelete={remove} />
          ))}
        </div>
      )}

      {modal && <RascunhoModal rascunho={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
