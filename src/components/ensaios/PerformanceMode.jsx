import { useState, useEffect, useCallback } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import MetronomeButton from '../setlist/MetronomeButton'

export default function PerformanceMode({ event, onClose }) {
  const [repertorio, setRepertorio] = useState(null)
  const [idx, setIdx] = useState(0)

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

  // Mantém a tela acesa com o celular apoiado no pedestal. O metrônomo é
  // Web Audio, não vídeo — não aciona o wake lock automático de mídia do
  // navegador sozinho. O navegador libera o lock quando a aba perde o foco
  // (troca de app, tela bloqueia), então pede de novo ao voltar.
  useEffect(() => {
    let lock = null
    const pedir = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {
        // Sem suporte, ou o navegador recusou — a tela apaga no tempo normal
      }
    }
    pedir()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') pedir()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release?.()
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
