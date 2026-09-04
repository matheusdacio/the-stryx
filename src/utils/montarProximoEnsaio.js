import { collection, getDocs, writeBatch, doc, deleteField } from 'firebase/firestore'
import { db } from '../firebase/config'
import { normalizeName } from './votes'
import { jaPassou, formatData } from './data'
import { novoBlocoId } from './blocos'

// Sequência da mensagem do Marcos no grupo, 03/09/2026 18:58. `tom` está na
// notação da mensagem (a app aceita texto livre).
export const SEQUENCIA = [
  { bloco: 1, title: 'Meu Erro', cantor: 'Marcos', tom: 'C' },
  { bloco: 1, title: 'Bichos Escrotos', cantor: 'Márcio', tom: 'C' },
  { bloco: 1, title: 'Até Quando Esperar', cantor: 'Márcio', tom: 'C' },
  { bloco: 1, title: 'Será', cantor: 'Marcos', tom: 'C' },
  { bloco: 1, title: 'O Tempo Não Para', cantor: 'Marcos', tom: 'Em' },
  { bloco: 2, title: 'Tempo Perdido', cantor: 'Marcos', tom: 'Em' },
  { bloco: 2, title: 'Borracho y Loco', cantor: 'Márcio', tom: 'Em' },
  { bloco: 2, title: 'Quase Sem Querer', cantor: 'Márcio', tom: 'G' },
  { bloco: 2, title: 'Mulher de Fases', cantor: 'Márcio', tom: 'G' },
  { bloco: 2, title: 'Me Lambe', cantor: 'Márcio', tom: 'G' },
  { bloco: 3, title: 'SOS', cantor: 'Márcio', tom: 'G' },
  { bloco: 3, title: 'Luz dos Olhos', cantor: 'Márcio', tom: 'Am' },
  { bloco: 3, title: 'Psycho Killer', cantor: 'Márcio', tom: 'Am' },
  { bloco: 3, title: 'Have You Ever Seen The Rain', cantor: 'Marcos', tom: 'C' },
  { bloco: 3, title: 'Jumento Celestino', cantor: 'Márcio', tom: 'C' },
  { bloco: 4, title: 'Reggae do Manero', cantor: 'Marcos', tom: 'D' },
  { bloco: 4, title: 'Não Sei', cantor: 'Marcos', tom: 'D' },
  { bloco: 4, title: 'Pelados em Santos', cantor: 'Márcio', tom: 'Bm' },
  { bloco: 4, title: 'Graffiti', cantor: 'Márcio', tom: 'C#m' },
  { bloco: 4, title: 'Santeria', cantor: 'Marcos', tom: 'E' },
  { bloco: 5, title: 'Clube dos Canalhas', cantor: 'Márcio', tom: 'E' },
  { bloco: 5, title: 'Nothing Else Matters', cantor: 'Marcos', tom: 'Em' },
  { bloco: 5, title: 'Born To Be Wild', cantor: 'Márcio', tom: 'Em' },
  { bloco: 5, title: 'Sharp Dressed Man', cantor: 'Marcos', tom: 'G' },
  { bloco: 5, title: 'Astronauta de Mármore', cantor: 'Marcos', tom: 'Dm' },
  { bloco: 5, title: 'Cabeça de Bagre', cantor: 'Márcio', tom: 'F' },
  { bloco: 5, title: 'You Shook Me All Night Long', cantor: 'Marcos', tom: 'F', bpm: 128 },
  { bloco: 5, title: 'Smells Like Teen Spirit', cantor: 'Márcio/Marcos', tom: 'Fm' },
]

// normalizeName já ignora acento/caixa; aqui também tira pontuação solta,
// de qualquer posição ("Have You Ever Seen The Rain?" ~= "...Rain",
// "SOS" ~= "S.O.S.")
const limpar = (s) => normalizeName(s).replace(/[?!.,']/g, '').replace(/\s+/g, ' ').trim()

function acharMusica(title, songs) {
  const alvo = limpar(title)
  const exata = songs.find((s) => limpar(s.title) === alvo)
  if (exata) return exata
  const parciais = songs.filter((s) => {
    const t = limpar(s.title)
    return t.includes(alvo) || alvo.includes(t)
  })
  return parciais.length === 1 ? parciais[0] : null
}

const toMs = (ts) => (ts?.toDate ? ts.toDate() : new Date(ts)).getTime()

// dryRun: só monta o preview. Aplicar (dryRun: false) grava os campos das
// músicas casadas e substitui o repertório do evento-alvo pelos 5 blocos
// da sequência — quem já estava no evento sai (a sequência é o repertório
// inteiro do ensaio, não um acréscimo).
export async function montarProximoEnsaio({ dryRun = false } = {}) {
  const [songsSnap, ensaiosSnap] = await Promise.all([
    getDocs(collection(db, 'songs')),
    getDocs(collection(db, 'ensaios')),
  ])
  const songs = songsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const ensaios = ensaiosSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const candidatos = ensaios.filter((e) => e.type === 'ensaio' && e.status !== 'cancelado' && !jaPassou(e.date))
  const alvo = [...candidatos].sort((a, b) => toMs(a.date) - toMs(b.date))[0] || null
  if (!alvo) {
    return { erro: 'Nenhum ensaio futuro. Crie o evento em Eventos › + Evento e rode de novo.' }
  }

  const atuais = Array.isArray(alvo.blocos)
    ? alvo.blocos.flatMap((b) => b.musicas || []).length
    : (alvo.setlist || []).length

  const casadas = []
  const naoAchadas = []
  SEQUENCIA.forEach((item) => {
    const song = acharMusica(item.title, songs)
    if (song) casadas.push({ item, song })
    else naoAchadas.push(item.title)
  })

  const camposMusica = casadas.map(({ item, song }) => {
    let tom
    if (!song.tom) tom = `→ ${item.tom}`
    else if (song.tom.trim() !== item.tom.trim()) tom = `mantido ${song.tom}`
    return { title: item.title, cantor: 'novo', tom }
  })

  if (!dryRun) {
    const batch = writeBatch(db)
    casadas.forEach(({ item, song }) => {
      const update = { cantor: item.cantor }
      if (!song.tom) update.tom = item.tom
      if (!song.bpm && item.bpm) update.bpm = item.bpm
      batch.update(doc(db, 'songs', song.id), update)
    })
    const blocos = [1, 2, 3, 4, 5].map((n) => ({
      id: novoBlocoId(),
      nome: '',
      musicas: casadas
        .filter(({ item }) => item.bloco === n)
        .map(({ item, song }) => ({
          id: song.id,
          title: song.title,
          artist: song.artist || '',
          bpm: song.bpm || item.bpm || null,
        })),
    }))
    batch.update(doc(db, 'ensaios', alvo.id), { blocos, setlist: deleteField() })
    await batch.commit()
  }

  return {
    alvo: `${formatData(alvo.date, { curta: true })}${alvo.location ? ` · ${alvo.location}` : ''}`,
    atuais,
    casadas: casadas.map(({ item, song }) => ({ title: item.title, songTitle: song.title })),
    naoAchadas,
    camposMusica,
  }
}
