import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { firstName } from '../../utils/members'
import { PRESENCAS, splitPresenca } from '../../utils/presenca'
import EnsaioModal from './EnsaioModal'
import PerformanceMode from './PerformanceMode'

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

// ── Presença ──────────────────────────────────────────────────────────

// Cada um responde pela própria presença. Clicar de novo na mesma resposta
// desfaz, igual aos votos de dificuldade
function PresencaBar({ ensaio, uid, userName }) {
  const meu = (ensaio.presenca || {})[uid]?.status

  const responder = (status) => {
    const ref = doc(db, 'ensaios', ensaio.id)
    if (meu === status) {
      updateDoc(ref, { [`presenca.${uid}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`presenca.${uid}`]: { status, name: userName, at: new Date().toISOString() },
      })
    }
  }

  return (
    <div className="presenca-bar" onClick={(e) => e.stopPropagation()}>
      <span className="section-label">Você vai?</span>
      {PRESENCAS.map((p) => (
        <button
          key={p.value}
          className={`btn-presenca ${meu === p.value ? 'active' : ''}`}
          style={meu === p.value ? { background: p.bg, borderColor: p.color, color: p.color } : {}}
          onClick={() => responder(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function PresencaResumo({ ensaio, bandMembers }) {
  const { vao, nao, pendentes, convidados } = splitPresenca(ensaio, bandMembers)
  if (!bandMembers.length) return null

  const linha = (titulo, lista, cor) => lista.length > 0 && (
    <div className="presenca-linha">
      <span className="presenca-linha-titulo" style={{ color: cor }}>{titulo} ({lista.length})</span>
      <div className="members-tags">
        {lista.map((m) => (
          <span key={m.name} className="member-tag" style={{ borderColor: cor, color: cor }} title={m.name}>
            {firstName(m.name)}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="presenca-resumo">
      {linha('Vão', vao, PRESENCAS[0].color)}
      {linha('Não vão', nao, PRESENCAS[1].color)}
      {linha('Sem resposta', pendentes, 'var(--text-muted)')}
      {convidados.length > 0 && (
        <div className="presenca-linha">
          <span className="presenca-linha-titulo">Convidados ({convidados.length})</span>
          <div className="members-tags">
            {convidados.map((n) => <span key={n} className="member-tag" title={n}>{firstName(n)}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }) {
  const isShow = type === 'apresentacao'
  return (
    <span className={`event-type-badge ${isShow ? 'apresentacao' : ''}`}>
      {isShow ? '🎤 Apresentação' : '🎸 Ensaio'}
    </span>
  )
}

// ── Card expandível ───────────────────────────────────────────────────

function EnsaioRow({ ensaio, onEdit, onRemove, onTogglePauta, onPerform, bandMembers, user }) {
  const [open, setOpen] = useState(false)
  const hasPauta   = ensaio.pauta?.length > 0
  const { vao, nao } = splitPresenca(ensaio, bandMembers)
  const hasNotes   = !!ensaio.notes
  const hasSetlist = ensaio.setlist?.length > 0

  return (
    <div className={`ensaio-row ${open ? 'open' : ''}`}>
      <div className="ensaio-row-header" onClick={() => setOpen(!open)}>
        <div className="ensaio-row-left">
          <span className="ensaio-row-date">{formatDateShort(ensaio.date)}</span>
          <TypeBadge type={ensaio.type} />
          {ensaio.location && <span className="ensaio-row-loc">· {ensaio.location}</span>}
        </div>
        <div className="ensaio-row-right">
          {hasSetlist && <span className="ensaio-row-members">🎵 {ensaio.setlist.length}</span>}
          {vao.length > 0 && <span className="ensaio-row-members presenca-vai">✓ {vao.length}</span>}
          {nao.length > 0 && <span className="ensaio-row-members presenca-nao">✕ {nao.length}</span>}
          <span className={`ensaio-row-arrow ${open ? 'up' : ''}`}>›</span>
        </div>
      </div>

      {open && (
        <div className="ensaio-row-body">
          {hasSetlist && (
            <div className="pauta-block">
              <p className="section-label">Músicas ({ensaio.setlist.length})</p>
              <ol className="event-songs-list">
                {ensaio.setlist.map((s, i) => (
                  <li key={i}>
                    {s.title}
                    {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                    {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {hasPauta && (
            <div className="pauta-block" style={{ marginTop: hasSetlist ? 10 : 0 }}>
              <p className="section-label">Pauta</p>
              {ensaio.pauta.map((item, i) => (
                <label key={i} className="pauta-item">
                  <input type="checkbox" checked={!!item.done} onChange={() => onTogglePauta(ensaio, i)} />
                  <span className={item.done ? 'done' : ''}>{item.text}</span>
                </label>
              ))}
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <PresencaBar ensaio={ensaio} uid={user.uid} userName={user.displayName || user.email} />
            <PresencaResumo ensaio={ensaio} bandMembers={bandMembers} />
          </div>

          {hasNotes && (
            <div style={{ marginTop: 10 }}>
              <p className="section-label">Observações</p>
              <p className="ensaio-notes">{ensaio.notes}</p>
            </div>
          )}

          <div className="ensaio-row-actions">
            {hasSetlist && (
              <button className="btn-primary" onClick={() => onPerform(ensaio)}>🎤 Modo palco</button>
            )}
            <button className="btn-secondary" onClick={() => onEdit(ensaio)}>Editar</button>
            <button className="btn-ghost-danger" onClick={() => onRemove(ensaio)}>Remover</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card destaque — próximo evento ────────────────────────────────────

function NextEnsaioCard({ ensaio, onEdit, onPerform, bandMembers, user }) {
  const [open, setOpen] = useState(false)
  const hasSetlist = ensaio.setlist?.length > 0

  return (
    <div className={`next-ensaio-card ${ensaio.type === 'apresentacao' ? 'apresentacao' : ''}`}>
      <div className="next-ensaio-top">
        <div>
          <p className="next-ensaio-label">
            {ensaio.type === 'apresentacao' ? '🎤 Próxima apresentação' : '🎸 Próximo ensaio'}
          </p>
          <p className="next-ensaio-date">{formatDate(ensaio.date)}</p>
          {ensaio.location && <p className="next-ensaio-loc">📍 {ensaio.location}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="next-ensaio-relative">{relativeLabel(ensaio.date)}</span>
          {splitPresenca(ensaio, bandMembers).vao.length > 0 && (
            <p className="next-ensaio-members presenca-vai">
              ✓ {splitPresenca(ensaio, bandMembers).vao.length} confirmados
            </p>
          )}
          {hasSetlist && (
            <p className="next-ensaio-members">🎵 {ensaio.setlist.length} músicas</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <PresencaBar ensaio={ensaio} uid={user.uid} userName={user.displayName || user.email} />
        <PresencaResumo ensaio={ensaio} bandMembers={bandMembers} />
      </div>

      {hasSetlist && open && (
        <div className="pauta-block" style={{ marginTop: 10 }}>
          <ol className="event-songs-list">
            {ensaio.setlist.map((s, i) => (
              <li key={i}>
                {s.title}
                {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {ensaio.pauta?.length > 0 && open && (
        <div className="pauta-block" style={{ marginTop: 8 }}>
          <p className="section-label">Pauta</p>
          {ensaio.pauta.map((item, i) => (
            <label key={i} className="pauta-item">
              <input type="checkbox" checked={!!item.done} readOnly />
              <span className={item.done ? 'done' : ''}>{item.text}</span>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {hasSetlist && (
          <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => onPerform(ensaio)}>
            🎤 Modo palco
          </button>
        )}
        {(hasSetlist || ensaio.pauta?.length > 0) && (
          <button className="btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setOpen(!open)}>
            {open ? '▲ Fechar detalhes' : '▼ Ver detalhes'}
          </button>
        )}
        <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => onEdit(ensaio)}>
          Editar
        </button>
      </div>
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
  const { user } = useAuth()
  const [ensaios, setEnsaios] = useState([])
  const [bandMembers, setBandMembers] = useState([])
  const [modal, setModal]     = useState(null)
  const [tab, setTab]         = useState('proximos')
  const [performing, setPerforming] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'ensaios'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, (snap) => setBandMembers(snap.docs.map((d) => ({
      name: d.data().name,
      firebaseUid: d.data().firebaseUid || null,
    }))))
  }, [])

  const remove = (e) => {
    if (confirm(`Remover evento de ${formatDate(e.date)}?`)) deleteDoc(doc(db, 'ensaios', e.id))
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
        <h2>Eventos</h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Evento</button>
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
            ? <NextEnsaioCard ensaio={nextEnsaio} onEdit={setModal} onPerform={setPerforming} bandMembers={bandMembers} user={user} />
            : (
              <div className="empty-state" style={{ marginTop: 12 }}>
                <p>Nenhum evento planejado.</p>
                <button className="btn-primary" onClick={() => setModal('add')}>Agendar evento</button>
              </div>
            )
          }

          {restantes.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="section-label" style={{ marginBottom: 8 }}>Próximos eventos</p>
              <div className="ensaio-list">
                {restantes.map(e => (
                  <EnsaioRow
                    key={e.id}
                    ensaio={e}
                    onEdit={setModal}
                    onRemove={remove}
                    onTogglePauta={togglePauta}
                    onPerform={setPerforming}
                    bandMembers={bandMembers}
                    user={user}
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
              <p>Nenhum evento {tab === 'realizados' ? 'realizado' : 'cancelado'} aqui.</p>
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
                  onPerform={setPerforming}
                  bandMembers={bandMembers}
                  user={user}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modal && <EnsaioModal ensaio={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
      {performing && <PerformanceMode event={performing} onClose={() => setPerforming(null)} />}
    </div>
  )
}
