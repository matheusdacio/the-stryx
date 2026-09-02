import { useState, useEffect, useRef } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { menosDominadas } from '../../utils/dominio'

function toInputDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toISOString().slice(0, 10)
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
export default function EnsaioModal({ ensaio, copiando = false, onClose }) {
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
  const dragIndex = useRef(null)

  // Carrega músicas do repertório
  useEffect(() => {
    const q = query(collection(db, 'songs'), orderBy('order', 'asc'))
    return onSnapshot(q, (snap) => {
      setAllSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const addPauta = () => {
    if (!newItem.trim()) return
    setPauta([...pauta, { text: newItem.trim(), done: false }])
    setNewItem('')
  }

  const removePauta = (i) => setPauta(pauta.filter((_, idx) => idx !== i))

  // ── Setlist do evento ───────────────────────────────────────────────
  // Puxa pro ensaio o que a banda marcou como menos dominado. Já ignora o
  // que está no evento e quem ainda não recebeu nenhum voto
  const trazerCruas = () => {
    const escolhidas = menosDominadas(allSongs, Number(quantasCruas) || 0, setlist.map((s) => s.id))
    if (!escolhidas.length) {
      setAvisoCruas('Nenhuma música com voto de domínio fora deste evento.')
      return
    }
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
    setSetlist([...setlist, {
      id: song.id,
      title: song.title,
      artist: song.artist || '',
      bpm: song.bpm || null,
    }])
    setSongSearch('')
  }

  const removeSong = (i) => setSetlist(setlist.filter((_, idx) => idx !== i))

  const moveSong = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= setlist.length) return
    const next = [...setlist]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSetlist(next)
  }

  // Drag and drop (desktop)
  const handleDragStart = (i) => { dragIndex.current = i }
  const handleDragOver = (e, i) => {
    e.preventDefault()
    const from = dragIndex.current
    if (from === null || from === i) return
    const next = [...setlist]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    dragIndex.current = i
    setSetlist(next)
  }
  const handleDragEnd = () => { dragIndex.current = null }

  const searchResults = songSearch.trim()
    ? allSongs.filter((s) =>
        !setlist.some((x) => x.id === s.id) &&
        `${s.title} ${s.artist || ''}`.toLowerCase().includes(songSearch.toLowerCase())
      ).slice(0, 6)
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>{editando ? 'Editar Evento' : copiando ? 'Copiar Evento' : 'Agendar Evento'}</h2>
        {copiando && (
          <p className="section-label" style={{ marginBottom: 10 }}>
            Repertório e pauta vieram do evento de {toInputDate(ensaio?.date).split('-').reverse().join('/')}. Escolha a data nova — a presença começa em branco.
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
          <label>Status
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="planejado">Planejado</option>
              <option value="realizado">Realizado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>

          {/* Setlist do evento */}
          <div className="form-group">
            <p className="section-label">
              Músicas do evento {setlist.length > 0 && `(${setlist.length})`}
            </p>
            <input
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              placeholder="Buscar música do repertório..."
            />
            {searchResults.length > 0 && (
              <div className="song-search-results">
                {searchResults.map((s) => (
                  <button key={s.id} type="button" className="song-search-item" onClick={() => addSong(s)}>
                    + {s.title} {s.artist && <span className="song-search-artist">— {s.artist}</span>}
                  </button>
                ))}
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
              />
              <span>músicas menos dominadas</span>
              <button type="button" className="btn-secondary" onClick={trazerCruas}>+ Trazer</button>
              {avisoCruas && <span className="trazer-cruas-aviso">{avisoCruas}</span>}
            </div>

            {setlist.length > 0 && (
              <div className="event-setlist">
                {setlist.map((s, i) => (
                  <div
                    key={s.id}
                    className="event-setlist-item"
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <span className="drag-handle" title="Arrastar para reordenar">⠿</span>
                    <span className="event-setlist-pos">{i + 1}</span>
                    <span className="event-setlist-title">
                      {s.title}
                      {s.artist && <span className="song-search-artist"> — {s.artist}</span>}
                      {s.bpm && <span className="event-setlist-bpm"> · {s.bpm} BPM</span>}
                    </span>
                    <span className="event-setlist-actions">
                      <button type="button" className="btn-order" onClick={() => moveSong(i, -1)} disabled={i === 0}>▲</button>
                      <button type="button" className="btn-order" onClick={() => moveSong(i, 1)} disabled={i === setlist.length - 1}>▼</button>
                      <button type="button" className="btn-remove" onClick={() => removeSong(i)}>✕</button>
                    </span>
                  </div>
                ))}
              </div>
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
              />
              <button type="button" className="btn-primary" onClick={addPauta}>+</button>
            </div>
            {pauta.map((item, i) => (
              <div key={i} className="pauta-item-edit">
                <span>{item.text}</span>
                <button type="button" className="btn-remove" onClick={() => removePauta(i)}>✕</button>
              </div>
            ))}
          </div>

          <label>Observações
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Notas do evento..." />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
