import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getYouTubeId, loadYouTubeApi } from '../utils/youtube'

// Toca o repertório do evento em sequência, emendando a próxima quando a
// atual termina. Precisa da IFrame API: o embed simples não avisa o fim do
// vídeo, e é esse aviso que encadeia o set.
export default function SetPlayer({ setlist, onFechar }) {
  const [idx, setIdx] = useState(0)
  const [erroDe, setErroDe] = useState(null)
  const playerRef = useRef(null)
  const containerRef = useRef(null)
  const totalRef = useRef(0)

  // O evento guarda só um retrato da música (título, artista, BPM) — o link do
  // vídeo vive no repertório, então é de lá que ele vem
  const [repertorio, setRepertorio] = useState(null)
  useEffect(() => {
    return onSnapshot(collection(db, 'songs'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      setRepertorio(map)
    })
  }, [])

  // Só entram no player as músicas que têm vídeo cadastrado
  const faixas = (setlist || [])
    .map((s) => ({ ...s, ...(repertorio?.[s.id] || {}) }))
    .filter((s) => getYouTubeId(s.videoUrl))
  const atual = faixas[idx]
  const videoId = getYouTubeId(atual?.videoUrl)
  const erro = !!videoId && erroDe === videoId

  useEffect(() => { totalRef.current = faixas.length }, [faixas.length])

  // O player só nasce quando o repertório chegou e existe faixa pra tocar —
  // antes disso o container ainda nem está na tela
  const pronto = !!repertorio && faixas.length > 0

  useEffect(() => {
    if (!pronto) return
    let cancelado = false
    loadYouTubeApi().then((YT) => {
      if (cancelado || !containerRef.current) return
      playerRef.current = new YT.Player(containerRef.current, {
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onStateChange: (e) => {
            if (e.data !== YT.PlayerState.ENDED) return
            setIdx((i) => (i + 1 < totalRef.current ? i + 1 : i))
          },
          onError: () => setErroDe(playerRef.current?.getVideoData?.().video_id || null),
        },
      })
    })
    return () => {
      cancelado = true
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [pronto])

  useEffect(() => {
    const player = playerRef.current
    if (videoId && player?.loadVideoById) player.loadVideoById(videoId)
  }, [videoId])

  if (!repertorio) return <p className="lookup-aviso">Carregando o repertório…</p>
  if (!faixas.length) {
    return <p className="lookup-aviso">Nenhuma música deste evento tem link do YouTube cadastrado.</p>
  }

  return (
    <div className="set-player" onClick={(e) => e.stopPropagation()}>
      <div className="set-player-topo">
        <span>{idx + 1} / {faixas.length} · <strong>{atual?.title}</strong></span>
        <button type="button" className="btn-meta-add" onClick={onFechar}>✕ Fechar</button>
      </div>

      <div className="perf-player-box"><div ref={containerRef} /></div>

      {erro && (
        <p className="lookup-aviso">
          O dono do vídeo não permite tocar fora do YouTube. Pule pra próxima.
        </p>
      )}

      <div className="set-player-nav">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIdx((i) => Math.max(i - 1, 0))}
          disabled={idx === 0}
        >
          ‹ Anterior
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setIdx((i) => Math.min(i + 1, faixas.length - 1))}
          disabled={idx === faixas.length - 1}
        >
          Próxima ›
        </button>
      </div>
    </div>
  )
}
