import { useState } from 'react'

// Só pra preferência que dura semanas e é cara de reescolher (ex.: a tag
// que a pessoa usa há um mês) — filtro de status/aba não entra aqui: o
// padrão é o que a pessoa quer na maioria das visitas
export function usePersistedState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored)
    } catch {
      // localStorage indisponível (modo privado) ou valor corrompido
    }
    return initialValue
  })

  const setPersisted = (value) => {
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try {
        if (next === null || next === undefined) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // idem — não trava a UI por causa do storage
      }
      return next
    })
  }

  return [state, setPersisted]
}
