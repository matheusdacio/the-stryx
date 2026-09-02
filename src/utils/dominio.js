// Quanto cada pessoa se sente pronta em cada música do setlist. Serve pra
// escolher o que ensaiar: música com alguém inseguro precisa de rodagem.
export const DOMINIOS = [
  { value: 'dominada', label: 'Dominada', weight: 3, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'quase',    label: 'Quase lá', weight: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'crua',     label: 'Crua',     weight: 1, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
]

const POR_VALOR = Object.fromEntries(DOMINIOS.map((d) => [d.value, d]))
export const dominioPorPeso = (peso) => DOMINIOS.find((d) => d.weight === peso) || null

// pior = o menor nível votado. É ele que aparece no card e que manda na
// ordenação: se uma pessoa está crua na música, a banda precisa ensaiar,
// não importa que os outros cinco estejam tranquilos.
export function calcDominio(dominio) {
  const votos = Object.values(dominio || {})
  if (!votos.length) return { pior: null, media: null, total: 0 }
  const pesos = votos.map((v) => POR_VALOR[v.level]?.weight).filter(Boolean)
  if (!pesos.length) return { pior: null, media: null, total: 0 }
  return {
    pior: Math.min(...pesos),
    media: pesos.reduce((a, b) => a + b, 0) / pesos.length,
    total: pesos.length,
  }
}

// As `quantas` músicas mais cruas do repertório, pra puxar pro ensaio.
// Quem ainda não recebeu nenhum voto fica de fora: não há indício de que
// precise de ensaio, e entrar na frente de quem foi marcado como crua
// atrapalharia a escolha.
export function menosDominadas(songs, quantas, idsJaNoEvento = []) {
  const fora = new Set(idsJaNoEvento)
  return (songs || [])
    .filter((s) => !fora.has(s.id))
    .map((s) => ({ song: s, ...calcDominio(s.dominio) }))
    .filter((x) => x.pior !== null)
    .sort((a, b) =>
      a.pior - b.pior ||          // mais crua primeiro
      a.media - b.media ||        // depois a que tem mais gente insegura
      b.total - a.total           // e a que tem mais votos (mais evidência)
    )
    .slice(0, Math.max(0, quantas))
    .map((x) => x.song)
}
