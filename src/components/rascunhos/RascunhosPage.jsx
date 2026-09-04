import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'
import { matchesSearch } from '../../utils/search'
import SearchLupa from '../SearchLupa'

const TYPES = [
  { value: 'ideia', label: 'Ideia', color: '#a855f7' },
  { value: 'letra', label: 'Letra', color: '#3b82f6' },
  { value: 'riff', label: 'Riff', color: '#f59e0b' },
  { value: 'estrutura', label: 'Estrutura', color: '#10b981' },
]

function RascunhoCard({ r, onEdit }) {
  const type = TYPES.find((t) => t.value === r.type) || TYPES[0]
  return (
    <div className="rascunho-card" onClick={() => onEdit(r)}>
      <div className="rascunho-header">
        <span className="rascunho-title">{r.title}</span>
      </div>
      <span className="badge" style={{ background: type.color + '33', color: type.color, borderColor: type.color + '55' }}>
        {type.label}
      </span>
      <p className="rascunho-preview">{r.content?.slice(0, 120)}{r.content?.length > 120 ? '...' : ''}</p>
      <p className="rascunho-author">{r.createdBy}</p>
    </div>
  )
}

function RascunhoModal({ rascunho, onClose, onRemove }) {
  const { user } = useAuth()
  // Modo leitura é o padrão pra rascunho existente — abrir direto no
  // formulário derrubava o teclado em cima de quem só queria ler a letra
  const [editing, setEditing] = useState(!rascunho)
  const [form, setForm] = useState({ title: rascunho?.title || '', type: rascunho?.type || 'ideia', content: rascunho?.content || '' })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Cancelar volta pra leitura quando o rascunho já existe (nada se perde,
  // o form nem chegou a salvar); só fecha o modal de vez quando é novo
  const cancelar = () => {
    if (rascunho) {
      setForm({ title: rascunho.title, type: rascunho.type, content: rascunho.content })
      setEditing(false)
    } else {
      onClose()
    }
  }

  useFecharComVoltar(editing ? cancelar : onClose)

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    // Fecha na hora — sem sinal, o await deixava o modal preso em "Salvando..."
    const erro = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
    if (rascunho) {
      updateDoc(doc(db, 'rascunhos', rascunho.id), form).catch(erro)
    } else {
      addDoc(collection(db, 'rascunhos'), { ...form, createdBy: user.displayName, createdAt: serverTimestamp() }).catch(erro)
    }
    onClose()
  }

  const type = TYPES.find((t) => t.value === (rascunho?.type || form.type)) || TYPES[0]

  return (
    <div className="modal-overlay" onClick={editing ? undefined : onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2>{editing ? (rascunho ? 'Editar rascunho' : 'Novo rascunho') : rascunho.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {rascunho && !editing && <button className="btn-secondary" onClick={() => setEditing(true)}>Editar</button>}
            {!editing && <button className="btn-secondary" onClick={onClose}>Fechar</button>}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave}>
            <div className="form-row">
              <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Ideia pro refrão" autoFocus={!rascunho} required /></label>
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
              {onRemove && <button type="button" className="btn-ghost-danger" style={{ marginRight: 'auto' }} onClick={onRemove}>Remover</button>}
              <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        ) : (
          <>
            <span className="badge" style={{ background: type.color + '33', color: type.color, borderColor: type.color + '55' }}>
              {type.label}
            </span>
            <pre className="rascunho-content">{rascunho.content || 'Sem conteúdo.'}</pre>
            <p className="rascunho-author" style={{ marginTop: 10 }}>{rascunho.createdBy}</p>
            {onRemove && (
              <div className="modal-actions">
                <button type="button" className="btn-ghost-danger" style={{ marginRight: 'auto' }} onClick={onRemove}>Remover</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function RascunhosPage() {
  const [rascunhos, setRascunhos] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [modal, setModal] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'rascunhos'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setRascunhos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [])

  const filtered = rascunhos
    .filter((r) => filterType === 'all' || r.type === filterType)
    .filter((r) => matchesSearch(search, r.title, r.content))

  const remove = (r) => { if (confirm(`Apagar o rascunho "${r.title}"? Não dá pra desfazer.`)) deleteDoc(doc(db, 'rascunhos', r.id)) }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Rascunhos</h2>
        <div className="page-header-actions">
          <SearchLupa value={search} onChange={setSearch} placeholder="Buscar rascunho..." />
          <button className="btn-primary" onClick={() => setModal('add')}>+ Rascunho</button>
        </div>
      </div>
      <p className="filter-hint" style={{ marginTop: -12 }}>Ideias, letras, riffs e estruturas de música da banda.</p>

      <div className="filter-bar">
        <button className={`btn-filter ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
          Todos <span className="count">{rascunhos.length}</span>
        </button>
        {TYPES.map((t) => {
          const active = filterType === t.value
          return (
            <button
              key={t.value}
              className={`btn-filter ${active ? 'active' : ''}`}
              style={active ? { background: t.color + '33', borderColor: t.color, color: t.color } : {}}
              onClick={() => setFilterType(t.value)}
            >
              <span className="filter-dot" style={{ background: t.color }} />
              {t.label} <span className="count">{rascunhos.filter((r) => r.type === t.value).length}</span>
            </button>
          )
        })}
      </div>

      {!loaded ? (
        <p className="empty-state">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <p>{`Nenhum rascunho pra "${search}".`}</p>
          ) : filterType !== 'all' ? (
            <>
              <p>Nenhum rascunho do tipo {TYPES.find((t) => t.value === filterType)?.label} ainda.</p>
              <button className="btn-secondary" onClick={() => setFilterType('all')}>Ver todos</button>
            </>
          ) : (
            <>
              <p>Nenhuma ideia guardada ainda. Letra, riff, estrutura — anota aqui antes que fuja.</p>
              <button className="btn-primary" onClick={() => setModal('add')}>Criar primeiro rascunho</button>
            </>
          )}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((r) => (
            <RascunhoCard key={r.id} r={r} onEdit={setModal} />
          ))}
        </div>
      )}

      {modal && (
        <RascunhoModal
          rascunho={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onRemove={modal !== 'add' ? () => { remove(modal); setModal(null) } : undefined}
        />
      )}
    </div>
  )
}
