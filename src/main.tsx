import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { reloadForNewVersion } from '@/lib/chunkReload'

// Vite raises this when a lazy chunk is gone after a deploy; reload once for the new files instead of leaving the page stuck.
window.addEventListener('vite:preloadError', event => { if (reloadForNewVersion()) event.preventDefault() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
