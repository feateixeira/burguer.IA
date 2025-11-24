import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AdminAuthProvider } from './hooks/useAdminAuth'

// CRÍTICO: Handler global para erros não capturados
// Previne que erros não tratados quebrem toda a aplicação
window.addEventListener('error', (event) => {
  console.error('Erro global capturado:', event.error);
  // Prevenir que o erro quebre a aplicação
  event.preventDefault();
  // Opcional: enviar para serviço de logging
});

// Handler para promessas rejeitadas não tratadas
window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rejeitada não tratada:', event.reason);
  // Prevenir que a rejeição quebre a aplicação
  event.preventDefault();
  // Opcional: enviar para serviço de logging
});

createRoot(document.getElementById("root")!).render(
  <AdminAuthProvider>
    <App />
  </AdminAuthProvider>
);
