// Script para verificar variáveis de ambiente antes do build
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY'
];

const missingVars = [];
const warnings = [];

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    missingVars.push(varName);
  } else {
    console.log(`✓ ${varName} está configurado`);
  }
});

if (missingVars.length > 0) {
  console.error('\n❌ ERRO: Variáveis de ambiente obrigatórias não encontradas:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n📝 Instruções:');
  console.error('   1. No Vercel: Settings → Environment Variables');
  console.error('   2. Adicione as variáveis acima');
  console.error('   3. Certifique-se de que estão disponíveis para "Production"');
  console.error('   4. Faça um novo deploy\n');
  
  // Em produção (CI/CD), falhar o build
  if (process.env.CI || process.env.VERCEL) {
    process.exit(1);
  } else {
    // Em desenvolvimento local, apenas avisar
    console.warn('⚠️  AVISO: Build continuará, mas pode falhar em produção se as variáveis não estiverem configuradas.\n');
  }
} else {
  console.log('\n✅ Todas as variáveis de ambiente estão configuradas!\n');
}

