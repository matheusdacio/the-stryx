import { useState, useEffect, useCallback } from 'react'
import MetronomeButton from '../setlist/MetronomeButton'

export default function PerformanceMode({ event, onClose }) {
  const setlist = event.setlist || []
  const [idx, setIdx] = useState(0)

  const current = setlist[idx]
  const next = setlist[idx + 1] || null

  const goNext = useCallback(() => setIdx((i) => Math.min(i + 1, setlist.length - 1)), [setlist.length])
  const goPrev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), [])

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
        <button className="perf-close" onClick={onClose}>✕</button>
      </div>

      {/* Música atual */}
      <div className="perf-current" onClick={goNext}>
        <p className="perf-now-label">Tocando agora</p>
        <h1 className="perf-title">{current.title}</h1>
        {current.artist && <p className="perf-artist">{current.artist}</p>}
        {current.bpm && (
          <div className="perf-bpm" onClick={(e) => e.stopPropagation()}>
            <MetronomeButton bpm={current.bpm} />
          </div>
        )}
      </div>

      {/* Próxima música */}
      <div className="perf-next">
        {next ? (
          <>
            <p className="perf-next-label">Próxima</p>
            <p className="perf-next-title">
              {next.title}
              {next.artist && <span className="perf-next-artist"> — {next.artist}</span>}
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
