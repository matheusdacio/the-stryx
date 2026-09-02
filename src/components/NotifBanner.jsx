import { isIOS } from '../utils/device'

// Convite pra ativar push: aparece uma vez (dispensável) enquanto a pessoa
// nunca respondeu à permissão, ou — no iPhone, onde Notification nem existe
// fora da tela inicial — orienta a instalar o app pra receber lembrete
export default function NotifBanner({ suportado, onAtivar, onDispensar }) {
  return (
    <div className="app-banner">
      {suportado ? (
        <>
          <span>Quer aviso quando alguém sugerir música e lembrete de ensaio?</span>
          <div className="app-banner-actions">
            <button className="btn-primary" onClick={onAtivar}>Ativar avisos</button>
            <button className="btn-secondary" onClick={onDispensar}>Agora não</button>
          </div>
        </>
      ) : isIOS ? (
        <>
          <span>No iPhone, adiciona o app na tela inicial (Compartilhar → Adicionar à Tela de Início) pra receber lembrete de ensaio.</span>
          <div className="app-banner-actions">
            <button className="btn-secondary" onClick={onDispensar}>Entendi</button>
          </div>
        </>
      ) : null}
    </div>
  )
}
