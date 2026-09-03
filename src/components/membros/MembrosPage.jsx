import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection, onSnapshot, orderBy, query, getDocs,
  updateDoc, deleteDoc, doc, writeBatch, deleteField,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import { mergeAllImportedVotes, namesMatch } from '../../utils/votes'
import { normalizeEventMembers } from '../../utils/members'
import { migrateEventPresence } from '../../utils/presenca'
import { verificarIntegridade } from '../../utils/integridade'
import { dedupSugestoes } from '../../utils/dedupSugestoes'
import { migrarDificuldade } from '../../utils/migrarDificuldade'
import { migrarTom } from '../../utils/migrarTom'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const INSTRUMENTS = [
  'Guitarra solo', 'Guitarra base', 'Baixo', 'Bateria',
  'Vocal', 'Teclado', 'Outro',
]

// Toda ferramenta admin mostrava o erro cru do Firebase em inglês
// ("Missing or insufficient permissions") — ninguém decifra isso sem abrir
// o console, e é o console que deveria mostrar o detalhe mesmo
function msgErro(e) {
  console.error(e)
  return '❌ Não deu certo — tenta de novo (detalhe no console).'
}

// ── Card de membro ────────────────────────────────────────────────────

function MemberCard({ member, isAdmin, currentUid, onRemove }) {
  const [editingRole, setEditingRole] = useState(false)
  const [role, setRole] = useState(member.role || '')
  const [newAlias, setNewAlias] = useState('')

  const linked  = !!member.firebaseUid
  const photo   = member.photoURL || null
  // Admin edita qualquer um; membro edita o próprio instrumento
  const canEdit = isAdmin || (linked && member.firebaseUid === currentUid)
  const aliases = member.aliases || []

  // Fecha/limpa na hora — sem sinal, o await deixava a caixa presa esperando a rede
  const erro = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')

  const saveRole = () => {
    updateDoc(doc(db, 'members', member.id), { role }).catch(erro)
    setEditingRole(false)
  }

  // Apelidos / nomes antigos do Glissandoo (pra fundir votos de quem usou outro sobrenome)
  const addAlias = () => {
    const a = newAlias.trim()
    if (!a || aliases.some((x) => x.toLowerCase() === a.toLowerCase())) { setNewAlias(''); return }
    updateDoc(doc(db, 'members', member.id), { aliases: [...aliases, a] }).catch(erro)
    setNewAlias('')
  }
  const removeAlias = (a) => {
    updateDoc(doc(db, 'members', member.id), { aliases: aliases.filter((x) => x !== a) }).catch(erro)
  }

  // Quem saiu não conta mais pra presença, semeadura de voto nem domínio,
  // mas o histórico (respostas antigas, votos gravados) fica intacto — e
  // "ativo" só preenchendo campo vazio no login sobrevive a um novo login
  const ativo = member.ativo !== false
  const toggleAtivo = () => updateDoc(doc(db, 'members', member.id), { ativo: !ativo }).catch(erro)

  return (
    <div className={`member-card ${linked ? 'linked' : 'unlinked'} ${ativo ? '' : 'membro-inativo'}`}>
      {/* Avatar */}
      <div className="member-avatar-wrap">
        {photo
          ? <img src={photo} alt={member.name} className="member-avatar" />
          : <div className="member-avatar-placeholder">{(member.name || '?')[0].toUpperCase()}</div>
        }
        {linked && <span className="member-linked-dot" title="Conta Google vinculada" />}
      </div>

      {/* Info */}
      <div className="member-info">
        <p className="member-name">{member.name}</p>

        {/* Instrumento */}
        {canEdit && editingRole ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ fontSize: '0.8rem', flex: 1 }}>
              <option value="">Instrumento...</option>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} aria-label="Confirmar instrumento" title="Confirmar instrumento" onClick={saveRole}>✓</button>
            <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} aria-label="Cancelar edição" title="Cancelar edição" onClick={() => setEditingRole(false)}>✕</button>
          </div>
        ) : (
          <p
            className="member-role"
            onClick={canEdit ? () => setEditingRole(true) : undefined}
            title={canEdit ? 'Toque pra editar' : undefined}
          >
            {member.role || (canEdit ? '+ instrumento' : '—')}
          </p>
        )}

        {/* Info extra — só admin vê */}
        {isAdmin && (
          <div className="member-admin-info">
            {linked ? (
              <>
                <span className="member-email">{member.email}</span>
                {member.mergedAt
                  ? <span className="merge-badge">✅ votos vinculados</span>
                  : <span className="merge-badge pending">⏳ aguardando fusão</span>
                }
              </>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Não logou ainda</span>
            )}
            {/* Apelidos / nomes antigos do Glissandoo */}
            <div className="member-aliases">
              <span className="alias-label" title="Nomes que essa pessoa usou no Glissandoo, pra fundir votos antigos">
                Nomes antigos (Glissandoo)
              </span>
              {aliases.length > 0 && (
                <div className="alias-chips">
                  {aliases.map((a) => (
                    <span key={a} className="song-tag editable">
                      {a}
                      <button type="button" className="tag-remove" aria-label={`Tirar apelido ${a}`} onClick={() => removeAlias(a)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="tag-edit-row">
                <input
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                  placeholder="Ex: Marcio Braz"
                  style={{ fontSize: '0.78rem' }}
                  aria-label="Novo apelido"
                />
                <button type="button" className="btn-secondary" style={{ padding: '2px 9px', fontSize: '0.75rem' }} onClick={addAlias}>+</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                className={`btn-toggle-ativo ${ativo ? '' : 'inativo'}`}
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={toggleAtivo}
                title={ativo ? 'Marcar que saiu da banda' : 'Reativar'}
              >
                {ativo ? '✓ Tá na banda' : '↩ Saiu'}
              </button>
              <button
                className="btn-ghost-danger"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                onClick={() => onRemove(member)}
              >
                Remover
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────

// ── Ferramenta: normalizar membros dos eventos ────────────────────────
// Eventos guardam os membros como texto, então quem foi renomeado no cadastro
// depois do evento continua com o nome antigo lá — e pode ficar duplicado se
// alguém marcar o nome novo. Dois passos: mostra o que muda, depois grava.
function EventNormalizeTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { changes } = await normalizeEventMembers({ dryRun: true })
      setPending(changes)
      if (!changes.length) setMsg('✅ Nenhum evento com nome antigo.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { updated } = await normalizeEventMembers()
      setMsg(`✅ ${updated} evento(s) normalizado(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '📅 Normalizar membros dos eventos'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} evento(s) com nome antigo</p>
          {pending.map((c) => (
            <p key={c.id} className="event-normalize-item">
              <strong>{c.date}</strong>: {c.before.join(', ')}
              <br />→ {c.after.join(', ')}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
              {busy ? 'Gravando...' : `Aplicar em ${pending.length} evento(s)`}
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Ferramenta: migrar a lista de membros pra presença por pessoa ─────
// A lista antiga era um texto marcado por qualquer um. Eventos já realizados
// guardam o histórico como "Vou"; os futuros nascem em branco pra banda
// confirmar de verdade. Quem não está no cadastro vira "convidado".
function PresenceMigrateTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { changes } = await migrateEventPresence({ dryRun: true })
      setPending(changes)
      if (!changes.length) setMsg('✅ Nenhum evento com lista antiga.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { updated } = await migrateEventPresence()
      setMsg(`✅ ${updated} evento(s) migrado(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '👥 Migrar pra presença por pessoa'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} evento(s)</p>
          {pending.map((c) => (
            <p key={c.id} className="event-normalize-item">
              <strong>{c.date}</strong> {c.passado ? '(realizado)' : '(futuro)'}: {c.antes.join(', ') || '—'}
              <br />→ {c.passado
                ? `Vou: ${c.vai.join(', ') || '—'}${c.convidados.length ? ` · convidados: ${c.convidados.join(', ')}` : ''}`
                : 'presença em branco'}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
              {busy ? 'Gravando...' : `Aplicar em ${pending.length} evento(s)`}
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Ferramenta: conferir a integridade dos dados ──────────────────────
// Só lê. Serve pra checar depois de uma migração se sobrou alguma ponta solta
function IntegridadeTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [itens, setItens] = useState(null)

  const rodar = async () => {
    setBusy(true)
    setMsg('')
    try {
      setItens(await verificarIntegridade())
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const alertas = (itens || []).filter((i) => !i.info && !i.ok).length

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={rodar} disabled={busy}>
        {busy ? 'Conferindo...' : '🔎 Conferir integridade dos dados'}
      </button>
      {itens && (
        <div className="event-normalize-preview">
          <p className="section-label">
            {alertas === 0 ? '✅ Nenhum problema encontrado' : `⚠️ ${alertas} ponto(s) pra olhar`}
          </p>
          {itens.map((i) => {
            const icone = i.info ? 'ℹ️' : i.ok ? '✓' : '✕'
            const cor = i.info ? 'var(--text-muted)' : i.ok ? 'var(--green)' : 'var(--red)'
            return (
              <p key={i.titulo} className="event-normalize-item">
                <strong style={{ color: cor }}>{icone} {i.titulo}</strong>
                <br />
                {i.detalhe.join(' · ')}
                {i.total > i.detalhe.length && ` … e mais ${i.total - i.detalhe.length}`}
              </p>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Ferramenta: sugestões duplicadas ──────────────────────────────────
function DedupSugestoesTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { changes } = await dedupSugestoes({ dryRun: true })
      setPending(changes)
      if (!changes.length) setMsg('✅ Nenhuma sugestão duplicada.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { updated } = await dedupSugestoes()
      setMsg(`✅ ${updated} duplicata(s) resolvida(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '🎵 Fundir sugestões duplicadas'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} música(s) com sugestão repetida</p>
          {pending.map((c) => (
            <p key={c.fica.id} className="event-normalize-item">
              <strong>{c.titulo}</strong>
              <br />
              {c.fica.votosAntes} voto(s) + {c.saem.map((s) => `${s.votos}`).join(' + ')}
              {' → '}<strong>{c.resultado.votos} voto(s)</strong>, {c.resultado.status}
              {c.repontar.length > 0 && ` · ${c.repontar.length} música do setlist repontada`}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
              {busy ? 'Gravando...' : `Aplicar em ${pending.length}`}
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Ferramenta: escala única de dificuldade ───────────────────────────
function DificuldadeTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { changes } = await migrarDificuldade({ dryRun: true })
      setPending(changes)
      if (!changes.length) setMsg('✅ Nenhum voto na escala antiga.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { updated } = await migrarDificuldade()
      setMsg(`✅ ${updated} música(s) convertida(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '🎯 Converter dificuldade pra escala única'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} música(s) com voto na escala antiga</p>
          {pending.map((c) => (
            <p key={c.id} className="event-normalize-item">
              <strong>{c.titulo}</strong>: {c.antes.join(', ')}
              <br />→ {c.depois.join(', ') || '—'}
              {c.descartados.length > 0 && ` · descartado "Ainda não vi" de ${c.descartados.join(', ')}`}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
              {busy ? 'Gravando...' : `Aplicar em ${pending.length}`}
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Ferramenta: "Tonalidade: X" das observações vira campo Tom ────────
function TomTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const { changes } = await migrarTom({ dryRun: true })
      setPending(changes)
      if (!changes.length) setMsg('✅ Nenhuma observação com tonalidade.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const { updated } = await migrarTom()
      setMsg(`✅ ${updated} música(s) atualizada(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const aplicaveis = (pending || []).filter((c) => c.update).length

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '♪ Tonalidade das observações → campo Tom'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} música(s) com tonalidade na observação</p>
          {pending.map((c) => (
            <p key={c.id} className="event-normalize-item">
              <strong>{c.titulo}</strong>: tom <strong>{c.tom}</strong>
              {c.conflito
                ? ` · ⚠️ já tem tom "${c.conflito}" cadastrado — não vou mexer`
                : ` · observação fica: ${c.notesDepois || '(vazia)'}`}
            </p>
          ))}
          {aplicaveis > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
                {busy ? 'Gravando...' : `Aplicar em ${aplicaveis}`}
              </button>
              <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Junta cadastros de membro que são a mesma pessoa ("Albano" e "Albano
// Borba") — apagava direto no clique, sem confirmar; agora segue o mesmo
// preview → Aplicar das ferramentas vizinhas, mostrando quem fica e quem some
function DedupMembersTool({ setMsg }) {
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(null)

  const preview = async () => {
    setBusy(true)
    setMsg('')
    try {
      const snap = await getDocs(collection(db, 'members'))
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const groups = []
      all.forEach((m) => {
        const group = groups.find((g) => g.some((x) => namesMatch(x.name, m.name)))
        if (group) group.push(m)
        else groups.push([m])
      })

      const duplicadas = groups.filter((g) => g.length > 1).map((group) => {
        // Prioriza quem tem firebaseUid, email, mergedAt — e nome mais completo
        const ordenado = [...group].sort((a, b) => {
          const scoreA = (a.firebaseUid ? 4 : 0) + (a.email ? 2 : 0) + (a.mergedAt ? 1 : 0)
          const scoreB = (b.firebaseUid ? 4 : 0) + (b.email ? 2 : 0) + (b.mergedAt ? 1 : 0)
          return scoreB - scoreA || (b.name || '').length - (a.name || '').length
        })
        return { mantem: ordenado[0], apaga: ordenado.slice(1) }
      })

      setPending(duplicadas)
      if (!duplicadas.length) setMsg('✅ Nenhuma duplicata encontrada.')
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const batch = writeBatch(db)
      let removed = 0
      pending.forEach(({ apaga }) => {
        apaga.forEach((dup) => { batch.delete(doc(db, 'members', dup.id)); removed++ })
      })
      await batch.commit()
      setMsg(`✅ ${removed} duplicata(s) removida(s).`)
      setPending(null)
    } catch (e) {
      setMsg(msgErro(e))
    }
    setBusy(false)
  }

  return (
    <>
      <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={preview} disabled={busy}>
        {busy && !pending ? 'Verificando...' : '🧹 Remover duplicatas'}
      </button>
      {pending?.length > 0 && (
        <div className="event-normalize-preview">
          <p className="section-label">{pending.length} grupo(s) duplicado(s)</p>
          {pending.map(({ mantem, apaga }) => (
            <p key={mantem.id} className="event-normalize-item">
              apaga {apaga.map((m) => m.name).join(', ')} · mantém {mantem.name}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn-primary" style={{ fontSize: '0.8rem' }} onClick={apply} disabled={busy}>
              {busy ? 'Removendo...' : `Aplicar em ${pending.length} grupo(s)`}
            </button>
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default function MembrosPage() {
  const { user } = useAuth()
  const isAdmin = user.email === ADMIN_EMAIL

  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [merging, setMerging] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [])

  // Um msg só pras oito ferramentas admin — antes cada uma tinha o seu, e
  // duas ou três mensagens antigas coexistiam lado a lado na mesma linha
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(''), 5000)
    return () => clearTimeout(t)
  }, [msg])

  const handleRemove = async (member) => {
    if (!confirm(`Apagar "${member.name}" do cadastro de vez? Se a pessoa só saiu da banda, use "Tá na banda → Saiu", que guarda o histórico.`)) return
    await deleteDoc(doc(db, 'members', member.id))
  }

  // Funde votos importados do Glissandoo com os votos reais (matching por nome aproximado)
  const handleMergeVotes = async () => {
    setMerging(true)
    setMsg('')
    try {
      const { merged, removed } = await mergeAllImportedVotes()
      if (merged + removed > 0) {
        setMsg(`✅ ${merged} voto(s) vinculado(s) e ${removed} duplicata(s) removida(s).`)
      } else {
        setMsg('✅ Nenhum voto pendente de fusão.')
      }
    } catch (e) {
      setMsg(msgErro(e))
    }
    setMerging(false)
  }

  const linkedCount = members.filter(m => m.firebaseUid).length

  return (
    <div className="page">
      <div className="page-header">
        <h2>Banda</h2>
        <span className="section-label" style={{ marginLeft: 'auto' }}>
          {linkedCount}/{members.length} logados
        </span>
      </div>

      {/* Ferramentas admin — recolhidas por padrão: são 8 botões que só o
          admin usa, e metade são migrações já rodadas uma vez (ver
          CHANGELOG). Abertas, empurravam os cards da banda pra baixo do
          celular toda vez que a página abria. */}
      {isAdmin && (
        <details className="admin-tools">
          <summary>🛠 Manutenção</summary>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/import" className="btn-secondary" style={{ fontSize: '0.8rem' }} title="Importar do Glissandoo">
              ⬆ Importar do Glissandoo
            </Link>
            <DedupMembersTool setMsg={setMsg} />
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleMergeVotes} disabled={merging}>
              {merging ? 'Fundindo...' : '🔗 Fundir votos duplicados'}
            </button>
            <IntegridadeTool setMsg={setMsg} />
          </div>

          <p className="section-label" style={{ marginTop: 4 }}>Já rodadas</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <EventNormalizeTool setMsg={setMsg} />
            <PresenceMigrateTool setMsg={setMsg} />
            <DedupSugestoesTool setMsg={setMsg} />
            <DificuldadeTool setMsg={setMsg} />
            <TomTool setMsg={setMsg} />
          </div>

          {msg && (
            <p style={{ fontSize: '0.8rem', marginTop: 8, color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
              {msg}
            </p>
          )}
        </details>
      )}

      {/* Grid de membros */}
      {!loaded ? (
        <p className="empty-state">Carregando...</p>
      ) : members.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum membro cadastrado.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Peça pra cada um fazer login com o Google — o cadastro é automático.
          </p>
          {isAdmin && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Ou importe do Glissandoo em "🛠 Manutenção" acima.
            </p>
          )}
        </div>
      ) : (
        <div className="members-grid">
          {members.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              isAdmin={isAdmin}
              currentUid={user.uid}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
