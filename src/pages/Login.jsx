import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '../store/index.js'
import { API_URL } from '../utils/config.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useUserStore()
  const next = location.state?.next || '/'
  
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const endpoint = isLogin ? '/auth/login' : '/auth/signup'
    const body = isLogin 
      ? { email, password }
      : { email, username, password }
    
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(data.user)
      navigate(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <button onClick={() => navigate(-1)} style={styles.back}>← Back</button>
        <h2 style={styles.title}>{isLogin ? 'Welcome Back' : 'Join The Club'}</h2>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          
          {error && <p style={styles.error}>{error}</p>}
          
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>
        
        <button onClick={() => setIsLogin(!isLogin)} style={styles.switchBtn}>
          {isLogin ? 'Need an account? Sign up' : 'Already have an account? Login'}
        </button>
        
        <div style={styles.note}>
          <span>🔒</span>
          <p>Your password is stored securely. Messages are ephemeral and auto-delete after 10 minutes.</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#050508', display: 'flex', justifyContent: 'center', padding: '0 16px 60px' },
  container: { width: '100%', maxWidth: 400, paddingTop: 60 },
  back: { background: 'none', border: 'none', color: '#6B6B85', fontSize: 14, cursor: 'pointer', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 800, color: '#E8E8F0', marginBottom: 32 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  input: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '14px 16px', color: '#E8E8F0', fontSize: 16, outline: 'none' },
  btn: { background: '#7C3AED', border: 'none', borderRadius: 12, padding: '14px', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 },
  switchBtn: { background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', marginTop: 20, fontSize: 14 },
  error: { color: '#EF4444', fontSize: 13, textAlign: 'center' },
  note: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 12, padding: 14, display: 'flex', gap: 12, marginTop: 32, fontSize: 12, color: '#6B6B85' },
}