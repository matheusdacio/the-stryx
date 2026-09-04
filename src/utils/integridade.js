import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { namesMatch } from './votes'
import { chaveMusica } from './score'
import { DOMINIOS } from './dominio'
import { PRESENCAS } from './presenca'
import { blocosDe } from './blocos'

// dd/mm · local — sem isso o relatório apontava eventos pelo id cru do
// Firestore, e o admin não tinha como saber qual abrir
function formatEvento(e) {
  const d = e.date?.toDate ? e.date.toDate() : e.date ? new Date(e.date) : null
  const data = d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 's/ data'
  return e.location ? `${data} · ${e.location}` : data
}

// Confere se os dados estão coerentes depois das migrações. Só lê — não
// corrige nada. Cada item vira uma linha do relatório: ok quando está tudo
// certo, alerta quando algo precisa de olho humano, ℹ️ quando é só
// informativo (não é um problema, mas vale saber).
export async function verificarIntegridade() {
  const [membersSnap, songsSnap, sugSnap, ensaiosSnap] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(collection(db, 'songs')),
    getDocs(collection(db, 'sugestoes')),
    getDocs(collection(db, 'ensaios')),
  ])

  const membros = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const musicas = songsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const sugestoes = sugSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const eventos = ensaiosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const uidsConhecidos = new Set(membros.map((m) => m.firebaseUid).filter(Boolean))
  const niveisDominio = new Set(DOMINIOS.map((d) => d.value))
  const statusPresenca = new Set(PRESENCAS.map((p) => p.value))

  const itens = []
  const add = (titulo, problemas, resumoOk) =>
    itens.push({
      titulo,
      ok: problemas.length === 0,
      detalhe: problemas.length ? problemas.slice(0, 8) : [resumoOk],
      total: problemas.length,
    })
  // Pra achados que não são "certo/errado" — só contexto que vale saber
  const addInfo = (titulo, lista, vazio) =>
    itens.push({
      titulo,
      info: true,
      detalhe: lista.length ? lista.slice(0, 8) : [vazio],
      total: lista.length,
    })

  // ── Banda ──
  add(
    'Membros vinculados a uma conta',
    membros.filter((m) => !m.firebaseUid).map((m) => `${m.name} sem login vinculado`),
    `${membros.length} membros, todos vinculados`
  )

  const duplicados = []
  membros.forEach((a, i) => {
    membros.slice(i + 1).forEach((b) => {
      if (namesMatch(a.name, b.name)) duplicados.push(`${a.name} e ${b.name} são a mesma pessoa`)
    })
  })
  add('Membros sem duplicata', duplicados, 'Nenhum nome repetido no cadastro')

  // ── Eventos: migração da presença ──
  add(
    'Eventos sem a lista de membros antiga',
    eventos.filter((e) => e.members).map((e) => `${formatEvento(e)} ainda tem o campo members`),
    `${eventos.length} eventos migrados pra presença por pessoa`
  )

  const presencaRuim = []
  eventos.forEach((e) => {
    Object.entries(e.presenca || {}).forEach(([uid, p]) => {
      if (!uidsConhecidos.has(uid)) presencaRuim.push(`${formatEvento(e)}: presença de uid desconhecido`)
      else if (!statusPresenca.has(p?.status)) presencaRuim.push(`${formatEvento(e)}: status "${p?.status}" inválido`)
    })
  })
  const comPresenca = eventos.filter((e) => Object.keys(e.presenca || {}).length).length
  add('Presenças com membro e status válidos', presencaRuim, `${comPresenca} eventos com presença registrada`)

  const convidados = [...new Set(eventos.flatMap((e) => e.convidados || []))]
  addInfo('Convidados preservados (não são membros)', convidados, 'Nenhum')

  // ── Setlist ──
  add(
    'Nenhuma música com a tag "Não faz sentido"',
    musicas.filter((s) => (s.tags || []).some((t) => t.toLowerCase() === 'não faz sentido'))
      .map((s) => `${s.title} ainda tem a tag`),
    `${musicas.length} músicas sem a tag desfeita`
  )

  const dominioRuim = []
  musicas.forEach((s) => {
    Object.entries(s.dominio || {}).forEach(([uid, v]) => {
      if (!uidsConhecidos.has(uid)) dominioRuim.push(`${s.title}: voto de uid desconhecido`)
      else if (!niveisDominio.has(v?.level)) dominioRuim.push(`${s.title}: nível "${v?.level}" inválido`)
    })
  })
  const comDominio = musicas.filter((s) => Object.keys(s.dominio || {}).length).length
  add('Votos de domínio válidos', dominioRuim, `${comDominio} músicas já votadas`)

  // ── Ligação setlist ↔ sugestões ──
  const idsSugestoes = new Set(sugestoes.map((s) => s.id))
  add(
    'Vínculo música → sugestão de origem',
    musicas.filter((s) => s.sugestaoId && !idsSugestoes.has(s.sugestaoId))
      .map((s) => `${s.title} aponta pra sugestão que não existe mais`),
    `${musicas.filter((s) => s.sugestaoId).length} músicas com vínculo íntegro`
  )

  // Duas sugestões com o mesmo título+artista deixam a nota da música do
  // setlist ambígua: ela pode vir de qualquer uma das duas
  const porChave = {}
  sugestoes.forEach((sug) => {
    const k = chaveMusica(sug.title, sug.artist)
    porChave[k] = [...(porChave[k] || []), sug]
  })
  add(
    'Sem ambiguidade de título + artista',
    musicas.flatMap((s) => {
      const colidem = porChave[chaveMusica(s.title, s.artist)] || []
      if (colidem.length < 2) return []
      const quais = colidem
        .map((sug) => `${sug.status}, ${Object.keys(sug.opinoes || {}).length} voto(s)`)
        .join(' / ')
      return [`${s.title}: ${colidem.length} sugestões (${quais})`]
    }),
    'Cada música casa com no máximo uma sugestão'
  )

  const aprovadasForaDoSetlist = sugestoes.filter((sug) => {
    if (sug.status !== 'aprovada') return false
    const noSetlist = musicas.some(
      (s) => s.sugestaoId === sug.id || chaveMusica(s.title, s.artist) === chaveMusica(sug.title, sug.artist)
    )
    return !noSetlist
  })
  addInfo(
    'Aprovadas que saíram do setlist',
    aprovadasForaDoSetlist.map((s) => `${s.title} — ${s.artist || ''}`),
    'Nenhuma'
  )

  // ── Blocos ──
  const eventosSemBloco = eventos.filter((e) => e.setlist?.length && !Array.isArray(e.blocos))
  addInfo(
    'Eventos com músicas fora de bloco',
    eventosSemBloco.map((e) => `${formatEvento(e)} — rode "Blocos: migrar músicas soltas"`),
    'Nenhum'
  )

  const idsMusicas = new Set(musicas.map((s) => s.id))
  const musicasSumidas = []
  eventos.forEach((e) => {
    blocosDe(e).forEach((b) => {
      (b.musicas || []).forEach((m) => {
        if (!idsMusicas.has(m.id)) musicasSumidas.push(`${formatEvento(e)}: ${m.title}`)
      })
    })
  })
  add('Músicas de evento que ainda existem no setlist', musicasSumidas, 'Nenhuma música de evento sumiu do setlist')

  // ── Votos importados ainda por fundir ──
  const importPendentes = sugestoes.filter((sug) =>
    Object.keys(sug.opinoes || {}).some((k) => k.startsWith('import_'))
  )
  addInfo(
    'Sugestões com voto importado ainda não fundido',
    importPendentes.length
      ? [`${importPendentes.length} sugestões — rode "Fundir votos duplicados" se quiser vincular aos uids`]
      : [],
    'Nenhuma'
  )

  return itens
}
