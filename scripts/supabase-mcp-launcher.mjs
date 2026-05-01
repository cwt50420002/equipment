/**
 * Cursor MCP spawns this script; it reads hospital-equipment-check/.env and
 * passes --access-token / --project-ref (the Supabase MCP binary only picks up
 * the PAT from env; project ref must be CLI args).
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
  fileEnv.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN
const ref =
  fileEnv.SUPABASE_PROJECT_REF ?? process.env.SUPABASE_PROJECT_REF

if (!token || !ref) {
  console.error(
    'supabase-mcp: set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env (project folder).'
  )
  process.exit(1)
}

const entry = path.join(
  root,
  'node_modules/@supabase/mcp-server-supabase/dist/transports/stdio.js'
)

const child = spawn(
  process.execPath,
  [entry, '--access-token', token, '--project-ref', ref],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...fileEnv },
  }
)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
