import { HashRouter, Routes, Route } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import SetlistPage from './components/setlist/SetlistPage'
import CifrasPage from './components/cifras/CifrasPage'
import EnsaiosPage from './components/ensaios/EnsaiosPage'
import RascunhosPage from './components/rascunhos/RascunhosPage'
import SugestoesPage from './components/sugestoes/SugestoesPage'
import ImportPage from './components/import/ImportPage'
import MembrosPage from './components/membros/MembrosPage'

export default function App() {
  const { user } = useAuth()
  if (!user) return <Login />

  return (
    <HashRouter>
      <Navbar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<SetlistPage />} />
          <Route path="/cifras" element={<CifrasPage />} />
          <Route path="/ensaios" element={<EnsaiosPage />} />
          <Route path="/rascunhos" element={<RascunhosPage />} />
          <Route path="/sugestoes" element={<SugestoesPage />} />
          <Route path="/membros" element={<MembrosPage />} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
      </div>
      <BottomNav />
    </HashRouter>
  )
}
