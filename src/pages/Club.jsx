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
  const [audioFile, setAudioFile] = useState(null)
  const [audioPreview, setAudioPreview] = useState(null)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const fileRef = useRef(null)
  const audioFileRef = useRef(null)
  const socketRef = useRef(null)

  // Redirect to login if not logged in
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
    })
    socket.on('newMedia', addMedia)
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, media])

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

  // Handle image upload
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

  // Handle audio file upload
  const handleAudioChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) return alert('Audio file too large (max 20MB)')
    if (!file.type.startsWith('audio/')) return alert('Please upload an audio file')
    
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
    finally { setUploading(false); audioFileRef.current.value = '' }
  }

  // GIF search
  const searchGifs = async () => {
    if (!gifSearch.trim() || !GIPHY_API_KEY) return
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(gifSearch)}&limit=20&rating=pg-13`
      )
      const data = await response.json()
      setGifResults(data.data || [])
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

  const downloadMedia = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'media'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const feed = [
    ...(messages || []).map(m => ({ ...m, _kind: 'msg' })),
    ...(media || []).map(m => ({ ...m, _kind: 'media' })),
  ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

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
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <button onClick={() => { socketRef.current?.emit('leaveClub'); clearClub(); navigate('/') }} style={s.backBtn}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#E8E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentClub?.name || clubId}
          </div>
          <div style={{ color: '#22C55E', fontSize: 11, fontWeight: 600 }}>
            {onlineUsers?.length || 0} online
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShareMenuOpen(!shareMenuOpen)} style={s.iconBtn} title="Share Club">
            📎
          </button>
          {shareMenuOpen && (
            <div style={s.shareMenu}>
              <button onClick={copyShareLink} style={s.shareMenuItem}>📋 Copy Club Link</button>
              <button onClick={() => navigator.clipboard.writeText(clubId)} style={s.shareMenuItem}>🔑 Copy Club ID</button>
            </div>
          )}
          <button onClick={() => setSidePanelOpen && setSidePanelOpen(!sidePanelOpen)} style={{ ...s.iconBtn, color: sidePanelOpen ? '#7C3AED' : '#6B6B85' }}>
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
              const isAudio = item.mimetype?.startsWith('audio/')
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
                  onReply={() => setReplyingTo(item)}
                  currentUser={username}
                />
              )
            }
          })}
          
          {/* Reply indicator */}
          {replyingTo && (
            <div style={s.replyBar}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: '#7C3AED' }}>Replying to {replyingTo.username}</span>
                <div style={{ fontSize: 12, color: '#6B6B85' }}>
                  {replyingTo.text?.substring(0, 60)}
                </div>
              </div>
              <button onClick={() => setReplyingTo(null)} style={s.closeReplyBtn}>✕</button>
            </div>
          )}
          
          {typingUsers?.length > 0 && (
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
              <button onClick={() => setSidePanelTab && setSidePanelTab('users')} style={{ ...s.sidePanelTab, color: sidePanelTab === 'users' ? '#7C3AED' : '#6B6B85' }}>
                Users ({onlineUsers?.length || 0})
              </button>
            </div>
            <div style={s.usersList}>
              {(onlineUsers || []).map((u, i) => (
                <div key={i} style={s.userItem}>
                  <img src={u.avatar} width={32} height={32} style={{ borderRadius: '50%', background: '#13131C' }} alt={u.username} />
                  <span style={{ color: '#E8E8F0', fontSize: 13, fontWeight: 600, marginLeft: 10 }}>
                    {u.username}{u.username === currentClub?.host ? ' 👑' : ''}
                  </span>
                  <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div style={s.inputBar}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <input ref={audioFileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleAudioChange} />
        
        <button onClick={() => fileRef.current.click()} disabled={uploading} style={s.iconBtn} title="Share Image">
          {uploading ? <Spinner size={16} /> : '🖼️'}
        </button>
        
        <button onClick={() => audioFileRef.current.click()} disabled={uploading} style={s.iconBtn} title="Share Audio (max 20MB)">
          🎵
        </button>
        
        <button onClick={() => setShowGifPicker(!showGifPicker)} style={s.iconBtn} title="Search GIF">
          🎬
        </button>
        
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Say something…"}
          rows={1}
          maxLength={MAX_MSG_LEN}
          style={s.textarea}
        />
        
        <button onClick={sendMsg} disabled={!text.trim()} style={{ ...s.sendBtn, opacity: text.trim() ? 1 : 0.4 }}>
          ➤
        </button>
      </div>
      
      {/* GIF Picker Modal */}
      {showGifPicker && (
        <div style={s.gifModal}>
          <div style={s.gifModalContent}>
            <div style={s.gifSearchBar}>
              <input
                value={gifSearch}
                onChange={e => setGifSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchGifs()}
                placeholder="Search GIFs..."
                style={s.gifSearchInput}
                autoFocus
              />
              <button onClick={searchGifs} style={s.gifSearchBtn}>Search</button>
              <button onClick={() => setShowGifPicker(false)} style={s.gifCloseBtn}>✕</button>
            </div>
            <div style={s.gifResults}>
              {gifResults.map(gif => (
                <img
                  key={gif.id}
                  src={gif.images?.fixed_height_small?.url}
                  alt={gif.title}
                  onClick={() => sendGif(gif.images?.fixed_height?.url)}
                  style={s.gifImage}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                />
              ))}
              {gifResults.length === 0 && gifSearch && (
                <div style={{ textAlign: 'center', padding: 20, color: '#6B6B85' }}>
                  No GIFs found. Try another search term.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Message Bubble Component with Reply Support
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
        
        {/* Reply Preview */}
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
        
        {/* Main Message Content */}
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
        
        {/* Reactions */}
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
                  transition: 'all 0.1s ease'
                }}
              >
                {emoji} <span style={{ color: '#6B6B85', fontSize: 11 }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Message Footer */}
        <div style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 12, marginTop: 4 }}>
          <span style={{ color: '#6B6B85', fontSize: 10 }}>{fmtTime(msg.timestamp)}</span>
          <button 
            onClick={onReply} 
            style={s.replyBtn}
            title="Reply"
          >
            ↩️
          </button>
        </div>
        
        {/* Reaction Picker Popup */}
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
            backdropFilter: 'blur(10px)'
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
                  transition: 'transform 0.1s ease',
                  ':hover': { transform: 'scale(1.2)' }
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

// Media Bubble Component
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

// Audio Bubble Component for voice notes and audio files
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
                cursor: 'pointer',
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
              style={s.downloadBtn}
              title="Download"
            >
              ⬇️
            </button>
          </div>
          
          <div style={{ fontSize: 10, color: '#6B6B85', marginTop: 8 }}>
            🎵 Audio file · {Math.round(item.size / 1024)} KB
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
const s = {
  root: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050508', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#E8E8F0', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  iconBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, width: 40, height: 40, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', transition: 'all 0.1s ease' },
  idBar: { background: '#0D0D14', padding: '5px 14px', borderBottom: '1px solid #1E1E2E', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  feed: { flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 },
  inputBar: { display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px', borderTop: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  textarea: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, padding: '10px 16px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', resize: 'none', maxHeight: 100, lineHeight: 1.4, overflowY: 'auto' },
  sendBtn: { background: '#7C3AED', border: 'none', borderRadius: 20, width: 44, height: 44, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  sidePanel: { width: 280, borderLeft: '1px solid #1E1E2E', background: '#0D0D14', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  sidePanelHeader: { display: 'flex', borderBottom: '1px solid #1E1E2E', padding: '12px 16px', gap: 16 },
  sidePanelTab: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '8px 0' },
  usersList: { padding: 12, overflowY: 'auto' },
  userItem: { display: 'flex', alignItems: 'center', marginBottom: 12, padding: '8px', borderRadius: 8, background: '#13131C' },
  shareMenu: { position: 'absolute', top: 50, right: 70, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, padding: '8px 0', zIndex: 100 },
  shareMenuItem: { display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', color: '#E8E8F0', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13 },
  replyBar: { background: '#13131C', margin: '4px 12px', padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid #7C3AED' },
  closeReplyBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 14, padding: '4px 8px' },
  replyBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', opacity: 0.6, transition: 'opacity 0.1s ease' },
  downloadBtn: { background: 'none', border: 'none', color: '#6B6B85', cursor: 'pointer', fontSize: 14, padding: '4px 8px' },
  gifModal: { position: 'fixed', bottom: 80, left: 20, right: 20, background: '#0D0D14', border: '1px solid #1E1E2E', borderRadius: 16, zIndex: 1000, maxHeight: 500, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  gifModalContent: { display: 'flex', flexDirection: 'column', height: '100%' },
  gifSearchBar: { display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #1E1E2E' },
  gifSearchInput: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, padding: '10px 12px', color: '#E8E8F0', outline: 'none' },
  gifSearchBtn: { background: '#7C3AED', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', cursor: 'pointer' },
  gifCloseBtn: { background: '#1E1E2E', border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff', cursor: 'pointer' },
  gifResults: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, padding: 12, overflowY: 'auto', maxHeight: 380 },
  gifImage: { width: '100%', borderRadius: 8, cursor: 'pointer', transition: 'transform 0.1s ease' },
}

// Add hover styles
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  button:hover { opacity: 0.8; transform: scale(0.98); }
  button:active { transform: scale(0.95); }
  img { user-select: none; }
  textarea:focus { border-color: #7C3AED; }
`
document.head.appendChild(styleSheet)