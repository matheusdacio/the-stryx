import { useEffect, useState } from 'react'
import {
  buscarMusicas, buscarVideo, buscarTomEBpm,
  buscaVideoAtiva, buscaTomAtiva,
} from '../utils/lookup'

// Sugere a música a partir do que já foi digitado no título. Não preenche
// nada sozinho — quem cadastra escolhe qual é, e só então o resto é buscado.
export default function MusicLookup({ titulo, onPick }) {
  const [opcoes, setOpcoes] = useState([])
  const [escolhido, setEscolhido] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  // Consultando cobre o debounce inteiro (não só a rede) e buscadoPara
  // marca pra qual termo a busca voltou — sem isso, "não achei" podia
  // aparecer ainda referindo-se ao termo anterior, com opcoes desatualizada
  const [consultando, setConsultando] = useState(false)
  const [buscadoPara, setBuscadoPara] = useState('')

  const termo = (titulo || '').trim()
  const mostrar = termo.length >= 3 && termo !== escolhido && opcoes.length > 0
  const naoAchou = termo.length >= 3 && termo !== escolhido && !consultando && buscadoPara === termo && opcoes.length === 0

  // Liga "consultando" já no render (não no efeito): cobre o debounce
  // inteiro, não só a rede que só começa 600ms depois
  const [termoAnunciado, setTermoAnunciado] = useState(termo)
  if (termo !== termoAnunciado && termo.length >= 3) {
    setTermoAnunciado(termo)
    setConsultando(true)
  }

  // Espera a pessoa parar de digitar antes de bater na API
  useEffect(() => {
    if (termo.length < 3) return
    let cancelado = false
    const timer = setTimeout(() => {
      buscarMusicas(termo)
        .then((r) => { if (!cancelado) { setOpcoes(r); setErro(''); setBuscadoPara(termo) } })
        .catch(() => { if (!cancelado) setErro('Não consegui buscar agora.') })
        .finally(() => { if (!cancelado) setConsultando(false) })
    }, 600)
    return () => { cancelado = true; clearTimeout(timer); setConsultando(false) }
  }, [termo])

  const escolher = async (op) => {
    setEscolhido(op.title)
    const dados = { title: op.title, artist: op.artist }

    // Vídeo e tom só quando as chaves existem; se falharem, segue com o resto
    if (buscaVideoAtiva || buscaTomAtiva) {
      setBuscando(true)
      try {
        if (buscaVideoAtiva) {
          const link = await buscarVideo(op.title, op.artist)
          if (link) dados.videoUrl = link
        }
        if (buscaTomAtiva) {
          const extra = await buscarTomEBpm(op.title, op.artist)
          if (extra?.tom) dados.tom = extra.tom
          if (extra?.bpm) dados.bpm = extra.bpm
        }
      } catch {
        setErro('Achei o artista, mas a busca de vídeo/tom falhou.')
      }
      setBuscando(false)
    }

    onPick(dados)
  }

  if (consultando) return <p className="lookup-aviso">Procurando no catálogo…</p>
  if (erro && !mostrar) return <p className="lookup-aviso">{erro}</p>
  if (buscando) return <p className="lookup-aviso">Buscando vídeo e tom…</p>
  if (naoAchou) return <p className="lookup-aviso">Não achei no catálogo — preenche na mão.</p>
  if (!mostrar) return null

  return (
    <div className="lookup-box">
      <p className="section-label">É alguma destas?</p>
      <div className="lookup-opcoes">
        {opcoes.map((op) => (
          <button
            key={`${op.title}|${op.artist}`}
            type="button"
            className="lookup-opcao"
            onClick={() => escolher(op)}
          >
            <strong>{op.title}</strong>
            <span> — {op.artist}</span>
            {op.ano && <span className="lookup-ano"> · {op.ano}</span>}
          </button>
        ))}
      </div>
      {erro && <p className="lookup-aviso">{erro}</p>}
    </div>
  )
}
