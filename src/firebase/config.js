import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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
export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
