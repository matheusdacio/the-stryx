import { useAuth } from '../contexts/AuthContext'
import { APP_VERSION } from '../version'

export default function Navbar({ notif, onAtivarNotif, onDesativarNotif }) {
  const { user, logout } = useAuth()
  const { permissao, ativando, suportado } = notif

  const handleNotifClick = () => (permissao === 'granted' ? onDesativarNotif() : onAtivarNotif())

  return (
    <nav className="navbar">
      <span className="navbar-brand">
        THE STRYX
        <span className="navbar-version">v{APP_VERSION}</span>
      </span>
      <div className="navbar-user">
        {suportado && (
          <button
            className="btn-notif"
            title={permissao === 'granted' ? 'Notificações ativas — toque pra desativar' : 'Ativar notificações'}
            onClick={handleNotifClick}
            disabled={ativando}
          >
            {ativando ? '⏳' : permissao === 'granted' ? '🔔' : '🔕'}
          </button>
        )}
        {user.photoURL ? (
          <img src={user.photoURL} alt={user.displayName} className="avatar" />
        ) : (
          <div className="avatar avatar-placeholder">{(user.displayName || '?')[0].toUpperCase()}</div>
        )}
        <span className="navbar-username">{user.displayName.split(' ')[0]}</span>
        <button className="btn-logout" onClick={() => confirm('Sair da conta?') && logout()}>Sair</button>
      </div>
    </nav>
  )
}
