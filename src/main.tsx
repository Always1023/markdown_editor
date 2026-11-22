import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { RootErrorBoundary } from './app/root-error-boundary'
import '@/i18n/i18n'
import '@/assets/main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
)
