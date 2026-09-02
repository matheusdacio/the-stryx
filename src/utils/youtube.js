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

  apiPromise = new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      anterior?.()
      resolve(window.YT)
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  })
  return apiPromise
}
