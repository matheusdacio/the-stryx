import { useEffect, useRef, useState } from 'react'

// Lupa discreta que expande num campo de busca; ✕ ou Esc limpa e recolhe
export default function SearchLupa({ value, onChange, placeholder = 'Buscar música...' }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = () => {
    onChange('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="btn-lupa" onClick={() => setOpen(true)} title="Buscar música">🔍</button>
    )
  }

  return (
    <div className="search-wrap">
      <span className="search-icon">🔍</span>
      <input
        ref={inputRef}
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        placeholder={placeholder}
      />
      <button className="search-clear" onClick={close} title="Fechar busca">✕</button>
    </div>
  )
}
