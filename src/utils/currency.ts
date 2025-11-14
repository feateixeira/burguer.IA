// Formatar valor para exibição BRL
export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00";
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "R$ 0,00";
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
};

// Converter string formatada para número
export const parseCurrency = (value: string): number => {
  // Remove tudo exceto números, vírgula e ponto
  const cleaned = value.replace(/[^\d,.-]/g, "");
  // Substitui vírgula por ponto
  const normalized = cleaned.replace(",", ".");
  return parseFloat(normalized) || 0;
};

// Máscara de input para moeda BRL
export const currencyMask = (value: string): string => {
  // Remove tudo exceto números
  const numbers = value.replace(/\D/g, "");
  
  if (!numbers) return "";
  
  // Converte para centavos e depois formata
  const cents = parseInt(numbers, 10);
  const reais = cents / 100;
  
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(reais);
};

