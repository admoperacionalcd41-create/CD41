import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ErrorBoundary } from './components/Shared/ErrorBoundary.jsx';
// Importado só pelo efeito colateral: registra bem cedo o listener que
// captura o evento de instalação do app (ver useInstalarApp.js) — tem que
// ser aqui, antes de qualquer aba (lazy-loaded) montar, senão o navegador
// pode disparar esse evento antes de alguém estar ouvindo e a chance se
// perde pro resto da sessão.
import './hooks/useInstalarApp.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Envolve TUDO — se algo quebrar em qualquer tela (login, providers
        incluídos), mostra uma tela de aviso com botão de recarregar em vez
        de deixar a página em branco sem nenhuma pista. Ver
        ErrorBoundary.jsx. */}
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
