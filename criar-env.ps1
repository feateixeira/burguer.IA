# Script PowerShell para criar arquivo .env.local
# Use este script se o arquivo .env ficar bloqueado pelo OneDrive

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Criador de Arquivo .env.local" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o arquivo já existe
if (Test-Path ".env.local") {
    Write-Host "⚠️  O arquivo .env.local já existe!" -ForegroundColor Yellow
    $resposta = Read-Host "Deseja sobrescrever? (S/N)"
    if ($resposta -ne "S" -and $resposta -ne "s") {
        Write-Host "Operação cancelada." -ForegroundColor Yellow
        exit
    }
}

Write-Host "Por favor, forneça suas credenciais do Supabase:" -ForegroundColor Green
Write-Host ""

# Solicitar URL
$url = Read-Host "VITE_SUPABASE_URL (ex: https://xxxxx.supabase.co)"
if ([string]::IsNullOrWhiteSpace($url)) {
    Write-Host "❌ URL não pode estar vazia!" -ForegroundColor Red
    exit 1
}

# Solicitar chave
$key = Read-Host "VITE_SUPABASE_ANON_KEY"
if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "❌ Chave não pode estar vazia!" -ForegroundColor Red
    exit 1
}

# Criar conteúdo do arquivo
$conteudo = @"
# ============================================
# Variáveis de Ambiente - Supabase
# ============================================
# Este arquivo é usado para desenvolvimento local
# O Vite carrega este arquivo automaticamente
# ============================================

# URL do seu projeto Supabase
VITE_SUPABASE_URL=$url

# Chave pública anônima (anon key) do Supabase
VITE_SUPABASE_ANON_KEY=$key

# ============================================
# INSTRUÇÕES:
# ============================================
# 1. Este arquivo foi criado automaticamente
# 2. REINICIE o servidor de desenvolvimento (npm run dev)
# ============================================
"@

# Tentar criar o arquivo
try {
    # Remover atributo somente leitura se existir
    if (Test-Path ".env.local") {
        Set-ItemProperty -Path ".env.local" -Name IsReadOnly -Value $false -ErrorAction SilentlyContinue
    }
    
    # Criar arquivo
    $conteudo | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline
    
    Write-Host ""
    Write-Host "✅ Arquivo .env.local criado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Verifique se o arquivo foi criado corretamente" -ForegroundColor White
    Write-Host "2. REINICIE o servidor de desenvolvimento: npm run dev" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Erro ao criar arquivo: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solução alternativa:" -ForegroundColor Yellow
    Write-Host "1. Crie o arquivo manualmente com o nome .env.local" -ForegroundColor White
    Write-Host "2. Adicione as seguintes linhas:" -ForegroundColor White
    Write-Host "   VITE_SUPABASE_URL=$url" -ForegroundColor Gray
    Write-Host "   VITE_SUPABASE_ANON_KEY=$key" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

