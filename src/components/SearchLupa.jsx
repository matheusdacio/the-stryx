// Campo de busca por título/artista, sempre visível — não fica escondido
// atrás de um ícone que precisa ser clicado pra aparecer
export default function SearchLupa({ value, onChange, placeholder = 'Filtrar por nome ou artista...' }) {
  return (
    <div className="search-wrap">
      <span className="search-icon">🔍</span>
      <input
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onChange('')}
        placeholder={placeholder}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} title="Limpar filtro">✕</button>
      )}
    </div>
  )
}
