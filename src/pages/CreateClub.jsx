import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore, useClubStore } from '../store/index.js'
import { getSocket } from '../utils/socket.js'

const TYPES = [
  { id: 'public',  icon: '🌐', label: 'Public',  desc: 'Anyone can find and join' },
  { id: 'private', icon: '🔗', label: 'Private', desc: 'Join via direct link only' },
  { id: 'hidden',  icon: '🔒', label: 'Hidden',  desc: 'Requires PIN to enter' },
]

export default function CreateClub() {
  const { username, avatar } = useUserStore()
  const { setClub, setMessages, setMedia, setOnlineUsers } = useClubStore()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [type, setType] = useState('public')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const create = () => {
    const n = name.trim()
    if (!n || n.length < 2) return setError('Club name must be at least 2 characters')
    if (type === 'hidden' && pin.length < 4) return setError('PIN must be at least 4 characters')
    setError(''); setLoading(true)

    const socket = getSocket()
    const timer = setTimeout(() => { setLoading(false); setError('Connection timeout. Is the server running?') }, 10000)

    socket.emit('createClub', { name: n, type, pin: type === 'hidden' ? pin : undefined, username, avatar }, res => {
      clearTimeout(timer); setLoading(false)
      if (res.error) return setError(res.error)
      setClub(res.club); setMessages([]); setMedia([]); setOnlineUsers(res.club.users || [])
      navigate(`/club/${res.clubId}`, { replace: true })
    })
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <button onClick={() => navigate(-1)} style={s.back}>← Back</button>
        <h2 style={s.title}>Create a Club</h2>

        <label style={s.label}>CLUB NAME</label>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="e.g. Late Night Vibes"
          maxLength={30}
          autoFocus
          style={{ ...s.input, marginBottom: 24 }}
        />

        <label style={s.label}>CLUB TYPE</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: type === 'hidden' ? 16 : 24 }}>
          {TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => { setType(t.id); setError('') }}
              style={{
                ...s.typeCard,
                borderColor: type === t.id ? '#7C3AED' : '#1E1E2E',
                background: type === t.id ? '#13131C' : '#0D0D14',
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#E8E8F0' }}>{t.label}</div>
                <div style={{ color: '#6B6B85', fontSize: 12 }}>{t.desc}</div>
              </div>
              {type === t.id && <span style={{ color: '#7C3AED', fontSize: 18 }}>✓</span>}
            </button>
          ))}
        </div>

        {type === 'hidden' && (
          <div style={{ marginBottom: 24 }}>
            <label style={s.label}>CLUB PIN</label>
            <input
              value={pin}
              onChange={e => { setPin(e.target.value); setError('') }}
              placeholder="Set a PIN (min 4 chars)"
              type="password"
              maxLength={12}
              style={s.input}
            />
          </div>
        )}

        <div style={s.note}>
          <span>⏱️ Club auto-deletes when empty · 💬 Messages expire in 10 min · 🖼️ Media expires in 5 min</span>
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button onClick={create} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Opening…' : '🎭 Open The Club'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#050508', display: 'flex', justifyContent: 'center', padding: '0 16px 60px' },
  container: { width: '100%', maxWidth: 440, paddingTop: 40 },
  back: { background: 'none', border: 'none', color: '#6B6B85', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8E8F0', marginBottom: 28 },
  label: { display: 'block', color: '#6B6B85', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 },
  input: { width: '100%', background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '13px 14px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', display: 'block' },
  typeCard: { width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, border: '1.5px solid', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit' },
  note: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 12, padding: 14, color: '#6B6B85', fontSize: 12, lineHeight: 1.7, marginBottom: 20 },
  btn: { width: '100%', background: '#7C3AED', border: 'none', borderRadius: 12, padding: '15px 0', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
}
