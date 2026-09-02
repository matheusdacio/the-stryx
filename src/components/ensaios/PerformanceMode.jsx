import { useState, useEffect, useCallback } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import MetronomeButton from '../setlist/MetronomeButton'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'
import { acharCifra } from '../../utils/score'

export default function PerformanceMode({ event, onClose }) {
  useFecharComVoltar(onClose)
  const [repertorio, setRepertorio] = useState(null)
  // Volta pra onde parou: sair (ou cair da tela) no meio do set e reabrir
  // não deveria empurrar de volta pra música 1
  const [idx, setIdx] = useState(() => {
    try {
      const salvo = sessionStorage.getItem(`perf-idx-${event.id}`)
      return salvo ? Number(salvo) : 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    try { sessionStorage.setItem(`perf-idx-${event.id}`, String(idx)) } catch { /* sem storage, segue sem lembrar */ }
  }, [idx, event.id])

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

  // Cifra por título+artista (F88) — quem depende dela hoje sai do palco,
  // busca na aba Cifras e perde a posição do set
  const [cifras, setCifras] = useState([])
  useEffect(() => {
    return onSnapshot(collection(db, 'cifras'), (snap) =>
      setCifras(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])
  const [mostrarCifra, setMostrarCifra] = useState(false)

  const setlist = (event.setlist || []).map((s) => ({ ...s, ...(repertorio?.[s.id] || {}) }))

  // idx restaurado do sessionStorage pode não caber mais (o repertório
  // encolheu desde a última vez) — nunca deixa current vir undefined
  const idxAtual = Math.max(0, Math.min(idx, setlist.length - 1))
  const current = setlist[idxAtual]
  const next = setlist[idxAtual + 1] || null
  const cifraAtual = current ? acharCifra(cifras, current.title, current.artist) : null

  // Trocar de música fecha a cifra da anterior — senão parece que a letra
  // na tela é da música que está tocando agora
  const [idxDaCifraAberta, setIdxDaCifraAberta] = useState(idxAtual)
  if (mostrarCifra && idxAtual !== idxDaCifraAberta) {
    setIdxDaCifraAberta(idxAtual)
    setMostrarCifra(false)
  }

  const goNext = useCallback(() => setIdx((i) => Math.min(i + 1, setlist.length - 1)), [setlist.length])
  const goPrev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), [])

  // Teclado: setas navegam (Esc sai via useFecharComVoltar)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

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
        <span className="perf-progress">{idxAtual + 1} / {setlist.length}</span>
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
          {cifraAtual && (
            <button
              className="perf-cifra-toggle"
              onClick={(e) => { e.stopPropagation(); setMostrarCifra(!mostrarCifra) }}
            >
              📄 {mostrarCifra ? 'Fechar cifra' : 'Cifra'}
            </button>
          )}
        </div>
        {current.notes && <p className="perf-notes">{current.notes}</p>}
        {mostrarCifra && cifraAtual && (
          <pre className="perf-cifra-content" onClick={(e) => e.stopPropagation()}>
            {cifraAtual.content || 'Sem conteúdo.'}
          </pre>
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
        <button className="perf-nav-btn" onClick={goPrev} disabled={idxAtual === 0}>‹ Anterior</button>
        <button className="perf-nav-btn primary" onClick={goNext} disabled={idxAtual === setlist.length - 1}>Próxima ›</button>
      </div>
    </div>
  )
}
