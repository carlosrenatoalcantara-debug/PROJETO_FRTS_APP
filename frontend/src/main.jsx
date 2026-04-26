import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { EmpresaProvider } from './contexts/EmpresaContext'
import App from './App'
import './index.css'

const apiKey = localStorage.getItem('googleMapsApiKey') || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <APIProvider apiKey={apiKey}>
        <EmpresaProvider>
          <App />
        </EmpresaProvider>
      </APIProvider>
    </BrowserRouter>
  </React.StrictMode>
)
