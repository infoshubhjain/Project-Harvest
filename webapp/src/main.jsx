import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// React.StrictMode double-invokes effects/renders in development to surface side-effect bugs.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
