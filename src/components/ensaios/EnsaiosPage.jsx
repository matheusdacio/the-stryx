import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, updateDoc, deleteField, arrayUnion, arrayRemove, runTransaction } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { firstName } from '../../utils/members'
import { PRESENCAS, splitPresenca, faltaResponder } from '../../utils/presenca'
import { calcDominio, dominioPorPeso, uidsAtivosDe } from '../../utils/dominio'
import { formatData, jaPassou } from '../../utils/data'
import { acharCifra } from '../../utils/score'
import { blocosDe, musicasDoEvento, nomeDoBloco } from '../../utils/blocos'
import EnsaioModal from './EnsaioModal'
import PerformanceMode from './PerformanceMode'
import SetPlayer from '../SetPlayer'

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

// Marcar o que foi ensaiado só faz sentido do dia do evento em diante.
// Compara por dia: o evento é gravado ao meio-dia, então usar a hora faria
// o ensaio de hoje contar como futuro até o meio-dia
function jaComecou(ts) {
  if (!ts) return false
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return dia(d) <= dia(new Date())
}

// Primeiras músicas do evento, pra dar o tom do que vai ser ensaiado sem
// precisar abrir os detalhes
function SetlistPreview({ setlist, blocos = 1, limite = 5 }) {
  const lista = setlist || []
  if (!lista.length) return null
  const restantes = lista.length - limite
  return (
    <div className="setlist-preview">
      <ol className="event-songs-list">
        {lista.slice(0, limite).map((s, i) => (
          <li key={s.id || i}>
            {s.title}
            {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
          </li>
        ))}
      </ol>
      {restantes > 0 && (
        <p className="setlist-preview-more">
          + {restantes} {restantes === 1 ? 'música' : 'músicas'}
          {blocos > 1 && ` · ${blocos} blocos`}
        </p>
      )}
    </div>
  )
}

// ── Presença ──────────────────────────────────────────────────────────

// Cada um responde pela própria presença. Clicar de novo na mesma resposta
// desfaz, igual aos votos de domínio
function PresencaBar({ ensaio, uid, userName }) {
  const meu = (ensaio.presenca || {})[uid]?.status
  const meuObs = (ensaio.presenca || {})[uid]?.obs || ''
  const [editingObs, setEditingObs] = useState(false)
  const [obsText, setObsText] = useState('')

  const erroSalvar = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')

  // Grava por caminho pontilhado (não a entrada inteira) pra não apagar a
  // observação de quem já tinha uma ao só trocar de resposta
  const responder = (status) => {
    const ref = doc(db, 'ensaios', ensaio.id)
    if (meu === status) {
      updateDoc(ref, { [`presenca.${uid}`]: deleteField() }).catch(erroSalvar)
      setEditingObs(false)
    } else {
      updateDoc(ref, {
        [`presenca.${uid}.status`]: status,
        [`presenca.${uid}.name`]: userName,
        [`presenca.${uid}.at`]: new Date().toISOString(),
      }).catch(erroSalvar)
      // "Só uma parte" sem observação ainda: abre o campo na hora, a pessoa
      // pode ignorar e sair sem digitar
      if (status === 'parte' && !meuObs) {
        setObsText('')
        setEditingObs(true)
      }
    }
  }

  const openObs = () => { setObsText(meuObs); setEditingObs(true) }
  const saveObs = () => {
    const texto = obsText.trim()
    updateDoc(doc(db, 'ensaios', ensaio.id), { [`presenca.${uid}.obs`]: texto || deleteField() }).catch(erroSalvar)
    setEditingObs(false)
  }

  return (
    <div className="presenca-bar" onClick={(e) => e.stopPropagation()}>
      <span className="prompt-label">Você vai?</span>
      {PRESENCAS.map((p) => (
        <button
          key={p.value}
          className={`btn-presenca ${meu === p.value ? 'active' : ''}`}
          style={meu === p.value ? { background: p.bg, borderColor: p.color, color: p.color } : {}}
          aria-pressed={meu === p.value}
          onClick={() => responder(p.value)}
        >
          {p.label}
        </button>
      ))}
      {meu && (editingObs ? (
        <div className="notes-edit">
          <input
            value={obsText}
            onChange={(e) => setObsText(e.target.value)}
            maxLength={80}
            aria-label="Observação da presença"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); saveObs() }
              if (e.key === 'Escape') setEditingObs(false)
            }}
          />
          <div className="notes-actions">
            <button className="btn-secondary" onClick={() => setEditingObs(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveObs}>Salvar</button>
          </div>
        </div>
      ) : (
        <p className="presenca-obs" onClick={openObs}>
          {meuObs
            ? `📝 ${meuObs}`
            : <span className="placeholder">{meu === 'parte' ? 'Que parte? Ex: chego às 21h, saio antes do bloco 4' : 'Adicionar observação (ex: chego 10 min atrasado)'}</span>}
        </p>
      ))}
    </div>
  )
}

