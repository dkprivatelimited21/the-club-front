import { io } from 'socket.io-client'
import { SERVER_URL } from './config.js'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    })
    socket.on('connect', () => console.log('[Socket] connected', socket.id))
    socket.on('disconnect', r => console.log('[Socket] disconnected', r))
    socket.on('connect_error', e => console.error('[Socket] error', e.message))
  }
  return socket
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null }
}
