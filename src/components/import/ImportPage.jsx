import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

const MEMBER_NAMES = ['Cristiano', 'Shirleano', 'Marcio Braz', 'Marcos', 'Albano', 'Matheus Dacio']

// Mapeia nota Glissandoo (1-4) → opinião The Stryx
const VOTE_TO_OPINION = { '4': 'escopo', '3': 'ajustar', '2': 'fora', '1': 'nao_gosto' }
const VOTE_LABEL      = { '4': 'Adora', '3': 'Eu Gosto Disso', '2': 'Eu Não Sei', '1': 'Eu Não Gosto Disso' }

// Parser de CSV com separador ; e aspas duplas
function parseCSV(text) {
  const clean = text.replace(/^﻿/, '').replace(/\r/g, '')
  const lines = clean.split('\n').filter((l) => l.trim())
  const headers = parseLine(lines[0])
  return lines.slice(1).map((line) => {
    const vals = parseLine(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
}

function parseLine(line) {
  const values = []
  let inQuote = false, cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ';' && !inQuote) { values.push(cur); cur = '' }
    else cur += ch
  }
  values.push(cur)
  return values
}

// Converte linhas do CSV de sugestões em documentos do Firestore
function csvToSugestoes(rows) {
  return rows.map((row) => {
    const title = row['Título']?.trim()
    if (!title) return null
    const opinoes = {}
    MEMBER_NAMES.forEach((name) => {
      const val = (row[name] || '').trim()
      if (!val) return
      const voteNum = val.charAt(0)
      if (!VOTE_TO_OPINION[voteNum]) return
      const key = `import_${name.replace(/\s+/g, '_')}`
      opinoes[key] = {
        userName: name,
        opinion: VOTE_TO_OPINION[voteNum],
        comment: `Glissandoo: ${VOTE_LABEL[voteNum]}`,
        at: new Date().toISOString(),
      }
    })
    return { title, opinoes, totalVotos: parseInt(row['Total Votos']) || 0 }
  }).filter(Boolean)
}

// Converte linhas do CSV de repertório em documentos de songs
function csvToSongs(rows) {
  return rows.map((row, i) => {
    const title = (row['Título'] || row['titulo'] || row['title'] || '').trim()
    if (!title) return null
    const artist = (row['Artista'] || row['artista'] || row['artist'] || '').trim()
    return { title, artist, status: 'pronta', notes: '', order: i, createdAt: serverTimestamp() }
  }).filter(Boolean)
}

// ─── Componente de preview de tabela ───
function PreviewTable({ rows, type }) {
  if (!rows.length) return null
  const cols = type === 'sugestoes'
    ? ['#', 'Título', 'Votos', 'Opiniões mapeadas']
    : ['#', 'Título', 'Artista']

  return (
    <div className="import-preview">
      <table>
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{row.title}</td>
              {type === 'sugestoes' ? (
                <>
                  <td>{row.totalVotos}</td>
                  <td className="opinions-preview">
                    {Object.values(row.opinoes).map((o, j) => (
                      <span key={j} className="mini-opinion">{o.userName}: {o.comment.replace('Glissandoo: ', '')}</span>
                    ))}
                  </td>
                </>
              ) : (
                <td>{row.artist || '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && <p className="preview-more">+ {rows.length - 20} itens não exibidos...</p>}
    </div>
  )
}

// ─── Seção de importação (reutilizável) ───
function ImportSection({ title, desc, type, onImport }) {
  const [rows, setRows] = useState(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      const converted = type === 'sugestoes' ? csvToSugestoes(parsed) : csvToSongs(parsed)
      setRows(converted)
      setDone(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImport = async () => {
    if (!rows?.length) return
    setImporting(true)
    await onImport(rows)
    setImporting(false)
    setDone(true)
    setRows(null)
  }

  return (
    <div className="import-section">
      <h3>{title}</h3>
      <p className="import-desc">{desc}</p>
      <label className="file-upload-label">
        <input type="file" accept=".csv" onChange={handleFile} />
        📂 Selecionar CSV
      </label>

      {rows && (
        <>
          <p className="import-count">✓ {rows.length} itens encontrados no arquivo</p>
          <PreviewTable rows={rows} type={type} />
          <button className="btn-primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importando...' : `Importar ${rows.length} itens`}
          </button>
        </>
      )}

      {done && (
        <div className="import-success">✅ Importação concluída com sucesso!</div>
      )}
    </div>
  )
}

// ─── Página principal ───
export default function ImportPage() {
  const { user } = useAuth()

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>Acesso restrito ao administrador.</p>
        </div>
      </div>
    )
  }

  const importSugestoes = async (rows) => {
    for (const row of rows) {
      await addDoc(collection(db, 'sugestoes'), {
        title: row.title,
        artist: '',
        videoUrl: '',
        description: `Importada do Glissandoo (${row.totalVotos} votos originais)`,
        status: 'aberta',
        opinoes: row.opinoes,
        suggestedBy: 'Glissandoo (importação)',
        suggestedById: 'import',
        createdAt: serverTimestamp(),
      })
    }
  }

  const importRepertorio = async (rows) => {
    for (const row of rows) {
      await addDoc(collection(db, 'songs'), row)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Importar do Glissandoo</h2>
      </div>

      <div className="import-instructions">
        <p className="section-label">Como funciona</p>
        <ol>
          <li>Rode o script de extração no console do Glissandoo</li>
          <li>Baixe o CSV gerado</li>
          <li>Selecione o arquivo aqui e confirme a importação</li>
        </ol>
      </div>

      <ImportSection
        title="🗳️ Sugestões com votos"
        desc="CSV gerado pelo script de sugestões. Os votos (1–4) serão convertidos para as opiniões do The Stryx."
        type="sugestoes"
        onImport={importSugestoes}
      />

      <ImportSection
        title="🎵 Repertório atual"
        desc="CSV gerado pelo script de repertório. As músicas entram como 'Prontas' no Setlist."
        type="repertorio"
        onImport={importRepertorio}
      />
    </div>
  )
}
