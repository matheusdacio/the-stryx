// Evento → bloco → música. `setlist` era um array só; agora as músicas do
// evento vivem dentro de blocos (ensaio.blocos = [{ id, nome, musicas }]).
// Evento antigo (só `setlist`) é lido como um bloco único — só na leitura;
// quem grava, grava `blocos` e apaga `setlist` (ver EnsaioModal.jsx).
export const novoBlocoId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const nomeDoBloco = (bloco, i) => (bloco?.nome || '').trim() || `Bloco ${i + 1}`

export function blocosDe(ensaio) {
  if (Array.isArray(ensaio?.blocos)) return ensaio.blocos
  if (ensaio?.setlist?.length) return [{ id: 'legado', nome: '', musicas: ensaio.setlist }]
  return []
}

export const musicasDoEvento = (ensaio) => blocosDe(ensaio).flatMap((b) => b.musicas || [])

// Achatada com o bloco de cada música e o número contínuo (palco, lista)
export function musicasComBloco(ensaio) {
  let n = 0
  return blocosDe(ensaio).flatMap((b, bi) =>
    (b.musicas || []).map((m) => ({ ...m, blocoId: b.id, blocoNome: nomeDoBloco(b, bi), blocoIndex: bi, numero: ++n })))
}
