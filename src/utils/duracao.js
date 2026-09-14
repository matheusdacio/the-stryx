// "3:45" -> segundos. Aceita só minutos ("4") também. null se não der pra entender
export function parseDuracao(texto) {
  const t = (texto || '').trim()
  if (!t) return null
  const comSegundos = t.match(/^(\d+):([0-5]?\d)$/)
  if (comSegundos) return Number(comSegundos[1]) * 60 + Number(comSegundos[2])
  if (/^\d+$/.test(t)) return Number(t) * 60
  return null
}

// segundos -> "3:45"
export function formatarDuracao(seg) {
  if (!seg) return ''
  const m = Math.floor(seg / 60)
  const s = seg % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Soma de segundos -> "2h17" (com hora) ou "42min" (só minutos)
export function formatarDuracaoTotal(segTotal) {
  if (!segTotal) return ''
  const h = Math.floor(segTotal / 3600)
  const m = Math.round((segTotal % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
  return `${m}min`
}
