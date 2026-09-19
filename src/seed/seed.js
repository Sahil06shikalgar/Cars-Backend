import mongoose from 'mongoose'
import { config } from 'dotenv'
config()

import { requireEnv } from '../config/env.js'
import { connectDB, disconnectDB } from '../config/db.js'
import User from '../models/User.js'
import VaultModel from '../models/VaultModel.js'
import WishlistItem from '../models/Wishlist.js'
import Find from '../models/Find.js'
import Post from '../models/Post.js'
import Auction from '../models/Auction.js'
import Conversation from '../models/Conversation.js'
import Message from '../models/Message.js'
import { makeInitials, pickColor } from '../utils/identity.js'

const DEMO_DB_FLAG = { demo: true }

const BERLIN = {
  alex: { lat: 52.5219, lng: 13.4132 },
  mitte: { lat: 52.5200, lng: 13.4050 },
  kreuzberg: { lat: 52.4990, lng: 13.4032 },
  prenz: { lat: 52.5390, lng: 13.4250 },
  zehlendorf: { lat: 52.4470, lng: 13.2420 },
}

const demoUsers = [
  { name: 'Ari Voss', email: 'ari@diecet.demo', handle: '@ari', city: 'Berlin', badges: ['vault', 'early'] },
  { name: 'Mika Feld', email: 'mika@diecet.demo', handle: '@mika', city: 'Hamburg', badges: ['trade'] },
  { name: 'Jona Kade', email: 'jona@diecet.demo', handle: '@jona', city: 'Munich', badges: ['midnight'] },
  { name: 'Noor Ali', email: 'noor@diecet.demo', handle: '@noor', city: 'Cologne', badges: [] },
  { name: 'Pia Nohl', email: 'pia@diecet.demo', handle: '@pia', city: 'Leipzig', badges: ['early'] },
]

const models = [
  ['2023 BMW M3', 'BMW', '1:64', '#e1503c', 'Fresh', 12, 'Super'],
  ['Lancia Delta Integrale', 'Lancia', '1:43', '#c5283e', 'Fresh', 34, 'Rare'],
  ['Porsche 911 GT3 RS', 'Porsche', '1:64', '#2f9e6e', 'Fresh', 15, 'Rare'],
  ['Honda Civic Type R', 'Honda', '1:43', '#2462ff', 'Fresh', 22, 'Super'],
  ['Twingo 5', 'Renault', '1:43', '#ff9f1c', 'Fresh', 8, 'Common'],
  ['Pagani Huayra R', 'Pagani', '1:18', '#d8d8d8', 'Fresh', 74, 'Ultra'],
  ['Ford Bronco', 'Ford', '1:24', '#2a9d8f', 'Fresh', 20, 'Super'],
  ['Nissan Skyline GT-R R34', 'Nissan', '1:64', '#6a5acd', 'Fresh', 18, 'Rare'],
]

const finds = [
  { owner: 1, type: 'find', title: 'Holy grail find at flea market', brand: 'Pagani', price: 74, city: 'Berlin', geo: BERLIN.alex, shop: 'Flea market, Boxhagener Platz', hue: 220, status: 'active' },
  { owner: 2, type: 'find', title: 'Gulf-spec Lancia away from home', brand: 'Lancia', price: 34, city: 'Hamburg', geo: BERLIN.mitte, shop: 'Mini-Car Factory', hue: 12, status: 'active' },
  { owner: 3, type: 'find', title: 'Porsche for trade', brand: 'Porsche', price: 15, city: 'Munich', geo: BERLIN.kreuzberg, shop: 'Diecast Haus', hue: 90, status: 'active' },
  { owner: 4, type: 'trade', title: 'Trading my Civic for a Skyline', brand: 'Honda', price: 22, city: 'Cologne', geo: BERLIN.prenz, shop: 'Trading Post', hue: 50, status: 'active' },
  { owner: 5, type: 'find', title: 'Bronco in mint box', brand: 'Ford', price: 20, city: 'Leipzig', geo: BERLIN.zehlendorf, shop: 'Zollern Kurs', hue: 160, status: 'soldout' },
  { owner: 1, type: 'find', title: 'Twingo set special offer', brand: 'Renault', price: 8, city: 'Berlin', geo: BERLIN.mitte, shop: 'Primär Shopping', hue: 40, status: 'active' },
  { owner: 2, type: 'trade', title: 'Trade offers welcome for GT-R', brand: 'Nissan', price: 18, city: 'Hamburg', geo: BERLIN.kreuzberg, shop: 'Trading Post', hue: 130, status: 'active' },
]

