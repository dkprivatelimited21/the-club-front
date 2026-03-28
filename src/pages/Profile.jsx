import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '../store/index.js'

const STYLES = ['bottts-neutral','adventurer-neutral','pixel-art-neutral','micah','identicon','rings']
const STYLE_LABELS = ['Bots','Adventure','Pixel','Micah','Identicon','Rings']

export default function Profile() {
  const { username, avatar, setUsername, setAvatar } = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()
  const next = location.state?.next || '/'

  const [name, setName] = useState(username)
  const [styleIdx, setStyleIdx] = useState(0)
  const [error, setError] = useState('')

  const preview = name
    ? `https://api.dicebear.com/7.x/${STYLES[styleIdx]}/svg?seed=${encodeURIComponent(name)}`
    : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default`

  const save = () => {
    const t = name.trim()
    if (!t || t.length < 2) return setError('At least 2 characters')
    if (t.length > 20) return setError('Max 20 characters')
    if (!/^[a-zA-Z0-9_]+$/.test(t)) return setError('Letters, numbers, underscores only')
    setError('')
    setUsername(t)
    setAvatar(`https://api.dicebear.com/7.x/${STYLES[styleIdx]}/svg?seed=${encodeURIComponent(t)}`)
    navigate(next)
  }

  return (
    <div style={pg.page}>
      <div style={pg.container}>
        <button onClick={() => navigate(-1)} style={pg.back}>← Back</button>
        <h2 style={pg.title}>Your Profile</h2>

        {/* Avatar */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={pg.avatarRing}>
            <img src={preview} alt="avatar" width={86} height={86} />
          </div>
          <p style={{ color: '#6B6B85', fontSize: 12, marginTop: 10 }}>Auto-generated · no upload needed</p>
        </div>

        {/* Style picker */}
        <label style={pg.label}>AVATAR STYLE</label>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 24 }}>
          {STYLES.map((style, i) => {
            const seed = name || 'preview'
            return (
              <button
                key={style}
                onClick={() => setStyleIdx(i)}
                style={{
                  ...pg.stylePill,
                  borderColor: styleIdx === i ? '#7C3AED' : '#1E1E2E',
                  background: styleIdx === i ? '#13131C' : '#0D0D14',
                  flexShrink: 0,
                }}
              >
                <img src={`https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`} width={40} height={40} alt={style} />
                <span style={{ fontSize: 11, color: styleIdx === i ? '#9F67FF' : '#6B6B85', marginTop: 4 }}>{STYLE_LABELS[i]}</span>
              </button>
            )
          })}
        </div>

        {/* Username */}
        <label style={pg.label}>USERNAME</label>
        <input
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Enter username..."
          maxLength={20}
          autoFocus
          style={{ ...pg.input, borderColor: error ? '#EF4444' : '#1E1E2E', marginBottom: 6 }}
        />
        {error && <p style={pg.error}>{error}</p>}
        <p style={{ color: '#6B6B85', fontSize: 11, marginBottom: 24 }}>Letters, numbers, underscores · 2–20 chars</p>

        {/* Privacy note */}
        <div style={pg.note}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <p style={{ color: '#6B6B85', fontSize: 12, lineHeight: 1.6 }}>
            No account needed. Stored locally in your browser only. No email, no password, no tracking.
          </p>
        </div>

        <button onClick={save} style={pg.btn}>
          {username ? 'Update Profile' : 'Set Username & Continue →'}
        </button>
      </div>
    </div>
  )
}

const pg = {
  page: { minHeight: '100vh', background: '#050508', display: 'flex', justifyContent: 'center', padding: '0 16px 60px' },
  container: { width: '100%', maxWidth: 440, paddingTop: 40 },
  back: { background: 'none', border: 'none', color: '#6B6B85', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8E8F0', marginBottom: 28 },
  avatarRing: { width: 108, height: 108, borderRadius: '50%', border: '2px solid #7C3AED', background: '#13131C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { display: 'block', color: '#6B6B85', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 },
  stylePill: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10, border: '2px solid', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' },
  input: { width: '100%', background: '#13131C', border: '1px solid', borderRadius: 12, padding: '13px 14px', color: '#E8E8F0', fontSize: 16, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', display: 'block' },
  note: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 12, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 24 },
  btn: { width: '100%', background: '#7C3AED', border: 'none', borderRadius: 12, padding: '15px 0', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: '#EF4444', fontSize: 12, marginBottom: 8 },
}
