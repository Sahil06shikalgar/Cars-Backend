// Money is stored as integer minor units (cents). Helpers translate to/from EUR.
export const toCents = (eur) => {
  const n = Number(eur)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export const fromCents = (cents) => {
  const n = Number(cents)
  if (!Number.isFinite(n)) return 0
  return Math.round(n) / 100
}

// Minimum increment rules mirror the frontend bid form.
export const nextBidStep = (currentCents) => (currentCents >= 20000 ? 1000 : 500)
export const minNextBidCents = (currentCents) => currentCents + nextBidStep(currentCents)