import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUserStore = create(
  persist(
    (set) => ({
      username: '',
      avatar: '',
      setUsername: (username) => set({
        username,
        avatar: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}`
      }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    { name: 'theclub-user' }
  )
)

export const useClubStore = create((set) => ({
  currentClub: null,
  messages: [],
  media: [],
  onlineUsers: [],
  typingUsers: [],

  setClub: (c) => set({ currentClub: c }),
  clearClub: () => set({ currentClub: null, messages: [], media: [], onlineUsers: [], typingUsers: [] }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages.slice(-199), msg] })),
  setMedia: (media) => set({ media }),
  addMedia: (item) => set(s => ({ media: [...s.media.slice(-19), item] })),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
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
}))
