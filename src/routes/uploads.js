import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import { ENV } from '../config/env.js'
import { AppError, asyncHandler } from '../middleware/errors.js'
import { requireAuth } from '../middleware/auth.js'
import { uploadLimiter, uploadSize } from '../middleware/rateLimit.js'

const r = Router()
r.use(requireAuth)
r.use(uploadLimiter)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ENV.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    cb(null, `${crypto.randomBytes(8).toString('hex')}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: uploadSize },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)
    cb(ok ? null : new AppError(400, 'Only JPG, PNG, WEBP or GIF images are allowed.'), ok)
  },
})

r.post('/', upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: { message: 'No photo uploaded.' } })
  const url = `${ENV.apiBaseUrl}/uploads/${req.file.filename}`
  res.status(201).json({
    photo: {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mime: req.file.mimetype,
    },
  })
}))

export default r