import { useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useNotifications } from './hooks/useNotifications'
import Login from './components/Login'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import NotifBanner from './components/NotifBanner'
import WelcomeBanner from './components/WelcomeBanner'
import Toast from './components/Toast'
import { isIOS } from './utils/device'
import { showToast } from './utils/toast'
import SetlistPage from './components/setlist/SetlistPage'
import CifrasPage from './components/cifras/CifrasPage'
import EnsaiosPage from './components/ensaios/EnsaiosPage'
import RascunhosPage from './components/rascunhos/RascunhosPage'
import SugestoesPage from './components/sugestoes/SugestoesPage'
import ImportPage from './components/import/ImportPage'
import MembrosPage from './components/membros/MembrosPage'

const NOTIF_BANNER_KEY = 'stryx-notif-banner-dispensado'

export default function App() {
  const { user } = useAuth()
  const notif = useNotifications(user)
  const [bannerDispensado, setBannerDispensado] = useState(
    () => localStorage.getItem(NOTIF_BANNER_KEY) === '1'
  )

  const dispensarBanner = () => {
    localStorage.setItem(NOTIF_BANNER_KEY, '1')
    setBannerDispensado(true)
  }

  const handleAtivarNotif = async () => {
    const r = await notif.ativar()
    if (r === 'denied') alert('O navegador bloqueou as notificações. Desbloqueia nas configurações do site e tenta de novo.')
    else if (r === 'error') alert('Não consegui ativar agora. Tenta de novo com internet.')
    else if (r === 'ok') { showToast('Pronto! Vai chegar aviso de sugestão nova e lembrete de ensaio.'); dispensarBanner() }
  }

  const handleDesativarNotif = async () => {
    if (!window.confirm('Desativar notificações?')) return
    await notif.desativar()
    dispensarBanner()
  }

  if (!user) return <Login />

  const mostrarBannerNotif = !bannerDispensado && (
    (notif.suportado && notif.permissao === 'default') || (!notif.suportado && isIOS)
  )

  return (
    <HashRouter>
      <Navbar notif={notif} onAtivarNotif={handleAtivarNotif} onDesativarNotif={handleDesativarNotif} />
      {mostrarBannerNotif && (
        <NotifBanner suportado={notif.suportado} onAtivar={handleAtivarNotif} onDispensar={dispensarBanner} />
      )}
      <WelcomeBanner user={user} suportadoNotif={notif.suportado} onAtivarNotif={handleAtivarNotif} />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<SetlistPage />} />
          <Route path="/cifras" element={<CifrasPage />} />
          <Route path="/ensaios" element={<EnsaiosPage />} />
          <Route path="/rascunhos" element={<RascunhosPage />} />
          <Route path="/sugestoes" element={<SugestoesPage />} />
          <Route path="/membros" element={<MembrosPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toast />
      <BottomNav />
    </HashRouter>
  )
}
