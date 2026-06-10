import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import {
  collection, query, where, getDocs, updateDoc, writeBatch, deleteField,
} from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase/config'

const AuthContext = createContext(null)

// Quando um membro loga, funde os votos importados (import_Nome) com o UID real
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
        // Move o voto importado para o UID real
        batch.update(docSnap.ref, {
          [`opinoes.${firebaseUid}`]: {
            ...opinoes[importKey],
            userName: memberName.trim(),
          },
          [`opinoes.${importKey}`]: deleteField(),
        })
      } else {
        // Já tem voto real — só apaga o duplicado importado
        batch.update(docSnap.ref, {
          [`opinoes.${importKey}`]: deleteField(),
        })
      }
      count++
    })

    if (count > 0) await batch.commit()
  } catch (e) {
    console.warn('mergeImportedVotes error:', e)
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

      // Tenta vincular o usuário a um membro cadastrado pelo admin
      try {
        const q = query(collection(db, 'members'), where('email', '==', u.email))
        const snap = await getDocs(q)
        if (snap.empty) return

        const memberDoc = snap.docs[0]
        const memberData = memberDoc.data()

        // Salva o UID do Firebase no cadastro do membro (se ainda não foi)
        if (!memberData.firebaseUid) {
          await updateDoc(memberDoc.ref, { firebaseUid: u.uid })
        }

        // Funde votos importados com o UID real (só uma vez)
        if (!memberData.mergedAt) {
          await mergeImportedVotes(memberData.name, u.uid)
          await updateDoc(memberDoc.ref, { mergedAt: new Date().toISOString() })
        }
      } catch (e) {
        console.warn('member link error:', e)
      }
    })
    return unsub
  }, [])

  const login = () => signInWithPopup(auth, googleProvider)
  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
