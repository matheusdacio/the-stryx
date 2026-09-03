import { useState } from 'react'
import { getYouTubeId } from '../utils/youtube'

// Toca a música dentro do app em vez de mandar pro YouTube. Começa como
// miniatura e só carrega o vídeo quando alguém clica — uma lista com dezenas
// de músicas não pode abrir dezenas de players.
//
// Controlado (aberto/onToggle) quando o pai precisa coordenar vários vídeos
// (ex.: um só tocando por vez); sem essas props, mantém estado próprio.
export default function VideoInline({ url, title, compacto = false, aberto, onToggle }) {
  const [tocandoLocal, setTocandoLocal] = useState(false)
  const controlado = onToggle !== undefined
  const tocando = controlado ? aberto : tocandoLocal
  const setTocando = controlado ? onToggle : setTocandoLocal

  const id = getYouTubeId(url)
  if (!id) return null

  if (!tocando) {
    return (
      <button
        type="button"
        className={compacto ? 'btn-tocar' : 'yt-thumb-wrap'}
        onClick={(e) => { e.stopPropagation(); setTocando(true) }}
        title="Tocar aqui"
      >
        {compacto ? '▶ Tocar' : (
          <>
            <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt={title} className="yt-thumb" />
            <div className="yt-play-icon">▶</div>
          </>
        )}
      </button>
    )
  }

  return (
    <div className="video-inline" onClick={(e) => e.stopPropagation()}>
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
        title={title || 'Vídeo'}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      <button type="button" className="btn-fechar-video" onClick={() => setTocando(false)}>✕ Fechar vídeo</button>
    </div>
  )
}
