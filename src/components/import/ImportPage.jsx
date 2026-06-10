import { useState } from 'react'
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const VOTE_TO_OPINION = { 4: 'escopo', 3: 'ajustar', 2: 'fora', 1: 'nao_gosto' }

// ── Helpers ──────────────────────────────────────────────────────────

function parseJSON(text) {
  try { return JSON.parse(text) } catch (e) { return null }
}

function buildOpinoes(votes) {
  const opinoes = {}
  Object.entries(votes || {}).forEach(([name, v]) => {
    const val = typeof v === 'object' ? v.value : v
    const label = typeof v === 'object' ? v.label : String(v)
    const opinion = VOTE_TO_OPINION[val]
    if (!opinion) return
    const key = `import_${name.replace(/\s+/g, '_')}`
    opinoes[key] = {
      userName: name,
      opinion,
      comment: `Glissandoo: ${label}`,
      at: new Date().toISOString(),
    }
  })
  return opinoes
}

// ── Seção de resumo ───────────────────────────────────────────────────

function ResumoCard({ icon, label, count, selected, onToggle }) {
  return (
    <button
      className={`resumo-card ${selected ? 'selected' : ''} ${count === 0 ? 'empty' : ''}`}
      onClick={() => count > 0 && onToggle()}
    >
      <span className="resumo-icon">{icon}</span>
      <span className="resumo-count">{count}</span>
      <span className="resumo-label">{label}</span>
      {count > 0 && <span className="resumo-check">{selected ? '✓' : '+'}</span>}
    </button>
  )
}

// ── Importadores ─────────────────────────────────────────────────────

