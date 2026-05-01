import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initSupabase } from './supabaseClient.js'

const container = document.getElementById('root')
const reactRoot = createRoot(container)

reactRoot.render(
  <p style={{ fontFamily: 'system-ui, sans-serif', padding: 24, margin: 0 }}>
    Loading EquipCheck…
  </p>,
)

initSupabase()
  .then(async () => {
    const App = (await import('./App.jsx')).default
    reactRoot.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err) => {
    reactRoot.render(
      <p style={{ fontFamily: 'system-ui, sans-serif', padding: 24, margin: 0, color: '#b91c1c' }}>
        Could not start the app: {String(err?.message ?? err)}
      </p>,
    )
  })
