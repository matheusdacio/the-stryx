import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query,
  addDoc, updateDoc, doc, serverTimestamp, deleteField
} from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import SearchLupa from '../SearchLupa'
import MusicLookup from '../MusicLookup'
import VideoInline from '../VideoInline'
import { buscaTomAtiva } from '../../utils/lookup'
import { matchesSearch } from '../../utils/search'
import { OPINIONS, calcSongScore, chaveMusica } from '../../utils/score'
import { checarDuplicata, mensagemBloqueio } from '../../utils/duplicata'
import { DIFFICULTIES, calcDifficulty, difficultyByWeight } from '../../utils/dificuldade'
import { estaRejeitada, temVeto, todosVotaram, quemFalta } from '../../utils/rejeicao'
import { faltaVotar, countSugestoesPendentes } from '../../utils/pendencias'
import { getYouTubeId } from '../../utils/youtube'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'


const firstName = (n) => (n || '').trim().split(' ')[0]

// opinoes é um mapa { [userId]: { userName, opinion, comment, at } }
// Isso garante 1 voto por usuário — sobrescreve se votar de novo
function opinoesArray(opinoes) {
  return Object.entries(opinoes || {}).map(([uid, data]) => ({ userId: uid, ...data }))
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

function SugestaoModal({ sugestao, onClose, isAdmin, userId, userName, bandMembers }) {
  const [myOpinion, setMyOpinion] = useState(null)
  // Inicializador preguiçoso: sem isso o textarea sempre nascia vazio, mesmo
  // reabrindo uma sugestão em que a pessoa já tinha deixado um comentário
  const [comment, setComment] = useState(() => (sugestao.opinoes || {})[userId]?.comment || '')
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

  // Voto de dificuldade (mapa keyed por uid)
  const dificuldade = sugestao.dificuldade || {}
  const myDiff = dificuldade[userId]?.level
  const voteDiff = (level) => {
    if (myDiff === level) {
      updateDoc(ref, { [`dificuldade.${userId}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`dificuldade.${userId}`]: { userName, level, at: new Date().toISOString() },
      })
    }
  }

  const submitOpinion = () => {
    if (!myOpinion) return
    setSaving(true)
    // Chave é o userId — sobrescreve automaticamente opinião anterior
    const voto = { userName, opinion: myOpinion, comment: comment.trim(), at: new Date().toISOString() }
    const opinoesDepois = { ...(sugestao.opinoes || {}), [userId]: voto }
    const update = { [`opinoes.${userId}`]: voto }

    // Grava a rejeição no momento em que o último voto fecha com veto — sem
    // isso ela era só calculada na hora (estaRejeitada), e o badge do
    // rodapé, a planilha exportada e a lista divergiam entre si
    if (todosVotaram({ opinoes: opinoesDepois }, bandMembers) && temVeto({ opinoes: opinoesDepois })) {
      update.status = 'rejeitada'
      update.rejeitadaPor = 'veto'
    }

    // Não espera o servidor confirmar: sem sinal, o await de updateDoc fica
    // pendente indefinidamente (é assim que o SDK do Firestore funciona,
    // mesmo com cache persistente) e o botão ficava preso em "Enviando..."
    updateDoc(ref, update).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
    setSaving(false)
    setMyOpinion(null)
    setComment('')
  }

  const approve = async () => {
    if (!confirm(`Enviar "${sugestao.title}" pro setlist?`)) return

    // Música nova entra crua pra todo mundo: ninguém ensaiou ainda. Cada um
    // muda o próprio voto no card do setlist quando pegar a música
    const dominio = {}
    bandMembers.forEach((m) => {
      if (!m.firebaseUid) return
      dominio[m.firebaseUid] = { userName: m.name, level: 'crua', at: new Date().toISOString(), seeded: true }
    })

    await addDoc(collection(db, 'songs'), {
      dominio: { ...dominio, ...(sugestao.dominio || {}) },
      title: sugestao.title,
      artist: sugestao.artist || '',
      videoUrl: sugestao.videoUrl || '',
      status: 'ensaiando',
      notes: sugestao.notes || `Aprovada da sugestão de ${sugestao.suggestedBy}`,
      tom: sugestao.tom || '',
      bpm: sugestao.bpm || null,
      tags: sugestao.tags || [],
      // Escala única desde 80191d4: não precisa converter, só copiar
      dificuldade: sugestao.dificuldade || {},
      // Guarda o vínculo pra poder reabrir esta mesma sugestão se a música voltar
      sugestaoId: sugestao.id,
      order: Date.now(),
      createdAt: serverTimestamp(),
    })
    await updateDoc(ref, { status: 'aprovada' })
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

        {sugestao.videoUrl && <VideoInline url={sugestao.videoUrl} title={sugestao.title} />}

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

        {/* Dificuldade pra tocar */}
        <div className="difficulty-section" style={{ marginBottom: 12 }}>
          <p className="section-label">Dificuldade pra tocar</p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={`btn-diff ${myDiff === d.value ? 'active' : ''}`}
                style={myDiff === d.value ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
                aria-pressed={myDiff === d.value}
                onClick={() => voteDiff(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
          {Object.keys(dificuldade).length > 0 && (
            <div className="difficulty-summary">
              {DIFFICULTIES.map((d) => {
                const voters = Object.values(dificuldade).filter((v) => v.level === d.value)
                if (!voters.length) return null
                return (
                  <span key={d.value} className="diff-pill" style={{ color: d.color, background: d.bg }}>
                    {d.label}: {voters.map((v) => firstName(v.userName)).join(', ')}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {sugestao.status !== 'aberta' && (
          <div className={`sug-status-banner sug-${sugestao.status}`}>
            {sugestao.status === 'aprovada' ? '✓ Enviada pro setlist' : '✕ Rejeitada'}
            {isAdmin && <button className="btn-reopen" onClick={reopen}>Reabrir</button>}
          </div>
        )}

        {sugestao.status === 'aberta' && temVeto(sugestao) && (
          todosVotaram(sugestao, bandMembers) ? (
            <div className="sug-status-banner sug-rejeitada">
              ✕ Rejeitada — a banda toda opinou e alguém marcou "Não curti" ou "Não faz sentido"
            </div>
          ) : (
            <div className="sug-status-banner sug-veto-pendente">
              ⚠️ Tem veto, mas ainda falta gente votar — segue em aberto até todos opinarem.
              {' '}Faltam: {quemFalta(sugestao, bandMembers).map(firstName).join(', ')}
            </div>
          )
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

        {sugestao.status === 'aberta' && todosVotaram(sugestao, bandMembers) && (
          <p className="lookup-aviso">
            A banda toda já opinou — a votação desta música está encerrada.
          </p>
        )}

        {sugestao.status === 'aberta' && !todosVotaram(sugestao, bandMembers) && (
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
                  aria-pressed={myOpinion === o.value}
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
              <button className="btn-approve" onClick={approve}>➤ Enviar pro setlist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AddSugestaoModal({ onClose, userId, userName, acervo, onAbrirExistente }) {
  // tom e bpm não têm campo no formulário: vêm da busca automática quando
  // disponível e viajam pro setlist se a sugestão for aprovada
  const [form, setForm] = useState({ title: '', artist: '', videoUrl: '', description: '', tom: '', bpm: null })
  const [achado, setAchado] = useState(null)
  const [saving, setSaving] = useState(false)
  const videoId = getYouTubeId(form.videoUrl)

  // Trava o cadastro de música que já existe, e avisa quando só o título bate
  const duplicata = checarDuplicata(form.title, form.artist, acervo)
  const { bloqueio, parecidas } = duplicata

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  // Preenche com o que a busca trouxe, sem apagar o que a pessoa já escreveu
  const aplicarAchado = (dados) => {
    setForm((f) => ({
      ...f,
      title: dados.title || f.title,
      artist: f.artist.trim() || dados.artist || '',
      videoUrl: f.videoUrl.trim() || dados.videoUrl || '',
      tom: f.tom || dados.tom || '',
      bpm: f.bpm || dados.bpm || null,
    }))
    setAchado(dados)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || bloqueio) return
    setSaving(true)
    // Fecha na hora — não espera nenhuma das duas gravações. A fila de
    // notificação é só um "avise a banda" por trás, nunca deve travar quem
    // está sugerindo esperando o mesmo tempo que o processamento do lote
    addDoc(collection(db, 'sugestoes'), {
      ...form,
      status: 'aberta',
      opinoes: {},
      suggestedBy: userName,
      suggestedById: userId,
      createdAt: serverTimestamp(),
    }).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
    addDoc(collection(db, 'notification_queue'), {
      tipo: 'nova_sugestao',
      titulo: form.title.trim(),
      artista: form.artist?.trim() || '',
      suggestedBy: userName,
      suggestedById: userId,
      processado: false,
      criadoEm: serverTimestamp(),
    }).catch(() => {})
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>Nova Sugestão</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Música *<input name="title" value={form.title} onChange={handleChange} placeholder="Nome da música" autoFocus required /></label>
            <label>Artista<input name="artist" value={form.artist} onChange={handleChange} placeholder="Banda / Artista" /></label>
          </div>

          {bloqueio && (
            <p className="aviso-duplicata bloqueio">
              ⛔ {mensagemBloqueio(duplicata)}
              {bloqueio === 'sugestao' && (
                <button
                  type="button"
                  className="btn-link-inline"
                  onClick={() => onAbrirExistente(duplicata.sugestaoExistente)}
                >
                  Abrir essa
                </button>
              )}
            </p>
          )}
          {!bloqueio && parecidas?.length > 0 && (
            <p className="aviso-duplicata">
              ⚠️ Já existe algo parecido: {parecidas.join(' · ')} — confira o artista antes de sugerir.
            </p>
          )}

          <MusicLookup titulo={form.title} onPick={aplicarAchado} />
          {(achado?.tom || achado?.bpm) && (
            <p className="lookup-aviso">
              Da gravação original{achado.tom ? `, tom ${achado.tom}` : ''}{achado.bpm ? `, ${achado.bpm} BPM` : ''} — confira antes de confiar, a banda pode tocar em outro tom.
              {buscaTomAtiva && (
                <> Dados de <a href="https://getsongbpm.com" target="_blank" rel="noreferrer">GetSongBPM</a>.</>
              )}
            </p>
          )}
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
            <button type="submit" className="btn-primary" disabled={saving || !!bloqueio}>{saving ? 'Enviando...' : 'Sugerir'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FILTERS = [
  { value: 'all',       label: 'Todas' },
  { value: 'aberta',    label: 'Em aberto' },
  { value: 'rejeitada', label: 'Rejeitadas' },
]

const SORTS = [
  { value: 'balanceada',  label: '⚖️ Melhores e fáceis' },
  { value: 'media',       label: '⭐ Média' },
  { value: 'votes',       label: '🗳 Votos' },
  { value: 'dificuldade', label: '🎯 Dificuldade' },
  { value: 'recent',      label: '🕐 Recentes' },
]

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

// ── Nota combinada: média das opiniões com desconto por dificuldade ───
// Fácil não desconta nada, Ok e Difícil descontam progressivamente. A nota
// pesa mais que a dificuldade: uma música difícil precisa ser bem melhor
// avaliada pra passar na frente de uma fácil, mas entre notas parecidas a
// mais fácil sobe. Ajuste esses fatores se quiser a facilidade pesando mais.
const EASE_BY_WEIGHT = { 1: 1, 2: 0.85, 3: 0.7 }
const EASE_SEM_VOTO = EASE_BY_WEIGHT[2] // sem voto de dificuldade conta como Ok

/** Média das opiniões descontada pela dificuldade votada (a mais alta) */
function calcBalancedScore(opinoes, dificuldade) {
  const { media, soma, total } = calcSongScore(opinoes)
  const ease = EASE_BY_WEIGHT[calcDifficulty(dificuldade).max] ?? EASE_SEM_VOTO
  return { valor: media * ease, media, soma, total, ease }
}

function exportToExcel(sugestoes, filterLabel) {
  // ── 1. Ordena por média decrescente (desempate: mais votos) ──
  const sorted = [...sugestoes].sort((a, b) => {
    const sa = calcSongScore(a.opinoes)
    const sb = calcSongScore(b.opinoes)
    return sb.media - sa.media || sb.total - sa.total || sb.soma - sa.soma
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
  const [loaded, setLoaded] = useState(false)
  const [noSetlist, setNoSetlist] = useState({ ids: new Set(), chaves: new Set() })
  const [musicasSetlist, setMusicasSetlist] = useState([])
  const [bandMembers, setBandMembers] = useState([])
  const [searchParams, setSearchParams] = useSearchParams()
  // Push de sugestão nova chega com ?ordem=recentes&naovotei=1 — quem toca
  // no aviso cai já olhando a música anunciada, não no fim da lista padrão
  const [filter, setFilter] = useState(() => searchParams.get('naovotei') === '1' ? 'falta_meu_voto' : 'aberta')
  const [sortBy, setSortBy] = useState(() => searchParams.get('ordem') || 'balanceada')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [addModal, setAddModal] = useState(false)

  const isAdmin = user.email === ADMIN_EMAIL

  useEffect(() => {
    if (searchParams.size) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Quem já está no setlist não aparece mais aqui — o lugar dela agora é lá.
    // Casa pelo vínculo gravado na aprovação e, pras aprovadas antigas que não
    // têm esse vínculo, pelo título + artista normalizados
    return onSnapshot(collection(db, 'songs'), (snap) => {
      const ids = new Set()
      const chaves = new Set()
      snap.docs.forEach((d) => {
        const song = d.data()
        if (song.sugestaoId) ids.add(song.sugestaoId)
        chaves.add(chaveMusica(song.title, song.artist))
      })
      setNoSetlist({ ids, chaves })
      setMusicasSetlist(snap.docs.map((d) => ({ title: d.data().title, artist: d.data().artist || '' })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.map((d) => ({
        name: d.data().name,
        aliases: d.data().aliases || [],
        firebaseUid: d.data().firebaseUid || null,
      })))
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'sugestoes'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [])

  // Atualiza o modal com dados frescos do Firestore
  useEffect(() => {
    if (!modal || modal === 'add') return
    const fresh = sugestoes.find((s) => s.id === modal.id)
    if (fresh) setModal(fresh)
  }, [sugestoes])

  const visiveis = sugestoes.filter(
    (s) => !noSetlist.ids.has(s.id) && !noSetlist.chaves.has(chaveMusica(s.title, s.artist))
  )

  const noFiltro = (s) => {
    if (filter === 'all') return true
    if (filter === 'rejeitada') return estaRejeitada(s, bandMembers)
    if (filter === 'falta_meu_voto') return faltaVotar(s, user, noSetlist, bandMembers)
    return s.status === 'aberta' && !estaRejeitada(s, bandMembers)
  }

  const filtered = visiveis.filter(noFiltro)
    .filter((s) => matchesSearch(search, s.title, s.artist))
  // "falta pra mim" — mesma conta pro badge do título e pro botão de filtro,
  // pra não mostrar dois números diferentes pra mesma coisa
  const pendingCount = countSugestoesPendentes(visiveis, user, noSetlist, bandMembers)

  // ── Ordenação ──────────────────────────────────────────────────────
  const displayed = [...filtered].sort((a, b) => {
    if (sortBy === 'media') {
      // Ordena pela MÉDIA entre quem votou (quem não votou não entra na conta).
      // Desempate: mais votos primeiro, depois maior soma.
      const sa = calcSongScore(a.opinoes)
      const sb = calcSongScore(b.opinoes)
      return sb.media - sa.media || sb.total - sa.total || sb.soma - sa.soma
    }
    if (sortBy === 'votes') {
      const ta = Object.keys(a.opinoes || {}).length
      const tb = Object.keys(b.opinoes || {}).length
      return tb - ta || calcSongScore(b.opinoes).media - calcSongScore(a.opinoes).media
    }
    if (sortBy === 'balanceada') {
      // Melhor avaliada e mais fácil primeiro. Desempate igual ao da média:
      // mais votos, depois maior soma
      const ba = calcBalancedScore(a.opinoes, a.dificuldade)
      const bb = calcBalancedScore(b.opinoes, b.dificuldade)
      return bb.valor - ba.valor || bb.total - ba.total || bb.soma - ba.soma
    }
    if (sortBy === 'dificuldade') {
      // Mais fácil → mais difícil, pelo nível mais alto votado (o mesmo que
      // aparece no chip do card); sem votos de dificuldade vai pro fim
      const da = calcDifficulty(a.dificuldade).max
      const db_ = calcDifficulty(b.dificuldade).max
      if (da === null && db_ === null) return 0
      if (da === null) return 1
      if (db_ === null) return -1
      return da - db_
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
        <div className="page-header-actions">
          <SearchLupa value={search} onChange={setSearch} placeholder="Filtrar por nome ou artista..." />
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
          const count = f.value === 'all'
            ? visiveis.length
            : f.value === 'rejeitada'
              ? visiveis.filter((s) => estaRejeitada(s, bandMembers)).length
              : visiveis.filter((s) => s.status === 'aberta' && !estaRejeitada(s, bandMembers)).length
          return (
            <button key={f.value} className={`btn-filter ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label} <span className="count">{count}</span>
            </button>
          )
        })}
        <button
          className={`btn-filter ${filter === 'falta_meu_voto' ? 'active' : ''}`}
          onClick={() => setFilter(filter === 'falta_meu_voto' ? 'aberta' : 'falta_meu_voto')}
          title="Mostrar só as músicas que faltam meu voto de opinião ou dificuldade"
        >
          🗳 Falta meu voto <span className="count">{pendingCount}</span>
        </button>
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

      {!loaded ? (
        <p className="empty-state">Carregando as sugestões...</p>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <p>Nenhuma sugestão encontrada pra "{search.trim()}".</p>
          ) : filter === 'falta_meu_voto' ? (
            <p>🎉 Você já votou em todas as músicas daqui!</p>
          ) : (
            <>
              <p>{filter === 'aberta' ? 'Nenhuma sugestão em aberto.' : 'Nenhuma sugestão aqui.'}</p>
              {filter !== 'rejeitada' && <button className="btn-primary" onClick={() => setAddModal(true)}>Fazer primeira sugestão</button>}
            </>
          )}
        </div>
      ) : (
        <div className="sug-list">
          {displayed.map((s, rank) => {
            const videoId = getYouTubeId(s.videoUrl)
            const myVote = (s.opinoes || {})[user.uid]
            const { soma, media, total } = calcSongScore(s.opinoes)
            const showScore = total > 0
            const diffLabel = difficultyByWeight(calcDifficulty(s.dificuldade).max)
            return (
              <div
                key={s.id}
                className={`sug-card sug-card-${estaRejeitada(s, bandMembers) ? 'rejeitada' : s.status}`}
                onClick={() => setModal(s)}
              >
                {videoId && (
                  <div className="sug-thumb-wrap">
                    <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt={s.title} className="sug-thumb" />
                  </div>
                )}
                <div className="sug-card-body">
                  <div className="sug-card-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {(sortBy === 'media' || sortBy === 'balanceada') && showScore && (
                        <span className="sug-rank-badge">#{rank + 1}</span>
                      )}
                      <div>
                        <span className="sug-card-title">{s.title}</span>
                        {s.artist && <span className="sug-card-artist"> — {s.artist}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      {showScore && (
                        <span className="sug-score-chip" title={`Média ${media.toFixed(2)} · Soma ${soma.toFixed(1)} · ${total} voto(s)`}>
                          ⭐ {media.toFixed(2)} <span className="sug-score-avg">· {total} {total === 1 ? 'voto' : 'votos'}</span>
                        </span>
                      )}
                      {diffLabel && (
                        <span className="sug-diff-chip" style={{ color: diffLabel.color, borderColor: diffLabel.color }}>
                          🎯 {diffLabel.label}
                        </span>
                      )}
                      {s.status === 'aprovada' ? (
                        <span className="sug-status-tag sug-aprovada">✓ Aprovada</span>
                      ) : estaRejeitada(s, bandMembers) ? (
                        <span className="sug-status-tag sug-rejeitada">✕ Rejeitada</span>
                      ) : temVeto(s) && (
                        <span className="sug-status-tag sug-veto-pendente" title="Um voto já veta — falta a banda toda opinar pra fechar">
                          ⚠️ veto
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
          bandMembers={bandMembers}
          userId={user.uid}
          userName={user.displayName}
        />
      )}
      {addModal && (
        <AddSugestaoModal
          onClose={() => setAddModal(false)}
          userId={user.uid}
          userName={user.displayName}
          acervo={{ musicas: musicasSetlist, sugestoes, bandMembers }}
          onAbrirExistente={(sug) => { setAddModal(false); setModal(sug) }}
        />
      )}
    </div>
  )
}
