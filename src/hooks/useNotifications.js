import { useState, useEffect } from 'react'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, deleteDoc } from 'firebase/firestore'
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

export function useNotifications(user) {
  const [permissao, setPermissao] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [ativando, setAtivando] = useState(false)
  const suportado = typeof Notification !== 'undefined' && 'serviceWorker' in navigator

  // Escuta mensagens com app em foreground
  useEffect(() => {
    if (!suportado || permissao !== 'granted') return
    const messaging = getMessaging(getApp())
    const unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? 'The Stryx'
      const body = payload.notification?.body ?? ''
      new Notification(title, { body, icon: '/favicon.svg' })
    })
    return unsub
  }, [permissao, suportado])

  async function ativar() {
    if (!suportado || !user) return false
    setAtivando(true)
    try {
      const perm = await Notification.requestPermission()
      setPermissao(perm)
      if (perm !== 'granted') return false

      const sw = await navigator.serviceWorker.register('/the-stryx/firebase-messaging-sw.js')
      const messaging = getMessaging(getApp())
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: sw })

      await setDoc(doc(db, 'fcm_tokens', user.uid), {
        token,
        name: user.displayName || user.email,
        email: user.email,
        atualizadoEm: new Date().toISOString(),
      })
      return true
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
