import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, orderBy, query,
  addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const OPINIONS = [
  { value: 'hino',     label: '⚡ Hino',                      color: '#facc15', bg: 'rgba(250,204,21,0.12)' },
  { value: 'escopo',   label: '✓ Entra no escopo',           color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ajustar',  label: '~ Ajustar pro nosso estilo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'fora',     label: '✕ Não faz sentido',           color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'nao_gosto',label: '– Não curti',                 color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
]

// opinoes é um mapa { [userId]: { userName, opinion, comment, at } }
// Isso garante 1 voto por usuário — sobrescreve se votar de novo
function opinoesArray(opinoes) {
  return Object.entries(opinoes || {}).map(([uid, data]) => ({ userId: uid, ...data }))
}

function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/)
  return match ? match[1] : null
}

function YouTubeThumbnail({ url, title }) {
  const id = getYouTubeId(url)
  if (!id) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" className="yt-thumb-wrap" title="Abrir no YouTube">
      <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={title} className="yt-thumb" />
      <div className="yt-play-icon">▶</div>
    </a>
  )
}

function OpinionSummary({ opinoes }) {
  const list = opinoesArray(opinoes)
  return (
    <div className="opinion-summary">
      {OPINIONS.map((o) => {
        const count = list.filter((x) => x.opinion === o.value).length
        if (!count) return null
        return (
          <span key={o.value} className="opinion-pill" style={{ color: o.color, background: o.bg }}>
            {o.label.split(' ')[0]} {count}
          </span>
        )
      })}
    </div>
  )
}

