import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ADMIN_EMAIL = 'matheusdacioflscbr@gmail.com'

export default function Navbar() {
  const { user, logout } = useAuth()
  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <nav className="navbar">
      <span className="navbar-brand">THE STRYX</span>
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
        <img src={user.photoURL} alt={user.displayName} className="avatar" />
        <span className="navbar-username">{user.displayName.split(' ')[0]}</span>
        <button className="btn-logout" onClick={logout}>Sair</button>
      </div>
    </nav>
  )
}
