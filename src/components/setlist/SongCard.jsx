import { useState } from 'react'
import { doc, updateDoc, deleteDoc, deleteField, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import MetronomeButton from './MetronomeButton'
import { getYouTubeId } from '../../utils/youtube'
import VideoInline from '../VideoInline'
import { DOMINIOS, calcDominio, dominioPorPeso } from '../../utils/dominio'


// Níveis de dificuldade (votados por cada membro nas músicas em Ensaiando)
// 'nao_vi' é neutro: não conta na média de dificuldade (ver avgDifficulty na SetlistPage)
const DIFFICULTIES = [
  { value: 'nao_vi',   label: 'Ainda não vi',       short: 'Não viu',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  { value: 'de_boa',   label: 'De boa',             short: 'De boa',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'ok',       label: 'OK',                 short: 'OK',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  { value: 'sofrendo', label: 'Estou sofrendo',     short: 'Sofrendo',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'travado',  label: 'Preciso de um tempo', short: 'Travado',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  { value: 'moises',   label: 'Moisés, não consegue né', short: 'Moisés', color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
]

// Volta pras sugestões: o setlist tem 5 níveis de dificuldade e a sugestão só 3.
// 'nao_vi' é neutro e não vira voto lá.
const DIFF_TO_SUGESTAO = {
  de_boa: 'facil',
  ok: 'ok',
  sofrendo: 'dificil',
  travado: 'dificil',
  moises: 'dificil',
}

const firstName = (n) => (n || '').trim().split(' ')[0]

export default function SongCard({ song, nota, position }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const [tom, setTom] = useState(song.tom || '')
  const [bpm, setBpm] = useState(song.bpm || '')
  const [videoUrl, setVideoUrl] = useState(song.videoUrl || '')
  const [tags, setTags] = useState(song.tags || [])
  const [newTag, setNewTag] = useState('')
  const ref = doc(db, 'songs', song.id)

  // Dificuldade — voto de cada membro (mapa keyed por uid)
  const dificuldade = song.dificuldade || {}
  const myDiff = dificuldade[user.uid]?.level
  const voteDiff = (level) => {
    if (myDiff === level) {
      // Clicou no mesmo nível → remove o voto
      updateDoc(ref, { [`dificuldade.${user.uid}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`dificuldade.${user.uid}`]: {
          userName: user.displayName || user.email,
          level,
          at: new Date().toISOString(),
        },
      })
    }
  }

  // Domínio — o quanto cada um se sente pronto nesta música
  const dominio = song.dominio || {}
  const myDominio = dominio[user.uid]?.level
  const voteDominio = (level) => {
    if (myDominio === level) {
      updateDoc(ref, { [`dominio.${user.uid}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`dominio.${user.uid}`]: {
          userName: user.displayName || user.email,
          level,
          at: new Date().toISOString(),
        },
      })
    }
  }
  const piorDominio = dominioPorPeso(calcDominio(dominio).pior)

  const saveNotes = async () => { await updateDoc(ref, { notes }); setEditing(false) }
  const saveMeta = async () => {
    await updateDoc(ref, {
      tom: tom.trim(),
      bpm: bpm ? Number(bpm) : null,
      videoUrl: videoUrl.trim(),
      tags,
    })
    setEditingMeta(false)
  }
  const addTag = () => {
    const t = newTag.trim()
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setNewTag(''); return }
    setTags([...tags, t])
    setNewTag('')
  }
  const removeTag = (t) => setTags(tags.filter((x) => x !== t))
  const remove = () => { if (confirm(`Remover "${song.title}"?`)) deleteDoc(ref) }

  // Tira a música do setlist e devolve pra aba de Sugestões.
  // Se ela veio de uma sugestão aprovada, reabre a original (preserva as opiniões);
  // senão cria uma sugestão nova em aberto.
  const backToSuggestions = async () => {
    if (!confirm(`Tirar "${song.title}" do setlist e mandar de volta pras sugestões?`)) return

    const dificuldadeSug = {}
    Object.entries(dificuldade).forEach(([uid, v]) => {
      const level = DIFF_TO_SUGESTAO[v.level]
      if (level) dificuldadeSug[uid] = { userName: v.userName, level, at: v.at }
    })

    let reopened = false
    if (song.sugestaoId) {
      const sugRef = doc(db, 'sugestoes', song.sugestaoId)
      const snap = await getDoc(sugRef)
      if (snap.exists()) {
        await updateDoc(sugRef, {
          status: 'aberta',
          ...(song.notes ? { notes: song.notes } : {}),
          ...(song.videoUrl ? { videoUrl: song.videoUrl } : {}),
          ...(song.tom ? { tom: song.tom } : {}),
          ...(Object.keys(song.dominio || {}).length ? { dominio: song.dominio } : {}),
          bpm: song.bpm || null,
          tags: song.tags || [],
          dificuldade: { ...(snap.data().dificuldade || {}), ...dificuldadeSug },
        })
        reopened = true
      }
    }

    if (!reopened) {
      await addDoc(collection(db, 'sugestoes'), {
        title: song.title,
        artist: song.artist || '',
        videoUrl: song.videoUrl || '',
        description: '',
        notes: song.notes || '',
        tom: song.tom || '',
        dominio: song.dominio || {},
        bpm: song.bpm || null,
        tags: song.tags || [],
        status: 'aberta',
        opinoes: {},
        dificuldade: dificuldadeSug,
        suggestedBy: user.displayName || user.email,
        suggestedById: user.uid,
        createdAt: serverTimestamp(),
      })
    }

    await deleteDoc(ref)
  }

  const videoId = getYouTubeId(song.videoUrl)

  return (
    <div
      className={`song-card ${expanded ? 'expanded' : ''}`}
      style={{ borderLeftColor: piorDominio?.color || 'var(--border)' }}
    >
      <div className="song-header">
        <div className="song-order-wrap">
          <span className="song-position">{position}</span>
        </div>
        <div className="song-info" onClick={() => setExpanded(!expanded)} title={expanded ? 'Recolher' : 'Ver detalhes'}>
          <span className="song-title">{song.title}</span>
          {song.artist && <span className="song-artist"> — {song.artist}</span>}
        </div>
        <button
          className={`song-expand-btn ${expanded ? 'open' : ''}`}
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Recolher' : 'Ver detalhes'}
        >
          ›
        </button>
        <button className="btn-remove" onClick={remove} title="Remover">✕</button>
      </div>

      {/* Resumo compacto — aparece só quando recolhido */}
      {!expanded && (
        <div className="song-collapsed" onClick={() => setExpanded(true)}>
          {piorDominio ? (
            <span className="status-dot" style={{ color: piorDominio.color, background: piorDominio.bg }}>
              {piorDominio.label}
            </span>
          ) : (
            <span className="status-dot status-sem-voto">Sem voto</span>
          )}
          {nota && (
            <span className="mini-chip" title={`Média ${nota.media} · ${nota.total} voto(s) da banda`}>
              ⭐ {nota.media.toFixed(2)}
            </span>
          )}
          {song.tom && <span className="mini-chip">♪ {song.tom}</span>}
          {videoId && <VideoInline url={song.videoUrl} title={song.title} compacto />}
          {(song.tags || []).map((t) => <span key={t} className="mini-chip">🏷 {t}</span>)}
          {song.notes && <span className="mini-chip">📝</span>}
        </div>
      )}

      {/* Domínio — sempre visível, mesmo com o card fechado: é o voto
          que alimenta a escolha do que ensaiar */}
      <div className="difficulty-section">
        <p className="section-label">Você se sente pronto nessa?</p>
        <div className="difficulty-btns">
          {DOMINIOS.map((d) => (
            <button
              key={d.value}
              className={`btn-diff ${myDominio === d.value ? 'active' : ''}`}
              style={myDominio === d.value ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
              onClick={() => voteDominio(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {Object.keys(dominio).length > 0 && (
          <div className="difficulty-summary">
            {DOMINIOS.map((d) => {
              const voters = Object.values(dominio).filter((v) => v.level === d.value)
              if (!voters.length) return null
              return (
                <span key={d.value} className="diff-pill" style={{ color: d.color, background: d.bg }}>
                  {d.label}: {voters.map((v) => firstName(v.userName)).join(', ')}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {expanded && <>

      {/* Dificuldade pra tocar — o quanto a música é difícil, não o quanto a
          banda já a domina (isso é o bloco de cima) */}
      {(
        <div className="difficulty-section">
          <p className="section-label">Como tá pra você?</p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={`btn-diff ${myDiff === d.value ? 'active' : ''}`}
                style={myDiff === d.value ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
                onClick={() => voteDiff(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {Object.keys(dificuldade).length > 0 && (
            <div className="difficulty-summary">
              {DIFFICULTIES.map((d) => {
                const voters = Object.values(dificuldade).filter((v) => v.level === d.value)
                if (!voters.length) return null
                return (
                  <span key={d.value} className="diff-pill" style={{ color: d.color, background: d.bg }}>
                    {d.short}: {voters.map((v) => firstName(v.userName)).join(', ')}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* BPM, metrônomo e vídeo */}
      <div className="song-meta-bar">
        {song.bpm ? (
          <MetronomeButton bpm={song.bpm} />
        ) : (
          <button className="btn-meta-add" onClick={() => setEditingMeta(true)}>♩ + BPM</button>
        )}
        {videoId ? (
          <VideoInline url={song.videoUrl} title={song.title} compacto />
        ) : (
          <button className="btn-meta-add" onClick={() => setEditingMeta(true)}>🎬 + vídeo</button>
        )}
        {(song.tags || []).map((t) => (
          <span key={t} className="song-tag">🏷 {t}</span>
        ))}
        <button className="btn-meta-edit" onClick={() => setEditingMeta(!editingMeta)}>✏️ Editar</button>
      </div>

      {editingMeta && (
        <div className="song-meta-edit">
          <div className="form-row">
            <label>Tom
              <input value={tom} onChange={(e) => setTom(e.target.value)} placeholder="Ex: Sol, Am" />
            </label>
            <label>BPM
              <input type="number" min="20" max="300" value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="Ex: 120" />
            </label>
            <label>YouTube
              <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8 }}>
            Tags
            <div className="tag-edit-row">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Ex: Acústico, Show Bar do Zé..."
              />
              <button type="button" className="btn-primary" onClick={addTag}>+</button>
            </div>
          </label>
          {tags.length > 0 && (
            <div className="tag-chips">
              {tags.map((t) => (
                <span key={t} className="song-tag editable">
                  {t}
                  <button type="button" className="tag-remove" onClick={() => removeTag(t)}>✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="notes-actions">
            <button className="btn-secondary" onClick={() => setEditingMeta(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveMeta}>Salvar</button>
          </div>
        </div>
      )}

      {editing ? (
        <div className="notes-edit">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus />
          <div className="notes-actions">
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveNotes}>Salvar</button>
          </div>
        </div>
      ) : (
        <p className="song-notes" onClick={() => setEditing(true)}>
          {song.notes || <span className="placeholder">Clique para adicionar observações...</span>}
        </p>
      )}

      <div className="song-card-footer">
        <button className="btn-back-sug" onClick={backToSuggestions} title="Tirar do setlist e devolver pras sugestões">
          ↩ Voltar pras sugestões
        </button>
      </div>
      </>}
    </div>
  )
}