// Photos of the seeded demo content, served from the uploads folder
// (/uploads/Cars, /uploads/Finds). Exist unchanged on disk under Backend/uploads.
const CAR_PHOTOS = [
  '/uploads/Cars/car-1-Xdlto-Sa.jpg',
  '/uploads/Cars/car-2-DsJECiLL.jpg',
  '/uploads/Cars/car-3-Bhmbv--t.jpg',
  '/uploads/Cars/car-4-CkqnyCeK.jpg',
  '/uploads/Cars/car-5-BTL-bhuC.jpg',
  '/uploads/Cars/car-6-DyQsVnjh.jpg',
]
const FIND_PHOTOS = [
  '/uploads/Finds/find-1-CiWavn-S.jpg',
  '/uploads/Finds/find-2-dS6oQXzx.jpg',
  '/uploads/Finds/find-3-BultK7tA.jpg',
  '/uploads/Finds/find-4-Bz7o4v3S.jpg',
]

const startedBy = (userIndex) => Date.now() - userIndex * 3600_000

async function run() {
  await connectDB(requireEnv('MONGODB_URI'))

  // Reset only demo rows — real accounts are left untouched.
  const demoUsersAll = await User.find(DEMO_DB_FLAG).select('_id')
  const demoIds = demoUsersAll.map((u) => u._id)
  if (demoIds.length) {
    await VaultModel.deleteMany({ owner: { $in: demoIds } })
    await WishlistItem.deleteMany({ owner: { $in: demoIds } })
    await Find.deleteMany({ owner: { $in: demoIds } })
    await Post.deleteMany({ author: { $in: demoIds } })
    await Auction.deleteMany({ seller: { $in: demoIds } })
    await Message.deleteMany({ sender: { $in: demoIds } })
    await Conversation.deleteMany({ participants: { $in: demoIds } })
  }
  await User.deleteMany(DEMO_DB_FLAG)

  // Create demo users with a shared password so you can log in as any of them.
  const users = []
  for (const u of demoUsers) {
    const user = new User({
      ...u,
      initials: makeInitials(u.name),
      color: pickColor(u.name),
      demo: true,
      level: 1 + users.length,
      xp: 100 * (users.length + 1),
    })
    await user.setPassword('demo1234')
    await user.save()
    users.push(user)
  }

  // Vault: distribute models across the first three demo accounts.
  let n = 0
  for (const [name, brand, scale, color, condition, value, rarity] of models) {
    const owner = (n % 3) + 1
    await VaultModel.create({
      owner: users[owner - 1]._id,
      name, brand, scale, year: 2021 + (n % 4), condition, color,
      valueCents: value * 100, rarity,
      tags: [brand.toLowerCase(), scale.replace(':', '')],
      photoUrl: CAR_PHOTOS[n % CAR_PHOTOS.length],
    })
    n += 1
  }

  for (const w of [
    { owner: 1, name: 'Pagani Huayra R', brand: 'Pagani', scale: '1:18', note: 'Add to my collection and never sell.' },
    { owner: 2, name: 'Porsche 911 GT3 RS', brand: 'Porsche', scale: '1:64', note: 'Missed the drop!' },
    { owner: 3, name: 'Lancia Delta Integrale', brand: 'Lancia', scale: '1:43', note: 'Gulf livery please.' },
  ]) {
    await WishlistItem.create({ ...w, owner: users[w.owner - 1]._id })
  }

  // Finds (with freshness timestamps adjusted so the freshness pill shows nicely).
  let fi = 0
  for (const f of finds) {
    const doc = await Find.create({
      ...f,
      owner: users[f.owner - 1]._id,
      location: { type: 'Point', coordinates: [f.geo.lng, f.geo.lat] },
      expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      confirmedAt: new Date(startedBy(fi += 1)),
      photoUrl: FIND_PHOTOS[(fi - 1) % FIND_PHOTOS.length],
    })
    if (f.status === 'soldout') {
      doc.status = 'soldout'
      await doc.save()
    }
  }

  // Posts in the Berlin Trade Circle.
  const content = [
    'Finally found the Huayra in the wild. Flea market gold.',
    'Anyone else collect 1:43 specifically? Fell into the rabbit hole last year.',
    'Trading my Gulf Lancia — open to any Euro classics in 1:43.',
    'Midnight drop TOMORROW. Set your alarms people.',
  ]
  for (let i = 0; i < content.length; i++) {
    const p = await Post.create({ author: users[i % users.length]._id, community: 'Berlin Trade Circle', content: content[i] })
    if (i === 0) p.likes.push(users[1]._id, users[2]._id)
    if (i === 2) p.likes.push(users[4]._id)
    await p.save()
  }

  // Live + ended auctions with a little bid history.
  const an = (name, brand, scale, color) => ({ name, brand, scale, color })
  const A = await Auction.create({
    seller: users[0]._id,
    sourceModelId: null,
    model: an('Lancia Delta Integrale', 'Lancia', '1:43', '#c5283e'),
    photoUrl: '',
    endsAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
    startingBidCents: 3400,
    buyNowCents: 6000,
    currentBidCents: 4800,
    currentBidder: users[3]._id,
    bidCount: 3,
    status: 'active',
    bids: [
      { bidder: users[1]._id, amountCents: 3400, at: new Date(startedBy(1)) },
      { bidder: users[3]._id, amountCents: 4200, at: new Date(startedBy(2)) },
      { bidder: users[3]._id, amountCents: 4800, at: new Date(startedBy(3)) },
    ],
  })
  await Auction.create({
    seller: users[1]._id,
    model: an('Porsche 911 GT3 RS', 'Porsche', '1:64', '#2f9e6e'),
    endsAt: new Date(Date.now() + 6 * 3600_000),
    startingBidCents: 1500,
    buyNowCents: 0,
    currentBidCents: 1500,
    currentBidder: users[4]._id,
    bidCount: 1,
    status: 'active',
    bids: [{ bidder: users[4]._id, amountCents: 1500, at: new Date(startedBy(1)) }],
  })
  await Auction.create({
    seller: users[2]._id,
    model: an('Ford Bronco', 'Ford', '1:24', '#2a9d8f'),
    endsAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    startingBidCents: 2000,
    currentBidCents: 2500,
    currentBidder: users[3]._id,
    bidCount: 2,
    status: 'ended',
    winnerId: users[3]._id,
    bids: [
      { bidder: users[4]._id, amountCents: 2000, at: new Date(startedBy(2)) },
      { bidder: users[3]._id, amountCents: 2500, at: new Date(startedBy(1)) },
    ],
  })
  // Link the first vault "Pagani" model to the live auction object.
  const vaultA = await VaultModel.findOne({ owner: users[0]._id, name: 'Lancia Delta Integrale' })
  if (vaultA) { vaultA.listedAuctionId = A._id; await vaultA.save() }

  // A small demo conversation between Ari and Mika.
  const convo = await Conversation.create({ participants: [users[0]._id, users[1]._id], lastActivity: new Date(startedBy(1)) })
  const m1 = await Message.create({ conversation: convo._id, sender: users[0]._id, text: 'Hey! Saw your Lancia find — open for a trade?' })
  const m2 = await Message.create({ conversation: convo._id, sender: users[1]._id, text: 'Only if you have the Huayra in 1:18 :)', read: true })
  convo.lastMessage = m2.text
  await convo.save()
  await Message.updateMany({ _id: { $in: [m1._id, m2._id] } }, { $set: { read: true } })

  console.log(`[seed] created ${users.length} demo users, ${models.length} vault models, ${finds.length} finds, 4 posts, 3 auctions, 1 conversation`)
  console.log('[seed] demo login: ari@diecet.demo / demo1234 (password for all demo accounts)')
}

run()
  .catch((err) => { console.error('[seed] failed:', err.message); process.exit(1) })
  .finally(async () => { await disconnectDB(); process.exit(0) })