import { useState, useEffect } from 'react'
import { collection, onSnapshot, orderBy, query, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import CifraModal from './CifraModal'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export default function CifrasPage() {
  const [cifras, setCifras] = useState([])
  const [modal, setModal] = useState(null) // null | 'add' | cifra object (edit/view)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'cifras'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => setCifras(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  }, [])

  const filtered = cifras.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.artist || '').toLowerCase().includes(search.toLowerCase())
  )

  const remove = (cifra) => {
    if (confirm(`Apagar a cifra de "${cifra.title}"? Não dá pra desfazer.`)) deleteDoc(doc(db, 'cifras', cifra.id))
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Cifras</h2>
        <button className="btn-primary" onClick={() => setModal('add')}>+ Cifra</button>
      </div>

      <input
        className="search-input"
        placeholder="Buscar por título ou artista..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{search ? 'Nenhuma cifra encontrada.' : 'Nenhuma cifra ainda.'}</p>
          {!search && <button className="btn-primary" onClick={() => setModal('add')}>Adicionar primeira cifra</button>}
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((cifra) => (
            <div key={cifra.id} className="cifra-card" onClick={() => setModal(cifra)}>
              <div className="cifra-card-header">
                <div>
                  <span className="cifra-title">{cifra.title}</span>
                  {cifra.artist && <span className="cifra-artist">{cifra.artist}</span>}
                </div>
              </div>
              <div className="cifra-meta">
                {cifra.key && <span className="badge badge-key">Tom: {cifra.key}</span>}
                {cifra.bpm && <span className="badge badge-bpm">{cifra.bpm} BPM</span>}
              </div>
              <p className="cifra-preview">{cifra.content?.slice(0, 80)}...</p>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CifraModal
          cifra={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onRemove={modal !== 'add' ? () => { remove(modal); setModal(null) } : undefined}
          KEYS={KEYS}
        />
      )}
    </div>
  )
}
