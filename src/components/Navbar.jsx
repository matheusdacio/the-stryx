import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <span className="navbar-brand">THE STRYX</span>
      <div className="navbar-user">
        <img src={user.photoURL} alt={user.displayName} className="avatar" />
        <span className="navbar-username">{user.displayName.split(' ')[0]}</span>
        <button className="btn-logout" onClick={logout}>Sair</button>
      </div>
    </nav>
  )
}
