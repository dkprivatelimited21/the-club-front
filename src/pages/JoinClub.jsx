import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../utils/config.js'

export default function JoinClub() {
  const navigate = useNavigate()
  const [clubId, setClubId] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState('id') // 'id' | 'pin'
  const [clubInfo, setClubInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookup = async () => {
    const id = clubId.trim().toUpperCase()
    if (!id) return setError('Enter a Club ID')
    setError(''); setLoading(true)
    try {
      const r = await fetch(`${API_URL}/clubs/${id}`)
      const d = await r.json()
      if (!r.ok) return setError(d.error || 'Club not found')
      setClubInfo(d)
      if (d.requiresPin) setStep('pin')
      else navigate(`/club/${id}`)
    } catch { setError('Could not reach server') }
    finally { setLoading(false) }
  }

  const verifyPin = async () => {
    if (!pin) return setError('Enter the PIN')
    setError(''); setLoading(true)
    try {
      const r = await fetch(`${API_URL}/clubs/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId: clubId.trim().toUpperCase(), pin }),
      })
      const d = await r.json()
      if (!d.valid) { setError('Incorrect PIN'); return }
      navigate(`/club/${clubId.trim().toUpperCase()}`, { state: { pin } })
    } catch { setError('Verification failed') }
    finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <button onClick={() => navigate(-1)} style={s.back}>← Back</button>
        <h2 style={s.title}>Join a Club</h2>

        {step === 'id' ? (
          <>
            <label style={s.label}>CLUB ID</label>
            <input
              value={clubId}
              onChange={e => { setClubId(e.target.value.toUpperCase()); setError('') }}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="Enter Club ID (e.g. A1B2C3D4)"
              autoFocus
              style={{ ...s.input, letterSpacing: '3px', marginBottom: 24, borderColor: error ? '#EF4444' : '#1E1E2E' }}
            />
            {error && <p style={s.error}>{error}</p>}
            <button onClick={lookup} disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Looking up…' : '🔍 Find Club'}
            </button>
          </>
        ) : (
          <>
            <div style={s.clubFound}>
              <div style={{ color: '#9F67FF', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>CLUB FOUND</div>
              <div style={{ color: '#E8E8F0', fontSize: 18, fontWeight: 700 }}>{clubInfo?.name}</div>
              <div style={{ color: '#6B6B85', fontSize: 13, marginTop: 4 }}>🔒 This club requires a PIN</div>
            </div>

            <label style={s.label}>ENTER PIN</label>
            <input
              value={pin}
              onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && verifyPin()}
              placeholder="Club PIN"
              type="password"
              autoFocus
              style={{ ...s.input, marginBottom: 24, borderColor: error ? '#EF4444' : '#1E1E2E' }}
            />
            {error && <p style={s.error}>{error}</p>}
            <button onClick={verifyPin} disabled={loading} style={{ ...s.btn, marginBottom: 12, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Verifying…' : '→ Enter Club'}
            </button>
            <button onClick={() => { setStep('id'); setPin(''); setError('') }} style={s.back}>
              ← Change Club ID
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#050508', display: 'flex', justifyContent: 'center', padding: '0 16px 60px' },
  container: { width: '100%', maxWidth: 440, paddingTop: 40 },
  back: { background: 'none', border: 'none', color: '#6B6B85', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20, display: 'block' },
  title: { fontSize: 22, fontWeight: 800, color: '#E8E8F0', marginBottom: 28 },
  label: { display: 'block', color: '#6B6B85', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 },
  input: { width: '100%', background: '#13131C', border: '1px solid', borderRadius: 12, padding: '13px 14px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', display: 'block' },
  btn: { width: '100%', background: '#7C3AED', border: 'none', borderRadius: 12, padding: '15px 0', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12 },
  clubFound: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 14, padding: 16, marginBottom: 24 },
}
