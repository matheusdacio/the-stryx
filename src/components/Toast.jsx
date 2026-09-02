import { useEffect, useState, useRef } from 'react'
import { setToastListener } from '../utils/toast'

// Confirmação visível de "isso deu certo" quando a ação só some da tela
// (aprovar sugestão, devolver música) — sem isso o único feedback era o
// item desaparecer, sem dizer que foi mesmo o que a pessoa esperava
export default function Toast() {
  const [mensagem, setMensagem] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    setToastListener((msg) => {
      clearTimeout(timer.current)
      setMensagem(msg)
      timer.current = setTimeout(() => setMensagem(null), 2500)
    })
    return () => setToastListener(null)
  }, [])

  if (!mensagem) return null
  return <div className="toast">{mensagem}</div>
}
