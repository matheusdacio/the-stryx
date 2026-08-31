// Normaliza pra busca sem acento e sem diferença de caixa
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// true se algum dos campos contém o termo (termo vazio deixa tudo passar)
export function matchesSearch(term, ...fields) {
  const t = norm(term).trim()
  if (!t) return true
  return fields.some((f) => norm(f).includes(t))
}
