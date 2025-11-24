import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AdminAuthProvider } from './hooks/useAdminAuth'

console.log('[MAIN] ========================================');
console.log('[MAIN] Script main.tsx iniciado');
console.log('[MAIN] ========================================');
console.log('[MAIN] window disponível?', typeof window !== 'undefined');
console.log('[MAIN] document disponível?', typeof document !== 'undefined');
console.log('[MAIN] ✅ Todos os imports concluídos');

// CRÍTICO: Handler global para erros não capturados
// Previne que erros não tratados quebrem toda a aplicação
if (typeof window !== 'undefined') {
  console.log('[MAIN] Configurando handlers de erro globais');
  
  window.addEventListener('error', (event) => {
    console.error('[MAIN] ❌ Erro global capturado:', event.error);
    console.error('[MAIN] Erro message:', event.message);
    console.error('[MAIN] Erro filename:', event.filename);
    console.error('[MAIN] Erro lineno:', event.lineno);
    console.error('[MAIN] Erro colno:', event.colno);
    // Prevenir que o erro quebre a aplicação
    event.preventDefault();
    // Não bloquear a renderização mesmo em caso de erro
  });

  // Handler para promessas rejeitadas não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[MAIN] ❌ Promise rejeitada não tratada:', event.reason);
    // Prevenir que a rejeição quebre a aplicação
    event.preventDefault();
    // Não bloquear a renderização mesmo em caso de erro
  });
}

console.log('[MAIN] Verificando elemento root...');
const rootElement = document.getElementById("root");
console.log('[MAIN] Root element encontrado?', !!rootElement);

if (!rootElement) {
  console.error('[MAIN] ❌ ERRO CRÍTICO: Elemento #root não encontrado no DOM!');
  console.error('[MAIN] Document body:', document.body);
  console.error('[MAIN] Document HTML:', document.documentElement);
  throw new Error('Root element not found');
}

console.log('[MAIN] Criando root do React...');

try {
  const root = createRoot(rootElement);
  console.log('[MAIN] ✅ Root criado');
  
  console.log('[MAIN] Renderizando aplicação...');
  root.render(
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  );
  console.log('[MAIN] ✅✅✅ Aplicação renderizada com sucesso!');
} catch (error: any) {
  console.error('[MAIN] ❌❌❌ ERRO CRÍTICO ao inicializar aplicação:', error);
  console.error('[MAIN] Error name:', error?.name);
  console.error('[MAIN] Error message:', error?.message);
  console.error('[MAIN] Error stack:', error?.stack);
  
  // Tentar mostrar erro na tela
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
