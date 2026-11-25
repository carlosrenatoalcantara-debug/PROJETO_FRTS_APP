import { createContext, useContext, useState, useEffect } from 'react'
import { renovarAccessToken } from '../services/http'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to load token from localStorage on mount
    // Support both 'accessToken' (new) and 'token' (legacy) for backwards compatibility
    const storedToken = localStorage.getItem('accessToken') || localStorage.getItem('token')
    if (storedToken) {
      // Migrate legacy 'token' to 'accessToken'
      if (!localStorage.getItem('accessToken') && localStorage.getItem('token')) {
        localStorage.setItem('accessToken', storedToken)
      }
      setToken(storedToken)
      // Load user data
      verifyToken(storedToken)
    } else if (localStorage.getItem('refreshToken')) {
      // Access token perdido com refresh token válido: a sessão continua.
      renovarAccessToken().then((novo) => {
        if (!novo) { setLoading(false); return }
        setToken(novo)
        verifyToken(novo)
      })
    } else {
      setLoading(false)
    }
  }, [])

  async function verifyToken(accessToken, jaRenovou = false) {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        // A verificação pode ter renovado o token.
        setToken(localStorage.getItem('accessToken') || accessToken)
      } else if (response.status === 401 || response.status === 403) {
        // Recusado: renova UMA vez antes de desistir da sessão.
        const novo = jaRenovou ? null : await renovarAccessToken()
        if (novo) {
          setToken(novo)
          await verifyToken(novo, true)
          return
        }
        localStorage.removeItem('accessToken')
        // Token recém-renovado também recusado: a conta foi bloqueada.
        if (jaRenovou) localStorage.removeItem('refreshToken')
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error)
    } finally {
      setLoading(false)
    }
  }

  function login(accessToken, userData) {
    localStorage.setItem('accessToken', accessToken)
    setToken(accessToken)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
