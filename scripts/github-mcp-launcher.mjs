/**
 * Loads hospital-equipment-check/.env and runs the GitHub MCP server (stdio).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

function loadDotEnv(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  let text = fs.readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const fileEnv = loadDotEnv(path.join(root, '.env'))
const token =
  fileEnv.GITHUB_PERSONAL_ACCESS_TOKEN ??
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN

if (!token) {
  console.error(
    'github-mcp: set GITHUB_PERSONAL_ACCESS_TOKEN in .env (fine-grained or classic PAT).'
  )
  process.exit(1)
}

const entry = path.join(
  root,
  'node_modules/@modelcontextprotocol/server-github/dist/index.js'
)

const child = spawn(process.execPath, [entry], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...fileEnv, GITHUB_PERSONAL_ACCESS_TOKEN: token },
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
