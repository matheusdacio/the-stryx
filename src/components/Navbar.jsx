import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { APP_VERSION } from '../version'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

export default function Navbar() {
  const { user, logout } = useAuth()
  const isAdmin = user.email === ADMIN_EMAIL
  const { permissao, ativando, suportado, ativar, desativar } = useNotifications(user)

  const handleNotifClick = async () => {
    if (permissao === 'granted') {
      if (window.confirm('Desativar notificações?')) await desativar()
    } else {
      const ok = await ativar()
      if (!ok && permissao === 'denied') alert('Notificações bloqueadas. Habilite nas configurações do navegador.')
    }
  }

  return (
    <nav className="navbar">
      <span className="navbar-brand">
        THE STRYX
        <span className="navbar-version">v{APP_VERSION}</span>
      </span>
      <div className="navbar-user">
        {isAdmin && (
          <>
            <Link to="/membros" className="btn-import" title="Membros da banda">
              👥 Banda
            </Link>
            <Link to="/import" className="btn-import" title="Importar do Glissandoo">
              ⬆ Importar
            </Link>
          </>
        )}
        {suportado && (
          <button
            className="btn-notif"
            title={permissao === 'granted' ? 'Notificações ativas — clique para desativar' : 'Ativar notificações'}
            onClick={handleNotifClick}
            disabled={ativando}
          >
            {ativando ? '⏳' : permissao === 'granted' ? '🔔' : '🔕'}
          </button>
        )}
        <img src={user.photoURL} alt={user.displayName} className="avatar" />
        <span className="navbar-username">{user.displayName.split(' ')[0]}</span>
        <button className="btn-logout" onClick={logout}>Sair</button>
      </div>
    </nav>
  )
}
