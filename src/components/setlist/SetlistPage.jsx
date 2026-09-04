import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import SongCard from './SongCard'
import { notasPorMusica, opinioesPorMusica } from '../../utils/score'
import AddSongModal from './AddSongModal'
import SearchLupa from '../SearchLupa'
import SetPlayer from '../SetPlayer'
import { matchesSearch } from '../../utils/search'
import { DOMINIOS, calcDominio, dominioPorPeso, uidsAtivosDe } from '../../utils/dominio'
import { fatorFacilidade } from '../../utils/dificuldade'
import { musicasDoEvento } from '../../utils/blocos'
import { todosVotaram } from '../../utils/rejeicao'
import { usePersistedState } from '../../hooks/usePersistedState'

// O setlist é organizado pelo domínio da banda, no pior cenário votado:
// basta uma pessoa insegura pra música contar como precisando de ensaio.
// "Sem voto" (ninguém da banda votou) não é filtro à parte — quem quer ver
// o que falta usa "Falta meu voto", que é pessoal
const FILTERS = [
  { value: 'all', label: 'Todas' },
  // DOMINIOS já vem na ordem de prioridade de ensaio (crua → dominada)
  ...DOMINIOS.map((d) => ({ value: d.value, label: d.label })),
]

// Nível da música pra filtro e contagem
const nivelDe = (song, uidsAtivos) => dominioPorPeso(calcDominio(song.dominio, uidsAtivos).pior)?.value || 'sem_voto'

const SORTS = [
  { value: 'recentes',    label: '🕐 Recentes' },
  { value: 'balanceada',  label: '⚖️ Melhores' },
  { value: 'media',       label: '⭐ Média' },
  { value: 'data',        label: '📅 Antigas' },
]

