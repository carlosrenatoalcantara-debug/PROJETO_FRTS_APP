import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to load token from localStorage on mount
    const storedToken = localStorage.getItem('accessToken')
    if (storedToken) {
      setToken(storedToken)
      // Load user data
      verifyToken(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  async function verifyToken(accessToken) {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('accessToken')
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
