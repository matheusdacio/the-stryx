import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import EnsaioModal from './EnsaioModal'

const STATUS_LABELS = { planejado: 'Planejado', realizado: 'Realizado', cancelado: 'Cancelado' }

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function EnsaiosPage() {
  const [ensaios, setEnsaios] = useState([])
  const [modal, setModal] = useState(null)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'ensaios'), orderBy('date', 'desc'))
    return onSnapshot(q, (snap) => setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  const remove = (e) => { if (confirm(`Remover ensaio de ${formatDate(e.date)}?`)) deleteDoc(doc(db, 'ensaios', e.id)) }

  const togglePauta = async (ensaio, index) => {
    const pauta = [...(ensaio.pauta || [])]
    pauta[index] = { ...pauta[index], done: !pauta[index].done }
    await updateDoc(doc(db, 'ensaios', ensaio.id), { pauta })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Ensaios</h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Ensaio</button>
      </div>

      {ensaios.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum ensaio cadastrado.</p>
          <button className="btn-primary" onClick={() => setModal('add')}>Agendar ensaio</button>
        </div>
      ) : (
        <div className="ensaio-list">
          {ensaios.map((ensaio) => (
            <div key={ensaio.id} className={`ensaio-card status-ens-${ensaio.status}`}>
              <div className="ensaio-header" onClick={() => setExpanded(expanded === ensaio.id ? null : ensaio.id)}>
                <div>
                  <span className="ensaio-date">{formatDate(ensaio.date)}</span>
                  {ensaio.location && <span className="ensaio-location"> · {ensaio.location}</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge-status ens-${ensaio.status}`}>{STATUS_LABELS[ensaio.status]}</span>
                  <button className="btn-remove" onClick={(e) => { e.stopPropagation(); remove(ensaio) }}>✕</button>
                </div>
              </div>

              {expanded === ensaio.id && (
                <div className="ensaio-body">
                  {ensaio.pauta?.length > 0 && (
                    <div className="pauta-list">
                      <p className="section-label">Pauta</p>
                      {ensaio.pauta.map((item, i) => (
                        <label key={i} className="pauta-item">
                          <input type="checkbox" checked={!!item.done} onChange={() => togglePauta(ensaio, i)} />
                          <span className={item.done ? 'done' : ''}>{item.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {ensaio.members?.length > 0 && (
                    <div className="members-list">
                      <p className="section-label">Membros</p>
                      <div className="members-tags">
                        {ensaio.members.map((m, i) => <span key={i} className="member-tag">{m}</span>)}
                      </div>
                    </div>
                  )}

                  {ensaio.notes && (
                    <div>
                      <p className="section-label">Observações</p>
                      <p className="ensaio-notes">{ensaio.notes}</p>
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <button className="btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setModal(ensaio)}>
                      Editar ensaio
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && <EnsaioModal ensaio={modal === 'add' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
