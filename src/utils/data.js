// Data do evento num padrão único em todo o app — antes cada tela tinha o
// seu jeito (curto, longo, ISO cru, split/reverse na mão), e a mesma aba
// chegava a mostrar duas grafias diferentes uma embaixo da outra.
// curta: "qua., 02/09" (linhas) · padrão: "quarta, 02/09/2026" (destaque)
export function formatData(ts, { curta = false } = {}) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('pt-BR', {
    weekday: curta ? 'short' : 'long',
    day: '2-digit',
    month: '2-digit',
    ...(curta ? {} : { year: 'numeric' }),
  })
}

// Já passou do dia: não faz sentido perguntar se a pessoa vai, e o resumo
// passa a falar no passado. Compara por dia, não por hora — o evento é
// gravado ao meio-dia, então usar a hora faria o de hoje contar como
// passado antes da hora certa
export function jaPassou(ts) {
  if (!ts) return false
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return dia(d) < dia(new Date())
}
