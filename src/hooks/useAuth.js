import { useEffect, useState } from 'react'
import { auth, loginWithGoogle, logout } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

export function useAuth(){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    return () => unsub()
  },[])
  return { user, loading, loginWithGoogle, logout }
}
