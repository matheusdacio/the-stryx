import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { getYouTubeId, loadYouTubeApi } from '../../utils/youtube'
import MetronomeButton from '../setlist/MetronomeButton'

export default function PerformanceMode({ event, onClose }) {
  const [repertorio, setRepertorio] = useState(null)
  const [idx, setIdx] = useState(0)
  const [tocando, setTocando] = useState(false)
  // Guarda o id que falhou, não um booleano: assim o aviso desaparece sozinho
  // quando a música muda, sem precisar limpar estado dentro do efeito
  const [erroDe, setErroDe] = useState(null)
  const playerRef = useRef(null)
  const containerRef = useRef(null)
  const totalRef = useRef(0)
  const videoIdRef = useRef(null)

  // O evento guarda um retrato das músicas (título, artista, BPM) de quando
  // foi montado. Tom e observações mudam no repertório, então lemos de lá e
  // caímos no retrato se a música tiver sido removida do setlist
  useEffect(() => {
    return onSnapshot(collection(db, 'songs'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      setRepertorio(map)
    })
  }, [])

  const setlist = (event.setlist || []).map((s) => ({ ...s, ...(repertorio?.[s.id] || {}) }))

  const current = setlist[idx]
  const next = setlist[idx + 1] || null
  const videoId = getYouTubeId(current?.videoUrl)
  const erroVideo = !!videoId && erroDe === videoId

  // O player consulta o total dentro do callback do YouTube, fora do render
  useEffect(() => { totalRef.current = setlist.length }, [setlist.length])

  const goNext = useCallback(() => setIdx((i) => Math.min(i + 1, setlist.length - 1)), [setlist.length])
  const goPrev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), [])

  // Player embutido: encadeia o setlist sem sair pro YouTube. Criado uma vez
  // quando liga; a troca de música usa loadVideoById (recriar o player a cada
  // faixa faria a reprodução engasgar)
  useEffect(() => {
    if (!tocando) return
    let cancelado = false

    loadYouTubeApi().then((YT) => {
      if (cancelado || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e) => {
            // Terminou a música: emenda a próxima, ou encerra no fim do set
            if (e.data !== YT.PlayerState.ENDED) return
            setIdx((i) => {
              if (i + 1 < totalRef.current) return i + 1
              setTocando(false)
              return i
            })
          },
          // Vídeo removido ou com incorporação bloqueada pelo dono
          onError: () => setErroDe(videoIdRef.current),
        },
      })
    })

    return () => {
      cancelado = true
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [tocando])

  // Troca a faixa quando a música muda (ou quando o player acabou de nascer)
  useEffect(() => {
    videoIdRef.current = videoId
    const player = playerRef.current
    if (!tocando || !player?.loadVideoById) return
    if (videoId) player.loadVideoById(videoId)
    else player.stopVideo?.()
  }, [videoId, tocando])

  // Teclado: setas navegam, Esc sai
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  // Tenta fullscreen do navegador (melhor no palco); ignora se bloqueado
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  if (!current) return null

  return (
    <div className="perf-overlay">
      {/* Topo: progresso e sair */}
      <div className="perf-top">
        <span className="perf-progress">{idx + 1} / {setlist.length}</span>
        <span className="perf-event-name">
          {event.type === 'apresentacao' ? '🎤' : '🎸'} {event.location || ''}
        </span>
        <button
          className={`perf-play ${tocando ? 'active' : ''}`}
          onClick={() => setTocando(!tocando)}
          title={tocando ? 'Parar' : 'Tocar o set em sequência'}
        >
          {tocando ? '■ Parar' : '▶ Tocar'}
        </button>
        <button className="perf-close" onClick={onClose}>✕</button>
      </div>

      {/* Música atual */}
      <div className="perf-current" onClick={goNext}>
        <p className="perf-now-label">Tocando agora</p>
        <h1 className="perf-title">{current.title}</h1>
        {current.artist && <p className="perf-artist">{current.artist}</p>}
        <div className="perf-chips">
          {current.tom && <span className="perf-tom">♪ {current.tom}</span>}
          {current.bpm && (
            <span className="perf-bpm" onClick={(e) => e.stopPropagation()}>
              <MetronomeButton bpm={current.bpm} />
            </span>
          )}
        </div>
        {current.notes && <p className="perf-notes">{current.notes}</p>}
      </div>

      {tocando && (
        <div className="perf-player" onClick={(e) => e.stopPropagation()}>
          {videoId ? (
            <div className="perf-player-box"><div ref={containerRef} /></div>
          ) : (
            <p className="perf-player-aviso">Esta música não tem link do YouTube cadastrado.</p>
          )}
          {erroVideo && (
            <p className="perf-player-aviso">
              O dono do vídeo não permite tocar fora do YouTube. Pule pra próxima.
            </p>
          )}
        </div>
      )}

      {/* Próxima música */}
      <div className="perf-next">
        {next ? (
          <>
            <p className="perf-next-label">Próxima</p>
            <p className="perf-next-title">
              {next.title}
              {next.artist && <span className="perf-next-artist"> — {next.artist}</span>}
              {next.tom && <span className="perf-next-bpm"> · ♪ {next.tom}</span>}
              {next.bpm && <span className="perf-next-bpm"> · {next.bpm} BPM</span>}
            </p>
          </>
        ) : (
          <p className="perf-next-label">🏁 Última música do set!</p>
        )}
      </div>

      {/* Navegação */}
      <div className="perf-nav">
        <button className="perf-nav-btn" onClick={goPrev} disabled={idx === 0}>‹ Anterior</button>
        <button className="perf-nav-btn primary" onClick={goNext} disabled={idx === setlist.length - 1}>Próxima ›</button>
      </div>
    </div>
  )
}
