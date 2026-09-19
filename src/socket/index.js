import { Server } from 'socket.io'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Conversation from '../models/Conversation.js'

let io = null

export function initSocket(httpServer, { corsOrigin, sessionMiddleware }) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  })

  // Resolve the session cookie through the same store Express uses. The client
  // can never assert its own identity — the userId comes from the session.
  if (sessionMiddleware) io.engine.use(sessionMiddleware)

  io.use(async (socket, next) => {
    try {
      const userId = socket.request?.session?.userId
      if (!userId) return next(new Error('unauthorized'))
      const user = await User.findById(userId)
      if (!user) return next(new Error('unauthorized'))
      socket.userId = String(user._id)
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`)

    socket.on('conversation:join', async (conversationId) => {
      if (typeof conversationId !== 'string' || !mongoose.isValidObjectId(conversationId)) return
      try {
        const member = await Conversation.exists({ _id: conversationId, participants: socket.userId })
        if (member) socket.join(`conversation:${conversationId}`)
      } catch {
        // ignore malformed ids
      }
    })
    socket.on('auction:join', (auctionId) => {
      if (typeof auctionId === 'string') socket.join(`auction:${auctionId}`)
    })
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`)
    })
    socket.on('auction:leave', (auctionId) => {
      socket.leave(`auction:${auctionId}`)
    })
  })

  return io
}

export function getIo() {
  if (!io) throw new Error('Socket.io not initialized yet')
  return io
}
