// Data do evento num padrão único em todo o app — antes cada tela tinha o
// seu jeito (curto, longo, ISO cru, split/reverse na mão), e a mesma aba
// chegava a mostrar duas grafias diferentes uma embaixo da outra.
// curta: "qua., 02/09" (linhas) · padrão: "quarta, 02/09/2026" (destaque)
export function formatData(ts, { curta = false } = {}) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  // Curta some com o ano — mas um evento Realizado/Cancelado de ano
  // anterior sem ano fica ambíguo ("qua., 02/09" de que ano?)
  const foraDoAno = curta && d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString('pt-BR', {
    weekday: curta ? 'short' : 'long',
    day: '2-digit',
    month: '2-digit',
    ...(curta && !foraDoAno ? {} : { year: curta ? '2-digit' : 'numeric' }),
  })
}

// Meia-noite do dia do timestamp, sem hora — base de toda comparação "é
// hoje/já passou/faltam quantos dias". O evento é gravado ao meio-dia
// (EnsaioModal), então comparar por instante faria o de hoje contar como
// passado ou "amanhã" antes da hora certa
export function diaDe(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Já passou do dia: não faz sentido perguntar se a pessoa vai, e o resumo
// passa a falar no passado.
export function jaPassou(ts) {
  if (!ts) return false
  return diaDe(ts) < diaDe(new Date())
}

// "9h" / "20h30" — peça de formatHorario reaproveitada onde só uma hora
// entra na frase (ex.: "Hoje, 9h")
export const formatHora = (t) => {
  const [hh, mm] = t.split(':')
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
}

// "9h às 17h" / "a partir das 20h30" / "até 17h" / '' sem nenhum horário
export function formatHorario(ini, fim) {
  if (ini && fim) return `${formatHora(ini)} às ${formatHora(fim)}`
  if (ini) return `a partir das ${formatHora(ini)}`
  if (fim) return `até ${formatHora(fim)}`
  return ''
}
