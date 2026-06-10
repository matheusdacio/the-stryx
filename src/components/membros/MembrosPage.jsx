import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, orderBy, query, getDocs,
  updateDoc, doc, writeBatch, deleteField,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const INSTRUMENTS = [
  'Guitarra solo', 'Guitarra base', 'Baixo', 'Bateria',
  'Vocal', 'Teclado', 'Outro',
]

// ── Card de membro ────────────────────────────────────────────────────

function MemberCard({ member, isAdmin, unlinkedUsers, onLink, onUpdateRole }) {
  const [editingRole, setEditingRole] = useState(false)
  const [role, setRole] = useState(member.role || '')
  const [linking, setLinking] = useState(false)

  const linked = !!member.firebaseUid
  const photo  = member.photoURL || null

  const saveRole = async () => {
    await updateDoc(doc(db, 'members', member.id), { role })
    setEditingRole(false)
    onUpdateRole(member.id, role)
  }

  const handleLink = async (userUid, userEmail, displayName, photoURL) => {
    setLinking(true)
    await updateDoc(doc(db, 'members', member.id), {
      firebaseUid: userUid,
      email: userEmail,
      displayName,
      photoURL,
    })
    onLink(member.id, userUid)

    // Funde votos importados imediatamente
    try {
      const importKey = `import_${member.name.trim().replace(/\s+/g, '_')}`
      const sugestoesSnap = await getDocs(collection(db, 'sugestoes'))
      const batch = writeBatch(db)
      let count = 0
      sugestoesSnap.forEach(sDoc => {
        const opinoes = sDoc.data().opinoes || {}
        if (!opinoes[importKey]) return
        if (!opinoes[userUid]) {
          batch.update(sDoc.ref, {
            [`opinoes.${userUid}`]: { ...opinoes[importKey], userName: member.name.trim() },
            [`opinoes.${importKey}`]: deleteField(),
          })
        } else {
          batch.update(sDoc.ref, { [`opinoes.${importKey}`]: deleteField() })
        }
        count++
      })
      if (count > 0) {
        await batch.commit()
        await updateDoc(doc(db, 'members', member.id), { mergedAt: new Date().toISOString() })
      }
    } catch (e) { console.warn('link merge:', e) }

    setLinking(false)
  }

  return (
    <div className={`member-card ${linked ? 'linked' : 'unlinked'}`}>
      {/* Avatar */}
      <div className="member-avatar-wrap">
        {photo
          ? <img src={photo} alt={member.name} className="member-avatar" />
          : <div className="member-avatar-placeholder">{member.name[0]}</div>
        }
        {linked && <span className="member-linked-dot" title="Conta Google vinculada" />}
      </div>

      {/* Info */}
      <div className="member-info">
        <p className="member-name">{member.name}</p>

        {/* Instrumento / role */}
        {editingRole ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              style={{ fontSize: '0.8rem', flex: 1 }}
            >
              <option value="">Instrumento...</option>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={saveRole}>✓</button>
            <button className="btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => setEditingRole(false)}>✕</button>
          </div>
        ) : (
          <p
            className="member-role"
            onClick={isAdmin ? () => setEditingRole(true) : undefined}
            title={isAdmin ? 'Clique para editar' : undefined}
          >
            {member.role || (isAdmin ? '+ instrumento' : '—')}
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
              <div className="link-section">
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Não logou ainda</span>
                {unlinkedUsers.length > 0 && (
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--red)' }}>
                      Vincular manualmente ▾
                    </summary>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {unlinkedUsers.map(u => (
                        <button
                          key={u.uid}
                          className="btn-secondary"
                          style={{ fontSize: '0.75rem', textAlign: 'left', padding: '4px 8px' }}
                          disabled={linking}
                          onClick={() => handleLink(u.uid, u.email, u.displayName, u.photoURL)}
                        >
                          {u.displayName} — {u.email}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
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
  const [unlinkedUsers, setUnlinkedUsers] = useState([])

  // Carrega membros em tempo real
  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('name'))
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  // Carrega usuários que logaram mas ainda não estão vinculados (só admin)
  useEffect(() => {
    if (!isAdmin) return
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      setUnlinkedUsers(allUsers) // filtra no render abaixo
    })
    return unsub
  }, [isAdmin])

  const linkedUids = new Set(members.map(m => m.firebaseUid).filter(Boolean))
  const pendingUsers = unlinkedUsers.filter(u => !linkedUids.has(u.uid))

  const handleLink = (memberId, userUid) => {
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, firebaseUid: userUid } : m
    ))
  }

  const handleUpdateRole = (memberId, role) => {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
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

      {/* Grid de membros */}
      <div className="members-grid">
        {members.map(m => (
          <MemberCard
            key={m.id}
            member={m}
            isAdmin={isAdmin}
            unlinkedUsers={pendingUsers}
            onLink={handleLink}
            onUpdateRole={handleUpdateRole}
          />
        ))}
      </div>

      {/* Logins não vinculados (só admin) */}
      {isAdmin && pendingUsers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p className="section-label">⚠ Logins sem membro vinculado</p>
          <p className="import-desc" style={{ marginBottom: 8 }}>
            Estas pessoas fizeram login mas não estão associadas a nenhum membro. Clique em "Vincular manualmente" no card do membro correto para associar.
          </p>
          {pendingUsers.map(u => (
            <div key={u.uid} className="pending-user">
              {u.photoURL && <img src={u.photoURL} alt={u.displayName} style={{ width: 28, height: 28, borderRadius: '50%', marginRight: 8 }} />}
              <span style={{ fontWeight: 600 }}>{u.displayName}</span>
              <span className="member-email">{u.email}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                último login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('pt-BR') : '?'}
              </span>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 && (
        <div className="empty-state">
          <p>Nenhum membro cadastrado ainda.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Importe os membros do Glissandoo na página de Importação.
          </p>
        </div>
      )}
    </div>
  )
}
