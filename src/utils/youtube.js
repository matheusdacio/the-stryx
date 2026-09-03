// Id do vídeo a partir de qualquer formato de link do YouTube
export function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|v\/|watch\?v=|&v=)([^#&?]{11})/)
  return match ? match[1] : null
}

// Carrega a IFrame Player API uma única vez por sessão e devolve o window.YT
// pronto. Sem isso não dá pra tocar as músicas dentro do app: o embed simples
// não avisa quando o vídeo termina, e é esse aviso que encadeia o setlist.
let apiPromise = null
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    // Sem internet o script nunca chega e onYouTubeIframeAPIReady nunca
    // dispara — sem timeout/onerror a promise fica pendurada pra sempre, e
    // apiPromise fica com o valor morto pra sessão inteira (por isso zera
    // no catch, abaixo: fechar e abrir o player de novo tenta de novo)
    const timeout = setTimeout(() => reject(new Error('timeout')), 8000)
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout)
      anterior?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    tag.onerror = () => { clearTimeout(timeout); reject(new Error('script')) }
    document.head.appendChild(tag)
  }).catch((e) => {
    apiPromise = null
    throw e
  })
  return apiPromise
}