function SugestaoModal({ sugestao, onClose, isAdmin, userId, userName }) {
  const [myOpinion, setMyOpinion] = useState(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(sugestao.notes || '')
  const ref = doc(db, 'sugestoes', sugestao.id)

  const list = opinoesArray(sugestao.opinoes)
  const existing = (sugestao.opinoes || {})[userId]

  const saveNotes = async () => {
    await updateDoc(ref, { notes: notes.trim() })
    setEditingNotes(false)
  }

  const submitOpinion = async () => {
    if (!myOpinion) return
    setSaving(true)
    // Chave é o userId — sobrescreve automaticamente opinião anterior
    await updateDoc(ref, {
      [`opinoes.${userId}`]: {
        userName,
        opinion: myOpinion,
        comment: comment.trim(),
        at: new Date().toISOString(),
      },
    })
    setSaving(false)
    setMyOpinion(null)
    setComment('')
  }

  const approve = async () => {
    if (!confirm(`Aprovar "${sugestao.title}" e mover pro setlist como "Ensaiando"?`)) return
    await addDoc(collection(db, 'songs'), {
      title: sugestao.title,
      artist: sugestao.artist || '',
      videoUrl: sugestao.videoUrl || '',
      status: 'ensaiando',
      notes: sugestao.notes || `Aprovada da sugestão de ${sugestao.suggestedBy}`,
      order: Date.now(),
      createdAt: serverTimestamp(),
    })
    await updateDoc(ref, { status: 'aprovada' })
    onClose()
  }

  const reject = async () => {
    if (!confirm(`Rejeitar a sugestão "${sugestao.title}"?`)) return
    await updateDoc(ref, { status: 'rejeitada' })
    onClose()
  }

  const reopen = () => updateDoc(ref, { status: 'aberta' })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <div>
            <h2 style={{ marginBottom: 2 }}>{sugestao.title}</h2>
            {sugestao.artist && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{sugestao.artist}</p>}
          </div>
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>

        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Sugerida por <strong>{sugestao.suggestedBy}</strong>
        </p>

        {sugestao.videoUrl && <YouTubeThumbnail url={sugestao.videoUrl} title={sugestao.title} />}

        {sugestao.description && (
          <p className="sug-description">{sugestao.description}</p>
        )}

        {/* Observações da banda — editável por qualquer membro */}
        {editingNotes ? (
          <div className="notes-edit" style={{ marginBottom: 12 }}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus placeholder="Observações da banda..." />
            <div className="notes-actions">
              <button className="btn-secondary" onClick={() => setEditingNotes(false)}>Cancelar</button>
              <button className="btn-primary" onClick={saveNotes}>Salvar</button>
            </div>
          </div>
        ) : (
          <p className="song-notes" style={{ marginBottom: 12 }} onClick={() => { setNotes(sugestao.notes || ''); setEditingNotes(true) }}>
            {sugestao.notes || <span className="placeholder">Clique para adicionar observações...</span>}
          </p>
        )}

        {sugestao.status !== 'aberta' && (
          <div className={`sug-status-banner sug-${sugestao.status}`}>
            {sugestao.status === 'aprovada' ? '✓ Aprovada — adicionada ao setlist' : '✕ Rejeitada'}
            {isAdmin && <button className="btn-reopen" onClick={reopen}>Reabrir</button>}
          </div>
        )}

        {list.length > 0 && (
          <div className="opinions-list">
            <p className="section-label">Opiniões da banda ({list.length})</p>
            {list.map((o, i) => {
              const op = OPINIONS.find((x) => x.value === o.opinion)
              return (
                <div key={i} className="opinion-item">
                  <div className="opinion-item-header">
                    <strong>{o.userName}</strong>
                    <span className="opinion-badge" style={{ color: op?.color, background: op?.bg }}>{op?.label}</span>
                  </div>
                  {o.comment && <p className="opinion-comment">{o.comment}</p>}
                </div>
              )
            })}
          </div>
        )}

        {sugestao.status === 'aberta' && (
          <div className="opinion-form">
            <p className="section-label">{existing ? 'Alterar minha opinião' : 'Deixar minha opinião'}</p>
            {existing && (
              <p className="existing-vote">
                Sua opinião atual:{' '}
                <span style={{ color: OPINIONS.find((o) => o.value === existing.opinion)?.color }}>
                  {OPINIONS.find((o) => o.value === existing.opinion)?.label}
                </span>
              </p>
            )}
            <div className="opinion-btns">
              {OPINIONS.map((o) => (
                <button
                  key={o.value}
                  className={`btn-opinion ${myOpinion === o.value ? 'selected' : ''}`}
                  style={myOpinion === o.value ? { background: o.bg, borderColor: o.color, color: o.color } : {}}
                  onClick={() => setMyOpinion(myOpinion === o.value ? null : o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {myOpinion && (
              <>
                <textarea
                  className="opinion-comment-input"
                  placeholder="Considerações (opcional)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <button className="btn-primary" onClick={submitOpinion} disabled={saving}>
                  {saving ? 'Enviando...' : existing ? 'Atualizar opinião' : 'Enviar opinião'}
                </button>
              </>
            )}
          </div>
        )}

        {isAdmin && sugestao.status === 'aberta' && (
          <div className="admin-controls">
            <p className="section-label">Decisão final</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-approve" onClick={approve}>✓ Aprovar e mover pro setlist</button>
              <button className="btn-reject" onClick={reject}>✕ Rejeitar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddSugestaoModal({ onClose, userId, userName }) {
  const [form, setForm] = useState({ title: '', artist: '', videoUrl: '', description: '' })
  const [saving, setSaving] = useState(false)
  const videoId = getYouTubeId(form.videoUrl)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await addDoc(collection(db, 'sugestoes'), {
      ...form,
      status: 'aberta',
      opinoes: {},
      suggestedBy: userName,
      suggestedById: userId,
      createdAt: serverTimestamp(),
    })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>Nova Sugestão</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Música *<input name="title" value={form.title} onChange={handleChange} placeholder="Nome da música" autoFocus /></label>
            <label>Artista<input name="artist" value={form.artist} onChange={handleChange} placeholder="Banda / Artista" /></label>
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
            Por que sugere essa música?
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Contexto, referência, o que acha legal..." />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enviando...' : 'Sugerir'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FILTERS = [
  { value: 'all',       label: 'Todas' },
  { value: 'aberta',    label: 'Em aberto' },
  { value: 'aprovada',  label: 'Aprovadas' },
  { value: 'rejeitada', label: 'Rejeitadas' },
]

const SORTS = [
  { value: 'score',  label: '⭐ Pontuação' },
  { value: 'votes',  label: '🗳 Votos' },
  { value: 'recent', label: '🕐 Recentes' },
]

// ── Pontuação por tipo de opinião ─────────────────────────────────────
const SCORES = { hino: 1.2, escopo: 1, ajustar: 0.6, fora: 0.2, nao_gosto: 0 }

// Labels com score para as células da planilha (ex: "1 - Escopo")
const SCORE_LABELS_XLS = {
  hino:      '1,2 - Hino',
  escopo:    '1 - Escopo',
  ajustar:   '0,6 - Ajustar',
  fora:      '0,2 - Fora',
  nao_gosto: '0 - Não curti',
}

const STATUS_LABELS_XLS = {
  aberta:    'Em aberto',
  aprovada:  'Aprovada',
  rejeitada: 'Rejeitada',
}

/** Calcula pontuação de uma sugestão */
function calcSongScore(opinoes) {
  const list = Object.values(opinoes || {})
  if (!list.length) return { soma: 0, media: 0, total: 0 }
  const soma = list.reduce((acc, v) => acc + (SCORES[v.opinion] ?? 0), 0)
  const rounded = (n) => Math.round(n * 100) / 100
  return { soma: rounded(soma), media: rounded(soma / list.length), total: list.length }
}

function exportToExcel(sugestoes, filterLabel) {
  // ── 1. Ordena por pontuação decrescente para o ranking ──
  const sorted = [...sugestoes].sort((a, b) => {
    const sa = calcSongScore(a.opinoes)
    const sb = calcSongScore(b.opinoes)
    return sb.soma - sa.soma || sb.total - sa.total
  })

  // ── 2. Coleta membros únicos (ordem: mais votantes primeiro) ──
  const memberFreq = {}
  sorted.forEach((s) => {
    Object.values(s.opinoes || {}).forEach((v) => {
      if (v.userName) memberFreq[v.userName] = (memberFreq[v.userName] || 0) + 1
    })
  })
  const members = Object.entries(memberFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  // ── 3. Cabeçalho ──
  const header = [
    '#',
    'Título',
    'Artista',
    'Total Votos',
    'Soma',
    'Média',
    ...members,
    'Status',
    'YouTube',
    'Sugerida por',
  ]

  // ── 4. Linhas de dados ──
  const rows = sorted.map((s, i) => {
    const { soma, media, total } = calcSongScore(s.opinoes)

    // userName → label com score (ex: "1 - Escopo")
    const byName = {}
    Object.values(s.opinoes || {}).forEach((v) => {
      if (!v.userName) return
      const label = SCORE_LABELS_XLS[v.opinion] || v.opinion
      byName[v.userName] = v.comment ? `${label}\n"${v.comment}"` : label
    })

    return [
      i + 1,
      s.title || '',
      s.artist || '',
      total,
      soma,
      media,
      ...members.map((m) => byName[m] || ''),
      STATUS_LABELS_XLS[s.status] || s.status,
      s.videoUrl || '',
      s.suggestedBy || '',
    ]
  })

  // ── 5. Monta a planilha ──
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])

  // Congela a primeira linha
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' }

  // Largura das colunas
  ws['!cols'] = [
    { wch: 4 },   // #
    { wch: 30 },  // Título
    { wch: 20 },  // Artista
    { wch: 12 },  // Total Votos
    { wch: 8 },   // Soma
    { wch: 7 },   // Média
    ...members.map(() => ({ wch: 18 })),
    { wch: 12 },  // Status
    { wch: 44 },  // YouTube
    { wch: 18 },  // Sugerida por
  ]

  const sheetName = `Sugestões ${filterLabel}`.slice(0, 31)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // ── 6. Download ──
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  XLSX.writeFile(wb, `thestryx-sugestoes-${dateStr}.xlsx`)
}

export default function SugestoesPage() {
  const { user } = useAuth()
  const [sugestoes, setSugestoes] = useState([])
  const [filter, setFilter] = useState('aberta')
  const [sortBy, setSortBy] = useState('score')
  const [modal, setModal] = useState(null)
  const [addModal, setAddModal] = useState(false)

  const isAdmin = user.email === ADMIN_EMAIL

  useEffect(() => {
    const q = query(collection(db, 'sugestoes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  // Atualiza o modal com dados frescos do Firestore
  useEffect(() => {
    if (!modal || modal === 'add') return
    const fresh = sugestoes.find((s) => s.id === modal.id)
    if (fresh) setModal(fresh)
  }, [sugestoes])

  const filtered = filter === 'all' ? sugestoes : sugestoes.filter((s) => s.status === filter)
  const pendingCount = sugestoes.filter((s) => s.status === 'aberta').length

  // ── Ordenação ──────────────────────────────────────────────────────
  const displayed = [...filtered].sort((a, b) => {
    if (sortBy === 'score') {
      const sa = calcSongScore(a.opinoes)
      const sb = calcSongScore(b.opinoes)
      return sb.soma - sa.soma || sb.total - sa.total
    }
    if (sortBy === 'votes') {
      const ta = Object.keys(a.opinoes || {}).length
      const tb = Object.keys(b.opinoes || {}).length
      return tb - ta || calcSongScore(b.opinoes).soma - calcSongScore(a.opinoes).soma
    }
    // 'recent' — já vem do Firestore por createdAt desc, mantém ordem original
    return 0
  })

  const currentFilterLabel = FILTERS.find((f) => f.value === filter)?.label || ''

  const handleExport = () => {
    if (filtered.length === 0) return
    exportToExcel(filtered, currentFilterLabel)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          Sugestões
          {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && filtered.length > 0 && (
            <button className="btn-secondary" onClick={handleExport} title="Exportar para Excel">
              📊 Exportar
            </button>
          )}
          <button className="btn-primary" onClick={() => setAddModal(true)}>+ Sugerir</button>
        </div>
      </div>

      {/* Filtros de status */}
      <div className="filter-bar">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? sugestoes.length : sugestoes.filter((s) => s.status === f.value).length
          return (
            <button key={f.value} className={`btn-filter ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label} <span className="count">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Ordenação */}
      <div className="sort-bar">
        <span className="sort-label">Ordenar:</span>
        {SORTS.map((s) => (
          <button
            key={s.value}
            className={`btn-sort ${sortBy === s.value ? 'active' : ''}`}
            onClick={() => setSortBy(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="empty-state">
          <p>{filter === 'aberta' ? 'Nenhuma sugestão em aberto.' : 'Nenhuma sugestão aqui.'}</p>
          {filter !== 'rejeitada' && <button className="btn-primary" onClick={() => setAddModal(true)}>Fazer primeira sugestão</button>}
        </div>
      ) : (
        <div className="sug-list">
          {displayed.map((s, rank) => {
            const videoId = getYouTubeId(s.videoUrl)
            const myVote = (s.opinoes || {})[user.uid]
            const { soma, media, total } = calcSongScore(s.opinoes)
            const showScore = total > 0
            return (
              <div key={s.id} className={`sug-card sug-card-${s.status}`} onClick={() => setModal(s)}>
                {videoId && (
                  <div className="sug-thumb-wrap">
                    <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt={s.title} className="sug-thumb" />
                  </div>
                )}
                <div className="sug-card-body">
                  <div className="sug-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {sortBy === 'score' && showScore && (
                        <span className="sug-rank-badge">#{rank + 1}</span>
                      )}
                      <div>
                        <span className="sug-card-title">{s.title}</span>
                        {s.artist && <span className="sug-card-artist"> — {s.artist}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {showScore && (
                        <span className="sug-score-chip" title={`Soma: ${soma} · Média: ${media} · ${total} voto(s)`}>
                          ⭐ {soma.toFixed(1)} <span className="sug-score-avg">({media.toFixed(2)})</span>
                        </span>
                      )}
                      {s.status !== 'aberta' && (
                        <span className={`sug-status-tag sug-${s.status}`}>
                          {s.status === 'aprovada' ? '✓ Aprovada' : '✕ Rejeitada'}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="sug-card-by">por {s.suggestedBy}</p>
                  <OpinionSummary opinoes={s.opinoes} />
                  {myVote && (
                    <p className="my-vote-label">
                      Sua opinião:{' '}
                      <span style={{ color: OPINIONS.find((o) => o.value === myVote.opinion)?.color }}>
                        {OPINIONS.find((o) => o.value === myVote.opinion)?.label}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && modal !== 'add' && (
        <SugestaoModal
          sugestao={modal}
          onClose={() => setModal(null)}
          isAdmin={isAdmin}
          userId={user.uid}
          userName={user.displayName}
        />
      )}
      {addModal && (
        <AddSugestaoModal
          onClose={() => setAddModal(false)}
          userId={user.uid}
          userName={user.displayName}
        />
      )}
    </div>
  )
}
