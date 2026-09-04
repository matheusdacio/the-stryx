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
import { DIFFICULTIES, calcDifficulty, difficultyByWeight, fatorFacilidade } from '../../utils/dificuldade'
import { estaRejeitada, temVeto, todosVotaram, quemFalta, VETOS } from '../../utils/rejeicao'
import { faltaVotar, countSugestoesPendentes } from '../../utils/pendencias'
import { showToast } from '../../utils/toast'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'
import { getYouTubeId } from '../../utils/youtube'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'


const firstName = (n) => (n || '').trim().split(' ')[0]

// Sugestão nova sem voto nenhum ia pro fim de "Melhores e fáceis", empatada
// em 0 com as reprovadas — o chip explica por que ela aparece lá em cima
const formatarNota = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000
const ehNovo = (createdAt) => {
  if (!createdAt) return false
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  return Date.now() - d.getTime() < SETE_DIAS
}

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
            {o.short} {count}
          </span>
        )
      })}
    </div>
  )
}

function SugestaoModal({ sugestao, onClose, isAdmin, userId, userName, bandMembers, onVotou }) {
  useFecharComVoltar(onClose)
  const [saving, setSaving] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(sugestao.notes || '')
  const [editingComment, setEditingComment] = useState(false)
  // Inicializador preguiçoso: sem isso o textarea sempre nascia vazio, mesmo
  // reabrindo uma sugestão em que a pessoa já tinha deixado um comentário
  const [commentDraft, setCommentDraft] = useState(() => (sugestao.opinoes || {})[userId]?.comment || '')
  const ref = doc(db, 'sugestoes', sugestao.id)

  const list = opinoesArray(sugestao.opinoes)
  const existing = (sugestao.opinoes || {})[userId]

  const saveNotes = () => {
    updateDoc(ref, { notes: notes.trim() }).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
    setEditingNotes(false)
  }

  // Voto de dificuldade (mapa keyed por uid)
  const dificuldade = sugestao.dificuldade || {}
  const myDiff = dificuldade[userId]?.level
  const voteDiff = (level) => {
    // Fixa a sugestão na lista antes de votar: com "Falta meu voto" ativo,
    // ela pode sair do filtro assim que grava, sumindo atrás do modal
    onVotou?.(sugestao.id)
    if (myDiff === level) {
      updateDoc(ref, { [`dificuldade.${userId}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`dificuldade.${userId}`]: { userName, level, at: new Date().toISOString() },
      })
    }
  }

  const removerOpiniao = () => {
    updateDoc(ref, { [`opinoes.${userId}`]: deleteField() })
      .catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
  }

  // Grava no toque, igual ao voto de dificuldade (e ao de domínio no
  // Setlist) — tocar de novo na opção já marcada desfaz o voto. O
  // comentário é campo à parte, com salvar próprio, pra não se perder
  // quando a pessoa só quer trocar de opinião
  const votarOpiniao = (opinion) => {
    if (existing?.opinion === opinion) {
      removerOpiniao()
      return
    }
    if (VETOS.includes(opinion) && !confirm('Marcar isso veta a música: quando a banda toda opinar, ela sai da fila. Confirma?')) return
    onVotou?.(sugestao.id)
    const voto = { userName, opinion, comment: existing?.comment || '', at: new Date().toISOString() }
    const opinoesDepois = { ...(sugestao.opinoes || {}), [userId]: voto }
    const update = { [`opinoes.${userId}`]: voto }

    // Grava a rejeição no momento em que o último voto fecha com veto — sem
    // isso ela era só calculada na hora (estaRejeitada), e o badge do
    // rodapé, a planilha exportada e a lista divergiam entre si
    if (todosVotaram({ opinoes: opinoesDepois }, bandMembers) && temVeto({ opinoes: opinoesDepois })) {
      update.status = 'rejeitada'
      update.rejeitadaPor = 'veto'
    }

    updateDoc(ref, update).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
  }

  const saveComment = () => {
    updateDoc(ref, { [`opinoes.${userId}.comment`]: commentDraft.trim() })
      .catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
    setEditingComment(false)
  }

  const approve = async () => {
    if (!confirm(`Enviar "${sugestao.title}" pro setlist? Ela some daqui e entra como Crua pra todo mundo.`)) return
    setSaving(true)

    // Música nova entra crua pra todo mundo: ninguém ensaiou ainda. Cada um
    // muda o próprio voto no card do setlist quando pegar a música
    const dominio = {}
    bandMembers.forEach((m) => {
      if (!m.firebaseUid) return
      dominio[m.firebaseUid] = { userName: m.name, level: 'crua', at: new Date().toISOString(), seeded: true }
    })

    try {
      await addDoc(collection(db, 'songs'), {
        dominio: { ...dominio, ...(sugestao.dominio || {}) },
        title: sugestao.title,
        artist: sugestao.artist || '',
        videoUrl: sugestao.videoUrl || '',
        status: 'ensaiando',
        notes: sugestao.notes || `Veio da sugestão de ${sugestao.suggestedBy}`,
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
      showToast('Foi pro setlist, marcada Crua pra geral')
      onClose()
    } catch {
      alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
      setSaving(false)
    }
  }


  const reopen = () => {
    setReopening(true)
    updateDoc(ref, { status: 'aberta' })
      .then(() => showToast('Reaberta pra votação'))
      .catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
      .finally(() => setReopening(false))
  }

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

        {sugestao.status !== 'aberta' && (
          <div className={`sug-status-banner sug-${sugestao.status}`}>
            {sugestao.status === 'aprovada' ? '✓ Enviada pro setlist' : '✕ Rejeitada'}
            {isAdmin && (
              <button className="btn-reopen" onClick={reopen} disabled={reopening}>
                {reopening ? 'Reabrindo...' : 'Reabrir'}
              </button>
            )}
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

        {/* Opinar é o gesto mais frequente da tela — logo abaixo do vídeo,
            grava no toque (igual à dificuldade), sem precisar rolar até o
            fim nem tocar num botão "Enviar" à parte */}
        <div className="opinion-form">
          <p className="prompt-label">
            {sugestao.status === 'aberta' && todosVotaram(sugestao, bandMembers) ? 'A banda toda já opinou' : 'Vale tocar?'}
          </p>
          {!(sugestao.status === 'aberta' && todosVotaram(sugestao, bandMembers)) && (
            <div className="opinion-btns">
              {OPINIONS.map((o) => (
                <button
                  key={o.value}
                  className={`btn-opinion ${existing?.opinion === o.value ? 'selected' : ''}`}
                  style={existing?.opinion === o.value ? { background: o.bg, borderColor: o.color, color: o.color } : {}}
                  aria-pressed={existing?.opinion === o.value}
                  onClick={() => votarOpiniao(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {existing && (
            editingComment ? (
              <div className="notes-edit">
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="Considerações (opcional)..."
                />
                <div className="notes-actions">
                  <button className="btn-secondary" onClick={() => setEditingComment(false)}>Cancelar</button>
                  <button className="btn-primary" onClick={saveComment}>Salvar</button>
                </div>
              </div>
            ) : (
              <p className="existing-vote">
                {existing.comment || <span className="placeholder">Adicionar comentário...</span>}
                {' '}
                <button className="btn-link-inline" onClick={() => { setCommentDraft(existing.comment || ''); setEditingComment(true) }}>Editar</button>
                {' '}
                <button className="btn-link-inline" onClick={removerOpiniao}>Remover opinião</button>
              </p>
            )
          )}
        </div>

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
            {sugestao.notes || <span className="placeholder">Toque pra anotar algo pra banda</span>}
          </p>
        )}

        {/* Dificuldade pra tocar */}
        <div className="difficulty-section-flat" style={{ marginBottom: 12 }}>
          <p className="prompt-label">Dificuldade pra tocar</p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={`btn-diff ${myDiff === d.value ? 'active' : ''}`}
                style={myDiff === d.value ? { borderColor: d.color, color: d.color } : {}}
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

        {isAdmin && sugestao.status === 'aberta' && (
          <div className="admin-controls">
            <p className="section-label">Decisão final</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-approve" onClick={approve} disabled={saving}>
                {saving ? 'Enviando...' : '➤ Enviar pro setlist'}
              </button>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function AddSugestaoModal({ onClose, userId, userName, acervo, onAbrirExistente }) {
  useFecharComVoltar(onClose)
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
        <h2>Nova sugestão</h2>
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
  { value: 'balanceada',  label: '⚖️ Melhores e fáceis', hint: 'Melhores e fáceis: nota da banda, descontada se a galera achou difícil' },
  { value: 'media',       label: '⭐ Média', hint: 'Média: nota de 0 a 1,2 — Hino vale 1,2, Não curti vale 0' },
  { value: 'votes',       label: '👥 Mais votadas', hint: 'Mais votadas: quem recebeu mais opiniões aparece primeiro' },
  { value: 'dificuldade', label: '🎯 Dificuldade', hint: 'Dificuldade: da mais fácil pra mais difícil, pelo nível mais votado' },
  { value: 'recent',      label: '🕐 Recentes', hint: 'Recentes: quem foi sugerida por último aparece primeiro' },
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
// A nota pesa mais que a dificuldade: uma música difícil precisa ser bem
// melhor avaliada pra passar na frente de uma fácil, mas entre notas
// parecidas a mais fácil sobe. Fatores em fatorFacilidade (utils/dificuldade),
// compartilhados com a mesma ordenação do Setlist.
function calcBalancedScore(opinoes, dificuldade) {
  const { media, soma, total } = calcSongScore(opinoes)
  const ease = fatorFacilidade(dificuldade)
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
  // Ordenação persiste (dura semanas — quem prefere "Recentes" reescolheria
  // toda vez), mas o link do push sempre manda: sugestão nova precisa
  // aparecer perto do topo, não onde a pessoa deixou salvo
  const [sortBy, setSortBy] = useState(() => {
    if (searchParams.get('ordem')) return searchParams.get('ordem')
    try {
      return localStorage.getItem('stryx-sugestoes-sortby') || 'balanceada'
    } catch {
      return 'balanceada'
    }
  })
  const mudarSortBy = (v) => {
    setSortBy(v)
    try { localStorage.setItem('stryx-sugestoes-sortby', v) } catch { /* localStorage indisponível */ }
  }
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [addModal, setAddModal] = useState(false)
  // Sugestão recém-votada continua na lista até o filtro mudar — senão ela
  // some da tela atrás do modal assim que deixa de faltar o voto
  const [fixados, setFixados] = useState(new Set())
  const mudarFiltro = (v) => { setFixados(new Set()); setFilter(v) }
  const mudarSearch = (v) => { setFixados(new Set()); setSearch(v) }

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
    // Quem saiu da banda (ativo:false) fica fora daqui — não conta mais
    // pra "todo mundo votou", nem recebe voto crua semeado na aprovação
    return onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.filter((d) => d.data().ativo !== false).map((d) => ({
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
    if (filter === 'falta_meu_voto') return faltaVotar(s, user, noSetlist, bandMembers) || fixados.has(s.id)
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
      // Sem nenhuma opinião ainda não é "nota zero" — é diferente de uma
      // reprovada; vai pro topo, não empata em 0 com quem já foi mal avaliada
      if (ba.total === 0 && bb.total === 0) return 0
      if (ba.total === 0) return -1
      if (bb.total === 0) return 1
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

  // Congela a posição enquanto a página está aberta: um voto alheio não
  // pula o card debaixo de quem está lendo. Recalcula do zero só quando
  // filtro/ordenação/busca mudam (chave abaixo) — ajustar state durante o
  // render, não em efeito, é o padrão que o próprio React recomenda pra
  // "resetar ao mudar uma dependência" sem o flash de um efeito
  const [ordemCongelada, setOrdemCongelada] = useState(() => displayed.map((s) => s.id))
  const chaveOrdem = `${filter}|${sortBy}|${search}`
  const [chaveAnterior, setChaveAnterior] = useState(chaveOrdem)
  if (chaveOrdem !== chaveAnterior) {
    setChaveAnterior(chaveOrdem)
    setOrdemCongelada(displayed.map((s) => s.id))
  }
  // Sair da lista (virou rejeitada, ou meu próprio voto some com "Falta meu
  // voto") é imediato — só a POSIÇÃO de quem continua na lista é que
  // congela; ids novos entram no fim
  const idsAtuais = new Set(displayed.map((s) => s.id))
  const porId = Object.fromEntries(displayed.map((s) => [s.id, s]))
  const presentesNaOrdem = ordemCongelada.filter((id) => idsAtuais.has(id))
  const novos = displayed.filter((s) => !ordemCongelada.includes(s.id))
  const displayedCongelado = [...presentesNaOrdem.map((id) => porId[id]), ...novos]
  const ordemDivergente = displayedCongelado.some((s, i) => s.id !== displayed[i]?.id)

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
          <SearchLupa value={search} onChange={mudarSearch} placeholder="Filtrar por nome ou artista..." />
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
            <button key={f.value} className={`btn-filter ${filter === f.value ? 'active' : ''}`} onClick={() => mudarFiltro(f.value)}>
              {f.label} <span className="count">{count}</span>
            </button>
          )
        })}
        <button
          className={`btn-tag ${filter === 'falta_meu_voto' ? 'active' : ''}`}
          onClick={() => mudarFiltro(filter === 'falta_meu_voto' ? 'aberta' : 'falta_meu_voto')}
          title="Mostrar só as músicas que faltam meu voto de opinião ou dificuldade"
        >
          🗳 Falta meu voto <span className="count">{pendingCount}</span>
        </button>
      </div>

      {/* Ordenação */}
      <div className="sort-bar">
        <span className="sort-label">Ordenar:</span>
        <select className="btn-sort-select" value={sortBy} onChange={(e) => mudarSortBy(e.target.value)}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <p className="filter-hint">{SORTS.find((s) => s.value === sortBy)?.hint}</p>

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
              {filter !== 'rejeitada' && (
                <button className="btn-primary" onClick={() => setAddModal(true)}>
                  {visiveis.length > 0 ? 'Sugerir uma música' : 'Fazer primeira sugestão'}
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="sug-list">
          {ordemDivergente && (
            <button className="chip-reordenar" onClick={() => setOrdemCongelada(displayed.map((s) => s.id))}>
              Ordem mudou · reordenar
            </button>
          )}
          {displayedCongelado.map((s, rank) => {
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
                        {ehNovo(s.createdAt) && <span className="mini-chip" title="Sugerida nos últimos 7 dias">🆕</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      {showScore && (
                        <span className="sug-score-chip" title={`Média ${formatarNota(media)} · Soma ${soma.toLocaleString('pt-BR')} · ${total} voto(s)`}>
                          ⭐ {formatarNota(media)} <span className="sug-score-avg">· {total} {total === 1 ? 'voto' : 'votos'}</span>
                        </span>
                      )}
                      {diffLabel && (
                        <span className="sug-diff-chip" style={{ color: diffLabel.color, borderColor: diffLabel.color }}>
                          🎯 {diffLabel.label}
                        </span>
                      )}
                      {s.status === 'aprovada' ? (
                        <span className="sug-status-tag sug-aprovada">✓ No setlist</span>
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
          onClose={() => {
            // "fixados" só existe pra não sumir o card debaixo do dedo
            // enquanto a pessoa ainda está votando — uma vez que ela fecha
            // a tela, se o filtro não bate mais, a música já pode sumir da
            // lista (antes só desgrudava trocando de aba)
            setFixados((prev) => {
              if (!prev.has(modal.id)) return prev
              const next = new Set(prev)
              next.delete(modal.id)
              return next
            })
            setModal(null)
          }}
          isAdmin={isAdmin}
          bandMembers={bandMembers}
          userId={user.uid}
          userName={user.displayName}
          onVotou={(id) => setFixados((prev) => new Set(prev).add(id))}
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
