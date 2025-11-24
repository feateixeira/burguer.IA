import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AdminAuthProvider } from './hooks/useAdminAuth'

// CRÍTICO: Handler global para erros não capturados
// Previne que erros não tratados quebrem toda a aplicação
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Erro global capturado:', event.error);
    // Prevenir que o erro quebre a aplicação
    event.preventDefault();
    // Não bloquear a renderização mesmo em caso de erro
  });

  // Handler para promessas rejeitadas não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rejeitada não tratada:', event.reason);
    // Prevenir que a rejeição quebre a aplicação
    event.preventDefault();
    // Não bloquear a renderização mesmo em caso de erro
  });
}

createRoot(document.getElementById("root")!).render(
  <AdminAuthProvider>
    <App />
  </AdminAuthProvider>
);
