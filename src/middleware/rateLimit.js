import rateLimit from 'express-rate-limit'
import { ENV } from '../config/env.js'

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message } },
    skip: () => ENV.isTest,
  })

export const loginLimiter = make(15 * 60 * 1000, 20, 'Too many login attempts. Try again in a few minutes.')
export const signupLimiter = make(60 * 60 * 1000, 10, 'Too many accounts created from this device. Try again later.')
export const forgotLimiter = make(15 * 60 * 1000, 6, 'Too many reset requests. Try again later.')
export const postLimiter = make(60 * 60 * 1000, 60, 'You have reached the posting limit. Slow down.')
export const bidLimiter = make(60 * 60 * 1000, 120, 'You have placed too many bids. Slow down.')
export const findLimiter = make(60 * 60 * 1000, 30, 'You have posted too many finds. Slow down.')
export const messageLimiter = make(60 * 1000, 60, 'You are sending messages too quickly.')
export const reportLimiter = make(60 * 60 * 1000, 15, 'You have used all your reports for now.')
export const apiLimiter = make(60 * 1000, 600, 'Too many requests.')
export const uploadLimiter = make(60 * 60 * 1000, 50, 'You have uploaded too many photos. Slow down.')
export const uploadSize = 5 * 1024 * 1024 // 5 MB