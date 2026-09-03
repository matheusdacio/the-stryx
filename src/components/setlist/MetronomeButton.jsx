import { useState, useRef, useEffect } from 'react'

// Só um metrônomo toca por vez — dois cards abertos tocando junto (ou
// recolher um card com o som ligado, que desmonta o botão) confundia mais
// do que ajudava
let pararAtivo = null

// Tick agendado com precisão no relógio do AudioContext
function scheduleTick(ctx, time, accent) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = accent ? 1200 : 800
  gain.gain.setValueAtTime(0.5, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(time)
  osc.stop(time + 0.07)
}

export default function MetronomeButton({ bpm }) {
  const [playing, setPlaying] = useState(false)
  const ctxRef = useRef(null)
  const timerRef = useRef(null)
  const nextTickRef = useRef(0)
  const beatRef = useRef(0)

  const stop = () => {
    clearInterval(timerRef.current)
    timerRef.current = null
    setPlaying(false)
    if (pararAtivo === stop) pararAtivo = null
  }

  const start = () => {
    if (!bpm || bpm < 20) return
    pararAtivo?.()
    pararAtivo = stop
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    const ctx = ctxRef.current
    ctx.resume()

    const interval = 60 / bpm
    nextTickRef.current = ctx.currentTime + 0.05
    beatRef.current = 0

    // Scheduler: a cada 25ms agenda os ticks da próxima janela de 100ms
    timerRef.current = setInterval(() => {
      while (nextTickRef.current < ctx.currentTime + 0.1) {
        scheduleTick(ctx, nextTickRef.current, beatRef.current % 4 === 0)
        nextTickRef.current += interval
        beatRef.current++
      }
    }, 25)
    setPlaying(true)
  }

  const toggle = (e) => {
    e.stopPropagation()
    playing ? stop() : start()
  }

  // Se o BPM mudar enquanto toca, reinicia no novo andamento
  useEffect(() => {
    if (playing) { stop(); start() }
  }, [bpm])

  // Cleanup ao desmontar
  useEffect(() => () => {
    clearInterval(timerRef.current)
    ctxRef.current?.close()
  }, [])

  if (!bpm) return null

  return (
    <button
      className={`btn-metronome ${playing ? 'playing' : ''}`}
      // O pulso visual piscava num ritmo fixo de 0.5s, igual pra 60 ou
      // 180 BPM — inútil como referência quando o clique some no barulho
      // da sala. Duração do ciclo = duração da batida
      style={playing ? { animationDuration: `${60 / bpm}s` } : undefined}
      onClick={toggle}
      title={playing ? 'Parar metrônomo' : `Tocar metrônomo a ${bpm} BPM`}
      aria-pressed={playing}
    >
      {playing ? '⏸' : '▶'} {bpm} BPM
    </button>
  )
}