function PresencaResumo({ ensaio, bandMembers, passado }) {
  const { vao, parte, nao, pendentes, convidados } = splitPresenca(ensaio, bandMembers)
  if (!bandMembers.length) return null

  const linha = (titulo, lista, cor) => lista.length > 0 && (
    <div className="presenca-linha">
      <span className="presenca-linha-titulo" style={{ color: cor }}>{titulo} ({lista.length})</span>
      <div className="members-tags">
        {lista.map((m) => (
          <span
            key={m.name}
            className="member-tag"
            style={{ borderColor: cor, color: cor }}
            title={m.obs ? `${m.name}: ${m.obs}` : m.name}
          >
            {firstName(m.name)}
            {m.obs && <span className="member-tag-obs"> · {m.obs}</span>}
          </span>
        ))}
      </div>
    </div>
  )

  return (
    <div className="presenca-resumo">
      {linha(passado ? 'Foram' : 'Vão', vao, PRESENCAS[0].color)}
      {linha(passado ? 'Foram parte' : 'Só uma parte', parte, PRESENCAS[1].color)}
      {linha(passado ? 'Não foram' : 'Não vão', nao, PRESENCAS[2].color)}
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

// `compacto` é a aba de pendências: ali a tarefa é responder presença, então
// ela vem primeiro e o repertório fica só como prévia
function EnsaioRow({ ensaio, onEdit, onCopy, onRemove, onTogglePauta, onPerform, bandMembers, user, songs, cifras, compacto = false, destaque = false, colapsavel = false }) {
  // Realizados/Cancelados nascem recolhidos — repertório completo, presença
  // e 4-5 botões por evento, pra TODOS de uma vez, virava rolagem sem fim
  const [open, setOpen] = useState(!colapsavel)
  const hasPauta   = ensaio.pauta?.length > 0
  const { vao, parte, nao } = splitPresenca(ensaio, bandMembers)

  // Registro do que foi realmente tocado no ensaio. Quem diz se a música ficou
  // pronta é o voto de domínio de cada um, não esta marcação
  const ensaiadas = ensaio.ensaiadas || []
  // arrayUnion/arrayRemove em vez de regravar o array inteiro: duas pessoas
  // marcando músicas diferentes ao mesmo tempo não se pisam mais (quem
  // gravasse por último apagava a marcação do outro)
  const toggleEnsaiada = (id) => {
    if (!id) return
    const campo = ensaiadas.includes(id) ? arrayRemove(id) : arrayUnion(id)
    updateDoc(doc(db, 'ensaios', ensaio.id), { ensaiadas: campo })
  }

  const [tocando, setTocando] = useState(false)
  const podeMarcar = jaComecou(ensaio.date)
  const passado = jaPassou(ensaio.date)

  const hasNotes   = !!ensaio.notes
  const blocos = blocosDe(ensaio)
  const musicas = musicasDoEvento(ensaio)
  const hasSetlist = musicas.length > 0

  return (
    <div className={`ensaio-row ${open ? 'open' : ''} ${destaque ? `destaque ${ensaio.type === 'apresentacao' ? 'apresentacao' : ''}` : ''}`}>
      <div
        className={`ensaio-row-header ${destaque ? 'destaque-header' : ''}`}
        onClick={colapsavel ? () => setOpen(!open) : undefined}
        style={colapsavel ? { cursor: 'pointer' } : undefined}
      >
        {destaque ? (
          <>
            <div>
              <p className="next-ensaio-label">
                {ensaio.type === 'apresentacao' ? '🎤 Próxima apresentação' : '🎸 Próximo ensaio'}
              </p>
              <p className="next-ensaio-date">{formatData(ensaio.date)}</p>
              {ensaio.location && <p className="next-ensaio-loc">📍 {ensaio.location}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="next-ensaio-relative">{relativeLabel(ensaio.date)}</span>
              {(vao.length + parte.length) > 0 && (
                <p className="next-ensaio-members presenca-vai">
                  ✓ {vao.length + parte.length} confirmados
                  {parte.length > 0 && ` (${parte.length} só uma parte)`}
                </p>
              )}
              {hasSetlist && (
                <p className="next-ensaio-members">
                  🎵 {musicas.length} músicas{blocos.length > 1 && ` · ${blocos.length} blocos`}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="ensaio-row-left">
              <span className="ensaio-row-date">{formatData(ensaio.date, { curta: true })}</span>
              <TypeBadge type={ensaio.type} />
              {ensaio.location && <span className="ensaio-row-loc">· {ensaio.location}</span>}
            </div>
            <div className="ensaio-row-right">
              {hasSetlist && <span className="ensaio-row-members">🎵 {musicas.length}</span>}
              {vao.length > 0 && <span className="ensaio-row-members presenca-vai">{vao.length} vão</span>}
              {parte.length > 0 && <span className="ensaio-row-members presenca-parte">{parte.length} parte</span>}
              {nao.length > 0 && <span className="ensaio-row-members presenca-nao">{nao.length} não</span>}
              {colapsavel && <span className={`ensaio-row-arrow ${open ? 'up' : ''}`}>›</span>}
            </div>
          </>
        )}
      </div>

      {open && (
      <div className="ensaio-row-body">
          {compacto && (
            <div>
              {!passado && (
                <PresencaBar ensaio={ensaio} uid={user.uid} userName={user.displayName || user.email} />
              )}
              <PresencaResumo ensaio={ensaio} bandMembers={bandMembers} passado={passado} />
            </div>
          )}

          {hasSetlist && compacto && (
            <div className="pauta-block">
              <p className="section-label">Músicas ({musicas.length})</p>
              <SetlistPreview setlist={musicas} blocos={blocos.length} limite={3} />
            </div>
          )}

          {hasSetlist && !compacto && (
            <div className="pauta-block">
              <p className="section-label">
                Músicas ({musicas.length}){blocos.length > 1 && ` · ${blocos.length} blocos`}
                {podeMarcar && <span className="filter-hint" style={{ margin: 0, textTransform: 'none', letterSpacing: 0 }}> · marque as que rolaram</span>}
              </p>
              {(() => {
                let offset = 0
                return blocos.map((b, bi) => {
                  const inicio = offset
                  offset += (b.musicas || []).length
                  return (
                    <div key={b.id}>
                      <p className="bloco-titulo">{nomeDoBloco(b, bi)} <span className="count">{(b.musicas || []).length}</span></p>
                      <ol className="event-songs-list" start={inicio + 1}>
                        {(b.musicas || []).map((s, i) => {
                          const nivel = dominioPorPeso(calcDominio(songs[s.id]?.dominio, uidsAtivosDe(bandMembers)).pior)
                          const temCifra = acharCifra(cifras, s.title, s.artist)
                          const q = encodeURIComponent(s.title)
                          const texto = (
                            <span>
                              <a href={`#/?q=${q}`} className="event-song-link" onClick={(e) => e.stopPropagation()}>{s.title}</a>
                              {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                              {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                              {songs[s.id]?.tom && <span className="event-setlist-bpm"> · ♪ {songs[s.id].tom}</span>}
                              {songs[s.id]?.cantor && <span className="event-setlist-bpm"> · 🎤 {songs[s.id].cantor}</span>}
                              {temCifra && (
                                <a
                                  href={`#/cifras?q=${q}`}
                                  className="mini-chip"
                                  style={{ marginLeft: 6 }}
                                  title="Ver cifra"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📄
                                </a>
                              )}
                              {songs[s.id]?.proxima && (
                                <span className="mini-chip" style={{ marginLeft: 6 }} title="Emenda direto na próxima">⛓</span>
                              )}
                              {nivel && (
                                <span className="status-dot status-dot-inline" style={{ color: nivel.color, background: nivel.bg }}>
                                  {nivel.label}
                                </span>
                              )}
                            </span>
                          )
                          return (
                            <li key={s.id || i}>
                              {podeMarcar ? (
                                <label className="song-ensaiada">
                                  <input
                                    type="checkbox"
                                    checked={ensaiadas.includes(s.id)}
                                    onChange={() => toggleEnsaiada(s.id)}
                                    title="Marcar como ensaiada neste evento"
                                  />
                                  {texto}
                                </label>
                              ) : texto}
                            </li>
                          )
                        })}
                      </ol>
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {hasPauta && !compacto && (
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

          {!compacto && (
            <div style={{ marginTop: 10 }}>
              {!passado && (
                <PresencaBar ensaio={ensaio} uid={user.uid} userName={user.displayName || user.email} />
              )}
              <PresencaResumo ensaio={ensaio} bandMembers={bandMembers} passado={passado} />
            </div>
          )}

          {hasNotes && !compacto && (
            <div style={{ marginTop: 10 }}>
              <p className="section-label">Observações</p>
              <p className="ensaio-notes">{ensaio.notes}</p>
            </div>
          )}

          {tocando && (
            <SetPlayer setlist={musicas} />
          )}

          <div className="ensaio-row-actions">
            {hasSetlist && (
              <button
                className="btn-primary"
                onClick={() => { setTocando(false); onPerform(ensaio) }}
              >
                🎤 Modo palco
              </button>
            )}
            {hasSetlist && (
              <button className="btn-secondary" onClick={() => setTocando(!tocando)}>
                {tocando ? '■ Parar' : '▶ Tocar as músicas'}
              </button>
            )}
            <button className="btn-secondary" onClick={() => onEdit(ensaio)}>Editar</button>
            <button className="btn-secondary" onClick={() => onCopy(ensaio)}>⧉ Copiar</button>
            <button className="btn-ghost-danger" onClick={() => onRemove(ensaio)}>Remover</button>
          </div>
      </div>
      )}
    </div>
  )
}


// ── Página principal ──────────────────────────────────────────────────

const TABS = [
  { key: 'proximos',   label: 'Próximos' },
  { key: 'pendentes',  label: '⏳ Falta eu responder' },
  { key: 'realizados', label: 'Realizados' },
  { key: 'cancelados', label: 'Cancelados' },
]

export default function EnsaiosPage() {
  const { user } = useAuth()
  const [ensaios, setEnsaios] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [bandMembers, setBandMembers] = useState([])
  const [songs, setSongs] = useState({})
  const [cifras, setCifras] = useState([])
  const [modal, setModal]     = useState(null)
  const [tab, setTab]         = useState('proximos')
  const [performing, setPerforming] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'ensaios'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'songs'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      setSongs(map)
    })
  }, [])

  // Pro chip 📄 só aparecer quando existe cifra pra música (N06) — antes
  // levava pra uma busca vazia mesmo sem cifra cadastrada
  useEffect(() => {
    return onSnapshot(collection(db, 'cifras'), (snap) =>
      setCifras(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  useEffect(() => {
    // Quem saiu da banda (ativo:false) fica fora daqui — não fica "Sem
    // resposta" pra sempre em todo evento novo
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, (snap) => setBandMembers(
      snap.docs.filter((d) => d.data().ativo !== false).map((d) => ({
        name: d.data().name,
        firebaseUid: d.data().firebaseUid || null,
      }))
    ))
  }, [])

  const remove = (e) => {
    if (confirm(`Apagar o evento de ${formatData(e.date)} de vez? Músicas, pauta e presenças vão junto. Se ele só não vai acontecer, use Editar › Marcar como cancelado.`)) deleteDoc(doc(db, 'ensaios', e.id))
  }

  // Itens da pauta não têm id — regravar o array inteiro (updateDoc) fazia
  // duas pessoas marcando ao mesmo tempo se pisarem. Transação lê o estado
  // mais recente antes de escrever, então o segundo toque não perde o primeiro
  const togglePauta = (ensaio, index) => {
    const ref = doc(db, 'ensaios', ensaio.id)
    runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const pauta = [...(snap.data().pauta || [])]
      pauta[index] = { ...pauta[index], done: !pauta[index].done }
      tx.update(ref, { pauta })
    }).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
  }

  // Separa por categoria
  // jaPassou (não isPast): evento de hoje fica em Próximos o dia inteiro,
  // coerente com a pergunta de presença e o filtro de pendências, que já
  // usam jaPassou/jaComecou. Antes, o card destaque sumia ao meio-dia.
  const futuros    = ensaios.filter(e => !jaPassou(e.date) && e.status !== 'cancelado')
  const realizados = ensaios.filter(e =>  jaPassou(e.date) && e.status !== 'cancelado').reverse()
  const cancelados = ensaios.filter(e => e.status === 'cancelado')

  const nextEnsaio = futuros[0] || null
  const restantes  = futuros.slice(1)

  // Futuros que eu ainda não respondi — é o que o filtro de pendências mostra
  const pendentes = futuros.filter((e) => faltaResponder(e, user.uid))

  const counts = {
    proximos: futuros.length,
    pendentes: pendentes.length,
    realizados: realizados.length,
    cancelados: cancelados.length,
  }

  const listForTab = tab === 'pendentes' ? pendentes
    : tab === 'realizados' ? realizados
    : tab === 'cancelados' ? cancelados
    : restantes

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          Eventos
          {pendentes.length > 0 && <span className="pending-badge" title="Eventos em que falta você responder">{pendentes.length}</span>}
        </h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Evento</button>
      </div>

      {!loaded ? (
        <p className="empty-state">Carregando os eventos...</p>
      ) : (
        <>
      {/* Tabs */}
      <div className="filter-bar">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${t.key === 'pendentes' ? 'btn-tag' : 'btn-filter'} ${tab === t.key ? 'active' : ''}`}
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
            ? <EnsaioRow
                ensaio={nextEnsaio}
                onEdit={setModal}
                onCopy={(x) => setModal({ copiar: x })}
                onRemove={remove}
                onTogglePauta={togglePauta}
                onPerform={setPerforming}
                bandMembers={bandMembers}
                user={user}
                songs={songs}
                cifras={cifras}
                destaque
              />
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
                    onCopy={(x) => setModal({ copiar: x })}
                    onRemove={remove}
                    onTogglePauta={togglePauta}
                    onPerform={setPerforming}
                    bandMembers={bandMembers}
                    user={user}
                    songs={songs}
                    cifras={cifras}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Abas de lista simples */}
      {tab !== 'proximos' && (
        <>
          {listForTab.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 12 }}>
              <p>
                {tab === 'pendentes'
                  ? 'Você já indicou presença em todos os eventos futuros. 🎉'
                  : `Nenhum evento ${tab === 'realizados' ? 'realizado' : 'cancelado'} aqui.`}
              </p>
            </div>
          ) : (
            <div className="ensaio-list" style={{ marginTop: 8 }}>
              {listForTab.map(e => (
                <EnsaioRow
                  key={e.id}
                  ensaio={e}
                  onEdit={setModal}
                  onCopy={(x) => setModal({ copiar: x })}
                  onRemove={remove}
                  onTogglePauta={togglePauta}
                  onPerform={setPerforming}
                  bandMembers={bandMembers}
                  user={user}
                  songs={songs}
                  cifras={cifras}
                  compacto={tab === 'pendentes'}
                  colapsavel={tab === 'realizados' || tab === 'cancelados'}
                />
              ))}
            </div>
          )}
        </>
      )}
        </>
      )}

      {modal && (
        <EnsaioModal
          ensaio={modal === 'add' ? null : modal.copiar || modal}
          copiando={!!modal.copiar}
          onClose={() => setModal(null)}
          bandMembers={bandMembers}
        />
      )}
      {performing && <PerformanceMode event={performing} onClose={() => setPerforming(null)} />}
    </div>
  )
}
