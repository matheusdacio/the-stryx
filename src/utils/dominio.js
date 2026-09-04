// Quanto cada pessoa se sente pronta em cada música do setlist. Serve pra
// escolher o que ensaiar: música com alguém inseguro precisa de rodagem.
// Ordem de prioridade de ensaio, do que mais precisa de rodagem pro que
// menos precisa — mesma ordem usada na barra de filtros do Setlist. O peso
// manda nessa mesma prioridade: quanto menor, mais a música precisa de rodagem.
// "Enferrujada" é a que já foi dominada e ficou parada — precisa relembrar,
// mas dá menos trabalho do que uma que a pessoa ainda não pegou.
export const DOMINIOS = [
  { value: 'crua',        label: 'Crua',        weight: 1, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { value: 'quase',       label: 'Quase lá',    weight: 2, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'enferrujada', label: 'Enferrujada', weight: 3, color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  { value: 'dominada',    label: 'Dominada',    weight: 4, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
]

const POR_VALOR = Object.fromEntries(DOMINIOS.map((d) => [d.value, d]))
export const dominioPorPeso = (peso) => DOMINIOS.find((d) => d.weight === peso) || null

// Set de uid pra passar como uidsAtivos: bandMembers já vem filtrado por
// ativo !== false em quem carrega a lista, então aqui só falta achar quem
// tem login (só uid logado vota domínio)
export const uidsAtivosDe = (bandMembers) =>
  new Set((bandMembers || []).filter((m) => m.firebaseUid).map((m) => m.firebaseUid))

// pior = o menor nível votado. É ele que aparece no card e que manda na
// ordenação: se uma pessoa está crua na música, a banda precisa ensaiar,
// não importa que os outros cinco estejam tranquilos.
// uidsAtivos (opcional): Set de uid de quem ainda tá na banda — quem saiu
// deixou o voto gravado no doc, mas não deve mais pesar no domínio de ninguém
export function calcDominio(dominio, uidsAtivos) {
  const entradas = Object.entries(dominio || {})
  const validas = uidsAtivos ? entradas.filter(([uid]) => uidsAtivos.has(uid)) : entradas
  const votos = validas.map(([, v]) => v)
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
export function menosDominadas(songs, quantas, idsJaNoEvento = [], uidsAtivos) {
  const fora = new Set(idsJaNoEvento)
  return (songs || [])
    .filter((s) => !fora.has(s.id))
    .map((s) => ({ song: s, ...calcDominio(s.dominio, uidsAtivos) }))
    .filter((x) => x.pior !== null)
    .sort((a, b) =>
      a.pior - b.pior ||          // mais crua primeiro
      a.media - b.media ||        // depois a que tem mais gente insegura
      b.total - a.total           // e a que tem mais votos (mais evidência)
    )
    .slice(0, Math.max(0, quantas))
    .map((x) => x.song)
}
