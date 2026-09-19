import session from 'express-session'
import MongoStore from 'connect-mongo'
import { ENV, requireEnv } from './env.js'

export const SESSION_COOKIE = 'dg.sid'

// Single session middleware instance shared by Express and Socket.IO so both
// resolve the very same server-side session (never a client-supplied id).
export function buildSessionMiddleware(mongoUri) {
  return session({
    name: SESSION_COOKIE,
    secret: requireEnv('SESSION_SECRET'),
    store: MongoStore.create({ mongoUrl: mongoUri }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: ENV.secureCookies,
      sameSite: ENV.isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
}
