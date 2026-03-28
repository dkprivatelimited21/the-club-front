import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../utils/config.js'
import { useUserStore } from '../store/index.js'

export default function Home() {
  const { username, isLoggedIn } = useUserStore()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    fetchClubs()
  }, [])

  const fetchClubs = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/clubs/public`)
      const d = await r.json()
      setClubs(d.clubs || [])
    } catch { 
      setClubs([]) 
    }
    finally { 
      setLoading(false) 
    }
  }

  const searchClubs = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return
    setSearching(true)
    try {
      const r = await fetch(`${API_URL}/clubs/search?q=${encodeURIComponent(searchQuery)}`)
      const d = await r.json()
      setSearchResults(d.clubs || [])
    } catch { 
      setSearchResults([]) 
    }
    finally { 
      setSearching(false) 
    }
  }

  const handleQuickJoin = (id) => {
    if (!isLoggedIn && !username) {
      return navigate('/login', { state: { next: `/club/${id}` } })
    }
    navigate(`/club/${id}`)
  }

  const guard = (path) => {
    if (!isLoggedIn && !username) {
      return navigate('/login', { state: { next: path } })
    }
    navigate(path)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>The Club 🎭</h1>
            <p style={styles.sub}>
              {username ? `Hey, ${username} 👋` : 'Ephemeral · Private · Real-time'}
            </p>
          </div>
          <button onClick={() => navigate('/profile')} style={styles.iconBtn}>
            <svg width="18" height="18" fill="none" stroke="#7C3AED" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </button>
        </div>

        {/* Privacy badge */}
        <div style={styles.badge}>
          <div style={styles.badgeIcon}>🔒</div>
          <div>
            <div style={styles.badgeTitle}>Zero persistence guaranteed</div>
            <div style={styles.badgeSub}>Messages auto-delete in 10 min · No data stored</div>
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

        {/* SEARCH SECTION */}
        <div style={styles.section}>
          <label style={styles.label}>SEARCH CLUBS</label>
          <div style={styles.row}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchClubs()}
              placeholder="Search by name or ID"
              style={{ ...styles.input, flex: 1 }}
            />
            <button onClick={searchClubs} style={styles.iconBtn} disabled={searching}>
              {searching ? '⏳' : '🔍'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {searchResults.map(c => (
                <ClubCard key={c.id} club={c} onJoin={handleQuickJoin} />
              ))}
            </div>
          )}
        </div>

        {/* Live clubs section */}
        <div style={styles.sectionHeader}>
          <span style={styles.label}>LIVE CLUBS</span>
          <button onClick={fetchClubs} style={styles.ghostBtn}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={styles.empty}>
            <Spinner />
          </div>
        ) : clubs.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: 42 }}>🎭</span>
            <p style={{ color: '#6B6B85', marginTop: 12 }}>
              No clubs live right now.<br />Be the first to start one!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clubs.map(c => (
              <ClubCard key={c.id} club={c} onJoin={handleQuickJoin} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Club Card Component
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
        <span style={{ color: '#22C55E', fontWeight: 600, fontSize: 14 }}>{club.userCount || 0}</span>
        <span style={{ color: '#6B6B85', fontSize: 12 }}>→</span>
      </div>
    </div>
  )
}

// Pulse Dot Component
function PulseDot() {
  return (
    <span style={{ 
      display: 'inline-block', 
      width: 8, 
      height: 8, 
      borderRadius: 4, 
      background: '#22C55E', 
      animation: 'pulse 2s ease-in-out infinite' 
    }}>
      <style>{`@keyframes pulse { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.4); opacity:0.7 } }`}</style>
    </span>
  )
}

// Spinner Component
function Spinner() {
  return (
    <div style={{ 
      width: 28, 
      height: 28, 
      border: '3px solid #1E1E2E', 
      borderTopColor: '#7C3AED', 
      borderRadius: '50%', 
      animation: 'spin 0.8s linear infinite' 
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Styles
const styles = {
  page: { 
    minHeight: '100vh', 
    background: '#050508', 
    display: 'flex', 
    justifyContent: 'center', 
    padding: '0 16px 80px' 
  },
  container: { 
    width: '100%', 
    maxWidth: 480, 
    paddingTop: 48 
  },
  header: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 24 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 800, 
    color: '#E8E8F0', 
    letterSpacing: '-0.5px' 
  },
  sub: { 
    color: '#6B6B85', 
    fontSize: 13, 
    marginTop: 4 
  },
  badge: { 
    background: '#0D0D14', 
    border: '1px solid #1E1E2E', 
    borderRadius: 14, 
    padding: 14, 
    display: 'flex', 
    gap: 12, 
    alignItems: 'center', 
    marginBottom: 24 
  },
  badgeIcon: { 
    fontSize: 22, 
    flexShrink: 0 
  },
  badgeTitle: { 
    color: '#E8E8F0', 
    fontWeight: 600, 
    fontSize: 13 
  },
  badgeSub: { 
    color: '#6B6B85', 
    fontSize: 11, 
    marginTop: 2 
  },
  row: { 
    display: 'flex', 
    gap: 10, 
    marginBottom: 24 
  },
  primaryBtn: { 
    flex: 1, 
    background: '#7C3AED', 
    border: 'none', 
    borderRadius: 12, 
    padding: '14px 0', 
    color: '#fff', 
    fontWeight: 700, 
    fontSize: 15, 
    cursor: 'pointer', 
    fontFamily: 'inherit' 
  },
  secondaryBtn: { 
    flex: 1, 
    background: '#13131C', 
    border: '1px solid #1E1E2E', 
    borderRadius: 12, 
    padding: '14px 0', 
    color: '#E8E8F0', 
    fontWeight: 700, 
    fontSize: 15, 
    cursor: 'pointer', 
    fontFamily: 'inherit' 
  },
  iconBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 12, 
    background: '#13131C', 
    border: '1px solid #1E1E2E', 
    color: '#7C3AED', 
    fontSize: 18, 
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontFamily: 'inherit', 
    flexShrink: 0 
  },
  ghostBtn: { 
    background: 'none', 
    border: 'none', 
    color: '#6B6B85', 
    fontSize: 13, 
    cursor: 'pointer', 
    fontFamily: 'inherit' 
  },
  section: { 
    marginBottom: 24 
  },
  sectionHeader: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  label: { 
    color: '#6B6B85', 
    fontSize: 11, 
    fontWeight: 600, 
    letterSpacing: '1px', 
    textTransform: 'uppercase' 
  },
  input: { 
    background: '#13131C', 
    border: '1px solid #1E1E2E', 
    borderRadius: 12, 
    padding: '12px 14px', 
    color: '#E8E8F0', 
    fontSize: 15, 
    fontFamily: "'Space Grotesk', sans-serif", 
    outline: 'none', 
    width: '100%' 
  },
  card: { 
    background: '#13131C', 
    border: '1px solid', 
    borderRadius: 14, 
    padding: 16, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  empty: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    paddingTop: 48 
  },
}