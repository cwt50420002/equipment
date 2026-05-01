import { createClient } from '@supabase/supabase-js'

/** Set during initSupabase(); used after bootstrap completes */
let client = null

function applyFromBuildEnv() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (url && anonKey) {
    client = createClient(url, anonKey)
    return true
  }
  return false
}

function runtimeConfigUrls() {
  if (typeof window === 'undefined') return []
  const urls = new Set()
  urls.add(new URL('supabase-runtime-config.json', window.location.href).href)
  const { pathname, origin } = window.location
  if (!pathname.endsWith('/')) {
    urls.add(`${origin}${pathname}/supabase-runtime-config.json`)
  }
  return [...urls]
}

/**
 * Call once before rendering App. Uses Vite env first, then fetches
 * /supabase-runtime-config.json (written into dist by GitHub Actions).
 */
export async function initSupabase() {
  client = null
  if (applyFromBuildEnv()) return

  for (const href of runtimeConfigUrls()) {
    try {
      const res = await fetch(href, { cache: 'no-store' })
      if (!res.ok) continue
      const j = await res.json()
      const url = typeof j.url === 'string' ? j.url.trim() : ''
      const anonKey = typeof j.anonKey === 'string' ? j.anonKey.trim() : ''
      if (url && anonKey) {
        client = createClient(url, anonKey)
        return
      }
    } catch {
      /* try next URL */
    }
  }
}

export function isSupabaseConfigured() {
  return Boolean(client)
}

export function getSupabase() {
  return client
}
