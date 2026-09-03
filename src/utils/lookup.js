// Busca dados da música pra adiantar o cadastro.
//
// O catálogo do iTunes é aberto e libera CORS, então a sugestão de artista
// funciona sem configurar nada. O link do YouTube e o tom dependem de chaves
// de terceiros: enquanto não existirem, as funções devolvem null e a interface
// simplesmente não oferece o recurso — nada quebra.

const ITUNES = 'https://itunes.apple.com/search'

/** Candidatos de título/artista a partir do que a pessoa digitou */
export async function buscarMusicas(termo) {
  const q = (termo || '').trim()
  if (q.length < 3) return []

  const url = `${ITUNES}?term=${encodeURIComponent(q)}&entity=song&limit=8&country=BR`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Busca indisponível')
  const { results = [] } = await resp.json()

  // Mesma música aparece em vários álbuns; um por título+artista basta
  const vistos = new Set()
  return results.reduce((acc, r) => {
    const chave = `${r.trackName}|${r.artistName}`.toLowerCase()
    if (!r.trackName || vistos.has(chave)) return acc
    vistos.add(chave)
    acc.push({
      title: r.trackName,
      artist: r.artistName || '',
      album: r.collectionName || '',
      ano: r.releaseDate ? r.releaseDate.slice(0, 4) : '',
    })
    return acc
  }, []).slice(0, 5)
}

// ── YouTube (precisa de chave da YouTube Data API v3) ─────────────────
const YT_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''
export const buscaVideoAtiva = !!YT_KEY

/** Link do vídeo mais provável pra essa música, ou null */
export async function buscarVideo(titulo, artista) {
  if (!YT_KEY || !titulo) return null
  const q = encodeURIComponent(`${titulo} ${artista || ''}`.trim())
  const url = `https://www.googleapis.com/youtube/v3/search`
    + `?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=${q}&key=${YT_KEY}`

  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Busca de vídeo indisponível')
  const { items = [] } = await resp.json()
  const id = items[0]?.id?.videoId
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

// ── Tom e BPM (precisa de chave do GetSongBPM) ────────────────────────
// Atenção: devolve o tom da gravação original, não da versão que a banda
// toca — serve como sugestão pra confirmar, nunca como verdade.
const TOM_KEY = import.meta.env.VITE_GETSONGBPM_API_KEY || ''
export const buscaTomAtiva = !!TOM_KEY

/** { tom, bpm } da gravação original, ou null */
export async function buscarTomEBpm(titulo, artista) {
  if (!TOM_KEY || !titulo) return null
  const lookup = artista ? `song:${titulo} artist:${artista}` : `song:${titulo}`
  const url = `https://api.getsong.co/search/`
    + `?api_key=${TOM_KEY}&type=both&lookup=${encodeURIComponent(lookup)}`

  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Busca de tom indisponível')
  const dados = await resp.json()
  const hit = Array.isArray(dados.search) ? dados.search[0] : null
  if (!hit) return null
  return {
    tom: hit.key_of || '',
    bpm: hit.tempo ? Number(hit.tempo) : null,
  }
}