// Compara só o dia — o evento é gravado ao meio-dia (EnsaioModal), e a
// banda costuma votar o domínio logo depois do ensaio, então "ensaiado
// hoje" já deve contar como passado, não só a partir de amanhã
const diaDe = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export default function SetlistPage() {
  const { user } = useAuth()
  const [songs, setSongs] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [sugestoes, setSugestoes] = useState([])
  const [filter, setFilter] = useState('all')
  // Dura semanas (ex.: a tag de um show específico) — vale sobreviver a
  // fechar o app. Filtro de nível não: o padrão (Todas) é o que a pessoa
  // quer na maioria das visitas
  const [tagFilter, setTagFilter] = usePersistedState('stryx-setlist-tagfilter', null)
  // Música recém-votada continua na lista até o filtro mudar, mesmo que o
  // novo voto não bata mais no filtro ativo — senão ela some debaixo do
  // dedo e a próxima sobe pro lugar exato do toque
  const [fixados, setFixados] = useState(new Set())
  // Chip "Último ensaio" / "Próximo ensaio": toggle independente, combina
  // com o filtro de nível (igual tagFilter)
  const [eventoChip, setEventoChip] = useState(null)
  const [ensaios, setEnsaios] = useState([])
  // O setlist é um acervo, não uma sequência: a ordem vem sempre de um
  // critério. Montar sequência é papel do repertório do evento
  const [sortBy, setSortBy] = useState('recentes')
  // Vem preenchida quando chega de um link "ver essa música" (lista de
  // evento, por ex.) — ?q= no lugar do hash inteiro, porque o HashRouter
  // já usa o hash pra rota
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [showModal, setShowModal] = useState(false)
  // Um id só: null = nada tocando, 'lista' = o SetPlayer da lista,
  // ou o id da música cujo player inline está aberto. Ligar um sempre
  // fecha o outro (D08) — nunca dois áudios ao mesmo tempo
  const [tocandoId, setTocandoId] = useState(null)
  const [bandMembers, setBandMembers] = useState([])
  const [cifras, setCifras] = useState([])

  useEffect(() => {
    if (searchParams.size) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [])

  // As opiniões da banda vivem na sugestão que originou a música — é de lá
  // que vem a nota mostrada no setlist
  useEffect(() => {
    return onSnapshot(collection(db, 'sugestoes'), (snap) =>
      setSugestoes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  useEffect(() => {
    // Quem saiu da banda (ativo:false) fica fora daqui — não conta mais
    // pra "todo mundo votou", presença nem semeadura de voto novo
    return onSnapshot(collection(db, 'members'), (snap) =>
      setBandMembers(snap.docs.filter((d) => d.data().ativo !== false).map((d) => ({
        name: d.data().name,
        aliases: d.data().aliases || [],
        firebaseUid: d.data().firebaseUid || null,
      })))
    )
  }, [])

  // Pra achar a cifra da música (F88) sem duplicar dado nem exigir vínculo
  useEffect(() => {
    return onSnapshot(collection(db, 'cifras'), (snap) =>
      setCifras(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'ensaios'), (snap) =>
      setEnsaios(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  // Muda o filtro/tag/busca/chip de evento solta os cards fixados: eles só
  // existem pra não sumir debaixo do dedo dentro do MESMO filtro
  const mudarFiltro = (v) => { setFixados(new Set()); setFilter(v) }
  const mudarTagFilter = (v) => { setFixados(new Set()); setTagFilter(v) }
  const mudarSearch = (v) => { setFixados(new Set()); setSearch(v) }
  const mudarEventoChip = (v) => { setFixados(new Set()); setEventoChip(v) }

  // Só ensaio (não apresentação) e não cancelado — "último"/"próximo
  // ensaio" é sobre o ciclo de rodagem, não sobre shows
  const hoje = diaDe(new Date())
  const ensaiosOrdenados = [...ensaios]
    .filter((e) => e.type === 'ensaio' && e.status !== 'cancelado' && e.date)
    .sort((a, b) => diaDe(a.date) - diaDe(b.date))
  const passados = ensaiosOrdenados.filter((e) => diaDe(e.date) <= hoje)
  const futuros = ensaiosOrdenados.filter((e) => diaDe(e.date) > hoje)
  const ultimoEnsaio = passados[passados.length - 1] || null
  const proximoEnsaio = futuros[0] || null
  const idsUltimoEnsaio = new Set(musicasDoEvento(ultimoEnsaio).map((s) => s.id))
  const idsProximoEnsaio = new Set(musicasDoEvento(proximoEnsaio).map((s) => s.id))

  const notaDe = notasPorMusica(sugestoes)
  const opinioesDe = opinioesPorMusica(sugestoes)

  const allTags = [...new Set(songs.flatMap((s) => s.tags || []))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  )
  // Tag guardada de uma visita anterior pode não existir mais (a música que
  // tinha essa tag saiu, ou a tag foi removida) — sem isso a lista ficava
  // vazia sem explicação nenhuma
  const tagFilterValida = tagFilter && allTags.includes(tagFilter) ? tagFilter : null

  // Falta EU indicar algo nessa música: domínio (pronto pra tocar) ou
  // opinião (vale tocar — só conta enquanto a seção ainda está aberta,
  // isto é, nem toda a banda opinou ainda). Dificuldade só se vota nas Sugestões.
  const meuVotoFalta = (s) => {
    const opinoes = opinioesDe(s)
    return !(s.dominio || {})[user.uid] ||
      (!todosVotaram({ opinoes }, bandMembers) && !opinoes[user.uid])
  }

  const uidsAtivos = uidsAtivosDe(bandMembers)

  const filtered = songs.filter((s) =>
    (filter === 'all' || (filter === 'falta_meu_voto' ? meuVotoFalta(s) : nivelDe(s, uidsAtivos) === filter) || fixados.has(s.id)) &&
    (!tagFilterValida || (s.tags || []).includes(tagFilterValida)) &&
    (!eventoChip || (eventoChip === 'ultimo' ? idsUltimoEnsaio : idsProximoEnsaio).has(s.id)) &&
    matchesSearch(search, s.title, s.artist)
  )

  // Música sem nota vai pro fim nas ordenações por nota: quem nunca passou
  // por votação não tem como competir com quem a banda avaliou
  const porNota = (fator) => (a, b) => {
    const na = notaDe(a)
    const nb = notaDe(b)
    if (!na && !nb) return 0
    if (!na) return 1
    if (!nb) return -1
    return nb.media * fator(b) - na.media * fator(a) || nb.total - na.total || nb.soma - na.soma
  }
  const semDesconto = () => 1

  const displayed = [...filtered].sort((a, b) => {
    if (sortBy === 'balanceada') return porNota((song) => fatorFacilidade(song.dificuldade))(a, b)
    if (sortBy === 'media') return porNota(semDesconto)(a, b)
    if (sortBy === 'data') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    if (sortBy === 'recentes') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    return 0
  })

  // Toca o que está na tela: filtro, tag, busca e ordenação valem pra fila
  const comVideo = displayed.filter((s) => s.videoUrl)

  const counts = FILTERS.reduce((acc, f) => {
    acc[f.value] = f.value === 'all'
      ? songs.length
      : songs.filter((s) => nivelDe(s, uidsAtivos) === f.value).length
    return acc
  }, {})
  const meuVotoFaltaCount = songs.filter(meuVotoFalta).length

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          Setlist
          {meuVotoFaltaCount > 0 && <span className="pending-badge" title="Músicas em que falta seu voto">{meuVotoFaltaCount}</span>}
        </h2>
        <div className="page-header-actions">
          <SearchLupa value={search} onChange={mudarSearch} placeholder="Filtrar por nome ou artista..." />
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Música</button>
        </div>
      </div>

      <div className="filter-bar">
        {FILTERS.map((f) => {
          const d = DOMINIOS.find((x) => x.value === f.value)
          const active = filter === f.value
          return (
            <button
              key={f.value}
              className={`btn-filter ${active ? 'active' : ''}`}
              style={d && active ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
              onClick={() => mudarFiltro(f.value)}
            >
              {d && <span className="filter-dot" style={{ background: d.color }} />}
              {f.label} <span className="count">{counts[f.value]}</span>
            </button>
          )
        })}
        <button
          className={`btn-tag ${filter === 'falta_meu_voto' ? 'active' : ''}`}
          onClick={() => mudarFiltro(filter === 'falta_meu_voto' ? 'all' : 'falta_meu_voto')}
          title="Mostrar só as músicas que faltam você indicar domínio ou opinião"
        >
          🗳 Falta meu voto <span className="count">{meuVotoFaltaCount}</span>
        </button>
        {ultimoEnsaio && idsUltimoEnsaio.size > 0 && (
          <button
            className={`btn-tag ${eventoChip === 'ultimo' ? 'active' : ''}`}
            onClick={() => mudarEventoChip(eventoChip === 'ultimo' ? null : 'ultimo')}
            title="Combina com o filtro acima — músicas do último ensaio, hora de atualizar o domínio"
          >
            🎸 Último ensaio <span className="count">{idsUltimoEnsaio.size}</span>
          </button>
        )}
        {proximoEnsaio && idsProximoEnsaio.size > 0 && (
          <button
            className={`btn-tag ${eventoChip === 'proximo' ? 'active' : ''}`}
            onClick={() => mudarEventoChip(eventoChip === 'proximo' ? null : 'proximo')}
            title="Combina com o filtro acima — músicas já escaladas pro próximo ensaio"
          >
            Próximo ensaio <span className="count">{idsProximoEnsaio.size}</span>
          </button>
        )}
      </div>
      <p className="filter-hint">O nível da música é o de quem está menos pronto nela.</p>

      {/* Ordenação extra */}
      <div className="sort-bar">
        <span className="sort-label">Ordenar:</span>
        <select className="btn-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Filtro por tags customizadas */}
      {allTags.length > 0 && (
        <div className="tag-bar">
          <span className="sort-label">🏷</span>
          {allTags.map((t) => (
            <button
              key={t}
              className={`btn-tag ${tagFilter === t ? 'active' : ''}`}
              onClick={() => mudarTagFilter(tagFilter === t ? null : t)}
            >
              {t}
              <span className="count">{songs.filter((s) => (s.tags || []).includes(t)).length}</span>
            </button>
          ))}
          {tagFilterValida && (
            <button className="btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => mudarTagFilter(null)}>
              ✕ limpar
            </button>
          )}
        </div>
      )}

      {comVideo.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button
            className="btn-secondary"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setTocandoId(tocandoId === 'lista' ? null : 'lista')}
          >
            {tocandoId === 'lista' ? '■ Parar' : `▶ Tocar as ${comVideo.length} músicas da lista`}
          </button>
          {tocandoId === 'lista' && <SetPlayer setlist={comVideo} />}
        </div>
      )}

      {!loaded ? (
        <p className="empty-state">Carregando o setlist...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {search.trim() ? (
            <p>Nenhuma música encontrada pra "{search.trim()}".</p>
          ) : filter === 'falta_meu_voto' ? (
            <p>🎉 Você já votou em todas as músicas daqui!</p>
          ) : filter !== 'all' ? (
            <>
              <p>Nenhuma música {FILTERS.find((f) => f.value === filter)?.label} agora 🎉</p>
              <button className="btn-secondary" onClick={() => mudarFiltro('all')}>Ver todas</button>
            </>
          ) : (tagFilterValida || eventoChip) ? (
            <>
              <p>Nenhuma música com esse filtro.</p>
              <button className="btn-secondary" onClick={() => { mudarTagFilter(null); mudarEventoChip(null) }}>✕ Limpar filtros</button>
            </>
          ) : (
            <>
              <p>Nenhuma música aqui ainda.</p>
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                Adicionar primeira música
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="song-list">
          {displayed.map((song, i) => (
            <SongCard
              nota={notaDe(song)}
              opinoes={opinioesDe(song)}
              bandMembers={bandMembers}
              cifras={cifras}
              todasMusicas={songs}
              key={song.id}
              song={song}
              // Bolinha só faz sentido quando a ordem reflete um ranking de
              // nota; em Recentes/Antigas ela mudava a cada filtro/tag/busca
              // sem significar posição nenhuma
              position={['balanceada', 'media'].includes(sortBy) ? i + 1 : null}
              tocandoVideo={tocandoId === song.id}
              onTocarVideo={setTocandoId}
              onVotou={(id) => setFixados((prev) => new Set(prev).add(id))}
            />
          ))}
        </div>
      )}

      {showModal && <AddSongModal onClose={() => setShowModal(false)} totalSongs={songs.length} acervo={{ musicas: songs, sugestoes, bandMembers }} />}
    </div>
  )
}
