import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Navbar from './components/Navbar'
import SetlistPage from './components/setlist/SetlistPage'

export default function App() {
  const { user } = useAuth()

  if (!user) return <Login />

  return (
    <>
      <Navbar />
      <SetlistPage />
    </>
  )
}
