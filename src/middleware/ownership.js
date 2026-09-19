import mongoose from 'mongoose'
import { AppError } from './errors.js'

// Every private query is scoped to the authenticated user derived from the
// session — never from a body/query/param value supplied by the browser.
export const ownerScope = (req, field = 'owner') => {
  if (!req.user) throw new AppError(401, 'You must be signed in.')
  return { [field]: req.user._id }
}

// Middleware: 401 unless signed in, and puts `{ owner: req.user._id }` on the
// request so route handlers can spread it into their Mongo filters.
export const requireOwner = (field = 'owner') => (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'You must be signed in.'))
  req.ownerFilter = { [field]: req.user._id }
  next()
}

// Middleware: load a document by `:id` that is owned by the signed-in user.
// A missing document, a foreign document and an invalid id all return 404 so
// the endpoint never reveals whether another user's record exists.
export const loadOwned = (
  Model,
  { param = 'id', field = 'owner', as = 'resource', message = 'Not found.' } = {}
) =>
  async function loadOwnedDoc(req, res, next) {
    try {
      if (!req.user) return next(new AppError(401, 'You must be signed in.'))
      const id = req.params[param]
      if (!id || !mongoose.isValidObjectId(id)) return next(new AppError(404, message))
      const doc = await Model.findOne({ _id: id, [field]: req.user._id })
      if (!doc) return next(new AppError(404, message))
      req[as] = doc
      next()
    } catch (err) {
      next(err)
    }
  }
