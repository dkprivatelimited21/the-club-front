import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore, useClubStore } from '../store/index.js'
import { getSocket } from '../utils/socket.js'
import { API_URL, SERVER_URL, MAX_MSG_LEN, GIPHY_API_KEY } from '../utils/config.js'

const REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '💯', '😈', '✨']

// Helper Components
function CenteredMsg({ children }) {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#050508', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 24, 
      textAlign: 'center' 
    }}>
      {children}
    </div>
  )
}

function Spinner({ size = 26 }) {
  return (
    <div style={{ 
      width: size, 
      height: size, 
      border: `3px solid #1E1E2E`, 
      borderTopColor: '#7C3AED', 
      borderRadius: '50%', 
      animation: 'spin 0.8s linear infinite' 
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Club() {
  const { clubId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { username, avatar, userId, isLoggedIn } = useUserStore()
  const {
    currentClub, messages, media, onlineUsers, typingUsers, sidePanelOpen, sidePanelTab,
    setClub, clearClub, addMessage, setMessages, addMedia, setMedia,
    setOnlineUsers, addTypingUser, updateReaction, setSidePanelOpen, setSidePanelTab,
  } = useClubStore()

  const pin = location.state?.pin
  const [text, setText] = useState('')
  const [status, setStatus] = useState('joining')
  const [errMsg, setErrMsg] = useState('')
  const [showReactFor, setShowReactFor] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordingTimer, setRecordingTimer] = useState(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [showGifPreview, setShowGifPreview] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const fileRef = useRef(null)
  const audioFileRef = useRef(null)
  const socketRef = useRef(null)
  const feedRef = useRef(null)
  const attachmentRef = useRef(null)
  const recordButtonRef = useRef(null)

  // Detect keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      const isKeyboard = window.innerHeight < window.outerHeight - 100
      setIsKeyboardVisible(isKeyboard)
      if (isKeyboard) {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      } else {
        setShowAttachmentMenu(false)
        setShowGifPicker(false)
        setShowGifPreview(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachmentRef.current && !attachmentRef.current.contains(event.target) && 
          recordButtonRef.current && !recordButtonRef.current.contains(event.target)) {
        setShowAttachmentMenu(false)
        setShowGifPicker(false)
        setShowGifPreview(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isLoggedIn && username === '') {
      navigate('/login', { state: { next: `/club/${clubId}` } })
    }
  }, [isLoggedIn, username, navigate, clubId])

  useEffect(() => {
    if (!isLoggedIn && username === '') return

    const socket = getSocket()
    socketRef.current = socket

    socket.on('newMessage', (msg) => {
      addMessage(msg)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    })
    socket.on('newMedia', (media) => {
      addMedia(media)
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    })
    socket.on('newLink', (link) => addMessage({ ...link, type: 'link' }))
    socket.on('newGif', (gif) => addMessage({ ...gif, type: 'gif' }))
    socket.on('userJoined', ({ user, users }) => {
      setOnlineUsers(users || [])
      if (user.username !== username) {
        addMessage({ id: crypto.randomUUID(), type: 'system', text: `${user.username} joined 👋`, timestamp: Date.now() })
      }
    })
    socket.on('userLeft', ({ username: u, users }) => {
      setOnlineUsers(users || [])
      addMessage({ id: crypto.randomUUID(), type: 'system', text: `${u} left`, timestamp: Date.now() })
    })
    socket.on('usersUpdate', ({ users }) => setOnlineUsers(users || []))
    socket.on('userTyping', addTypingUser)
    socket.on('messageReaction', ({ messageId, reactions }) => updateReaction(messageId, reactions))
    socket.on('disconnect', () => addMessage({ id: crypto.randomUUID(), type: 'system', text: '⚠️ Connection lost. Reconnecting…', timestamp: Date.now() }))

    socket.emit('joinClub', { clubId, pin, username, avatar, userId }, res => {
      if (res.error) { setStatus('error'); setErrMsg(res.error); return }
      setStatus('joined')
      setClub(res.club)
      setMessages(res.recentMessages || [])
      setMedia(res.recentMedia || [])
      setOnlineUsers(res.club.users || [])
    })

    return () => {
      socket.off('newMessage')
      socket.off('newMedia')
      socket.off('newLink')
      socket.off('newGif')
      socket.off('userJoined')
      socket.off('userLeft')
      socket.off('usersUpdate')
      socket.off('userTyping')
      socket.off('messageReaction')
      socket.off('disconnect')
      socket.emit('leaveClub')
      clearClub()
    }
  }, [isLoggedIn, username, clubId, pin, avatar, userId])

  useEffect(() => {
    if (activeTab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, media, activeTab])

  const sendMsg = useCallback(() => {
    const t = text.trim()
    if (!t || t.length > MAX_MSG_LEN) return
    
    const messageData = { text: t }
    if (replyingTo) {
      messageData.replyTo = {
        id: replyingTo.id,
        text: replyingTo.text,
        username: replyingTo.username
      }
    }
    
    socketRef.current.emit('sendMessage', messageData)
    setText('')
    setReplyingTo(null)
    emitTyping(false)
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    
    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }, [text, replyingTo])

  const emitTyping = (v) => {
    socketRef.current?.emit('typing', { isTyping: v })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMsg()
    }
  }

  const handleTyping = (v) => {
    setText(v)
    emitTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTyping(false), 2000)
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px'
    }
    
    if (isKeyboardVisible) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }
  }

  const handleFocus = () => {
    setIsKeyboardVisible(true)
    setShowAttachmentMenu(false)
    setShowGifPicker(false)
    setShowGifPreview(false)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 150)
  }

  const handleBlur = () => {
    setTimeout(() => {
      setIsKeyboardVisible(false)
    }, 100)
  }

  const handleReact = (messageId, emoji) => {
    socketRef.current.emit('reactMessage', { messageId, emoji })
    setShowReactFor(null)
  }

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/club/${clubId}`
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    setShareMenuOpen(false)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Please upload an image file')
    if (file.size > 10 * 1024 * 1024) return alert('File too large (max 10MB)')
    setUploading(true)
    setShowAttachmentMenu(false)
    try {
      const fd = new FormData()
      fd.append('media', file)
      const r = await fetch(`${API_URL}/media/upload`, {
        method: 'POST',
        headers: { 'x-socket-id': socketRef.current.id },
        body: fd,
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
    } catch (err) { alert('Upload failed: ' + err.message) }
    finally { setUploading(false); fileRef.current.value = '' }
  }

  const handleAudioChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) return alert('Please upload an audio file (MP3, WAV, etc.)')
    if (file.size > 20 * 1024 * 1024) return alert('Audio file too large (max 20MB)')
    
    setUploading(true)
    setShowAttachmentMenu(false)
    try {
      const fd = new FormData()
      fd.append('media', file)
      const r = await fetch(`${API_URL}/media/upload`, {
        method: 'POST',
        headers: { 'x-socket-id': socketRef.current.id },
        body: fd,
      })
      const d = await r.json()
      if (!d.success) throw new Error(d.error)
    } catch (err) { alert('Upload failed: ' + err.message) }
    finally { setUploading(false); audioFileRef.current.value = '' }
  }

  // Voice Recording with Hold-to-Send
  const startRecordingWithHold = () => {
    setRecording(true)
    setRecordingDuration(0)
    
    // Start timer
    const timer = setInterval(() => {
      setRecordingDuration(prev => prev + 1)
    }, 1000)
    setRecordingTimer(timer)
    
    startRecording()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []
      
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const audioData = reader.result.split(',')[1]
          socketRef.current.emit('sendVoiceNote', { audioData, duration: recordingDuration })
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      recorder.start()
      setMediaRecorder(recorder)
    } catch (err) {
      alert('Microphone access denied')
      setRecording(false)
      if (recordingTimer) clearInterval(recordingTimer)
    }
  }

  const stopRecordingAndSend = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
      if (recordingTimer) {
        clearInterval(recordingTimer)
        setRecordingTimer(null)
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
      if (recordingTimer) {
        clearInterval(recordingTimer)
        setRecordingTimer(null)
      }
    }
    setRecordingDuration(0)
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // GIF search with inline preview
  const searchGifs = async () => {
    if (!gifSearch.trim()) {
      setShowGifPreview(false)
      return
    }
    if (!GIPHY_API_KEY) {
      alert('GIF search is not configured. Please add GIPHY API key.')
      return
    }
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifSearch)}&limit=20&rating=pg-13`
      )
      const data = await response.json()
      setGifResults(data.data || [])
      setShowGifPreview(true)
    } catch (err) {
      console.error('GIF search failed', err)
      alert('Failed to search GIFs')
    }
  }

  const sendGif = (gifUrl) => {
    socketRef.current.emit('sendGif', { gifUrl })
    setShowGifPicker(false)
    setShowGifPreview(false)
    setGifSearch('')
    setGifResults([])
    setShowAttachmentMenu(false)
  }

  const downloadMedia = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'media'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const kickUser = (targetUsername) => {
    if (confirm(`Kick ${targetUsername} from the club?`)) {
      socketRef.current.emit('kickUser', { targetUsername })
    }
  }

  const promoteAdmin = (targetUsername) => {
    if (confirm(`Promote ${targetUsername} to admin?`)) {
      socketRef.current.emit('promoteAdmin', { targetUsername })
    }
  }

  const feed = [
    ...(messages || []).map(m => ({ ...m, _kind: 'msg' })),
    ...(media || []).map(m => ({ ...m, _kind: 'media' })),
  ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

  const images = media.filter(m => m.type !== 'audio')
  const audioFiles = media.filter(m => m.type === 'audio')

  const isAdmin = currentClub?.admins?.includes(username) || currentClub?.host === username

  if (!isLoggedIn && username === '') return null
  if (status === 'joining') return <CenteredMsg><Spinner /><p style={{ color: '#6B6B85', marginTop: 16 }}>Joining club…</p></CenteredMsg>
  if (status === 'error') return (
    <CenteredMsg>
      <span style={{ fontSize: 44 }}>🚫</span>
      <p style={{ color: '#EF4444', fontWeight: 700, fontSize: 18, marginTop: 12 }}>Can't Join</p>
      <p style={{ color: '#6B6B85', marginTop: 8 }}>{errMsg}</p>
      <button onClick={() => navigate('/')} style={{ marginTop: 20, background: '#7C3AED', border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        Go Home
      </button>
    </CenteredMsg>
  )

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <button onClick={() => { socketRef.current?.emit('leaveClub'); clearClub(); navigate('/') }} style={styles.backBtn}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#E8E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentClub?.name || clubId}
          </div>
          <div style={{ color: '#22C55E', fontSize: 11, fontWeight: 600 }}>
            {onlineUsers?.length || 0} online
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShareMenuOpen(!shareMenuOpen)} style={styles.iconBtn} title="Share Club">
            📎
          </button>
          {shareMenuOpen && (
            <div style={styles.shareMenu}>
              <button onClick={copyShareLink} style={styles.shareMenuItem}>📋 Copy Club Link</button>
              <button onClick={() => navigator.clipboard.writeText(clubId)} style={styles.shareMenuItem}>🔑 Copy Club ID</button>
            </div>
          )}
          <button onClick={() => setSidePanelOpen && setSidePanelOpen(!sidePanelOpen)} style={{ ...styles.iconBtn, color: sidePanelOpen ? '#7C3AED' : '#6B6B85' }}>
            ☰
          </button>
        </div>
      </div>

      <div style={styles.idBar}>
        <span style={{ color: '#6B6B85', fontSize: 11 }}>ID: </span>
        <span style={{ color: '#9F67FF', fontSize: 11, fontWeight: 700, letterSpacing: '2px', fontFamily: 'JetBrains Mono, monospace' }}>{clubId}</span>
        {currentClub?.type === 'hidden' && <span style={{ fontSize: 11 }}>🔒</span>}
      </div>

      <div style={styles.tabs}>
        <button onClick={() => setActiveTab('chat')} style={{ ...styles.tab, color: activeTab === 'chat' ? '#7C3AED' : '#6B6B85' }}>
          💬 Chat
        </button>
        <button onClick={() => setActiveTab('media')} style={{ ...styles.tab, color: activeTab === 'media' ? '#7C3AED' : '#6B6B85' }}>
          🖼️ Media ({media.length})
        </button>
        <button onClick={() => setActiveTab('members')} style={{ ...styles.tab, color: activeTab === 'members' ? '#7C3AED' : '#6B6B85' }}>
          👥 Members
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('settings')} style={{ ...styles.tab, color: activeTab === 'settings' ? '#7C3AED' : '#6B6B85' }}>
            ⚙️ Admin
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chat' && (
          <div 
            ref={feedRef}
            style={styles.feed} 
            onClick={() => { setShowReactFor(null); setReplyingTo(null); setShowAttachmentMenu(false); setShowGifPicker(false); }}
          >
            {feed.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 60, color: '#6B6B85' }}>
                <div style={{ fontSize: 44 }}>🎭</div>
                <p style={{ marginTop: 12 }}>Club is open! Say something…</p>
                <p style={{ fontSize: 11, marginTop: 6, color: '#4C1D95' }}>Messages disappear after 10 minutes</p>
              </div>
            )}
            {feed.map(item => {
              if (item._kind === 'media') {
                const isAudio = item.type === 'audio' || item.mimetype?.startsWith('audio/')
                return isAudio ? (
                  <AudioBubble key={item.id} item={item} isMine={item.username === username} onDownload={downloadMedia} />
                ) : (
                  <MediaBubble key={item.id} item={item} isMine={item.username === username} onDownload={downloadMedia} />
                )
              } else {
                return (
                  <MessageBubble
                    key={item.id}
                    msg={item}
                    isMine={item.username === username}
                    showReactFor={showReactFor === item.id}
                    onLongPress={() => setShowReactFor(item.id)}
                    onReact={emoji => handleReact(item.id, emoji)}
                    onReply={() => {
                      setReplyingTo(item)
                      inputRef.current?.focus()
                    }}
                    currentUser={username}
                  />
                )
              }
            })}
            
            {replyingTo && (
              <div style={styles.replyBar}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 11, color: '#7C3AED' }}>Replying to {replyingTo.username}</span>
                  <div style={{ fontSize: 12, color: '#6B6B85', marginTop: 2 }}>
                    {replyingTo.text?.substring(0, 60)}{replyingTo.text?.length > 60 ? '...' : ''}
                  </div>
                </div>
                <button onClick={() => setReplyingTo(null)} style={styles.closeReplyBtn}>✕</button>
              </div>
            )}
            
            {typingUsers?.length > 0 && (
              <div style={{ padding: '4px 12px', color: '#6B6B85', fontSize: 12 }}>
                {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {activeTab === 'media' && (
          <div style={styles.mediaTab}>
            <div style={styles.mediaSection}>
              <h3 style={styles.mediaTitle}>📸 Images ({images.length})</h3>
              <div style={styles.mediaGrid}>
                {images.map(img => (
                  <div key={img.id} style={styles.mediaItem}>
                    <img src={`${SERVER_URL}${img.url}`} alt={img.originalName} style={styles.mediaImage} />
                    <div style={styles.mediaInfo}>
                      <span>{img.username}</span>
                      <button onClick={() => downloadMedia(`${SERVER_URL}${img.url}`, img.filename)} style={styles.downloadBtn}>⬇️</button>
                    </div>
                  </div>
                ))}
                {images.length === 0 && <p style={{ color: '#6B6B85', textAlign: 'center', padding: 40 }}>No images shared yet</p>}
              </div>
            </div>
            
            <div style={styles.mediaSection}>
              <h3 style={styles.mediaTitle}>🎵 Audio Files ({audioFiles.length})</h3>
              <div style={styles.audioList}>
                {audioFiles.map(audio => (
                  <div key={audio.id} style={styles.audioItem}>
                    <div style={styles.audioPlayer}>
                      <AudioPlayer url={`${SERVER_URL}${audio.url}`} />
                    </div>
                    <div style={styles.audioInfo}>
                      <span>{audio.username}</span>
                      <span style={{ fontSize: 11, color: '#6B6B85' }}>{Math.round(audio.size / 1024)} KB</span>
                      <button onClick={() => downloadMedia(`${SERVER_URL}${audio.url}`, audio.filename)} style={styles.downloadBtn}>⬇️</button>
                    </div>
                  </div>
                ))}
                {audioFiles.length === 0 && <p style={{ color: '#6B6B85', textAlign: 'center', padding: 40 }}>No audio files shared yet</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div style={styles.membersTab}>
            {onlineUsers?.map((user, i) => (
              <div key={i} style={styles.memberCard}>
                <img src={user.avatar} width={40} height={40} style={{ borderRadius: '50%' }} alt={user.username} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#E8E8F0' }}>{user.username}</div>
                  <div style={{ fontSize: 11, color: '#6B6B85' }}>
                    {user.username === currentClub?.host ? '👑 Host' : user.isAdmin ? '👑 Admin' : 'Member'}
                  </div>
                </div>
                {isAdmin && user.username !== username && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!user.isAdmin && user.username !== currentClub?.host && (
                      <button onClick={() => promoteAdmin(user.username)} style={styles.adminBtn} title="Make Admin">👑</button>
                    )}
                    <button onClick={() => kickUser(user.username)} style={styles.kickBtn} title="Kick">🚫</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && isAdmin && (
          <div style={styles.settingsTab}>
            <div style={styles.settingCard}>
              <h3 style={styles.settingTitle}>Club Settings</h3>
              <div style={styles.settingItem}>
                <label>Club Name</label>
                <input type="text" defaultValue={currentClub?.name} style={styles.settingInput} />
              </div>
              <div style={styles.settingItem}>
                <label>Club Type</label>
                <select defaultValue={currentClub?.type} style={styles.settingSelect}>
                  <option value="public">🌐 Public</option>
                  <option value="private">🔗 Private</option>
                  <option value="hidden">🔒 Hidden</option>
                </select>
              </div>
              <div style={styles.settingItem}>
                <label>Slow Mode (seconds)</label>
                <input type="number" min="0" max="60" defaultValue={currentClub?.settings?.slowMode || 0} style={styles.settingInput} />
              </div>
              <div style={styles.settingItem}>
                <label>Max Members</label>
                <input type="number" min="1" max="500" defaultValue={currentClub?.settings?.maxMembers || 100} style={styles.settingInput} />
              </div>
              <div style={styles.settingItem}>
                <label>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowMedia !== false} />
                  Allow Media Uploads
                </label>
              </div>
              <div style={styles.settingItem}>
                <label>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowVoiceNotes !== false} />
                  Allow Voice Notes
                </label>
              </div>
              <div style={styles.settingItem}>
                <label>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowLinks !== false} />
                  Allow Links
                </label>
              </div>
              <button style={styles.saveBtn}>Save Settings</button>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'chat' && (
        <div style={styles.inputBar}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <input ref={audioFileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioChange} />
          
          {/* Attachment Button */}
          <div ref={attachmentRef} style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} 
              style={styles.attachBtn}
              title="Attachment"
            >
              {uploading ? <Spinner size={20} /> : '+'}
            </button>
            
            {/* Attachment Menu */}
            {showAttachmentMenu && !recording && (
              <div style={styles.attachmentMenu}>
                <button onClick={() => fileRef.current.click()} style={styles.attachmentItem}>
                  <span style={styles.attachmentIcon}>🖼️</span>
                  <span>Photo/Video</span>
                </button>
                <button onClick={() => audioFileRef.current.click()} style={styles.attachmentItem}>
                  <span style={styles.attachmentIcon}>🎵</span>
                  <span>Audio File</span>
                </button>
                <button onClick={() => {
                  setShowGifPicker(true)
                  setShowAttachmentMenu(false)
                  setShowGifPreview(false)
                }} style={styles.attachmentItem}>
                  <span style={styles.attachmentIcon}>🎬</span>
                  <span>GIF</span>
                </button>
              </div>
            )}
          </div>
          
          {/* Input Area */}
          <div style={styles.inputContainer}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Message..."
              rows={1}
              maxLength={MAX_MSG_LEN}
              style={styles.textarea}
            />
            
            {/* GIF Search Input (appears when GIF picker is open) */}
            {showGifPicker && (
              <div style={styles.gifInputContainer}>
                <input
                  value={gifSearch}
                  onChange={e => setGifSearch(e.target.value)}
                  onKeyUp={searchGifs}
                  placeholder="Search GIFs..."
                  style={styles.gifInput}
                  autoFocus
                />
                <button onClick={() => setShowGifPicker(false)} style={styles.gifCloseInline}>✕</button>
              </div>
            )}
            
            {/* GIF Preview Grid */}
            {showGifPreview && gifResults.length > 0 && (
              <div style={styles.gifPreviewGrid}>
                {gifResults.slice(0, 8).map(gif => (
                  <img
                    key={gif.id}
                    src={gif.images?.fixed_height_small?.url}
                    alt={gif.title}
                    onClick={() => sendGif(gif.images?.fixed_height?.url)}
                    style={styles.gifPreviewImage}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Voice Recording Button with Hold-to-Send */}
          {!text.trim() && !recording ? (
            <button
              ref={recordButtonRef}
              onMouseDown={startRecordingWithHold}
              onMouseUp={stopRecordingAndSend}
              onMouseLeave={cancelRecording}
              onTouchStart={startRecordingWithHold}
              onTouchEnd={stopRecordingAndSend}
              onTouchCancel={cancelRecording}
              style={styles.voiceBtn}
              title="Hold to record"
            >
              🎤
            </button>
          ) : recording ? (
            <div style={styles.recordingIndicator}>
              <div style={styles.recordingPulse} />
              <span style={styles.recordingTime}>{formatDuration(recordingDuration)}</span>
              <button onClick={cancelRecording} style={styles.cancelRecordBtn}>✕</button>
            </div>
          ) : (
            <button onClick={sendMsg} disabled={!text.trim()} style={{ ...styles.sendBtn, opacity: text.trim() ? 1 : 0.4 }}>
              ➤
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AudioPlayer({ url }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setPlaying(!playing)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={togglePlay} style={smallStyles.smallAudioBtn}>
        {playing ? '⏸️' : '▶️'}
      </button>
      <audio ref={audioRef} src={url} />
    </div>
  )
}

function MessageBubble({ msg, isMine, showReactFor, onLongPress, onReact, onReply, currentUser }) {
  if (msg.type === 'system') {
    return (
      <div style={{ textAlign: 'center', margin: '6px 0' }}>
        <span style={{ background: '#0D0D14', color: '#6B6B85', fontSize: 11, padding: '3px 12px', borderRadius: 10 }}>
          {msg.text}
        </span>
      </div>
    )
  }

  const reactions = msg.reactions ? Object.entries(msg.reactions).filter(([, u]) => u.length > 0) : []
  const isLink = msg.type === 'link'
  const isGif = msg.type === 'gif'
  const hasReply = msg.replyTo

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: isMine ? 'row-reverse' : 'row', 
      alignItems: 'flex-end', 
      gap: 8, 
      margin: '3px 12px', 
      position: 'relative',
      animation: 'fadeIn 0.2s ease'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      {!isMine && (
        <img 
          src={msg.avatar} 
          width={32} 
          height={32} 
          style={{ borderRadius: '50%', flexShrink: 0, marginBottom: 2, background: '#13131C' }} 
          alt={msg.username} 
        />
      )}
      
      <div style={{ maxWidth: '70%' }}>
        {!isMine && (
          <div style={{ color: msg.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
            {msg.username}
          </div>
        )}
        
        {hasReply && (
          <div style={{
            background: '#0D0D14',
            borderRadius: 12,
            padding: '6px 10px',
            marginBottom: 4,
            borderLeft: `3px solid ${isMine ? '#9F67FF' : '#7C3AED'}`,
            fontSize: 11,
            color: '#6B6B85'
          }}>
            <span style={{ color: '#9F67FF', fontWeight: 600 }}>↳ {msg.replyTo.username}</span>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.replyTo.text?.substring(0, 80)}{msg.replyTo.text?.length > 80 ? '...' : ''}
            </div>
          </div>
        )}
        
        <div
          onContextMenu={(e) => { e.preventDefault(); onLongPress() }}
          onDoubleClick={onLongPress}
          style={{
            background: isMine ? '#7C3AED' : '#13131C',
            color: isMine ? '#fff' : '#E8E8F0',
            borderRadius: 18,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            padding: isLink || isGif ? '6px 10px' : '10px 14px',
            fontSize: 14,
            lineHeight: 1.4,
            border: isMine ? 'none' : '1px solid #1E1E2E',
            cursor: 'default',
            wordBreak: 'break-word',
            position: 'relative',
          }}
        >
          {isLink ? (
            <a 
              href={msg.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: isMine ? '#fff' : '#9F67FF', textDecoration: 'underline' }}
            >
              🔗 {msg.title || msg.url}
            </a>
          ) : isGif ? (
            <img 
              src={msg.url} 
              alt="gif" 
              style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} 
            />
          ) : (
            msg.text
          )}
        </div>
        
        {reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                style={{
                  background: users.includes(currentUser) ? '#7C3AED20' : '#13131C',
                  border: `1px solid ${users.includes(currentUser) ? '#7C3AED' : '#1E1E2E'}`,
                  borderRadius: 20,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  gap: 4,
                  fontFamily: 'inherit',
                }}
              >
                {emoji} <span style={{ color: '#6B6B85', fontSize: 11 }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 12, marginTop: 4 }}>
          <span style={{ color: '#6B6B85', fontSize: 10 }}>{fmtTime(msg.timestamp)}</span>
          <button onClick={onReply} style={msgStyles.replyBtn} title="Reply">↩️</button>
        </div>
        
        {showReactFor && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            [isMine ? 'right' : 'left']: 0,
            background: '#1E1E2E',
            border: '1px solid #7C3AED',
            borderRadius: 30,
            padding: '8px 12px',
            display: 'flex',
            gap: 8,
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            marginBottom: 8,
          }}>
            {REACTIONS.map(e => (
              <button
                key={e}
                onClick={() => onReact(e)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 24,
                  padding: 4,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MediaBubble({ item, isMine, onDownload }) {
  const url = `${SERVER_URL}${item.url}`
  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '6px 12px' }}>
      {!isMine && <img src={item.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, background: '#13131C' }} alt={item.username} />}
      <div style={{ maxWidth: '65%' }}>
        {!isMine && <div style={{ color: item.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{item.username}</div>}
        <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${isMine ? '#7C3AED' : '#1E1E2E'}` }}>
          <img src={url} alt="media" style={{ display: 'block', maxWidth: 240, maxHeight: 200, objectFit: 'cover' }} />
          <div style={{ background: '#0D0D14', padding: '5px 10px', fontSize: 10, color: '#6B6B85', display: 'flex', justifyContent: 'space-between' }}>
            <span>⏱ Expires in ~5 min</span>
            <button onClick={() => onDownload(url, item.filename)} style={msgStyles.downloadBtn}>⬇️ Download</button>
          </div>
        </div>
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{fmtTime(item.timestamp)}</div>
      </div>
    </div>
  )
}

function AudioBubble({ item, isMine, onDownload }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)
  const url = `${SERVER_URL}${item.url}`

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onloadedmetadata = () => {
        setDuration(audioRef.current.duration)
      }
      audioRef.current.ontimeupdate = () => {
        setCurrentTime(audioRef.current.currentTime)
      }
      audioRef.current.onended = () => {
        setPlaying(false)
        setCurrentTime(0)
      }
    }
  }, [])

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setPlaying(!playing)
    }
  }

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '6px 12px' }}>
      {!isMine && <img src={item.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} alt={item.username} />}
      <div style={{ maxWidth: '75%', minWidth: 200 }}>
        {!isMine && <div style={{ color: item.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{item.username}</div>}
        <div style={{
          background: isMine ? '#7C3AED' : '#13131C',
          borderRadius: 18,
          padding: '10px 14px',
          border: `1px solid ${isMine ? '#7C3AED' : '#1E1E2E'}`
        }}>
          <audio ref={audioRef} src={url} preload="metadata" />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={togglePlay}
              style={{
                background: isMine ? '#fff' : '#7C3AED',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                fontSize: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isMine ? '#7C3AED' : '#fff'
              }}
            >
              {playing ? '⏸️' : '▶️'}
            </button>
            
            <div style={{ flex: 1 }}>
              <div style={{
                height: 4,
                background: '#1E1E2E',
                borderRadius: 2,
                position: 'relative'
              }}>
                <div style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  height: 4,
                  background: '#7C3AED',
                  borderRadius: 2
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#6B6B85' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            <button
              onClick={() => onDownload(url, item.filename)}
              style={msgStyles.downloadBtn}
              title="Download"
            >
              ⬇️
            </button>
          </div>
          
          <div style={{ fontSize: 10, color: '#6B6B85', marginTop: 8 }}>
            🎵 {item.originalName || 'Audio file'} · {Math.round(item.size / 1024)} KB
          </div>
        </div>
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
          {fmtTime(item.timestamp)}
        </div>
      </div>
    </div>
  )
}

// Styles
const styles = {
  root: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050508', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#E8E8F0', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  iconBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, width: 40, height: 40, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all 0.1s ease' },
  idBar: { background: '#0D0D14', padding: '5px 14px', borderBottom: '1px solid #1E1E2E', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  tabs: { display: 'flex', gap: 4, padding: '8px 12px', background: '#0D0D14', borderBottom: '1px solid #1E1E2E', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  tab: { background: 'none', border: 'none', padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  feed: { flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8, WebkitOverflowScrolling: 'touch' },
  
  inputBar: { display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px', borderTop: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' },
  attachBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, width: 40, height: 40, fontSize: 24, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all 0.1s ease' },
  inputContainer: { flex: 1, position: 'relative' },
  textarea: { width: '100%', background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, padding: '10px 16px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', resize: 'none', maxHeight: 120, lineHeight: 1.4, overflowY: 'auto', transition: 'height 0.1s ease' },
  sendBtn: { background: '#7C3AED', border: 'none', borderRadius: 20, width: 44, height: 44, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  voiceBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, width: 44, height: 44, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all 0.1s ease' },
  
  attachmentMenu: { position: 'absolute', bottom: 50, left: 0, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '8px 0', zIndex: 100, minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
  attachmentItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'none', border: 'none', color: '#E8E8F0', cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit', fontSize: 14, transition: 'background 0.1s ease' },
  attachmentIcon: { fontSize: 18 },
  
  gifInputContainer: { marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' },
  gifInput: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, padding: '8px 12px', color: '#E8E8F0', fontSize: 14, outline: 'none' },
  gifCloseInline: { background: '#1E1E2E', border: 'none', borderRadius: 20, padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: 12 },
  gifPreviewGrid: { position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 12, padding: 8, marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, maxHeight: 200, overflowY: 'auto', zIndex: 100 },
  gifPreviewImage: { width: '100%', borderRadius: 8, cursor: 'pointer', transition: 'transform 0.1s ease' },
  
  recordingIndicator: { display: 'flex', alignItems: 'center', gap: 8, background: '#EF4444', borderRadius: 20, padding: '8px 16px', height: 44 },
  recordingPulse: { width: 12, height: 12, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' },
  recordingTime: { color: '#fff', fontSize: 14, fontWeight: 600 },
  cancelRecordBtn: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '4px' },
  
  shareMenu: { position: 'absolute', top: 50, right: 70, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 0', zIndex: 100 },
  shareMenuItem: { display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', color: '#E8E8F0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13 },
  replyBar: { background: '#13131C', margin: '4px 12px', padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid #7C3AED' },
  closeReplyBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 14, padding: '4px 8px' },
  
  mediaTab: { flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' },
  mediaSection: { marginBottom: 24 },
  mediaTitle: { color: '#E8E8F0', fontSize: 16, fontWeight: 600, marginBottom: 12 },
  mediaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  mediaItem: { background: '#13131C', borderRadius: 8, overflow: 'hidden' },
  mediaImage: { width: '100%', height: 120, objectFit: 'cover' },
  mediaInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, fontSize: 11, color: '#6B6B85' },
  audioList: { display: 'flex', flexDirection: 'column', gap: 8 },
  audioItem: { background: '#13131C', borderRadius: 8, padding: 12 },
  audioPlayer: { marginBottom: 8 },
  audioInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#E8E8F0' },
  
  membersTab: { flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' },
  memberCard: { display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#13131C', borderRadius: 12, marginBottom: 8 },
  adminBtn: { background: '#7C3AED20', border: '1px solid #7C3AED', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14 },
  kickBtn: { background: '#EF444420', border: '1px solid #EF4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14 },
  
  settingsTab: { flex: 1, overflowY: 'auto', padding: 16 },
  settingCard: { background: '#13131C', borderRadius: 12, padding: 20 },
  settingTitle: { color: '#E8E8F0', fontSize: 18, fontWeight: 600, marginBottom: 16 },
  settingItem: { marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#E8E8F0', fontSize: 14 },
  settingInput: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 12px', color: '#E8E8F0', width: 150 },
  settingSelect: { background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 12px', color: '#E8E8F0', width: 150 },
  saveBtn: { background: '#7C3AED', border: 'none', borderRadius: 8, padding: '12px', color: '#fff', fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 16 },
  downloadBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 14, padding: '4px 8px' },
}

const smallStyles = {
  smallAudioBtn: { background: '#7C3AED', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}

const msgStyles = {
  replyBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', opacity: 0.6 },
  downloadBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 14, padding: '4px 8px' },
}

// Add global styles
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
  }
  button:hover { opacity: 0.8; transform: scale(0.98); }
  button:active { transform: scale(0.95); }
  img { user-select: none; }
  textarea:focus { border-color: #7C3AED; }
  * { -webkit-tap-highlight-color: transparent; }
`
document.head.appendChild(styleSheet)