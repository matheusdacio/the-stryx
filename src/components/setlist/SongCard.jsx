import { useState } from 'react'
import { doc, updateDoc, deleteDoc, deleteField, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import MetronomeButton from './MetronomeButton'
import { getYouTubeId } from '../../utils/youtube'
import VideoInline from '../VideoInline'
import { DOMINIOS, calcDominio, dominioPorPeso } from '../../utils/dominio'
import { DIFFICULTIES } from '../../utils/dificuldade'
import { OPINIONS, fundirVotos } from '../../utils/score'
import { todosVotaram } from '../../utils/rejeicao'


const firstName = (n) => (n || '').trim().split(' ')[0]

export default function SongCard({ song, nota, opinoes = {}, bandMembers = [], position, tocandoVideo = false, onTocarVideo }) {
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

  // Opinião da banda sobre a música. A votação vive aqui também porque as
  // 32 músicas importadas nunca passaram por sugestão — sem isso elas nunca
  // teriam nota. O voto dado aqui vence o que veio da sugestão de origem.
  const minhaOpiniao = opinoes[user.uid]?.opinion
  const bandaJaOpinou = todosVotaram({ opinoes }, bandMembers)
  const votarOpiniao = (opinion) => {
    if (minhaOpiniao === opinion) {
      updateDoc(ref, { [`opinoes.${user.uid}`]: deleteField() })
    } else {
      updateDoc(ref, {
        [`opinoes.${user.uid}`]: {
          userName: user.displayName || user.email,
          opinion,
          comment: '',
          at: new Date().toISOString(),
        },
      })
    }
  }

  // Fecha a caixa na hora: esperar o await deixava a caixa aberta sem
  // resposta quando não tinha sinal, e o botão Salvar continuava clicável
  const erroSalvar = () => alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
  const saveNotes = () => {
    updateDoc(ref, { notes }).catch(erroSalvar)
    setEditing(false)
  }
  const saveMeta = () => {
    updateDoc(ref, {
      tom: tom.trim(),
      bpm: bpm ? Number(bpm) : null,
      videoUrl: videoUrl.trim(),
      tags,
    }).catch(erroSalvar)
    setEditingMeta(false)
  }

  // Card fica montado a visita inteira: se outro membro mudou tom/BPM/tags
  // enquanto isso, o formulário abria com o valor de quando o card montou e
  // "Salvar" revertia a edição do colega sem ninguém perceber. Re-semeia do
  // song (o snapshot mais recente) toda vez que o editor abre.
  const openMeta = () => {
    setTom(song.tom || '')
    setBpm(song.bpm || '')
    setVideoUrl(song.videoUrl || '')
    setTags(song.tags || [])
    setNewTag('')
    setEditingMeta(true)
  }
  const openNotes = () => {
    setNotes(song.notes || '')
    setEditing(true)
  }
  const addTag = () => {
    const t = newTag.trim()
    if (!t || tags.some((x) => x.toLowerCase() === t.toLowerCase())) { setNewTag(''); return }
    setTags([...tags, t])
    setNewTag('')
  }
  const removeTag = (t) => setTags(tags.filter((x) => x !== t))
  const remove = () => {
    if (confirm(`Apagar "${song.title}" de vez? Votos de domínio, dificuldade e opinião, tom, BPM, tags e observações vão junto. Se é só tirar do setlist, use "↩ Voltar pras sugestões".`)) deleteDoc(ref)
  }

  // Tira a música do setlist e devolve pra aba de Sugestões.
  // Se ela veio de uma sugestão aprovada, reabre a original (preserva as opiniões);
  // senão cria uma sugestão nova em aberto.
  const backToSuggestions = async () => {
    if (!confirm(`Tirar "${song.title}" do setlist e mandar de volta pras sugestões?`)) return

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
          dificuldade: { ...(snap.data().dificuldade || {}), ...dificuldade },
          // Preserva as opiniões que rolaram no setlist — sem isso a volta
          // apagava a única votação que as músicas importadas já tinham
          opinoes: fundirVotos(snap.data().opinoes, song.opinoes),
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
        opinoes: song.opinoes || {},
        dificuldade,
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
        {position != null && (
          <div className="song-order-wrap">
            <span className="song-position">#{position}</span>
          </div>
        )}
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
      </div>

      {/* Vídeo — uma instância só, fora do expandir/recolher, senão trocar de
          estado desmonta o player e a música para no meio */}
      {videoId && (
        <div className="song-video-slot">
          <VideoInline
            url={song.videoUrl}
            title={song.title}
            compacto
            aberto={tocandoVideo}
            onToggle={(v) => onTocarVideo?.(v ? song.id : null)}
          />
        </div>
      )}

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
          {(song.tags || []).map((t) => <span key={t} className="mini-chip">🏷 {t}</span>)}
          {song.notes && <span className="mini-chip">📝</span>}
        </div>
      )}

      {/* Domínio — sempre visível, mesmo com o card fechado: é o voto
          que alimenta a escolha do que ensaiar */}
      <div className="difficulty-section">
        <p className="section-label">✅ Você se sente pronto nessa?</p>
        <div className="difficulty-btns">
          {DOMINIOS.map((d) => (
            <button
              key={d.value}
              className={`btn-diff ${myDominio === d.value ? 'active' : ''}`}
              style={myDominio === d.value ? { background: d.bg, borderColor: d.color, color: d.color } : {}}
              aria-pressed={myDominio === d.value}
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

      {/* Opinião da banda — fecha quando todos já opinaram */}
      <div className="difficulty-section-flat">
        <p className="section-label">
          {bandaJaOpinou ? '⭐ A banda toda já opinou' : '⭐ Vale tocar?'}
        </p>
        {!bandaJaOpinou && (
          <div className="difficulty-btns">
            {OPINIONS.map((o) => (
              <button
                key={o.value}
                className={`btn-diff ${minhaOpiniao === o.value ? 'active' : ''}`}
                style={minhaOpiniao === o.value ? { borderColor: o.color, color: o.color } : {}}
                aria-pressed={minhaOpiniao === o.value}
                onClick={() => votarOpiniao(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {Object.keys(opinoes).length > 0 && (
          <div className="difficulty-summary">
            {OPINIONS.map((o) => {
              const voters = Object.values(opinoes).filter((v) => v.opinion === o.value)
              if (!voters.length) return null
              return (
                <span key={o.value} className="diff-pill" style={{ color: o.color, background: o.bg }}>
                  {o.label.replace(/^[^\w]+\s*/, '')}: {voters.map((v) => firstName(v.userName)).join(', ')}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Dificuldade pra tocar — o quanto a música é difícil, não o quanto a
          banda já a domina (isso é o bloco de cima) */}
      {(
        <div className="difficulty-section-flat">
          <p className="section-label">🎯 Dificuldade pra tocar</p>
          <div className="difficulty-btns">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                className={`btn-diff ${myDiff === d.value ? 'active' : ''}`}
                style={myDiff === d.value ? { borderColor: d.color, color: d.color } : {}}
                aria-pressed={myDiff === d.value}
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
                    {d.label}: {voters.map((v) => firstName(v.userName)).join(', ')}
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
          <button className="btn-meta-add" onClick={openMeta}>♩ + BPM</button>
        )}
        {!videoId && (
          <button className="btn-meta-add" onClick={openMeta}>🎬 + vídeo</button>
        )}
        {(song.tags || []).map((t) => (
          <span key={t} className="song-tag">🏷 {t}</span>
        ))}
        <button className="btn-meta-edit" onClick={() => (editingMeta ? setEditingMeta(false) : openMeta())}>✏️ Editar</button>
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
        <p className="song-notes" onClick={openNotes}>
          {song.notes || <span className="placeholder">Clique para adicionar observações...</span>}
        </p>
      )}

      <div className="song-card-footer">
        <button className="btn-back-sug" onClick={backToSuggestions} title="Tirar do setlist e devolver pras sugestões">
          ↩ Voltar pras sugestões
        </button>
        <button className="btn-ghost-danger" onClick={remove} title="Apagar a música de vez">
          Remover
        </button>
      </div>
      </>}
    </div>
  )
}
