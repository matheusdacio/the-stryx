// `proxima` = id da música que SEMPRE vem em seguida. Só a sucessora é
// gravada; a predecessora é quem tem `proxima` apontando pra esta.
export const predecessoraDe = (songId, songs) => songs.find((s) => s.proxima === songId) || null
export const sucessoraDe = (songId, songs) => { const s = songs.find((x) => x.id === songId); return (s?.proxima && songs.find((x) => x.id === s.proxima)) || null }

// Cadeia inteira a que a música pertence, do começo ao fim (ids). Música
// solta devolve [songId]. Protegido contra círculo e id que não existe mais.
export function grupoDe(songId, songs) {
  const porId = Object.fromEntries(songs.map((s) => [s.id, s]))
  let inicio = songId
  const vistos = new Set([songId])
  for (;;) {
    const ant = songs.find((s) => s.proxima === inicio)
    if (!ant || vistos.has(ant.id)) break
    vistos.add(ant.id); inicio = ant.id
  }
  const grupo = [inicio]
  let atual = porId[inicio]
  while (atual?.proxima && porId[atual.proxima] && !grupo.includes(atual.proxima) && grupo.length < 20) {
    grupo.push(atual.proxima); atual = porId[atual.proxima]
  }
  return grupo
}

// null se pode gravar songId.proxima = proximaId; senão o motivo, em texto
export function motivoInvalido(songId, proximaId, songs) {
  if (!proximaId) return null
  if (songId === proximaId) return 'Uma música não pode emendar nela mesma.'
  const outra = songs.find((s) => s.proxima === proximaId && s.id !== songId)
  if (outra) return `Essa já vem depois de "${outra.title}". Tira o vínculo lá primeiro.`
  if (grupoDe(proximaId, songs).includes(songId)) return 'Isso fecharia um círculo (A → B → A).'
  return null
}

// Agrupa as músicas de UM bloco em unidades — cada grupo de pares (mesmo
// que espalhado ou fora de ordem no bloco) vira uma unidade só, na ordem
// da cadeia. juntarPares() é quem arruma a posição de verdade; isso aqui
// só monta a visão pra renderizar.
export function unidadesDe(musicas, songs) {
  const porId = Object.fromEntries(musicas.map((m) => [m.id, m]))
  const consumidas = new Set()
  const unidades = []
  musicas.forEach((m) => {
    if (consumidas.has(m.id)) return
    const doGrupo = grupoDe(m.id, songs).filter((id) => porId[id] && !consumidas.has(id))
    doGrupo.forEach((id) => consumidas.add(id))
    unidades.push({ id: doGrupo[0], musicas: doGrupo.map((id) => porId[id]) })
  })
  return unidades
}

// Junta cadeias espalhadas entre blocos ou fora de ordem: cada grupo com
// 2+ músicas presentes no evento vai inteiro pro bloco/posição da primeira
// que aparece (lendo os blocos em ordem), contíguo, na ordem da cadeia.
export function juntarPares(blocos, songs) {
  const flat = []
  blocos.forEach((b, bi) => (b.musicas || []).forEach((m, i) => flat.push({ ...m, bi, i })))
  const porId = Object.fromEntries(flat.map((m) => [m.id, m]))

  let novosBlocos = blocos.map((b) => ({ ...b, musicas: [...(b.musicas || [])] }))
  const processados = new Set()
  const juntou = []

  flat.forEach((m) => {
    if (processados.has(m.id)) return
    const grupo = grupoDe(m.id, songs).filter((id) => porId[id])
    grupo.forEach((id) => processados.add(id))
    if (grupo.length < 2) return

    // Posição atual de cada membro pode ter mudado por causa de um grupo
    // processado antes nesta mesma passada — recalcula em novosBlocos
    let melhorBi = null, melhorI = null
    grupo.forEach((id) => {
      novosBlocos.forEach((b, bi) => {
        const i = b.musicas.findIndex((x) => x.id === id)
        if (i < 0) return
        if (melhorBi === null || bi < melhorBi || (bi === melhorBi && i < melhorI)) {
          melhorBi = bi; melhorI = i
        }
      })
    })
    if (melhorBi === null) return

    const destinoAtual = novosBlocos[melhorBi].musicas
    const idxInsercao = destinoAtual.slice(0, melhorI).filter((x) => !grupo.includes(x.id)).length

    const jaContiguo = destinoAtual.slice(idxInsercao, idxInsercao + grupo.length)
      .every((x, idx) => x?.id === grupo[idx])
    const soNesteBloco = novosBlocos.every((b, bi) => bi === melhorBi || !b.musicas.some((x) => grupo.includes(x.id)))
    if (jaContiguo && soNesteBloco) return

    const objetos = Object.fromEntries(grupo.map((id) => [id, porId[id]]))
    novosBlocos = novosBlocos.map((b) => ({ ...b, musicas: b.musicas.filter((x) => !grupo.includes(x.id)) }))
    novosBlocos[melhorBi].musicas.splice(idxInsercao, 0, ...grupo.map((id) => objetos[id]))
    juntou.push(...grupo.map((id) => objetos[id].title))
  })

  return { blocos: novosBlocos, juntou }
}
