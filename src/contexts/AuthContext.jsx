import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection, query, where, getDocs, updateDoc, writeBatch,
  deleteField, setDoc, doc,
} from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase/config'

const AuthContext = createContext(null)

// Funde votos importados (import_Nome) com o UID real do Firebase
async function mergeImportedVotes(memberName, firebaseUid) {
  const importKey = `import_${memberName.trim().replace(/\s+/g, '_')}`
  try {
    const snap = await getDocs(collection(db, 'sugestoes'))
    if (snap.empty) return

    const batch = writeBatch(db)
    let count = 0

    snap.forEach((docSnap) => {
      const opinoes = docSnap.data().opinoes || {}
      if (!opinoes[importKey]) return

      if (!opinoes[firebaseUid]) {
        batch.update(docSnap.ref, {
          [`opinoes.${firebaseUid}`]: { ...opinoes[importKey], userName: memberName.trim() },
          [`opinoes.${importKey}`]: deleteField(),
        })
      } else {
        batch.update(docSnap.ref, { [`opinoes.${importKey}`]: deleteField() })
      }
      count++
    })

    if (count > 0) await batch.commit()
  } catch (e) {
    console.warn('mergeImportedVotes:', e)
  }
}

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

        if (!memberDoc) return

        const data = memberDoc.data()

        // Atualiza campos do membro com info real do Google
        const updates = {}
        if (!data.firebaseUid) updates.firebaseUid = u.uid
        if (!data.email)       updates.email       = u.email
        if (!data.photoURL)    updates.photoURL    = u.photoURL
        if (!data.displayName) updates.displayName = u.displayName
        if (Object.keys(updates).length) await updateDoc(memberDoc.ref, updates)

        // Funde os votos importados (só uma vez)
        if (!data.mergedAt) {
          await mergeImportedVotes(data.name, u.uid)
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
