import crypto from 'node:crypto'
import { ENV } from '../config/env.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

// Social sign-up is enabled only once a Google OAuth web client is configured.
export const googleConfigured = () => Boolean(ENV.googleClientId && ENV.googleClientSecret)

export const oauthState = () => crypto.randomBytes(24).toString('hex')
export const OAUTH_STATE_TTL = 10 * 60 * 1000 // 10 minutes

export const googleAuthorizeUrl = (state) => {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: ENV.googleRedirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// Exchange the authorization code for an access token.
export async function googleExchangeCode(code) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: ENV.googleRedirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`)
  }
  return res.json()
}

// Fetch the verified profile ({ id, email, name, picture, ... }) for an access token.
export async function googleUserInfo(accessToken) {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Google userinfo request failed (${res.status})`)
  }
  return res.json()
}