import { initializeApp } from 'firebase/app'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyDZfIAY7nEIzY7-tGoEDkLmp-Gu20sHpQE",
  authDomain: "the-stryx.firebaseapp.com",
  projectId: "the-stryx",
  storageBucket: "the-stryx.firebasestorage.app",
  messagingSenderId: "544479308598",
  appId: "1:544479308598:web:69ef136c14fbe8d9de6197",
  measurementId: "G-K61HP7RW68"
}

const app = initializeApp(firebaseConfig)
// Cache persistente: o setlist, os eventos e as sugestões abrem do cache sem
// rede (inclusive o Modo palco no ensaio), e um voto/presença dado sem sinal
// não se perde se a aba fechar antes de a rede voltar — antes só ficava em
// memória e sumia
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
