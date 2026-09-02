// Pub/sub mínimo: qualquer componente chama showToast(...) sem precisar de
// contexto nem prop drilling; o <Toast /> (montado uma vez no App) escuta
let ouvinte = null

export function showToast(mensagem) {
  ouvinte?.(mensagem)
}

export function setToastListener(fn) {
  ouvinte = fn
}
