import { create } from 'zustand';

const AVATAR_SEEDS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'theta', 'kappa', 'sigma', 'omega'];

function generateAvatar(username) {
  return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(username)}&backgroundColor=transparent`;
}

export const useUserStore = create((set, get) => ({
  username: '',
  avatar: '',
  socketId: null,

  setUsername: (username) => {
    const avatar = generateAvatar(username);
    set({ username, avatar });
  },
  setSocketId: (id) => set({ socketId: id }),
  setAvatar: (url) => set({ avatar: url }),

  randomizeAvatar: () => {
    const seed = AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)] + Math.random();
    const avatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}&backgroundColor=transparent`;
    set({ avatar });
  },
}));

export const useClubStore = create((set, get) => ({
  currentClub: null,   // { id, name, type, host, userCount, users, createdAt }
  messages: [],
  media: [],
  onlineUsers: [],
  typingUsers: [],

  setClub: (club) => set({ currentClub: club }),
  clearClub: () => set({ currentClub: null, messages: [], media: [], onlineUsers: [], typingUsers: [] }),

  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set(s => ({ messages: [...s.messages.slice(-199), msg] })),

  setMedia: (media) => set({ media }),
  addMedia: (item) => set(s => ({ media: [...s.media.slice(-19), item] })),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  addTypingUser: (data) => set(s => {
    const exists = s.typingUsers.find(u => u.username === data.username);
    if (data.isTyping && !exists) return { typingUsers: [...s.typingUsers, data] };
    if (!data.isTyping) return { typingUsers: s.typingUsers.filter(u => u.username !== data.username) };
    return s;
  }),

  updateMessageReaction: (messageId, reactions) => set(s => ({
    messages: s.messages.map(m => m.id === messageId ? { ...m, reactions } : m),
  })),
}));
