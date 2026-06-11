import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, orderBy, query, getDocs,
  updateDoc, deleteDoc, doc, writeBatch, deleteField,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const INSTRUMENTS = [
  'Guitarra solo', 'Guitarra base', 'Baixo', 'Bateria',
  'Vocal', 'Teclado', 'Outro',
]

// ── Card de membro ────────────────────────────────────────────────────

function MemberCard({ member, isAdmin, currentUid, onRemove }) {
  const [editingRole, setEditingRole] = useState(false)
  const [role, setRole] = useState(member.role || '')

  const linked  = !!member.firebaseUid
  const photo   = member.photoURL || null
  // Admin edita qualquer um; membro edita o próprio instrumento
  const canEdit = isAdmin || (linked && member.firebaseUid === currentUid)

  const saveRole = async () => {
    await updateDoc(doc(db, 'members', member.id), { role })
    setEditingRole(false)
  }

  return (
    <div className={`member-card ${linked ? 'linked' : 'unlinked'}`}>
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
            <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={saveRole}>✓</button>
            <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => setEditingRole(false)}>✕</button>
          </div>
        ) : (
          <p
            className="member-role"
            onClick={canEdit ? () => setEditingRole(true) : undefined}
            title={canEdit ? 'Clique para editar' : undefined}
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
            <button
              className="btn-ghost-danger"
              style={{ marginTop: 6, fontSize: '0.72rem', padding: '2px 8px' }}
              onClick={() => onRemove(member)}
            >
              Remover
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────

export default function MembrosPage() {
  const { user } = useAuth()
  const isAdmin = user.email === ADMIN_EMAIL

  const [members, setMembers] = useState([])
  const [deduping, setDeduping] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const handleRemove = async (member) => {
    if (!confirm(`Remover "${member.name}" da banda?`)) return
    await deleteDoc(doc(db, 'members', member.id))
  }

  // Remove membros duplicados (mesmo nome) — mantém o que tem mais dados
  const handleDedup = async () => {
    setDeduping(true)
    setMsg('')
    try {
      const snap = await getDocs(collection(db, 'members'))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Agrupa por nome normalizado
      const groups = {}
      all.forEach(m => {
        const key = (m.name || '').toLowerCase().trim()
        if (!groups[key]) groups[key] = []
        groups[key].push(m)
      })

      const batch = writeBatch(db)
      let removed = 0

      Object.values(groups).forEach(group => {
        if (group.length < 2) return
        // Ordena: prioriza quem tem firebaseUid, email, mergedAt
        group.sort((a, b) => {
          const scoreA = (a.firebaseUid ? 4 : 0) + (a.email ? 2 : 0) + (a.mergedAt ? 1 : 0)
          const scoreB = (b.firebaseUid ? 4 : 0) + (b.email ? 2 : 0) + (b.mergedAt ? 1 : 0)
          return scoreB - scoreA
        })
        // Mantém o primeiro, remove os demais
        group.slice(1).forEach(dup => {
          batch.delete(doc(db, 'members', dup.id))
          removed++
        })
      })

      if (removed > 0) {
        await batch.commit()
        setMsg(`✅ ${removed} duplicata(s) removida(s).`)
      } else {
        setMsg('✅ Nenhuma duplicata encontrada.')
      }
    } catch (e) {
      setMsg(`❌ Erro: ${e.message}`)
    }
    setDeduping(false)
  }

  const linkedCount = members.filter(m => m.firebaseUid).length

  return (
    <div className="page">
      <div className="page-header">
        <h2>A Banda</h2>
        <span className="section-label" style={{ marginLeft: 'auto' }}>
          {linkedCount}/{members.length} logados
        </span>
      </div>

      {/* Ferramentas admin */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleDedup} disabled={deduping}>
            {deduping ? 'Removendo...' : '🧹 Remover duplicatas'}
          </button>
          {msg && (
            <span style={{ fontSize: '0.8rem', color: msg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>
              {msg}
            </span>
          )}
        </div>
      )}

      {/* Grid de membros */}
      {members.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum membro cadastrado.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Importe os membros na página de Importação ou peça para cada um fazer login.
          </p>
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
