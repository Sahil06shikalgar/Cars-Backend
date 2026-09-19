import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const roots = ['src']
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (extname(full) === '.js' || extname(full) === '.mjs') files.push(full)
  }
}
roots.forEach(walk)

let failed = 0
for (const file of files) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (res.status !== 0) {
    failed += 1
    console.error(`✗ ${file}\n${res.stderr}`)
  }
}
if (failed) {
  console.error(`\n${failed} file(s) failed syntax check`)
  process.exit(1)
}
console.log(`✓ syntax OK for ${files.length} JS files`)