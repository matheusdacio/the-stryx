import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection, query, where, getDocs, updateDoc,
  setDoc, addDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase/config'
import { mergeAllImportedVotes } from '../utils/votes'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setLoading(false)
      if (!u) return

      // 1. Registra o login na coleção 'users' (visível ao admin na página de Membros)
      try {
        await setDoc(doc(db, 'users', u.uid), {
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          lastLogin: new Date().toISOString(),
        }, { merge: true })
      } catch (e) {
        console.warn('users setDoc:', e)
      }

      // 2. Tenta vincular ao membro da banda pelo e-mail
      try {
        const byEmail = query(collection(db, 'members'), where('email', '==', u.email))
        const byUid   = query(collection(db, 'members'), where('firebaseUid', '==', u.uid))

        const [emailSnap, uidSnap] = await Promise.all([getDocs(byEmail), getDocs(byUid)])
        const memberDoc = (!emailSnap.empty && emailSnap.docs[0])
                       || (!uidSnap.empty   && uidSnap.docs[0])
                       || null

        if (!memberDoc) {
          // Pessoa nova → cadastra automaticamente como membro da banda
          await addDoc(collection(db, 'members'), {
            name:        u.displayName || u.email,
            email:       u.email,
            firebaseUid: u.uid,
            photoURL:    u.photoURL || '',
            role:        '',
            createdAt:   serverTimestamp(),
          })
          return
        }

        const data = memberDoc.data()

        // Atualiza campos do membro com info real do Google
        const updates = {}
        if (!data.firebaseUid) updates.firebaseUid = u.uid
        if (!data.email)       updates.email       = u.email
        if (!data.photoURL)    updates.photoURL    = u.photoURL
        if (!data.displayName) updates.displayName = u.displayName
        if (Object.keys(updates).length) await updateDoc(memberDoc.ref, updates)

        // Funde os votos importados (só uma vez por membro).
        // Usa matching por nome aproximado (ignora acentos e aceita nome parcial)
        // e limpa os votos de toda a banda, não só deste membro.
        if (!data.mergedAt) {
          try {
            await mergeAllImportedVotes()
          } catch (e) {
            console.warn('mergeAllImportedVotes:', e)
          }
          await updateDoc(memberDoc.ref, { mergedAt: new Date().toISOString() })
        }
      } catch (e) {
        console.warn('member link:', e)
      }
    })
    return unsub
  }, [])

  const login  = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
