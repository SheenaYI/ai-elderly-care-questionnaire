import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from '@/app/router'
import '@/styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('未找到 #root 挂载点')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>,
)
