import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 600 },
  },
  { timestamps: true }
)

export const toDto = (comment, authorProfile = null) => ({
  id: String(comment._id),
  postId: String(comment.post),
  authorId: comment.author ? String(comment.author._id || comment.author) : '',
  author: authorProfile || null,
  content: comment.content,
  ts: new Date(comment.createdAt).getTime(),
})

const Comment = mongoose.model('Comment', commentSchema)
export default Comment