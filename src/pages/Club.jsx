import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore, useClubStore } from '../store/index.js'
import { getSocket } from '../utils/socket.js'
import { API_URL, SERVER_URL, MAX_MSG_LEN } from '../utils/config.js'

const REACTIONS = ['❤️','😂','🔥','👍','😮','💯','😈','✨']

export default function Club() {
  const { clubId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { username, avatar } = useUserStore()
  const {
    currentClub, messages, media, onlineUsers, typingUsers,
    setClub, clearClub, addMessage, setMessages, addMedia, setMedia,
    setOnlineUsers, addTypingUser, updateReaction,
  } = useClubStore()

  const pin = location.state?.pin
  const [text, setText] = useState('')
  const [status, setStatus] = useState('joining') // joining | joined | error
  const [errMsg, setErrMsg] = useState('')
  const [showUsers, setShowUsers] = useState(false)
  const [showReactFor, setShowReactFor] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimer = useRef(null)
  const fileRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!username) return navigate('/profile', { state: { next: `/club/${clubId}` } })
    const socket = getSocket()
    socketRef.current = socket

    socket.on('newMessage', addMessage)
    socket.on('newMedia', addMedia)
    socket.on('userJoined', ({ user, users }) => {
      setOnlineUsers(users || [])
      if (user.username !== username) addMessage({ id: crypto.randomUUID(), type: 'system', text: `${user.username} joined 👋`, timestamp: Date.now() })
    })
    socket.on('userLeft', ({ username: u, users }) => {
      setOnlineUsers(users || [])
      addMessage({ id: crypto.randomUUID(), type: 'system', text: `${u} left`, timestamp: Date.now() })
    })
    socket.on('usersUpdate', ({ users }) => setOnlineUsers(users || []))
    socket.on('userTyping', addTypingUser)
    socket.on('messageReaction', ({ messageId, reactions }) => updateReaction(messageId, reactions))
    socket.on('disconnect', () => addMessage({ id: crypto.randomUUID(), type: 'system', text: '⚠️ Connection lost. Reconnecting…', timestamp: Date.now() }))

    socket.emit('joinClub', { clubId, pin, username, avatar }, res => {
      if (res.error) { setStatus('error'); setErrMsg(res.error); return }
      setStatus('joined')
      setClub(res.club)
      setMessages(res.recentMessages || [])
      setMedia(res.recentMedia || [])
      setOnlineUsers(res.club.users || [])
    })

    return () => {
      socket.off('newMessage', addMessage)
      socket.off('newMedia', addMedia)
      socket.off('userJoined')
      socket.off('userLeft')
      socket.off('usersUpdate')
      socket.off('userTyping', addTypingUser)
      socket.off('messageReaction')
      socket.off('disconnect')
      socket.emit('leaveClub')
      clearClub()
    }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, media])

  const sendMsg = useCallback(() => {
    const t = text.trim()
    if (!t || t.length > MAX_MSG_LEN) return
    socketRef.current.emit('sendMessage', { text: t })
    setText('')
    emitTyping(false)
  }, [text])

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

  const copyId = () => {
    navigator.clipboard.writeText(clubId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  // Combine messages + media sorted by timestamp
  const feed = [
    ...messages.map(m => ({ ...m, _kind: 'msg' })),
    ...media.map(m => ({ ...m, _kind: 'media' })),
  ].sort((a, b) => a.timestamp - b.timestamp)

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
          <button onClick={copyId} style={{ ...s.iconBtn, color: copied ? '#22C55E' : '#6B6B85' }} title="Copy Club ID">
            {copied ? '✓' : '⧉'}
          </button>
          <button onClick={() => setShowUsers(v => !v)} style={{ ...s.iconBtn, color: showUsers ? '#7C3AED' : '#6B6B85' }}>
            👥
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
        <div style={s.feed} onClick={() => setShowReactFor(null)}>
          {feed.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 60, color: '#6B6B85' }}>
              <div style={{ fontSize: 44 }}>🎭</div>
              <p style={{ marginTop: 12 }}>Club is open! Say something…</p>
              <p style={{ fontSize: 11, marginTop: 6, color: '#4C1D95' }}>Messages disappear after 10 minutes</p>
            </div>
          )}
          {feed.map(item => item._kind === 'media'
            ? <MediaBubble key={item.id} item={item} isMine={item.username === username} />
            : <MessageBubble
                key={item.id}
                msg={item}
                isMine={item.username === username}
                showReactFor={showReactFor === item.id}
                onLongPress={() => setShowReactFor(item.id)}
                onReact={emoji => handleReact(item.id, emoji)}
              />
          )}
          {typingUsers.length > 0 && (
            <div style={{ padding: '4px 12px', color: '#6B6B85', fontSize: 12 }}>
              {typingUsers.map(u => u.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Users panel */}
        {showUsers && (
          <div style={s.usersPanel}>
            <div style={{ color: '#6B6B85', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>
              Online — {onlineUsers.length}
            </div>
            {onlineUsers.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={u.avatar} width={32} height={32} style={{ borderRadius: '50%', background: '#13131C' }} alt={u.username} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#22C55E', border: '1.5px solid #0D0D14' }} />
                </div>
                <span style={{ color: '#E8E8F0', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.username}{u.username === currentClub?.host ? ' 👑' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={s.inputBar}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current.click()}
          disabled={uploading}
          style={{ ...s.iconBtn, flexShrink: 0, color: '#7C3AED', border: '1px solid #1E1E2E', borderRadius: 10 }}
          title="Share image"
        >
          {uploading ? <Spinner size={16} /> : '🖼'}
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => handleTyping(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something…"
          rows={1}
          maxLength={MAX_MSG_LEN}
          style={s.textarea}
        />
        <button
          onClick={sendMsg}
          disabled={!text.trim()}
          style={{ ...s.sendBtn, opacity: text.trim() ? 1 : 0.4, flexShrink: 0 }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine, showReactFor, onLongPress, onReact }) {
  if (msg.type === 'system') return (
    <div style={{ textAlign: 'center', margin: '6px 0' }}>
      <span style={{ background: '#0D0D14', color: '#6B6B85', fontSize: 11, padding: '3px 12px', borderRadius: 10 }}>{msg.text}</span>
    </div>
  )

  const reactions = msg.reactions ? Object.entries(msg.reactions).filter(([, u]) => u.length > 0) : []

  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '3px 12px', position: 'relative' }}>
      {!isMine && <img src={msg.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, marginBottom: 2, background: '#13131C' }} alt={msg.username} />}
      <div style={{ maxWidth: '72%' }}>
        {!isMine && <div style={{ color: msg.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{msg.username}</div>}
        <div
          onContextMenu={e => { e.preventDefault(); onLongPress() }}
          onDoubleClick={onLongPress}
          style={{
            background: isMine ? '#7C3AED' : '#13131C',
            color: isMine ? '#fff' : '#E8E8F0',
            borderRadius: 18,
            borderBottomRightRadius: isMine ? 4 : 18,
            borderBottomLeftRadius: isMine ? 18 : 4,
            padding: '10px 14px',
            fontSize: 15,
            lineHeight: 1.4,
            border: isMine ? 'none' : '1px solid #1E1E2E',
            cursor: 'default',
            wordBreak: 'break-word',
          }}
        >
          {msg.text}
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
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{fmtTime(msg.timestamp)}</div>
        {showReactFor && (
          <div style={{ position: 'absolute', bottom: '100%', [isMine ? 'right' : 'left']: 0, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 20, padding: '8px 10px', display: 'flex', gap: 6, zIndex: 99, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
            {REACTIONS.map(e => <button key={e} onClick={() => onReact(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 2 }}>{e}</button>)}
          </div>
        )}
      </div>
    </div>
  )
}

function MediaBubble({ item, isMine }) {
  const url = `${SERVER_URL}${item.url}`
  return (
    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, margin: '6px 12px' }}>
      {!isMine && <img src={item.avatar} width={28} height={28} style={{ borderRadius: '50%', flexShrink: 0, background: '#13131C' }} alt={item.username} />}
      <div style={{ maxWidth: '65%' }}>
        {!isMine && <div style={{ color: item.color || '#9F67FF', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>{item.username}</div>}
        <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${isMine ? '#7C3AED' : '#1E1E2E'}` }}>
          <img src={url} alt="media" style={{ display: 'block', maxWidth: 240, maxHeight: 200, objectFit: 'cover' }} />
          <div style={{ background: '#0D0D14', padding: '5px 10px', fontSize: 10, color: '#6B6B85' }}>⏱ Expires in ~5 min</div>
        </div>
        <div style={{ color: '#6B6B85', fontSize: 10, marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{fmtTime(item.timestamp)}</div>
      </div>
    </div>
  )
}

function CenteredMsg({ children }) {
  return <div style={{ minHeight: '100vh', background: '#050508', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>{children}</div>
}

function Spinner({ size = 26 }) {
  return <div style={{ width: size, height: size, border: `3px solid #1E1E2E`, borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const s = {
  root: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#050508', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#E8E8F0', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit', padding: 4 },
  iconBtn: { background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  idBar: { background: '#0D0D14', padding: '5px 14px', borderBottom: '1px solid #1E1E2E', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  feed: { flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 },
  usersPanel: { width: 210, borderLeft: '1px solid #1E1E2E', background: '#0D0D14', padding: 16, overflowY: 'auto', flexShrink: 0 },
  inputBar: { display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px', borderTop: '1px solid #1E1E2E', background: '#0D0D14', flexShrink: 0 },
  textarea: { flex: 1, background: '#13131C', border: '1px solid #1E1E2E', borderRadius: 12, padding: '10px 14px', color: '#E8E8F0', fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', resize: 'none', maxHeight: 100, lineHeight: 1.4, overflowY: 'auto' },
  sendBtn: { background: '#7C3AED', border: 'none', borderRadius: 10, width: 40, height: 40, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
}
