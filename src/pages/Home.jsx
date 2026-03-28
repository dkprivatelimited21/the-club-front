import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_URL } from '../utils/config.js'
import { useUserStore } from '../store/index.js'
import { getSocket } from '../utils/socket.js'

export default function Home() {
  const { username } = useUserStore()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [joinId, setJoinId] = useState('')
  const [joinErr, setJoinErr] = useState('')

  useEffect(() => { getSocket(); fetchClubs() }, [])

  const fetchClubs = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/clubs/public`)
      const d = await r.json()
      setClubs(d.clubs || [])
    } catch { setClubs([]) }
    finally { setLoading(false) }
  }, [])

  const handleQuickJoin = (id) => {
    if (!username) return navigate('/profile', { state: { next: `/club/${id}` } })
    navigate(`/club/${id}`)
  }

  const handleJoinById = () => {
    const id = joinId.trim().toUpperCase()
    if (!id) { setJoinErr('Enter a Club ID'); return }
    if (!username) return navigate('/profile', { state: { next: `/club/${id}` } })
    navigate(`/club/${id}`)
  }

  const guard = (path) => {
    if (!username) return navigate('/profile', { state: { next: path } })
    navigate(path)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>The Club 🎭</h1>
            <p style={styles.sub}>{username ? `Hey, ${username} 👋` : 'Ephemeral · Private · Real-time'}</p>
          </div>
          <button onClick={() => navigate('/profile')} style={styles.iconBtn}>
            <svg width="18" height="18" fill="none" stroke="#7C3AED" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          </button>
        </div>

        {/* Privacy badge */}
        <div style={styles.badge}>
          <div style={styles.badgeIcon}>🔒</div>
          <div>
            <div style={styles.badgeTitle}>Zero persistence guaranteed</div>
            <div style={styles.badgeSub}>Messages auto-delete in 10 min · No data stored · No accounts</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={styles.row}>
          <button onClick={() => guard('/create')} style={styles.primaryBtn}>
            ＋ Create Club
          </button>
          <button onClick={() => guard('/join')} style={styles.secondaryBtn}>
            → Join Club
          </button>
        </div>

        {/* Quick join */}
        <div style={styles.section}>
          <label style={styles.label}>QUICK JOIN BY ID</label>
          <div style={styles.row}>
            <input
              value={joinId}
              onChange={e => { setJoinId(e.target.value.toUpperCase()); setJoinErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleJoinById()}
              placeholder="e.g. A1B2C3D4"
              style={{ ...styles.input, letterSpacing: '3px', flex: 1, borderColor: joinErr ? '#EF4444' : '#1E1E2E' }}
            />
            <button onClick={handleJoinById} style={styles.iconBtn}>→</button>
          </div>
          {joinErr && <p style={styles.error}>{joinErr}</p>}
        </div>

        {/* Live clubs */}
        <div style={styles.sectionHeader}>
          <span style={styles.label}>LIVE CLUBS</span>
          <button onClick={fetchClubs} style={styles.ghostBtn}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={styles.empty}><Spinner /></div>
        ) : clubs.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: 42 }}>🎭</span>
            <p style={{ color: '#6B6B85', marginTop: 12 }}>No clubs live right now.<br />Be the first to start one!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clubs.map(c => <ClubCard key={c.id} club={c} onJoin={handleQuickJoin} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ClubCard({ club, onJoin }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={() => onJoin(club.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...styles.card,
        borderColor: hover ? '#7C3AED' : '#1E1E2E',
        cursor: 'pointer',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#E8E8F0' }}>{club.name}</div>
        <div style={{ color: '#6B6B85', fontSize: 12, marginTop: 3 }}>by {club.host}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PulseDot />
        <span style={{ color: '#22C55E', fontWeight: 600, fontSize: 14 }}>{club.userCount}</span>
        <span style={{ color: '#6B6B85', fontSize: 12 }}>→</span>
      </div>
    </div>
  )
}

function PulseDot() {
  return (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#22C55E', animation: 'pulse 2s ease-in-out infinite' }}>
      <style>{`@keyframes pulse { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.4); opacity:0.7 } }`}</style>
    </span>
  )
}

function Spinner() {
  return <div style={{ width: 28, height: 28, border: '3px solid #1E1E2E', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
}

const styles = {
  page: { minHeight: '100vh', background: '#050508', display: 'flex', justifyContent: 'center', padding: '0 16px 80px' },
  container: { width: '100%', maxWidth: 480, paddingTop: 48 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 800, color: '#E8E8F0', letterSpacing: '-0.5px' },
  sub: { color: '#6B6B85', fontSize: 13, marginTop: 4 },
  badge: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 14, padding: 14, display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 },
  badgeIcon: { fontSize: 22, flexShrink: 0 },
  badgeTitle: { color: '#E8E8F0', fontWeight: 600, fontSize: 13 },
  badgeSub: { color: '#6B6B85', fontSize: 11, marginTop: 2 },
  row: { display: 'flex', gap: 10, marginBottom: 24 },
  primaryBtn: { flex: 1, background: '#7C3AED', border: 'none', borderRadius: 12, padding: '14px 0', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '14px 0', color: '#E8E8F0', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, background: '#13131C', border: '1px solid #1E1E2E', color: '#7C3AED', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 },
  ghostBtn: { background: 'none', border: 'none', color: '#6B6B85', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  section: { marginBottom: 24 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { color: '#6B6B85', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' },
  input: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '12px 14px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', width: '100%' },
  card: { background: '#13131C', border: '1px solid', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48 },
  error: { color: '#EF4444', fontSize: 12, marginTop: 6 },
}
