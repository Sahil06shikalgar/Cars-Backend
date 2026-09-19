export class AppError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export const notFound = (req, res, next) => next(new AppError(404, `Not found: ${req.method} ${req.originalUrl}`))

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500
  const body = {
    error: {
      message: status >= 500 ? 'Internal server error' : (err.message || 'Something went wrong'),
    },
  }
  if (err.details) body.error.details = err.details
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    if (status >= 500) console.error('[error]', err)
  }
  res.status(status).json(body)
}