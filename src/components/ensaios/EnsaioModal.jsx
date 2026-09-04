import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, onSnapshot, orderBy, query, deleteField } from 'firebase/firestore'
import {
  DndContext, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../../firebase/config'
import { menosDominadas, calcDominio, dominioPorPeso, uidsAtivosDe } from '../../utils/dominio'
import { matchesSearch } from '../../utils/search'
import { formatData } from '../../utils/data'
import { blocosDe, novoBlocoId, nomeDoBloco } from '../../utils/blocos'
import { grupoDe, unidadesDe, juntarPares } from '../../utils/pares'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'

function toInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
}

// Wrapper sortable: liga a linha do repertório do evento ao dnd-kit, com a
// alça ⠿ arrastável por toque (PointerSensor/TouchSensor abaixo)
function SortableSetlistItem({ id, className = '', children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {}),
  }
  return (
    <div ref={setNodeRef} style={style} className={`event-setlist-item ${className} ${isDragging ? 'dragging' : ''}`}>
      <span className="drag-handle" title="Arrastar para reordenar" {...attributes} {...listeners}>⠿</span>
      {children}
    </div>
  )
}

// Evento novo, cancelado ou remarcado — só quem não abre o app dependia
// disso pra saber. Fila e cron já existem (mesmo caminho da sugestão nova);
// falha aqui não deve travar nem avisar quem estava salvando o evento
function enfileirarAviso(tipo, ensaioId, data) {
  addDoc(collection(db, 'notification_queue'), {
    tipo,
    ensaioId,
    data: data.date,
    tipoEvento: data.type,
    local: data.location,
    horaInicio: data.horaInicio,
    horaFim: data.horaFim,
    processado: false,
    criadoEm: serverTimestamp(),
  }).catch(() => {})
}

