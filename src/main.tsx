import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AdminAuthProvider } from './hooks/useAdminAuth'

// Logs removidos para produção - adicionar apenas se necessário para debug

// Handler global para erros não capturados
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    event.preventDefault();
  });

  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  const root = createRoot(rootElement);
  root.render(
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  );
} catch (error: any) {
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; max-width: 800px; margin: 50px auto;">
        <h1 style="color: red;">Erro ao carregar aplicação</h1>
        <p><strong>Erro:</strong> ${error?.message || 'Erro desconhecido'}</p>
        <p><strong>Detalhes:</strong> Verifique o console do navegador (F12) para mais informações.</p>
        <pre style="background: #f5f5f5; padding: 10px; overflow: auto; border: 1px solid #ddd;">${error?.stack || ''}</pre>
      </div>
    `;
  }
  throw error;
}
