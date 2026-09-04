// Uma escala só de dificuldade, igual na sugestão e no setlist. Antes eram
// duas (3 níveis na sugestão, 6 no setlist) com o mesmo nome de campo e um
// conversor entre elas — quem lia o banco não desconfiava da diferença.
export const DIFFICULTIES = [
  { value: 'facil',   label: 'Fácil',   weight: 1, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ok',      label: 'Ok',      weight: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'dificil', label: 'Difícil', weight: 3, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

export const DIFF_BY_VALUE = Object.fromEntries(DIFFICULTIES.map((d) => [d.value, d]))

// Média (usada nas ordenações) e o nível mais alto votado (usado no chip):
// se alguém achou difícil, a música aparece como difícil
export function calcDifficulty(dificuldade) {
  const list = Object.values(dificuldade || {})
  const weights = list.map((v) => DIFF_BY_VALUE[v.level]?.weight).filter(Boolean)
  if (!weights.length) return { avg: null, max: null, total: 0 }
  const sum = weights.reduce((acc, w) => acc + w, 0)
  return { avg: sum / weights.length, max: Math.max(...weights), total: weights.length }
}

export const difficultyByWeight = (weight) =>
  DIFFICULTIES.find((d) => d.weight === weight) || null

// Desconto pela dificuldade, usado tanto no Setlist quanto em Sugestões —
// Fácil não desconta, Ok desconta 15%, Difícil desconta 30%; sem voto
// conta como Ok (meio da escala)
export const EASE_BY_WEIGHT = { 1: 1, 2: 0.85, 3: 0.7 }
export function fatorFacilidade(dificuldade) {
  const { max } = calcDifficulty(dificuldade)
  return EASE_BY_WEIGHT[max] ?? EASE_BY_WEIGHT[2]
}
