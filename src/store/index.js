import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUserStore = create(
  persist(
    (set) => ({
      username: '',
      avatar: '',
      userId: null,
      isLoggedIn: false,
      email: '',
      setUsername: (username) => set({
        username,
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}`
      }),
      setAvatar: (avatar) => set({ avatar }),
      setUser: (user) => set({ 
        username: user.username, 
        avatar: user.avatar, 
        userId: user.id, 
        isLoggedIn: true,
        email: user.email 
      }),
      logout: () => set({ username: '', avatar: '', userId: null, isLoggedIn: false, email: '' }),
    }),
    { name: 'theclub-user' }
  )
)

export const useClubStore = create((set) => ({
  currentClub: null,
  messages: [],
  media: [],
  voiceNotes: [],
  onlineUsers: [],
  typingUsers: [],
  sidePanelOpen: false,
  sidePanelTab: 'users',
  clubActivity: [],

  setClub: (c) => set({ currentClub: c }),
  clearClub: () => set({ currentClub: null, messages: [], media: [], voiceNotes: [], onlineUsers: [], typingUsers: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages.slice(-199), msg] })),
  setMedia: (media) => set({ media }),
  addMedia: (item) => set(s => ({ media: [...s.media.slice(-19), item] })),
  setVoiceNotes: (notes) => set({ voiceNotes: notes || [] }),
  addVoiceNote: (note) => set(s => ({ voiceNotes: [...(s.voiceNotes || []).slice(-19), note] })),
  setOnlineUsers: (users) => set({ onlineUsers: users || [] }),
  addTypingUser: ({ username, color, isTyping }) => set(s => {
    if (isTyping && !s.typingUsers.find(u => u.username === username))
      return { typingUsers: [...s.typingUsers, { username, color }] }
    if (!isTyping)
      return { typingUsers: s.typingUsers.filter(u => u.username !== username) }
    return s
  }),
  updateReaction: (messageId, reactions) => set(s => ({
    messages: s.messages.map(m => m.id === messageId ? { ...m, reactions } : m)
  })),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setSidePanelTab: (tab) => set({ sidePanelTab: tab }),
  addActivity: (activity) => set(s => ({ 
    clubActivity: [{ ...activity, timestamp: Date.now() }, ...(s.clubActivity || [])].slice(0, 50) 
  })),
  clearActivity: () => set({ clubActivity: [] }),
}))