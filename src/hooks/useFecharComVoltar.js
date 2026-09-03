import { useEffect, useRef } from 'react'

// Fecha o modal no botão voltar do Android e no Esc, em vez de trocar de
// aba (cada toque no rodapé empilha uma entrada no HashRouter — sem isso,
// voltar com um modal aberto troca de página e o modal some com tudo o
// que tinha sido digitado) ou sair do app.
export function useFecharComVoltar(onClose) {
  const onCloseRef = useRef(onClose)
  // Atualiza em efeito, não durante o render — mutar ref no corpo do
  // componente quebra a pureza que o React (e o compiler) espera
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const nossaEntrada = useRef(false)
  const geracaoRef = useRef(0)

  useEffect(() => {
    geracaoRef.current++
    const minhaGeracao = geracaoRef.current

    window.history.pushState({ ...window.history.state, modalAberto: true }, '')
    nossaEntrada.current = true

    const onPopState = () => {
      nossaEntrada.current = false
      onCloseRef.current()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current()
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('keydown', onKeyDown)
      // Fechou por código (Cancelar/Salvar/Fechar), não pelo voltar — tira
      // a entrada que empilhamos, senão um próximo "voltar" cairia num
      // histórico fantasma em vez de sair da tela de verdade
      if (nossaEntrada.current) {
        nossaEntrada.current = false
        // No StrictMode do dev, o efeito roda montar→limpar→montar de
        // novo tudo no mesmo instante — o back() daqui só dispara o
        // popstate depois (é assíncrono), e esse popstate atrasado caía
        // no listener da 2ª montagem, fechando o modal na hora que abria.
        // Adia e cancela se alguém já remontou nesse meio tempo — o valor
        // "ao vivo" de geracaoRef é o ponto, não um snapshot antigo
        setTimeout(() => {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          if (geracaoRef.current === minhaGeracao) window.history.back()
        }, 0)
      }
    }
  }, [])
}
