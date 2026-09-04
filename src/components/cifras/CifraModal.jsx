import { useState } from 'react'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'

const FS_KEY = 'stryx-cifra-fs'
const FS_MIN = 0.7
const FS_MAX = 1.6

function lerFs() {
  try {
    const salvo = Number(localStorage.getItem(FS_KEY))
    return salvo >= FS_MIN && salvo <= FS_MAX ? salvo : 0.88
  } catch {
    return 0.88
  }
}

const formDe = (cifra) => ({
  title: cifra?.title || '',
  artist: cifra?.artist || '',
  key: cifra?.key || '',
  bpm: cifra?.bpm || '',
  content: cifra?.content || '',
})

export default function CifraModal({ cifra, onClose, onRemove, KEYS }) {
  const [editing, setEditing] = useState(!cifra)
  const [form, setForm] = useState(() => formDe(cifra))
  const [saving, setSaving] = useState(false)
  const [mexeu, setMexeu] = useState(false)
  // Tamanho da letra é preferência de quem lê, não da cifra — compartilhado
  // com o Modo palco pela mesma chave no localStorage
  const [fs, setFs] = useState(lerFs)

  const handleChange = (e) => {
    setMexeu(true)
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const ajustarFs = (delta) => {
    const novo = Math.round(Math.min(FS_MAX, Math.max(FS_MIN, fs + delta)) * 10) / 10
    setFs(novo)
    try { localStorage.setItem(FS_KEY, String(novo)) } catch { /* sem storage, segue sem lembrar */ }
  }

  // Em edição, só sai por Cancelar (com aviso se mexeu em algo) — tocar
  // fora não deve descartar cifra digitada por acidente
  const cancelar = () => {
    if (mexeu && !confirm('Descartar o que você digitou?')) return
    onClose()
  }

  useFecharComVoltar(cancelar)

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    // Fecha na hora — sem sinal, o await deixava o modal preso em "Salvando..."
    const erro = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
    if (cifra) {
      updateDoc(doc(db, 'cifras', cifra.id), form).catch(erro)
    } else {
      addDoc(collection(db, 'cifras'), { ...form, createdAt: serverTimestamp() }).catch(erro)
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={editing ? undefined : onClose}>
      <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2>{editing ? (cifra ? 'Editar cifra' : 'Nova cifra') : cifra.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {!editing && (
              <>
                <button className="btn-secondary" aria-label="Diminuir letra" onClick={() => ajustarFs(-0.1)}>A−</button>
                <button className="btn-secondary" aria-label="Aumentar letra" onClick={() => ajustarFs(0.1)}>A+</button>
              </>
            )}
            {cifra && !editing && (
              <button className="btn-secondary" onClick={() => { setForm(formDe(cifra)); setEditing(true) }}>Editar</button>
            )}
            {!editing && <button className="btn-secondary" onClick={onClose}>Fechar</button>}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave}>
            <div className="form-row">
              <label>Título *<input name="title" value={form.title} onChange={handleChange} placeholder="Nome da música" autoFocus required /></label>
              <label>Artista<input name="artist" value={form.artist} onChange={handleChange} placeholder="Banda / Artista" /></label>
            </div>
            <div className="form-row">
              <label>Tom
                <input name="key" value={form.key} onChange={handleChange} placeholder="Ex: Sol, Am" list="tons-cifra" />
                <datalist id="tons-cifra">
                  {KEYS.map((k) => <option key={k} value={k} />)}
                </datalist>
              </label>
              <label>BPM<input name="bpm" type="number" value={form.bpm} onChange={handleChange} placeholder="120" /></label>
            </div>
            <label>
              Cifra / Tabs
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                placeholder={`Ex:\n[Intro]\nE|--0--2--3--|\nB|--0--3--3--|\n\n[Verso]\nAm   G   F   E\nLetra ou acordes aqui…`}
                rows={14}
                className="cifra-textarea"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={cancelar}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        ) : (
          <div className="cifra-view" style={{ '--cifra-fs': `${fs}rem` }}>
            <div className="cifra-meta" style={{ marginBottom: 16 }}>
              {cifra.key && <span className="mini-chip">♪ {cifra.key}</span>}
              {cifra.bpm && <span className="badge badge-bpm">{cifra.bpm} BPM</span>}
              {cifra.artist && <span className="badge">{cifra.artist}</span>}
            </div>
            <pre className="cifra-content">{cifra.content || 'Sem conteúdo.'}</pre>
            {onRemove && (
              <div className="modal-actions">
                <button type="button" className="btn-ghost-danger" style={{ marginRight: 'auto' }} onClick={onRemove}>Remover</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
