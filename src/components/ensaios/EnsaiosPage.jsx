import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import EnsaioModal from './EnsaioModal'

function formatDate(ts, opts = {}) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
    ...opts
  })
}

function formatDateShort(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
}

function relativeLabel(ts) {
  if (!ts) return ''
  const d   = ts.toDate ? ts.toDate() : new Date(ts)
  const now  = new Date()
  const days = Math.round((d - now) / 86400000)
  if (days === 0) return 'Hoje!'
  if (days === 1) return 'Amanhã'
  if (days > 0)  return `em ${days} dias`
  return `${Math.abs(days)} dias atrás`
}

function isPast(ts) {
  if (!ts) return false
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d < new Date()
}

// ── Card expandível ───────────────────────────────────────────────────

function EnsaioRow({ ensaio, onEdit, onRemove, onTogglePauta }) {
  const [open, setOpen] = useState(false)
  const hasPauta   = ensaio.pauta?.length > 0
  const hasMembers = ensaio.members?.length > 0
  const hasNotes   = !!ensaio.notes

  return (
    <div className={`ensaio-row ${open ? 'open' : ''}`}>
      <div className="ensaio-row-header" onClick={() => setOpen(!open)}>
        <div className="ensaio-row-left">
          <span className="ensaio-row-date">{formatDateShort(ensaio.date)}</span>
          {ensaio.location && <span className="ensaio-row-loc">· {ensaio.location}</span>}
        </div>
        <div className="ensaio-row-right">
          {hasMembers && (
            <span className="ensaio-row-members">👥 {ensaio.members.length}</span>
          )}
          <span className={`ensaio-row-arrow ${open ? 'up' : ''}`}>›</span>
        </div>
      </div>

      {open && (
        <div className="ensaio-row-body">
          {hasPauta && (
            <div className="pauta-block">
              <p className="section-label">Pauta</p>
              {ensaio.pauta.map((item, i) => (
                <label key={i} className="pauta-item">
                  <input type="checkbox" checked={!!item.done} onChange={() => onTogglePauta(ensaio, i)} />
                  <span className={item.done ? 'done' : ''}>{item.text}</span>
                </label>
              ))}
            </div>
          )}

          {hasMembers && (
            <div style={{ marginTop: hasPauta ? 10 : 0 }}>
              <p className="section-label">Membros</p>
              <div className="members-tags">
                {ensaio.members.map((m, i) => <span key={i} className="member-tag">{m}</span>)}
              </div>
            </div>
          )}

          {hasNotes && (
            <div style={{ marginTop: 10 }}>
              <p className="section-label">Observações</p>
              <p className="ensaio-notes">{ensaio.notes}</p>
            </div>
          )}

          <div className="ensaio-row-actions">
            <button className="btn-secondary" onClick={() => onEdit(ensaio)}>Editar</button>
            <button className="btn-ghost-danger" onClick={() => onRemove(ensaio)}>Remover</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card destaque — próximo ensaio ────────────────────────────────────

function NextEnsaioCard({ ensaio, onEdit }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="next-ensaio-card">
      <div className="next-ensaio-top">
        <div>
          <p className="next-ensaio-label">Próximo ensaio</p>
          <p className="next-ensaio-date">{formatDate(ensaio.date)}</p>
          {ensaio.location && <p className="next-ensaio-loc">📍 {ensaio.location}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="next-ensaio-relative">{relativeLabel(ensaio.date)}</span>
          {ensaio.members?.length > 0 && (
            <p className="next-ensaio-members">👥 {ensaio.members.length} membros</p>
          )}
        </div>
      </div>

      {ensaio.pauta?.length > 0 && (
        <>
          <button className="btn-ghost" style={{ fontSize: '0.78rem', marginTop: 10 }} onClick={() => setOpen(!open)}>
            {open ? '▲ Fechar pauta' : `▼ Ver pauta (${ensaio.pauta.length} itens)`}
          </button>
          {open && (
            <div className="pauta-block" style={{ marginTop: 8 }}>
              {ensaio.pauta.map((item, i) => (
                <label key={i} className="pauta-item">
                  <input type="checkbox" checked={!!item.done} readOnly />
                  <span className={item.done ? 'done' : ''}>{item.text}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}

      <button className="btn-secondary" style={{ marginTop: 12, fontSize: '0.8rem' }} onClick={() => onEdit(ensaio)}>
        Editar
      </button>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────

const TABS = [
  { key: 'proximos',   label: 'Próximos' },
  { key: 'realizados', label: 'Realizados' },
  { key: 'cancelados', label: 'Cancelados' },
]

export default function EnsaiosPage() {
  const [ensaios, setEnsaios] = useState([])
  const [modal, setModal]     = useState(null)
  const [tab, setTab]         = useState('proximos')

  useEffect(() => {
    const q = query(collection(db, 'ensaios'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  const remove = (e) => {
    if (confirm(`Remover ensaio de ${formatDate(e.date)}?`)) deleteDoc(doc(db, 'ensaios', e.id))
  }

  const togglePauta = async (ensaio, index) => {
    const pauta = [...(ensaio.pauta || [])]
    pauta[index] = { ...pauta[index], done: !pauta[index].done }
    await updateDoc(doc(db, 'ensaios', ensaio.id), { pauta })
  }

  // Separa por categoria
  const futuros    = ensaios.filter(e => !isPast(e.date) && e.status !== 'cancelado')
  const realizados = ensaios.filter(e =>  isPast(e.date) && e.status !== 'cancelado').reverse()
  const cancelados = ensaios.filter(e => e.status === 'cancelado')

  const nextEnsaio = futuros[0] || null
  const restantes  = futuros.slice(1)

  const counts = { proximos: futuros.length, realizados: realizados.length, cancelados: cancelados.length }

  const listForTab = tab === 'proximos' ? restantes : tab === 'realizados' ? realizados : cancelados

  return (
    <div className="page">
      <div className="page-header">
        <h2>Ensaios</h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Ensaio</button>
      </div>

      {/* Tabs */}
      <div className="filter-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`btn-filter ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="count">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      {/* Aba Próximos */}
      {tab === 'proximos' && (
        <>
          {nextEnsaio
            ? <NextEnsaioCard ensaio={nextEnsaio} onEdit={setModal} />
            : (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <p>Nenhum ensaio planejado.</p>
                <button className="btn-primary" onClick={() => setModal('add')}>Agendar ensaio</button>
              </div>
            )
          }

          {restantes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="section-label" style={{ marginBottom: 8 }}>Próximos ensaios</p>
              <div className="ensaio-list">
                {restantes.map(e => (
                  <EnsaioRow
                    key={e.id}
                    ensaio={e}
                    onEdit={setModal}
                    onRemove={remove}
                    onTogglePauta={togglePauta}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Aba Realizados / Cancelados */}
      {tab !== 'proximos' && (
        <>
          {listForTab.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 12 }}>
              <p>Nenhum ensaio {tab === 'realizados' ? 'realizado' : 'cancelado'} aqui.</p>
            </div>
          ) : (
            <div className="ensaio-list" style={{ marginTop: 8 }}>
              {listForTab.map(e => (
                <EnsaioRow
                  key={e.id}
                  ensaio={e}
                  onEdit={setModal}
                  onRemove={remove}
                  onTogglePauta={togglePauta}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modal && <EnsaioModal ensaio={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
