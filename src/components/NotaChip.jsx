import { formatarNota } from '../utils/score'

// Mesma "roupa" da nota ⭐ em toda aba — antes o Setlist mostrava um chip
// cinza compacto e Sugestões um dourado com "· N votos" (dois componentes,
// duas regras de CSS pra mostrar a mesma coisa)
export default function NotaChip({ nota, deQuantos, compacto = false }) {
  const detalhe = deQuantos && nota.total <= deQuantos
    ? `${nota.total} de ${deQuantos} opinaram`
    : `${nota.total} ${nota.total === 1 ? 'voto' : 'votos'}`
  return (
    <span className="nota-chip" title={`Média ${formatarNota(nota.media)} · ${nota.total} voto(s)`}>
      ⭐ {formatarNota(nota.media)}
      {!compacto && <span className="nota-chip-detalhe"> · {detalhe}</span>}
    </span>
  )
}