async function importMembros(membros) {
  const batch = writeBatch(db)
  membros.forEach((m) => {
    const ref = doc(collection(db, 'members'))
    batch.set(ref, {
      name: m.name,
      uid: m.uid || '',
      role: '',
      createdAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

async function importMusicas(musicas) {
  for (let i = 0; i < musicas.length; i++) {
    const m = musicas[i]
    await addDoc(collection(db, 'songs'), {
      title: m.title,
      artist: m.artist || '',
      status: 'pronta',
      notes: '',
      order: i,
      createdAt: serverTimestamp(),
    })
  }
}

async function importSugestoes(sugestoes) {
  for (const s of sugestoes) {
    await addDoc(collection(db, 'sugestoes'), {
      title: s.title,
      artist: s.artist || '',
      videoUrl: '',
      description: 'Importada do Glissandoo',
      status: 'aberta',
      opinoes: buildOpinoes(s.votes),
      suggestedBy: 'Glissandoo (importação)',
      suggestedById: 'import',
      createdAt: serverTimestamp(),
    })
  }
}

async function importEnsaios(ensaios) {
  for (const e of ensaios) {
    let date = null
    try {
      if (e.date) date = Timestamp.fromDate(new Date(e.date + 'T12:00:00'))
    } catch (_) {}
    if (!date) continue
    await addDoc(collection(db, 'ensaios'), {
      date,
      location: e.location || '',
      notes: e.notes || '',
      status: e.status || 'realizado',
      members: e.members || [],
      pauta: e.pauta || [],
      createdAt: serverTimestamp(),
    })
  }
}

// ── Página principal ─────────────────────────────────────────────────

export default function ImportPage() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState({ membros: true, musicas: true, sugestoes: true, ensaios: true })
  const [status, setStatus] = useState(null) // null | 'importing' | 'done' | { error }
  const [progress, setProgress] = useState([])

  if (user.email !== ADMIN_EMAIL) {
    return <div className="page"><div className="empty-state"><p>Acesso restrito ao administrador.</p></div></div>
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setData(null)
    setStatus(null)
    setProgress([])
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseJSON(ev.target.result)
      if (!parsed) { setStatus({ error: 'Arquivo JSON inválido.' }); return }
      setData(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const toggle = (key) => setSelected((s) => ({ ...s, [key]: !s[key] }))

  const handleImport = async () => {
    if (!data) return
    setStatus('importing')
    setProgress([])

    const steps = [
      { key: 'membros',   label: 'Membros',   fn: () => importMembros(data.membros || []) },
      { key: 'musicas',   label: 'Músicas',    fn: () => importMusicas(data.musicas || []) },
      { key: 'sugestoes', label: 'Sugestões',  fn: () => importSugestoes(data.sugestoes || []) },
      { key: 'ensaios',   label: 'Ensaios',    fn: () => importEnsaios(data.ensaios || []) },
    ]

    for (const step of steps) {
      if (!selected[step.key]) continue
      const count = (data[step.key] || []).length
      if (!count) continue
      setProgress((p) => [...p, { label: step.label, status: 'running', count }])
      try {
        await step.fn()
        setProgress((p) => p.map((x) => x.label === step.label ? { ...x, status: 'done' } : x))
      } catch (err) {
        setProgress((p) => p.map((x) => x.label === step.label ? { ...x, status: 'error', err: err.message } : x))
      }
    }

    setStatus('done')
  }

  const totalSelected = data
    ? Object.entries(selected).filter(([k, v]) => v && (data[k] || []).length > 0).length
    : 0

  return (
    <div className="page">
      <div className="page-header">
        <h2>Importar do Glissandoo</h2>
      </div>

      {/* Instruções */}
      <div className="import-instructions">
        <p className="section-label">Como usar</p>
        <ol>
          <li>Abra o arquivo <code>glissandoo-extrator-completo.js</code> da pasta do projeto</li>
          <li>Acesse <strong>app.glissandoo.com/group/thestryx/repertory</strong> (sem filtros)</li>
          <li>Abra o console do navegador (F12 → Console)</li>
          <li>Cole o script e pressione Enter — o JSON será baixado</li>
          <li>Selecione o arquivo abaixo e confirme a importação</li>
        </ol>
      </div>

      {/* Upload */}
      <div className="import-section">
        <label className="file-upload-label">
          <input type="file" accept=".json" onChange={handleFile} />
          📂 Selecionar arquivo JSON
        </label>
        {fileName && <p className="import-count">📄 {fileName}</p>}
        {status?.error && <p style={{ color: 'var(--red)', fontSize: '0.85rem' }}>⚠ {status.error}</p>}
      </div>

      {/* Resumo do que foi encontrado */}
      {data && (
        <>
          <div className="resumo-header">
            <p className="section-label">O que foi encontrado — clique para selecionar/deselecionar</p>
            {data.exportedAt && (
              <p className="import-desc">Exportado em: {new Date(data.exportedAt).toLocaleString('pt-BR')}</p>
            )}
          </div>

          <div className="resumo-grid">
            <ResumoCard icon="👤" label="Membros"   count={(data.membros   || []).length} selected={selected.membros}   onToggle={() => toggle('membros')} />
            <ResumoCard icon="🎵" label="Músicas"   count={(data.musicas   || []).length} selected={selected.musicas}   onToggle={() => toggle('musicas')} />
            <ResumoCard icon="🗳️" label="Sugestões" count={(data.sugestoes || []).length} selected={selected.sugestoes} onToggle={() => toggle('sugestoes')} />
            <ResumoCard icon="📅" label="Ensaios"   count={(data.ensaios   || []).length} selected={selected.ensaios}   onToggle={() => toggle('ensaios')} />
          </div>

          {/* Preview de cada tipo */}
          {selected.membros && (data.membros || []).length > 0 && (
            <PreviewSection title="👤 Membros" items={(data.membros || []).map(m => m.name)} />
          )}
          {selected.musicas && (data.musicas || []).length > 0 && (
            <PreviewSection title="🎵 Músicas" items={(data.musicas || []).map(m => `${m.title}${m.artist ? ` — ${m.artist}` : ''}`)} />
          )}
          {selected.sugestoes && (data.sugestoes || []).length > 0 && (
            <PreviewSection
              title="🗳️ Sugestões"
              items={(data.sugestoes || []).map(s => {
                const nVotes = Object.keys(s.votes || {}).length
                return `${s.title}${s.artist ? ` — ${s.artist}` : ''} (${nVotes} votos)`
              })}
            />
          )}
          {selected.ensaios && (data.ensaios || []).length > 0 && (
            <PreviewSection title="📅 Ensaios" items={(data.ensaios || []).map(e => `${e.date}${e.location ? ` · ${e.location}` : ''}`)} />
          )}

          {/* Progresso */}
          {progress.length > 0 && (
            <div className="import-progress">
              {progress.map((p, i) => (
                <div key={i} className={`progress-item progress-${p.status}`}>
                  {p.status === 'running' && <span className="spinner">⏳</span>}
                  {p.status === 'done'    && <span>✅</span>}
                  {p.status === 'error'   && <span>❌</span>}
                  <span>{p.label} ({p.count})</span>
                  {p.err && <span style={{ color: 'var(--red)', fontSize: '0.75rem' }}>{p.err}</span>}
                </div>
              ))}
            </div>
          )}

          {status === 'done' && (
            <div className="import-success">✅ Importação concluída! Confira cada módulo no menu.</div>
          )}

          {status !== 'done' && totalSelected > 0 && (
            <button
              className="btn-primary"
              style={{ marginTop: 8 }}
              onClick={handleImport}
              disabled={status === 'importing'}
            >
              {status === 'importing' ? 'Importando...' : `Importar dados selecionados`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function PreviewSection({ title, items }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)
  return (
    <div className="preview-section">
      <p className="preview-section-title">{title}</p>
      <ul className="preview-list">
        {visible.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
      {items.length > 5 && (
        <button className="btn-expand" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ver menos' : `+ ${items.length - 5} mais`}
        </button>
      )}
    </div>
  )
}
