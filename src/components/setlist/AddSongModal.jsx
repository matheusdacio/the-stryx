import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { getYouTubeId } from '../../utils/youtube'
import { checarDuplicata, mensagemBloqueio } from '../../utils/duplicata'

export default function AddSongModal({ onClose, totalSongs, acervo }) {
  const [form, setForm] = useState({ title: '', artist: '', notes: '', tom: '', bpm: '', videoUrl: '' })
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)
  const videoId = getYouTubeId(form.videoUrl)

  const duplicata = checarDuplicata(form.title, form.artist, acervo)
  const { bloqueio, parecidas } = duplicata

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim() || bloqueio) return
    setSaving(true)
    // Semeia "crua" pra banda toda, igual ao aprovar sugestão — senão a
    // música cadastrada direto nasce "Sem voto" e fica fora do "Trazer as
    // menos dominadas" até alguém lembrar de votar nela
    const dominio = {}
    ;(acervo.bandMembers || []).forEach((m) => {
      if (!m.firebaseUid) return
      dominio[m.firebaseUid] = { userName: m.name, level: 'crua', at: new Date().toISOString(), seeded: true }
    })
    // Fecha na hora: o Firestore já aplica a escrita localmente e a lista se
    // atualiza sozinha (onSnapshot). Esperar o await deixava o botão preso em
    // "Salvando..." pra sempre sem internet, mesmo com a música já na tela
    addDoc(collection(db, 'songs'), {
      ...form,
      tom: form.tom.trim(),
      bpm: form.bpm ? Number(form.bpm) : null,
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      dominio,
      order: totalSongs,
      createdAt: serverTimestamp(),
    }).catch(() => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.'))
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adicionar Música</h2>
        <p className="filter-hint" style={{ margin: '-4px 0 12px' }}>
          Pra música que a banda já toca. Quer propor uma nova?{' '}
          <a href="#/sugestoes" className="btn-link-inline" onClick={onClose}>Manda em Sugerir 🡒</a>
        </p>
        <form onSubmit={handleSubmit}>
          <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Ex: Eruption" autoFocus required /></label>
          <label>Artista / Autor<input name="artist" value={form.artist} onChange={handleChange} placeholder="Ex: Van Halen" /></label>
          {bloqueio && (
            <p className="aviso-duplicata bloqueio">
              ⛔ {mensagemBloqueio(duplicata)}
              {bloqueio === 'sugestao' && (
                <a href="#/sugestoes" className="btn-link-inline" onClick={onClose}>Ver em Sugestões</a>
              )}
            </p>
          )}
          {!bloqueio && parecidas?.length > 0 && (
            <p className="aviso-duplicata">
              ⚠️ Já existe algo parecido: {parecidas.join(' · ')} — confira o artista.
            </p>
          )}
          <div className="form-row">
            <label>Tom
              <input name="tom" value={form.tom} onChange={handleChange} placeholder="Ex: Sol, Am" />
            </label>
            <label>BPM
              <input name="bpm" type="number" min="20" max="300" value={form.bpm} onChange={handleChange} placeholder="Ex: 120" />
            </label>
          </div>
          <label>
            Link do YouTube
            <input name="videoUrl" value={form.videoUrl} onChange={handleChange} placeholder="https://youtube.com/watch?v=..." />
          </label>
          {videoId && (
            <div className="yt-preview-small">
              <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="preview" />
              <span>✓ Vídeo reconhecido</span>
            </div>
          )}
          <label>
            Tags <span style={{ opacity: 0.6 }}>(separadas por vírgula)</span>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Ex: Acústico, Anos 80" />
          </label>
          <label>Observações<textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notas..." rows={3} /></label>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving || !!bloqueio}>{saving ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
