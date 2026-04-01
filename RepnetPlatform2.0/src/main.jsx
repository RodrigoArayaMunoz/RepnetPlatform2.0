import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Login from './frontend/Login.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Login />
  </StrictMode>,
)
