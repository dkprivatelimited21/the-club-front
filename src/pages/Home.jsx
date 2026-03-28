// Add search input and results in Home.jsx
const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState([])
const [searching, setSearching] = useState(false)

const searchClubs = async () => {
  if (!searchQuery.trim() || searchQuery.length < 2) return
  setSearching(true)
  try {
    const r = await fetch(`${API_URL}/clubs/search?q=${encodeURIComponent(searchQuery)}`)
    const d = await r.json()
    setSearchResults(d.clubs)
  } catch { setSearchResults([]) }
  finally { setSearching(false) }
}

// Add search UI before live clubs section
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
    <button onClick={searchClubs} style={styles.iconBtn}>🔍</button>
  </div>
  {searchResults.length > 0 && (
    <div style={{ marginTop: 12 }}>
      {searchResults.map(c => <ClubCard key={c.id} club={c} onJoin={handleQuickJoin} />)}
    </div>
  )}
</div>