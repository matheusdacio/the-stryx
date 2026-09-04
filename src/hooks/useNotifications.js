import { useState, useEffect } from 'react'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { initializeApp, getApps } from 'firebase/app'

const firebaseConfig = {
  apiKey: "AIzaSyDZfIAY7nEIzY7-tGoEDkLmp-Gu20sHpQE",
  authDomain: "the-stryx.firebaseapp.com",
  projectId: "the-stryx",
  storageBucket: "the-stryx.firebasestorage.app",
  messagingSenderId: "544479308598",
  appId: "1:544479308598:web:69ef136c14fbe8d9de6197",
}

// VAPID_KEY será substituída após gerar no Firebase Console
const VAPID_KEY = 'BK8XpvTYI71mZhki4ue8fIMYRhxaCwoIBTz3Od5bvkdtZEb-n0HkovYaxuQmOXa9Q6Bnkmb3mYQjqAMMReJ5UY'

function getApp() {
  return getApps()[0] ?? initializeApp(firebaseConfig)
}

async function salvarToken(user) {
  // O SW gerado pelo vite-plugin-pwa (cache do app offline) importa o
  // firebase-messaging-sw.js — um único SW cuida de cache e de push
  const sw = await navigator.serviceWorker.register('/the-stryx/sw.js')
  const messaging = getMessaging(getApp())
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })
  await setDoc(doc(db, 'fcm_tokens', user.uid), {
    token,
    name: user.displayName || user.email,
    email: user.email,
    atualizadoEm: new Date().toISOString(),
  })
}

export function useNotifications(user) {
  // Começa em 'default' (🔕) mesmo que o navegador já tenha concedido a
  // permissão: só vira 'granted' depois de confirmar que existe um token
  // gravado, senão o sino mente (permissão ok mas setDoc nunca rodou/falhou).
  const [permissao, setPermissao] = useState('default')
  const [ativando, setAtivando] = useState(false)
  const suportado = typeof Notification !== 'undefined' && 'serviceWorker' in navigator

  useEffect(() => {
    if (!suportado || !user || Notification.permission !== 'granted') return
    getDoc(doc(db, 'fcm_tokens', user.uid))
      .then((snap) => {
        if (!snap.exists()) return
        setPermissao('granted')
        salvarToken(user).catch(() => {})
      })
      .catch(() => {})
  }, [suportado, user])

  // Escuta mensagens com app em foreground. `new Notification(...)` é
  // construtor de página e o Chrome Android recusa ("Illegal constructor") —
  // só dá pra notificar por registration.showNotification, que é o mesmo
  // caminho que o service worker usa em segundo plano. `data.FCM_MSG` é o
  // formato interno que o próprio SDK usa pra reconhecer a notificação como
  // dele (getMessaging()/onNotificationClick do SW) — embrulhar assim faz o
  // toque, mesmo com o app já aberto, cair no mesmo tratamento de clique
  // (foco + link) que o SW já dá às notificações em segundo plano
  useEffect(() => {
    if (!suportado || permissao !== 'granted') return
    const messaging = getMessaging(getApp())
    const unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? 'The Stryx'
      const body = payload.notification?.body ?? ''
      const icone = import.meta.env.BASE_URL + 'icon-192.png'
      navigator.serviceWorker.ready.then((reg) =>
        reg.showNotification(title, {
          body,
          icon: icone,
          badge: import.meta.env.BASE_URL + 'badge-96.png',
          data: { FCM_MSG: payload },
        })
      )
    })
    return unsub
  }, [permissao, suportado])

  // Depois do clique (foreground ou segundo plano), o SW foca a aba já
  // aberta mas não navega pra URL do link — só manda essa mensagem de
  // volta. É aqui que a gente troca o hash pra cair na tela certa
  useEffect(() => {
    if (!suportado) return
    const onMessageFromSW = (event) => {
      if (event.data?.messageType !== 'notification-clicked') return
      const link = event.data?.fcmOptions?.link
      if (!link) return
      const hash = new URL(link).hash
      if (hash) window.location.hash = hash.slice(1)
    }
    navigator.serviceWorker.addEventListener('message', onMessageFromSW)
    return () => navigator.serviceWorker.removeEventListener('message', onMessageFromSW)
  }, [suportado])

  async function ativar() {
    if (!suportado || !user) return 'error'
    setAtivando(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'error'

      await salvarToken(user)
      setPermissao('granted')
      return 'ok'
    } catch (e) {
      console.error('ativar notificações:', e)
      return 'error'
    } finally {
      setAtivando(false)
    }
  }

  async function desativar() {
    if (!user) return
    await deleteDoc(doc(db, 'fcm_tokens', user.uid))
    setPermissao('default')
  }

  return { permissao, ativando, suportado, ativar, desativar }
}
