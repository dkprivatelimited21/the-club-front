import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore, useClubStore } from '../store/index.js'
import { getSocket } from '../utils/socket.js'
import { API_URL, SERVER_URL, MAX_MSG_LEN, GIPHY_API_KEY } from '../utils/config.js'

const REACTIONS = ['❤️','😂','🔥','👍','😮','💯','😈','✨']

export default function Club() {
  const { clubId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { username, avatar, userId, isLoggedIn } = useUserStore()
  const {
    currentClub, messages, media, voiceNotes, onlineUsers, typingUsers, sidePanelOpen, sidePanelTab,
    setClub, clearClub, addMessage, setMessages, addMedia, setMedia, addVoiceNote, setVoiceNotes,
    setOnlineUsers, addTypingUser, updateReaction, setSidePanelOpen, setSidePanelTab, addActivity, clearActivity,
  } = useClubStore()

  const pin = location.state?.pin
  const [text, setText] = useState('')
  const [status, setStatus] = useState('joining')
  const [errMsg, setErrMsg] = useState('')
  const [showReactFor, setShowReactFor] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [gifSearch, setGifSearch] = useState('')
  const [gifResults, setGifResults] = useState([])
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const fileRef = useRef(null)
  const socketRef = useRef(null)

  // Redirect to login if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login', { state: { next: `/club/${clubId}` } })
    }
  }, [isLoggedIn, navigate, clubId])

  useEffect(() => {
    if (!isLoggedIn) return
    
    const socket = getSocket()
    socketRef.current = socket

    socket.on('newMessage', (msg) => {
      addMessage(msg)
      addActivity({ username: msg.username, action: 'sent a message' })
    })
    socket.on('newMedia', addMedia)
    socket.on('newVoiceNote', addVoiceNote)
    socket.on('newLink', (link) => addMessage({ ...link, type: 'link' }))
    socket.on('newGif', (gif) => addMessage({ ...gif, type: 'gif' }))
    socket.on('userJoined', ({ user, users }) => {
      setOnlineUsers(users || [])
      if (user.username !== username) {
        addMessage({ id: crypto.randomUUID(), type: 'system', text: `${user.username} joined 👋`, timestamp: Date.now() })
        addActivity({ username: user.username, action: 'joined the club' })
      }
    })
    socket.on('userLeft', ({ username: u, users }) => {
      setOnlineUsers(users || [])
      addMessage({ id: crypto.randomUUID(), type: 'system', text: `${u} left`, timestamp: Date.now() })
      addActivity({ username: u, action: 'left the club' })
    })
    socket.on('usersUpdate', ({ users }) => setOnlineUsers(users || []))
    socket.on('userTyping', addTypingUser)
    socket.on('messageReaction', ({ messageId, reactions }) => updateReaction(messageId, reactions))
    socket.on('messageDeleted', ({ messageId }) => {
      // Remove from messages
      setMessages(prev => prev.filter(m => m.id !== messageId))
    })
    socket.on('kicked', ({ message }) => {
      alert(message)
      navigate('/')
    })
    socket.on('adminPromoted', ({ username }) => {
      addMessage({ id: crypto.randomUUID(), type: 'system', text: `${username} is now an admin!`, timestamp: Date.now() })
    })
    socket.on('disconnect', () => addMessage({ id: crypto.randomUUID(), type: 'system', text: '⚠️ Connection lost. Reconnecting…', timestamp: Date.now() }))

    socket.emit('joinClub', { clubId, pin, username, avatar, userId }, res => {
      if (res.error) { setStatus('error'); setErrMsg(res.error); return }
      setStatus('joined')
      setClub(res.club)
      setMessages(res.recentMessages || [])
      setMedia(res.recentMedia || [])
      setVoiceNotes(res.recentVoice || [])
      setOnlineUsers(res.club.users || [])
      clearActivity()
    })

    return () => {
      socket.off('newMessage')
      socket.off('newMedia')
      socket.off('newVoiceNote')
      socket.off('newLink')
      socket.off('newGif')
      socket.off('userJoined')
      socket.off('userLeft')
      socket.off('usersUpdate')
      socket.off('userTyping')
      socket.off('messageReaction')
      socket.off('messageDeleted')
      socket.off('kicked')
      socket.off('adminPromoted')
      socket.off('disconnect')
      socket.emit('leaveClub')
      clearClub()
    }
  }, [isLoggedIn])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, media, voiceNotes])

  const sendMsg = useCallback(() => {
    const t = text.trim()
    if (!t || t.length > MAX_MSG_LEN) return
    socketRef.current.emit('sendMessage', { text: t, replyTo: replyingTo?.id })
    setText('')
    setReplyingTo(null)
    emitTyping(false)
  }, [text, replyingTo])

  const emitTyping = (v) => {
    socketRef.current?.emit('typing', { isTyping: v })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  const handleTyping = (v) => {
    setText(v)
    emitTyping(true)
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => emitTyping(false), 2000)
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
    if (file.size > 10 * 1024 * 1024) return alert('File too large (max 10MB)')
    setUploading(true)
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
          socketRef.current.emit('sendVoiceNote', { audioData, duration: 0 })
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (err) {
      alert('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
    }
  }

  const searchGifs = async () => {
    if (!gifSearch.trim()) return
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifSearch)}&limit=20&rating=pg-13`
      )
      const data = await response.json()
      setGifResults(data.data)
    } catch (err) {
      console.error('GIF search failed')
    }
  }

  const sendGif = (gifUrl) => {
    socketRef.current.emit('sendGif', { gifUrl })
    setShowGifPicker(false)
    setGifSearch('')
    setGifResults([])
  }

  const flagMessage = (messageId) => {
    const reason = prompt('Reason for flagging:')
    if (reason) {
      socketRef.current.emit('flagMessage', { messageId, reason })
    }
  }

  const kickUser = (username) => {
    if (confirm(`Kick ${username} from the club?`)) {
      socketRef.current.emit('kickUser', { targetUsername: username })
    }
  }

  const promoteAdmin = (username) => {
    if (confirm(`Promote ${username} to admin?`)) {
      socketRef.current.emit('promoteAdmin', { targetUsername: username })
    }
  }

  const downloadMedia = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const feed = [
    ...messages.map(m => ({ ...m, _kind: 'msg' })),
    ...media.map(m => ({ ...m, _kind: 'media' })),
    ...voiceNotes.map(v => ({ ...v, _kind: 'voice' })),
  ].sort((a, b) => a.timestamp - b.timestamp)

  if (!isLoggedIn) return null
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
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={() => { socketRef.current?.emit('leaveClub'); clearClub(); navigate('/') }} style={s.backBtn}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#E8E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentClub?.name || clubId}
          </div>
          <div style={{ color: '#22C55E', fontSize: 11, fontWeight: 600 }}>
            {onlineUsers.length} online
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShareMenuOpen(!shareMenuOpen)} style={s.iconBtn} title="Share Club">
            📎
          </button>
          {shareMenuOpen && (
            <div style={s.shareMenu}>
              <button onClick={copyShareLink} style={s.shareMenuItem}>
                📋 Copy Club Link
              </button>
              <button onClick={() => navigator.clipboard.writeText(clubId)} style={s.shareMenuItem}>
                🔑 Copy Club ID
              </button>
            </div>
          )}
          <button onClick={() => setSidePanelOpen(!sidePanelOpen)} style={{ ...s.iconBtn, color: sidePanelOpen ? '#7C3AED' : '#6B6B85' }}>
            ☰
          </button>
        </div>
      </div>

      {/* Club ID bar */}
      <div style={s.idBar}>
        <span style={{ color: '#6B6B85', fontSize: 11 }}>ID: </span>
        <span style={{ color: '#9F67FF', fontSize: 11, fontWeight: 700, letterSpacing: '2px', fontFamily: 'JetBrains Mono, monospace' }}>{clubId}</span>
        {currentClub?.type === 'hidden' && <span style={{ fontSize: 11 }}>🔒</span>}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Feed */}
        <div style={s.feed} onClick={() => { setShowReactFor(null); setReplyingTo(null) }}>
          {feed.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#6B6B85' }}>
              <div style={{ fontSize: 44 }}>🎭</div>
              <p style={{ marginTop: 12 }}>Club is open! Say something…</p>
              <p style={{ fontSize: 11, marginTop: 6, color: '#4C1D95' }}>Messages disappear after 10 minutes</p>
            </div>
          )}
          {feed.map(item => {
            if (item._kind === 'media') {
              return <MediaBubble key={item.id} item={item} isMine={item.username === username} onDownload={downloadMedia} />
            } else if (item._kind === 'voice') {
              return <VoiceBubble key={item.id} item={item} isMine={item.username === username} />
            } else {
              return (
                <MessageBubble
                  key={item.id}
                  msg={item}
                  isMine={item.username === username}
                  showReactFor={showReactFor === item.id}
                  onLongPress={() => setShowReactFor(item.id)}
                  onReact={emoji => handleReact(item.id, emoji)}
                  onReply={() => setReplyingTo(item)}
                  onFlag={() => flagMessage(item.id)}
                  isAdmin={currentClub?.admins?.includes(username)}
                  onKick={item.username !== username ? () => kickUser(item.username) : null}
                  onPromote={currentClub?.host === username && !currentClub?.admins?.includes(item.username) ? () => promoteAdmin(item.username) : null}
                />
              )
            }
          })}
          {replyingTo && (
            <div style={s.replyBar}>
              <span>Replying to: {replyingTo.text?.substring(0, 50)}</span>
              <button onClick={() => setReplyingTo(null)}>✕</button>
            </div>
          )}
          {typingUsers.length > 0 && (
            <div style={{ padding: '4px 12px', color: '#6B6B85', fontSize: 12 }}>
              {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Side Panel */}
        {sidePanelOpen && (
          <div style={s.sidePanel}>
            <div style={s.sidePanelHeader}>
              <button onClick={() => setSidePanelTab('users')} style={{ ...s.sidePanelTab, color: sidePanelTab === 'users' ? '#7C3AED' : '#6B6B85' }}>Users</button>
              <button onClick={() => setSidePanelTab('activity')} style={{ ...s.sidePanelTab, color: sidePanelTab === 'activity' ? '#7C3AED' : '#6B6B85' }}>Activity</button>
              {currentClub?.host === username && (
                <button onClick={() => setSidePanelTab('settings')} style={{ ...s.sidePanelTab, color: sidePanelTab === 'settings' ? '#7C3AED' : '#6B6B85' }}>Settings</button>
              )}
            </div>
            
            {sidePanelTab === 'users' && (
              <div style={s.usersList}>
                {onlineUsers.map((u, i) => (
                  <div key={i} style={s.userItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <img src={u.avatar} width={32} height={32} style={{ borderRadius: '50%', background: '#13131C' }} alt={u.username} />
                      <span style={{ color: '#E8E8F0', fontSize: 13, fontWeight: 600 }}>
                        {u.username}{u.isAdmin ? ' 👑' : ''}
                      </span>
                    </div>
                    {currentClub?.host === username && u.username !== username && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!u.isAdmin && <button onClick={() => promoteAdmin(u.username)} style={s.userActionBtn} title="Make Admin">👑</button>}
                        <button onClick={() => kickUser(u.username)} style={s.userActionBtn} title="Kick">🚫</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {sidePanelTab === 'activity' && (
              <div style={s.activityList}>
                {useClubStore.getState().clubActivity.map((act, i) => (
                  <div key={i} style={s.activityItem}>
                    <span style={{ color: '#9F67FF', fontWeight: 600 }}>{act.username}</span>
                    <span style={{ color: '#6B6B85' }}> {act.action}</span>
                    <span style={{ color: '#4C1D95', fontSize: 10, marginLeft: 8 }}>
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {sidePanelTab === 'settings' && currentClub?.host === username && (
              <div style={s.settingsPanel}>
                <label style={s.settingItem}>
                  <span>Slow Mode (seconds)</span>
                  <input type="number" min="0" max="60" defaultValue={currentClub?.settings?.slowMode || 0} 
                    onChange={(e) => {/* Implement setting update */}} />
                </label>
                <label style={s.settingItem}>
                  <span>Max Members</span>
                  <input type="number" min="1" max="500" defaultValue={currentClub?.settings?.maxMembers || 100} />
                </label>
                <label style={s.settingItem}>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowMedia !== false} />
                  <span>Allow Media Uploads</span>
                </label>
                <label style={s.settingItem}>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowVoiceNotes !== false} />
                  <span>Allow Voice Notes</span>
                </label>
                <label style={s.settingItem}>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.allowLinks !== false} />
                  <span>Allow Links</span>
                </label>
                <label style={s.settingItem}>
                  <input type="checkbox" defaultChecked={currentClub?.settings?.profanityFilter !== false} />
                  <span>Profanity Filter</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={s.inputBar}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <button onClick={() => fileRef.current.click()} disabled={uploading} style={{ ...s.iconBtn, flexShrink: 0 }} title="Share image">
          {uploading ? <Spinner size={16} /> : '🖼'}
        </button>
        <button onClick={recording ? stopRecording : startRecording} style={{ ...s.iconBtn, flexShrink: 0, color: recording ? '#EF4444' : '#7C3AED' }}>
          {recording ? '⏹️' : '🎤'}
        </button>
        <button onClick={() => setShowGifPicker(!showGifPicker)} style={{ ...s.iconBtn, flexShrink: 0 }}>🎬</button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? `Replying to ${replyingTo.username}...` : "Say something…"}
          rows={1}
          maxLength={MAX_MSG_LEN}
          style={s.textarea}
        />
        <button onClick={sendMsg} disabled={!text.trim()} style={{ ...s.sendBtn, opacity: text.trim() ? 1 : 0.4, flexShrink: 0 }}>
          ➤
        </button>
      </div>
      
      {/* GIF Picker */}
      {showGifPicker && (
        <div style={s.gifPicker}>
          <div style={s.gifSearchBar}>
            <input
              value={gifSearch}
              onChange={e => setGifSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchGifs()}
              placeholder="Search GIFs..."
              style={s.gifSearchInput}
            />
            <button onClick={searchGifs} style={s.gifSearchBtn}>Search</button>
            <button onClick={() => setShowGifPicker(false)} style={s.gifCloseBtn}>✕</button>
          </div>
          <div style={s.gifResults}>
            {gifResults.map(gif => (
              <img
                key={gif.id}
                src={gif.images.fixed_height_small.url}
                alt={gif.title}
                onClick={() => sendGif(gif.images.fixed_height.url)}
                style={s.gifImage}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Message Bubble (updated with reply and admin actions) ───────────────────────────────────
function MessageBubble({ msg, isMine, showReactFor, onLongPress, onReact, onReply, onFlag, isAdmin, onKick, onPromote }) {
  if (msg.type === 'system') return (
    <div style={{ textAlign: 'center', margin: '6px 0' }}>
      <span style={{ background: '#0D0D14', color: '#6B6B85', fontSize: 11, padding: '3px 12px', borderRadius: 10 }}>{msg.text}</span>
    </div>
  )

  const reactions = msg.reactions ? Object.entries(msg.reactions).filter(([, u]) => u.length > 0) : []
  const isLink = msg.type === 'link'
  const isGif = msg.type === 'gif'

  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '3px 12px', position: 'relative' }}>
      {!isMine && <img src={msg.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, marginBottom: 2, background: '#13131C' }} alt={msg.username} />}
      <div style={{ maxWidth: '72%' }}>
        {!isMine && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ color: msg.color || '#9F67FF', fontSize: 11, fontWeight: 700 }}>{msg.username}</span>
            {isAdmin && msg.username !== 'system' && (
              <div style={{ display: 'flex', gap: 4 }}>
                {onKick && <button onClick={onKick} style={s.adminActionBtn} title="Kick">🚫</button>}
                {onPromote && <button onClick={onPromote} style={s.adminActionBtn} title="Make Admin">👑</button>}
              </div>
            )}
          </div>
        )}
        {msg.replyTo && (
          <div style={s.replyPreview}>
            ↳ {msg.replyTo.text?.substring(0, 40)}
          </div>
        )}
        <div
          onContextMenu={e => { e.preventDefault(); onLongPress() }}
          onDoubleClick={onLongPress}
          style={{
            background: isMine ? '#7C3AED' : '#13131C',
            color: isMine ? '#fff' : '#E8E8F0',
            borderRadius: 18,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            padding: isLink || isGif ? '6px 10px' : '10px 14px',
            fontSize: 15,
            lineHeight: 1.4,
            border: isMine ? 'none' : '1px solid #1E1E2E',
            cursor: 'default',
            wordBreak: 'break-word',
          }}
        >
          {isLink ? (
            <a href={msg.url} target="_blank" rel="noopener noreferrer" style={{ color: isMine ? '#fff' : '#9F67FF', textDecoration: 'underline' }}>
              🔗 {msg.title || msg.url}
            </a>
          ) : isGif ? (
            <img src={msg.url} alt="gif" style={{ maxWidth: '100%', borderRadius: 8 }} />
          ) : (
            msg.text
          )}
        </div>
        {reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {reactions.map(([emoji, users]) => (
              <button key={emoji} onClick={() => onReact(emoji)} style={{ background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 10, padding: '2px 7px', cursor: 'pointer', fontSize: 12, display: 'flex', gap: 4, fontFamily: 'inherit' }}>
                {emoji} <span style={{ color: '#6B6B85', fontSize: 11 }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 8, marginTop: 4 }}>
          <span style={{ color: '#6B6B85', fontSize: 10 }}>{fmtTime(msg.timestamp)}</span>
          <button onClick={onReply} style={s.replyBtn} title="Reply">↩️</button>
          <button onClick={onFlag} style={s.flagBtn} title="Flag">⚠️</button>
        </div>
        {showReactFor && (
          <div style={{ position: 'absolute', bottom: '100%', [isMine ? 'right' : 'left']: 0, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, padding: '8px 10px', display: 'flex', gap: 6, zIndex: 99, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {REACTIONS.map(e => <button key={e} onClick={() => onReact(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 2 }}>{e}</button>)}
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
            <button onClick={() => onDownload(url, item.filename)} style={s.downloadBtn}>⬇️ Download</button>
          </div>
        </div>
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{fmtTime(item.timestamp)}</div>
      </div>
    </div>
  )
}

function VoiceBubble({ item, isMine }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)
  
  const playAudio = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
        setPlaying(false)
      } else {
        audioRef.current.play()
        setPlaying(true)
      }
    }
  }
  
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setPlaying(false)
    }
  }, [])
  
  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '6px 12px' }}>
      {!isMine && <img src={item.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0 }} alt={item.username} />}
      <div style={{ maxWidth: '65%' }}>
        {!isMine && <div style={{ color: item.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{item.username}</div>}
        <div style={{ background: '#13131C', borderRadius: 18, padding: '8px 14px', border: `1px solid ${isMine ? '#7C3AED' : '#1E1E2E'}` }}>
          <button onClick={playAudio} style={s.voiceBtn}>
            {playing ? '⏸️' : '▶️'} Voice Note ({item.duration || '~5s'})
          </button>
          <audio ref={audioRef} src={`data:audio/webm;base64,${item.audioData}`} />
        </div>
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4 }}>{fmtTime(item.timestamp)}</div>
      </div>
    </div>
  )
}

// Styles (updated)
const s = {
  root: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050508', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#E8E8F0', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  iconBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  idBar: { background: '#0D0D14', padding: '5px 14px', borderBottom: '1px solid #1E1E2E', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  feed: { flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 },
  inputBar: { display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px', borderTop: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  textarea: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '10px 14px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', resize: 'none', maxHeight: 100, lineHeight: 1.4, overflowY: 'auto' },
  sendBtn: { background: '#7C3AED', border: 'none', borderRadius: 10, width: 40, height: 40, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  sidePanel: { width: 280, borderLeft: '1px solid #1E1E2E', background: '#0D0D14', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  sidePanelHeader: { display: 'flex', borderBottom: '1px solid #1E1E2E', padding: '8px 12px', gap: 16 },
  sidePanelTab: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '8px 0' },
  usersList: { padding: 12, overflowY: 'auto' },
  userItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '4px 8px', borderRadius: 8, background: '#13131C' },
  userActionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },
  activityList: { padding: 12, overflowY: 'auto' },
  activityItem: { padding: '6px 0', borderBottom: '1px solid #1E1E2E', fontSize: 12 },
  settingsPanel: { padding: 12 },
  settingItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 },
  shareMenu: { position: 'absolute', top: 50, right: 70, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 0', zIndex: 100 },
  shareMenuItem: { display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', color: '#E8E8F0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13 },
  replyBar: { background: '#13131C', padding: '8px 12px', margin: '4px 12px', borderRadius: 8, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  replyPreview: { fontSize: 10, color: '#6B6B85', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #7C3AED' },
  replyBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 },
  flagBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 },
  adminActionBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.6 },
  voiceBtn: { background: 'none', border: 'none', color: '#9F67FF', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 },
  downloadBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 10 },
  gifPicker: { position: 'absolute', bottom: 80, left: 60, right: 60, background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 12, padding: 12, zIndex: 100, maxHeight: 400, overflow: 'auto' },
  gifSearchBar: { display: 'flex', gap: 8, marginBottom: 12 },
  gifSearchInput: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 12px', color: '#E8E8F0' },
  gifSearchBtn: { background: '#7C3AED', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', cursor: 'pointer' },
  gifCloseBtn: { background: '#1E1E2E', border: 'none', borderRadius: 8, padding: '8px 12px', color: '#fff', cursor: 'pointer' },
  gifResults: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 },
  gifImage: { width: '100%', borderRadius: 8, cursor: 'pointer' },
}