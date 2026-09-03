import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { Link } from 'react-router-dom'
import { isIOS } from '../utils/device'

// Guia de 3 passos pra quem ainda não escolheu instrumento — pega tanto
// quem acabou de logar quanto membro importado do Glissandoo que nunca
// preencheu isso, então o texto não presume "você acabou de entrar"
export default function WelcomeBanner({ user, suportadoNotif, onAtivarNotif }) {
  const [membro, setMembro] = useState(null)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'members'), where('firebaseUid', '==', user.uid))
    return onSnapshot(q, (snap) => {
      const d = snap.docs[0]
      setMembro(d ? { id: d.id, ...d.data() } : null)
    })
  }, [user])

  if (!membro || membro.role || membro.boasVindasFechadaEm) return null

  const fechar = () => updateDoc(doc(db, 'members', membro.id), { boasVindasFechadaEm: new Date().toISOString() })

  return (
    <div className="app-banner app-banner-welcome">
      <div>
        <strong>Fala, {user.displayName?.split(' ')[0]}! Três coisas rápidas:</strong>
        <ol>
          <li><Link to="/membros">Diz teu instrumento na aba Banda</Link></li>
          {suportadoNotif ? (
            <li><button className="btn-link-inline" onClick={onAtivarNotif}>Ativa o 🔔 pra saber de sugestão e ensaio</button></li>
          ) : isIOS ? (
            <li>No iPhone, adiciona o app na tela inicial pra receber lembrete de ensaio</li>
          ) : null}
          <li>Marca em cada música o quanto tu já domina — é isso que escolhe o que a gente ensaia</li>
        </ol>
      </div>
      <button className="btn-secondary" onClick={fechar}>Entendi</button>
    </div>
  )
}