// `copiando` reaproveita um evento como molde: vem o repertório, a pauta (com
// os itens desmarcados), local e tipo — mas não a data nem a presença
export default function EnsaioModal({ ensaio, copiando = false, onClose, bandMembers = [] }) {
  const uidsAtivos = uidsAtivosDe(bandMembers)
  const editando = !!ensaio && !copiando
  const [allSongs, setAllSongs] = useState([])
  const [form, setForm] = useState(() => {
    const tipo = ensaio?.type || 'ensaio'
    return {
      date: copiando ? '' : toInputDate(ensaio?.date) || '',
      location: ensaio?.location || '',
      type: tipo,
      status: copiando ? 'planejado' : ensaio?.status || 'planejado',
      notes: ensaio?.notes || '',
      // Evento existente (editar/copiar) mantém o horário que já tinha, mesmo
      // vazio — evento novo do tipo ensaio já nasce 9h às 17h
      horaInicio: ensaio ? (ensaio.horaInicio || '') : (tipo === 'ensaio' ? '09:00' : ''),
      horaFim: ensaio ? (ensaio.horaFim || '') : (tipo === 'ensaio' ? '17:00' : ''),
    }
  })
  const [pauta, setPauta] = useState(
    copiando
      ? (ensaio?.pauta || []).map((i) => ({ ...i, done: false }))
      : ensaio?.pauta || []
  )
  // Evento → bloco → música. Cópia ganha ids novos; evento antigo (só
  // setlist) ganha id de verdade no lugar de 'legado'
  const [blocos, setBlocos] = useState(() => blocosDe(ensaio).map((b) => ({
    ...b,
    id: copiando || b.id === 'legado' ? novoBlocoId() : b.id,
    musicas: [...(b.musicas || [])],
  })))
  // Pra onde vai a próxima música adicionada — padrão: o último bloco
  const [blocoDestino, setBlocoDestino] = useState(() => blocos.at(-1)?.id || null)
  const [newItem, setNewItem] = useState('')
  const [songSearch, setSongSearch] = useState('')
  const [quantasCruas, setQuantasCruas] = useState(5)
  const [aviso, setAviso] = useState('')
  const [saving, setSaving] = useState(false)
  const [mexeu, setMexeu] = useState(false)

  const todasMusicas = blocos.flatMap((b) => b.musicas)

  // Pointer: arrasta depois de mover 6px (clique/toque normal continua
  // funcionando). Touch: segurar 250ms antes de arrastar (rolar a página
  // continua funcionando sem disparar o arrasto sem querer)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  // Carrega músicas do repertório
  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setAllSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const handleChange = (e) => { setMexeu(true); setForm({ ...form, [e.target.name]: e.target.value }) }

  // Só sai por Cancelar (sem fechar ao tocar fora) — repertório e pauta
  // montados item a item são o conteúdo mais caro de perder no app inteiro
  const cancelar = () => {
    if (mexeu && !confirm('Descartar o que você digitou?')) return
    onClose()
  }

  useFecharComVoltar(cancelar)

  const addPauta = () => {
    if (!newItem.trim()) return
    setMexeu(true)
    setPauta([...pauta, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const removePauta = (i) => { setMexeu(true); setPauta(pauta.filter((_, idx) => idx !== i)) }

  // ── Blocos do evento ─────────────────────────────────────────────────
  // Garante um bloco de destino, criando um vazio se não houver nenhum —
  // devolve blocos/destino já atualizados pra usar na mesma chamada
  const comDestino = () => {
    if (blocos.length && blocoDestino && blocos.some((b) => b.id === blocoDestino)) {
      return { bs: blocos, destino: blocoDestino }
    }
    if (blocos.length) return { bs: blocos, destino: blocos.at(-1).id }
    const b = { id: novoBlocoId(), nome: '', musicas: [] }
    return { bs: [b], destino: b.id }
  }

  // Puxa pro ensaio o que a banda marcou como menos dominado. Já ignora o
  // que está no evento e quem ainda não recebeu nenhum voto. Cada escolhida
  // expande pro grupo inteiro (par/cadeia) — sempre tocam juntas
  const trazerCruas = () => {
    const escolhidas = menosDominadas(allSongs, Number(quantasCruas) || 0, todasMusicas.map((s) => s.id), uidsAtivos)
    if (!escolhidas.length) {
      setAviso('Ninguém votou ainda em nenhuma música fora deste evento — vote no Setlist primeiro.')
      return
    }
    setMexeu(true)
    const porId = Object.fromEntries(allSongs.map((s) => [s.id, s]))
    const jaNoEvento = new Set(todasMusicas.map((s) => s.id))
    const vistos = new Set()
    const idsFinal = []
    escolhidas.forEach((song) => {
      grupoDe(song.id, allSongs).forEach((id) => {
        if (jaNoEvento.has(id) || vistos.has(id)) return
        vistos.add(id)
        idsFinal.push(id)
      })
    })
    const { bs, destino } = comDestino()
    const novas = idsFinal.map((id) => {
      const s = porId[id]
      return { id: s.id, title: s.title, artist: s.artist || '', bpm: s.bpm || null }
    })
    setBlocos(bs.map((b) => (b.id === destino ? { ...b, musicas: [...b.musicas, ...novas] } : b)))
    setBlocoDestino(destino)
    const extras = idsFinal.length - escolhidas.length
    setAviso(
      `${escolhidas.length} ${escolhidas.length === 1 ? 'música adicionada' : 'músicas adicionadas'}` +
      (extras > 0 ? ` (${extras} vieram junto por sempre tocarem juntas)` : '') + '.'
    )
  }

  // Adicionar traz o grupo inteiro (par/cadeia) da música escolhida, não só ela
  const addSong = (song) => {
    if (todasMusicas.some((s) => s.id === song.id)) return
    const ids = grupoDe(song.id, allSongs)
    const jaNoEvento = new Set(todasMusicas.map((s) => s.id))
    const novasIds = ids.filter((id) => !jaNoEvento.has(id))
    setMexeu(true)
    const { bs, destino } = comDestino()
    const porId = Object.fromEntries(allSongs.map((s) => [s.id, s]))
    const novasMusicas = novasIds.map((id) => {
      const s = porId[id] || song
      return { id: s.id, title: s.title, artist: s.artist || '', bpm: s.bpm || null }
    })
    setBlocos(bs.map((b) => (b.id === destino ? { ...b, musicas: [...b.musicas, ...novasMusicas] } : b)))
    setBlocoDestino(destino)
    if (novasIds.length > 1) {
      const outras = novasMusicas.filter((m) => m.id !== song.id).map((m) => m.title)
      setAviso(`Trouxe também ${outras.join(', ')} — sempre tocam juntas.`)
    }
  }

  // Grupo (par/cadeia) é uma unidade: sai, sobe/desce e é arrastado inteiro
  const removeUnidade = (blocoId, unidade) => {
    const n = unidade.musicas.length
    if (n > 1) {
      const titulos = unidade.musicas.map((m) => m.title).join(', ')
      if (!confirm(`Tirar ${n} músicas do evento? ${titulos} sempre tocam juntas.`)) return
    }
    setMexeu(true)
    const ids = new Set(unidade.musicas.map((m) => m.id))
    setBlocos(blocos.map((b) => (b.id === blocoId ? { ...b, musicas: b.musicas.filter((m) => !ids.has(m.id)) } : b)))
  }

  // ▲▼ atravessam a fronteira do bloco: ▲ na primeira unidade de um bloco
  // que não é o primeiro move ela pro fim do bloco anterior; ▼ na última
  // unidade de um bloco que não é o último move pro começo do seguinte
  const moveUnidade = (blocoId, unidades, ui, dir) => {
    const bi = blocos.findIndex((b) => b.id === blocoId)
    if (bi < 0) return
    const j = ui + dir
    setMexeu(true)
    if (j >= 0 && j < unidades.length) {
      const next = [...unidades]
      ;[next[ui], next[j]] = [next[j], next[ui]]
      setBlocos(blocos.map((b, idx) => (idx === bi ? { ...b, musicas: next.flatMap((u) => u.musicas) } : b)))
      return
    }
    const alvoIndex = bi + dir
    if (alvoIndex < 0 || alvoIndex >= blocos.length) return
    const unidade = unidades[ui]
    const ids = new Set(unidade.musicas.map((m) => m.id))
    setBlocos(blocos.map((b, idx) => {
      if (idx === bi) return { ...b, musicas: b.musicas.filter((m) => !ids.has(m.id)) }
      if (idx === alvoIndex) return { ...b, musicas: dir === -1 ? [...b.musicas, ...unidade.musicas] : [...unidade.musicas, ...b.musicas] }
      return b
    }))
  }

  // Arrastar e soltar (toque ou mouse) — um contexto por bloco, reordena as
  // unidades (grupo inteiro junto) e achata de volta pra b.musicas
  const handleDragEnd = (blocoId, unidades) => ({ active, over }) => {
    if (!over || active.id === over.id) return
    setMexeu(true)
    const oldIndex = unidades.findIndex((u) => u.id === active.id)
    const newIndex = unidades.findIndex((u) => u.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(unidades, oldIndex, newIndex)
    setBlocos(blocos.map((b) => (b.id === blocoId ? { ...b, musicas: reordered.flatMap((u) => u.musicas) } : b)))
  }

  // Uma vez, quando o repertório chega: junta cadeias espalhadas ou fora de
  // ordem — sem isso um par salvo depois de o evento já existir ficava
  // exibido separado até alguém arrumar na mão. Ajusta durante o render
  // (não num efeito, nem numa ref — refs também não podem ser lidas no
  // render) comparando com um estado que marca "já rodou"
  const [jaJuntou, setJaJuntou] = useState(false)
  if (!jaJuntou && allSongs.length > 0) {
    setJaJuntou(true)
    const { blocos: b2, juntou } = juntarPares(blocos, allSongs)
    if (juntou.length) {
      setBlocos(b2)
      setMexeu(true)
      setAviso(`Juntei ${juntou.join(' e ')}, que sempre tocam juntas.`)
    }
  }

  const moverBloco = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= blocos.length) return
    setMexeu(true)
    const next = [...blocos]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocos(next)
  }

  const removerBloco = (i) => {
    const b = blocos[i]
    if (b.musicas.length > 0 && !confirm(`Apagar "${nomeDoBloco(b, i)}" com ${b.musicas.length} músicas? Elas saem do evento.`)) return
    setMexeu(true)
    const next = blocos.filter((_, idx) => idx !== i)
    setBlocos(next)
    if (blocoDestino === b.id) setBlocoDestino(next.at(-1)?.id || null)
  }

  const renomearBloco = (i, nome) => {
    setMexeu(true)
    setBlocos(blocos.map((b, idx) => (idx === i ? { ...b, nome } : b)))
  }

  const novoBloco = () => {
    setMexeu(true)
    const b = { id: novoBlocoId(), nome: '', musicas: [] }
    setBlocos([...blocos, b])
    setBlocoDestino(b.id)
  }

  const searchResults = songSearch.trim()
    ? allSongs.filter((s) =>
        !todasMusicas.some((x) => x.id === s.id) &&
        matchesSearch(songSearch, s.title, s.artist)
      ).slice(0, 10)
    : []

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.date) return
    if (form.horaInicio && form.horaFim && form.horaFim <= form.horaInicio) {
      alert('O fim precisa ser depois do início.')
      return
    }
    setSaving(true)
    const data = {
      ...form,
      pauta,
      blocos: blocos.map((b) => ({ id: b.id, nome: (b.nome || '').trim(), musicas: b.musicas })),
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
    }
    // Fecha na hora — sem sinal, esperar o await deixava o modal preso e,
    // se a pessoa fechasse e tentasse de novo, salvava duas vezes
    const erro = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
    if (editando) {
      // Só grava o que de fato mudou em relação ao que estava aberto — quem
      // só trocou o local não regrava pauta/blocos por cima de uma edição
      // simultânea de outro membro (ensaiadas/presenca nunca entram aqui,
      // já que nem fazem parte do form)
      const mudou = {}
      if (form.location !== (ensaio.location || '')) mudou.location = data.location
      if (form.type !== (ensaio.type || 'ensaio')) mudou.type = data.type
      if (form.status !== (ensaio.status || 'planejado')) mudou.status = data.status
      if (form.notes !== (ensaio.notes || '')) mudou.notes = data.notes
      if (form.date !== toInputDate(ensaio.date)) mudou.date = data.date
      if (form.horaInicio !== (ensaio.horaInicio || '')) mudou.horaInicio = data.horaInicio
      if (form.horaFim !== (ensaio.horaFim || '')) mudou.horaFim = data.horaFim
      if (JSON.stringify(pauta) !== JSON.stringify(ensaio.pauta || [])) mudou.pauta = data.pauta
      // resumo ignora o id do bloco (o 'legado' sempre diferiria do novo id)
      const resumo = (bs) => JSON.stringify(bs.map((b) => [b.nome || '', (b.musicas || []).map((m) => m.id)]))
      const blocosMudaram = resumo(blocos) !== resumo(blocosDe(ensaio))
      // Evento antigo (só setlist): grava blocos mesmo sem mudança de
      // conteúdo, pra completar a migração junto com o apagar do setlist
      if (blocosMudaram || ensaio.setlist) mudou.blocos = data.blocos
      if (ensaio.setlist) mudou.setlist = deleteField()

      if (Object.keys(mudou).length) {
        updateDoc(doc(db, 'ensaios', ensaio.id), mudou).catch(erro)
        // Só quem não abre o app dependia disso pra saber que o ensaio
        // sumiu ou mudou de dia — cancelar tem prioridade sobre remarcar
        // (não faz sentido avisar as duas coisas na mesma edição)
        if (mudou.status === 'cancelado') {
          enfileirarAviso('evento_cancelado', ensaio.id, data)
        } else if ((mudou.date || mudou.horaInicio || mudou.horaFim) && data.status !== 'cancelado') {
          enfileirarAviso('evento_remarcado', ensaio.id, data)
        }
      }
    } else {
      // Evento novo (inclusive cópia) nasce sem presença
      addDoc(collection(db, 'ensaios'), { ...data, presenca: {}, createdAt: serverTimestamp() })
        .then((ref) => enfileirarAviso('novo_evento', ref.id, data))
        .catch(erro)
    }
    onClose()
  }

  const isApresentacao = form.type === 'apresentacao'

  return (
    <div className="modal-overlay">
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>{editando ? 'Editar evento' : copiando ? 'Copiar evento' : 'Novo evento'}</h2>
        {copiando && (
          <p className="filter-hint" style={{ margin: '0 0 12px' }}>
            Músicas e pauta vieram do evento de {formatData(ensaio?.date)}. Escolha a data nova — a presença começa em branco.
          </p>
        )}
        <form onSubmit={handleSave}>
          {/* Tipo de evento */}
          <div className="event-type-toggle">
            <button
              type="button"
              className={`btn-event-type ${!isApresentacao ? 'active' : ''}`}
              onClick={() => {
                setMexeu(true)
                setForm({
                  ...form,
                  type: 'ensaio',
                  ...(!form.horaInicio && !form.horaFim ? { horaInicio: '09:00', horaFim: '17:00' } : {}),
                })
              }}
            >
              🎸 Ensaio
            </button>
            <button
              type="button"
              className={`btn-event-type ${isApresentacao ? 'active apresentacao' : ''}`}
              onClick={() => { setMexeu(true); setForm({ ...form, type: 'apresentacao' }) }}
            >
              🎤 Apresentação
            </button>
          </div>

          <div className="form-row">
            <label>Data *<input type="date" name="date" value={form.date} onChange={handleChange} required /></label>
            <label>Local<input name="location" value={form.location} onChange={handleChange} placeholder={isApresentacao ? 'Ex: Bar do Zé' : 'Ex: Estúdio X'} /></label>
          </div>
          <div className="form-row">
            <label>Início<input type="time" name="horaInicio" step="300" value={form.horaInicio} onChange={handleChange} /></label>
            <label>Fim<input type="time" name="horaFim" step="300" value={form.horaFim} onChange={handleChange} /></label>
          </div>
          {/* "Realizado" não fazia nada — as abas Próximos/Realizados são
              calculadas pela data. Só cancelado muda algo, então o controle
              vira um toggle com o verbo certo */}
          <button
            type="button"
            className={`btn-cancelar-evento ${form.status === 'cancelado' ? 'cancelado' : ''}`}
            onClick={() => { setMexeu(true); setForm({ ...form, status: form.status === 'cancelado' ? 'planejado' : 'cancelado' }) }}
          >
            {form.status === 'cancelado' ? '↩ Reativar evento' : '🚫 Marcar como cancelado'}
          </button>

          {/* Músicas do evento, organizadas em blocos */}
          <div className="form-group">
            <p className="section-label">
              Músicas do evento {todasMusicas.length > 0 && `(${todasMusicas.length})`}
              {blocos.length > 1 && ` · ${blocos.length} blocos`}
            </p>
            <input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="Buscar música do setlist..."
              aria-label="Buscar música do setlist"
            />
            {searchResults.length > 0 && (
              <div className="song-search-results">
                {searchResults.map((s) => {
                  const nivel = dominioPorPeso(calcDominio(s.dominio, uidsAtivos).pior)
                  const nomesGrupo = grupoDe(s.id, allSongs)
                    .filter((id) => id !== s.id)
                    .map((id) => allSongs.find((x) => x.id === id)?.title)
                    .filter(Boolean)
                  return (
                    <button key={s.id} type="button" className="song-search-item" onClick={() => addSong(s)}>
                      + {s.title} {s.artist && <span className="song-search-artist">— {s.artist}</span>}
                      {s.cantor && <span className="mini-chip" style={{ marginLeft: 6 }}>🎤 {s.cantor}</span>}
                      {nomesGrupo.length > 0 && (
                        <span className="mini-chip" style={{ marginLeft: 6 }} title={`Vem junto com ${nomesGrupo.join(', ')}`}>⛓</span>
                      )}
                      {nivel && (
                        <span className="status-dot status-dot-inline" style={{ color: nivel.color, background: nivel.bg }}>
                          {nivel.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {blocos.length > 1 && (
              <label className="bloco-destino">
                Adicionar em
                <select value={blocoDestino || ''} onChange={(e) => setBlocoDestino(e.target.value)}>
                  {blocos.map((b, i) => <option key={b.id} value={b.id}>{nomeDoBloco(b, i)}</option>)}
                </select>
              </label>
            )}

            <div className="trazer-cruas">
              <span>Trazer as</span>
              <input
                type="number"
                min="1"
                max="30"
                value={quantasCruas}
                onChange={(e) => setQuantasCruas(e.target.value)}
                aria-label="Quantas músicas trazer"
              />
              <span>músicas menos dominadas</span>
              <button type="button" className="btn-secondary" onClick={trazerCruas}>+ Trazer</button>
              {aviso && <span className="trazer-cruas-aviso">{aviso}</span>}
            </div>

            {blocos.map((b, bi) => {
              const offset = blocos.slice(0, bi).reduce((acc, x) => acc + x.musicas.length, 0)
              const unidades = unidadesDe(b.musicas, allSongs)
              let localOffset = 0
              return (
                <div key={b.id} className={`bloco-edit ${b.id === blocoDestino ? 'destino' : ''}`}>
                  <div className="bloco-edit-header" onClick={() => setBlocoDestino(b.id)}>
                    <input
                      value={b.nome}
                      placeholder={`Bloco ${bi + 1}`}
                      aria-label="Nome do bloco"
                      onChange={(e) => renomearBloco(bi, e.target.value)}
                    />
                    <span className="count">{b.musicas.length}</span>
                    <button
                      type="button" className="btn-order" aria-label="Mover bloco pra cima" title="Mover bloco pra cima"
                      onClick={(e) => { e.stopPropagation(); moverBloco(bi, -1) }} disabled={bi === 0}
                    >▲</button>
                    <button
                      type="button" className="btn-order" aria-label="Mover bloco pra baixo" title="Mover bloco pra baixo"
                      onClick={(e) => { e.stopPropagation(); moverBloco(bi, 1) }} disabled={bi === blocos.length - 1}
                    >▼</button>
                    <button
                      type="button" className="btn-remove" aria-label="Apagar bloco" title="Apagar bloco"
                      onClick={(e) => { e.stopPropagation(); removerBloco(bi) }}
                    >✕</button>
                  </div>

                  {b.musicas.length === 0 ? (
                    <p className="filter-hint" style={{ margin: '6px 0 0' }}>Nenhuma música ainda — busque acima ou traga as menos dominadas.</p>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(b.id, unidades)}>
                      <SortableContext items={unidades.map((u) => u.id)} strategy={verticalListSortingStrategy}>
                        <div className="event-setlist">
                          {unidades.map((u, ui) => {
                            const startOffset = offset + localOffset
                            localOffset += u.musicas.length
                            const multi = u.musicas.length > 1
                            const linha = (s, numero) => {
                              const nivel = dominioPorPeso(calcDominio(allSongs.find((x) => x.id === s.id)?.dominio, uidsAtivos).pior)
                              const tom = allSongs.find((x) => x.id === s.id)?.tom
                              const cantor = allSongs.find((x) => x.id === s.id)?.cantor
                              return (
                                <>
                                  <span className="event-setlist-pos">{numero}</span>
                                  <span className="event-setlist-title">
                                    {s.title}
                                    {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                                    {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                                    {tom && <span className="event-setlist-bpm"> · ♪ {tom}</span>}
                                    {cantor && <span className="event-setlist-bpm"> · 🎤 {cantor}</span>}
                                    {nivel && (
                                      <span className="status-dot status-dot-inline" style={{ color: nivel.color, background: nivel.bg }}>
                                        {nivel.label}
                                      </span>
                                    )}
                                  </span>
                                </>
                              )
                            }
                            return (
                              <SortableSetlistItem key={u.id} id={u.id} className={multi ? 'unidade' : ''}>
                                {multi ? (
                                  <>
                                    <span className="unidade-elo" title="Sempre tocam juntas, nessa ordem">⛓</span>
                                    <div style={{ flex: 1 }}>
                                      {u.musicas.map((s, k) => (
                                        <div key={s.id} className="unidade-musica">
                                          {linha(s, startOffset + k + 1)}
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : linha(u.musicas[0], startOffset + 1)}
                                <span className="event-setlist-actions">
                                  <button
                                    type="button" className="btn-order" aria-label="Mover pra cima" title="Mover pra cima"
                                    onClick={() => moveUnidade(b.id, unidades, ui, -1)} disabled={bi === 0 && ui === 0}
                                  >▲</button>
                                  <button
                                    type="button" className="btn-order" aria-label="Mover pra baixo" title="Mover pra baixo"
                                    onClick={() => moveUnidade(b.id, unidades, ui, 1)} disabled={bi === blocos.length - 1 && ui === unidades.length - 1}
                                  >▼</button>
                                  <button
                                    type="button" className="btn-remove"
                                    aria-label={multi ? `Tirar ${u.musicas.length} músicas do evento` : `Tirar ${u.musicas[0].title} do evento`}
                                    title="Tirar do evento"
                                    onClick={() => removeUnidade(b.id, u)}
                                  >✕</button>
                                </span>
                              </SortableSetlistItem>
                            )
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              )
            })}

            <button type="button" className="btn-secondary" onClick={novoBloco}>+ Novo bloco</button>
          </div>

          <div className="form-group">
            <p className="section-label">Pauta</p>
            <div className="pauta-input-row">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPauta())}
                placeholder="Adicionar item à pauta..."
                aria-label="Novo item da pauta"
              />
              <button type="button" className="btn-secondary" onClick={addPauta}>+</button>
            </div>
            {pauta.map((item, i) => (
              <div key={i} className="pauta-item-edit">
                <span>{item.text}</span>
                <button type="button" className="btn-remove" aria-label="Remover item da pauta" title="Remover item da pauta" onClick={() => removePauta(i)}>✕</button>
              </div>
            ))}
          </div>

          <label>Observações
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Ex: levar cabo extra, ensaiar a entrada da 3ª…" />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
