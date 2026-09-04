import { useState } from 'react'
import { doc, updateDoc, deleteDoc, deleteField, addDoc, collection, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import MetronomeButton from './MetronomeButton'
import { getYouTubeId } from '../../utils/youtube'
import VideoInline from '../VideoInline'
import { DOMINIOS, calcDominio, dominioPorPeso, uidsAtivosDe } from '../../utils/dominio'
import { DIFFICULTIES, calcDifficulty, difficultyByWeight } from '../../utils/dificuldade'
import { OPINIONS, fundirVotos, acharCifra } from '../../utils/score'
import { todosVotaram } from '../../utils/rejeicao'
import { showToast } from '../../utils/toast'
import CifraModal from '../cifras/CifraModal'
import NotaChip from '../NotaChip'

const CIFRA_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

const firstName = (n) => (n || '').trim().split(' ')[0]

// Explica por que uma música sem votação nenhuma aparece lá no topo de
// "Recentes" — sem o chip parece só ordem aleatória
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000
const ehNovo = (createdAt) => {
  if (!createdAt) return false
  const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  return Date.now() - d.getTime() < SETE_DIAS
}

export default function SongCard({ song, nota, opinoes = {}, bandMembers = [], cifras = [], position, tocandoVideo = false, onTocarVideo, onVotou }) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [verCifra, setVerCifra] = useState(false)
  const cifra = acharCifra(cifras, song.title, song.artist)
  const [editing, setEditing] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)
  const [notes, setNotes] = useState(song.notes || '')
  const [tom, setTom] = useState(song.tom || '')
  const [bpm, setBpm] = useState(song.bpm || '')
  const [videoUrl, setVideoUrl] = useState(song.videoUrl || '')
  const [tags, setTags] = useState(song.tags || [])
  const [newTag, setNewTag] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = doc(db, 'songs', song.id)

  // Dificuldade — voto de cada membro (mapa keyed por uid)
  const dificuldade = song.dificuldade || {}
  // Chip do card fechado — mesmo nível mais alto votado que ordena "🎯 Dificuldade"
  const diff = difficultyByWeight(calcDifficulty(dificuldade).max)
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
    // Fixa o card na lista antes de votar: com filtro por nível ativo, o
    // card some da tela na hora (voto grava local, sem esperar o servidor)
    // e o próximo sobe pro lugar do dedo — um segundo toque vota errado
    onVotou?.(song.id)
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
  const piorDominio = dominioPorPeso(calcDominio(dominio, uidsAtivosDe(bandMembers)).pior)
  // "Crua" semeada pra todo mundo ao aprovar (ninguém ensaiou ainda) não é
  // voto de verdade — enquanto só houver semeados, nem selo nem pill devem
  // afirmar um voto que não aconteceu
  const dominioVotos = Object.values(dominio)
  const soSemeados = dominioVotos.length > 0 && dominioVotos.every((v) => v.seeded)

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
    if (busy) return
    setBusy(true)

    try {
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
      showToast('Voltou pras sugestões')
    } catch {
      alert('Não deu pra salvar agora. Confere a internet e tenta de novo.')
      setBusy(false)
    }
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
          aria-label={expanded ? 'Recolher' : 'Ver detalhes'}
          aria-expanded={expanded}
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
              {soSemeados ? `${piorDominio.label} (ninguém votou ainda)` : piorDominio.label}
            </span>
          ) : (
            <span className="status-dot status-sem-voto">Sem voto</span>
          )}
          {nota && <NotaChip nota={nota} compacto />}
          {diff && <span className="diff-chip" style={{ color: diff.color, borderColor: diff.color }}>🎯 {diff.label}</span>}
          {song.tom && <span className="mini-chip">♪ {song.tom}</span>}
          {(song.tags || []).map((t) => <span key={t} className="mini-chip">🏷 {t}</span>)}
          {song.notes && <span className="mini-chip">📝</span>}
          {ehNovo(song.createdAt) && <span className="mini-chip" title="Adicionada nos últimos 7 dias">🆕</span>}
        </div>
      )}

      {/* Domínio — sempre visível, mesmo com o card fechado: é o voto
          que alimenta a escolha do que ensaiar */}
      <div className="difficulty-section">
        <p className="prompt-label">✅ Você se sente pronto nessa?</p>
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
      </div>

      {expanded && <>

      {/* Quem votou o quê em domínio — só no card aberto; fechado fica só
          o selo (compacta o card, que é a tela mais rolada do app) */}
      {dominioVotos.length > 0 && (
        <div className="difficulty-summary" style={{ marginTop: -4, marginBottom: 10 }}>
          {DOMINIOS.map((d) => {
            const voters = dominioVotos.filter((v) => v.level === d.value && !v.seeded)
            if (!voters.length) return null
            return (
              <span key={d.value} className="diff-pill" style={{ color: d.color, background: d.bg }}>
                {d.label}: {voters.map((v) => firstName(v.userName)).join(', ')}
              </span>
            )
          })}
          {dominioVotos.some((v) => v.seeded) && (
            <span className="diff-pill diff-pill-seeded">
              Ainda não disseram: {dominioVotos.filter((v) => v.seeded).map((v) => firstName(v.userName)).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Opinião da banda — fecha quando todos já opinaram */}
      <div className="difficulty-section-flat">
        <p className="prompt-label">
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
                {o.labelSetlist}
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
                  {o.short}: {voters.map((v) => firstName(v.userName)).join(', ')}
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
          <p className="prompt-label">🎯 Dificuldade pra tocar</p>
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
        {cifra ? (
          <button className="btn-meta-add" onClick={() => setVerCifra(true)}>📄 Cifra</button>
        ) : (
          <button className="btn-meta-add" onClick={() => setVerCifra(true)}>📄 + cifra</button>
        )}
        {(song.tags || []).map((t) => (
          <span key={t} className="song-tag">🏷 {t}</span>
        ))}
        <button className="btn-meta-edit" onClick={() => (editingMeta ? setEditingMeta(false) : openMeta())}>✏️ Editar</button>
      </div>

      {verCifra && (
        <CifraModal
          cifra={cifra}
          inicial={!cifra ? { title: song.title, artist: song.artist } : undefined}
          onClose={() => setVerCifra(false)}
          KEYS={CIFRA_KEYS}
        />
      )}

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
                aria-label="Nova tag"
              />
              <button type="button" className="btn-secondary" onClick={addTag}>+</button>
            </div>
          </label>
          {tags.length > 0 && (
            <div className="tag-chips">
              {tags.map((t) => (
                <span key={t} className="song-tag editable">
                  {t}
                  <button type="button" className="tag-remove" aria-label={`Tirar tag ${t}`} onClick={() => removeTag(t)}>✕</button>
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
          {song.notes || <span className="placeholder">Toque pra anotar: quem canta, afinação, deixa do solo… (aparece no modo palco)</span>}
        </p>
      )}

      <div className="song-card-footer">
        <button className="btn-back-sug" onClick={backToSuggestions} disabled={busy} title="Tirar do setlist e devolver pras sugestões">
          {busy ? 'Devolvendo...' : '↩ Voltar pras sugestões'}
        </button>
        <button className="btn-ghost-danger" onClick={remove} disabled={busy} title="Apagar a música de vez">
          Remover
        </button>
      </div>
      </>}
    </div>
  )
}
