import mongoose from 'mongoose'

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    community: { type: String, default: 'Berlin Trade Circle', trim: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, maxlength: 1500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
    reported: { type: Boolean, default: false },
  },
  { timestamps: true }
)

postSchema.index({ createdAt: -1 })

export const toDto = (post, authorProfile = null, viewerId = null) => ({
  id: String(post._id),
  authorId: post.author ? String(post.author._id || post.author) : '',
  author: authorProfile || null,
  community: post.community,
  content: post.content,
  ts: new Date(post.createdAt).getTime(),
  likes: post.likes ? post.likes.length : 0,
  liked: viewerId ? (post.likes || []).some((id) => String(id) === String(viewerId)) : false,
  comments: post.commentCount || 0,
  auctionId: post.auctionId ? String(post.auctionId) : null,
})

const Post = mongoose.model('Post', postSchema)
export default Post