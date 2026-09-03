import { useState, useEffect } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, onSnapshot, orderBy, query } from 'firebase/firestore'
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
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'

function toInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
}

// Wrapper sortable: liga a linha do repertório do evento ao dnd-kit, com a
// alça ⠿ arrastável por toque (PointerSensor/TouchSensor abaixo)
function SortableSetlistItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 5, position: 'relative' } : {}),
  }
  return (
    <div ref={setNodeRef} style={style} className={`event-setlist-item ${isDragging ? 'dragging' : ''}`}>
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
  const [form, setForm] = useState({
    date: copiando ? '' : toInputDate(ensaio?.date) || '',
    location: ensaio?.location || '',
    type: ensaio?.type || 'ensaio',
    status: copiando ? 'planejado' : ensaio?.status || 'planejado',
    notes: ensaio?.notes || '',
  })
  const [pauta, setPauta] = useState(
    copiando
      ? (ensaio?.pauta || []).map((i) => ({ ...i, done: false }))
      : ensaio?.pauta || []
  )
  const [setlist, setSetlist] = useState(ensaio?.setlist || [])
  const [newItem, setNewItem] = useState('')
  const [songSearch, setSongSearch] = useState('')
  const [quantasCruas, setQuantasCruas] = useState(5)
  const [avisoCruas, setAvisoCruas] = useState('')
  const [saving, setSaving] = useState(false)
  const [mexeu, setMexeu] = useState(false)

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

  // ── Setlist do evento ───────────────────────────────────────────────
  // Puxa pro ensaio o que a banda marcou como menos dominado. Já ignora o
  // que está no evento e quem ainda não recebeu nenhum voto
  const trazerCruas = () => {
    const escolhidas = menosDominadas(allSongs, Number(quantasCruas) || 0, setlist.map((s) => s.id), uidsAtivos)
    if (!escolhidas.length) {
      setAvisoCruas('Ninguém votou ainda em nenhuma música fora deste evento — vote no Setlist primeiro.')
      return
    }
    setMexeu(true)
    setSetlist([...setlist, ...escolhidas.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      bpm: song.bpm || null,
    }))])
    setAvisoCruas(`${escolhidas.length} ${escolhidas.length === 1 ? 'música adicionada' : 'músicas adicionadas'}.`)
  }

  const addSong = (song) => {
    if (setlist.some((s) => s.id === song.id)) return
    setMexeu(true)
    setSetlist([...setlist, {
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      bpm: song.bpm || null,
    }])
  }

  const removeSong = (i) => { setMexeu(true); setSetlist(setlist.filter((_, idx) => idx !== i)) }

  const moveSong = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= setlist.length) return
    setMexeu(true)
    const next = [...setlist]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSetlist(next)
  }

  // Arrastar e soltar (toque ou mouse) — dnd-kit, ids são os da música
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = setlist.findIndex((s) => s.id === active.id)
    const newIndex = setlist.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    setMexeu(true)
    setSetlist(arrayMove(setlist, oldIndex, newIndex))
  }

  const searchResults = songSearch.trim()
    ? allSongs.filter((s) =>
        !setlist.some((x) => x.id === s.id) &&
        matchesSearch(songSearch, s.title, s.artist)
      ).slice(0, 10)
    : []

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    const data = {
      ...form,
      pauta,
      setlist,
      date: Timestamp.fromDate(new Date(form.date + 'T12:00:00')),
    }
    // Fecha na hora — sem sinal, esperar o await deixava o modal preso e,
    // se a pessoa fechasse e tentasse de novo, salvava duas vezes
    const erro = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
    if (editando) {
      // Só grava o que de fato mudou em relação ao que estava aberto — quem
      // só trocou o local não regrava pauta/setlist por cima de uma edição
      // simultânea de outro membro (ensaiadas/presenca nunca entram aqui,
      // já que nem fazem parte do form)
      const mudou = {}
      if (form.location !== (ensaio.location || '')) mudou.location = data.location
      if (form.type !== (ensaio.type || 'ensaio')) mudou.type = data.type
      if (form.status !== (ensaio.status || 'planejado')) mudou.status = data.status
      if (form.notes !== (ensaio.notes || '')) mudou.notes = data.notes
      if (form.date !== toInputDate(ensaio.date)) mudou.date = data.date
      if (JSON.stringify(pauta) !== JSON.stringify(ensaio.pauta || [])) mudou.pauta = data.pauta
      if (JSON.stringify(setlist) !== JSON.stringify(ensaio.setlist || [])) mudou.setlist = data.setlist

      if (Object.keys(mudou).length) {
        updateDoc(doc(db, 'ensaios', ensaio.id), mudou).catch(erro)
        // Só quem não abre o app dependia disso pra saber que o ensaio
        // sumiu ou mudou de dia — cancelar tem prioridade sobre remarcar
        // (não faz sentido avisar as duas coisas na mesma edição)
        if (mudou.status === 'cancelado') {
          enfileirarAviso('evento_cancelado', ensaio.id, data)
        } else if (mudou.date && data.status !== 'cancelado') {
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
              onClick={() => setForm({ ...form, type: 'ensaio' })}
            >
              🎸 Ensaio
            </button>
            <button
              type="button"
              className={`btn-event-type ${isApresentacao ? 'active apresentacao' : ''}`}
              onClick={() => setForm({ ...form, type: 'apresentacao' })}
            >
              🎤 Apresentação
            </button>
          </div>

          <div className="form-row">
            <label>Data *<input type="date" name="date" value={form.date} onChange={handleChange} required /></label>
            <label>Local<input name="location" value={form.location} onChange={handleChange} placeholder={isApresentacao ? 'Ex: Bar do Zé' : 'Ex: Estúdio X'} /></label>
          </div>
          {/* "Realizado" não fazia nada — as abas Próximos/Realizados são
              calculadas pela data. Só cancelado muda algo, então o controle
              vira um toggle com o verbo certo */}
          <button
            type="button"
            className={`btn-cancelar-evento ${form.status === 'cancelado' ? 'cancelado' : ''}`}
            onClick={() => { setMexeu(true); setForm({ ...form, status: form.status === 'cancelado' ? 'planejado' : 'cancelado' }) }}
          >
            {form.status === 'cancelado' ? '↩ Reativar' : '✕ Cancelar este evento'}
          </button>

          {/* Setlist do evento */}
          <div className="form-group">
            <p className="section-label">
              Músicas do evento {setlist.length > 0 && `(${setlist.length})`}
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
                  return (
                    <button key={s.id} type="button" className="song-search-item" onClick={() => addSong(s)}>
                      + {s.title} {s.artist && <span className="song-search-artist">— {s.artist}</span>}
                      {nivel && (
                        <span className="mini-chip" style={{ marginLeft: 6, color: nivel.color, borderColor: nivel.color }}>
                          {nivel.label}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
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
              {avisoCruas && <span className="trazer-cruas-aviso">{avisoCruas}</span>}
            </div>

            {setlist.length > 0 && (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={setlist.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="event-setlist">
                    {setlist.map((s, i) => {
                      const nivel = dominioPorPeso(calcDominio(allSongs.find((x) => x.id === s.id)?.dominio, uidsAtivos).pior)
                      return (
                      <SortableSetlistItem key={s.id} id={s.id}>
                        <span className="event-setlist-pos">{i + 1}</span>
                        <span className="event-setlist-title">
                          {s.title}
                          {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                          {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                          {nivel && (
                            <span className="mini-chip" style={{ marginLeft: 6, color: nivel.color, borderColor: nivel.color }}>
                              {nivel.label}
                            </span>
                          )}
                        </span>
                        <span className="event-setlist-actions">
                          <button type="button" className="btn-order" aria-label="Mover pra cima" title="Mover pra cima" onClick={() => moveSong(i, -1)} disabled={i === 0}>▲</button>
                          <button type="button" className="btn-order" aria-label="Mover pra baixo" title="Mover pra baixo" onClick={() => moveSong(i, 1)} disabled={i === setlist.length - 1}>▼</button>
                          <button type="button" className="btn-remove" aria-label={`Tirar ${s.title} do evento`} title="Tirar do evento" onClick={() => removeSong(i)}>✕</button>
                        </span>
                      </SortableSetlistItem>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
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
