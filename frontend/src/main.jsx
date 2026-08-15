import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { APIProvider } from '@vis.gl/react-google-maps'
import { EmpresaProvider } from './contexts/EmpresaContext'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './index.css'
import { getGoogleMapsApiKey } from './utils/googleMapsKey'
import { instalarInterceptorHttp } from './services/http'

// Camada HTTP única: injeta Authorization nas chamadas à API desta aplicação.
// Instalado antes do render para cobrir qualquer fetch disparado no mount.
instalarInterceptorHttp()

const apiKey = getGoogleMapsApiKey()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <APIProvider apiKey={apiKey}>
          <EmpresaProvider>
            <App />
          </EmpresaProvider>
        </APIProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
