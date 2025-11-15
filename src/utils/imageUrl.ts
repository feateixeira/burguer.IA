/**
 * Normaliza URLs do Imgur para garantir que funcionem como links de imagem diretos
 * 
 * O Imgur fornece links como https://imgur.com/WGNi1gV que não funcionam diretamente
 * como imagens. Esta função converte para https://i.imgur.com/WGNi1gV.jpg
 * 
 * @param url - URL da imagem (pode ser do Imgur ou de outro serviço)
 * @returns URL normalizada que funciona como link direto de imagem
 */
export const normalizeImageUrl = (url: string | null | undefined): string | null => {
  if (!url || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  try {
    // Se já é um link direto do i.imgur.com com extensão, retorna como está
    if (/^https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(jpg|jpeg|png|gif|webp)$/i.test(trimmedUrl)) {
      return trimmedUrl;
    }

    // Se é um link do imgur.com (sem i.) e não tem extensão, converter
    // Padrão: https://imgur.com/ID ou http://imgur.com/ID ou imgur.com/ID
    const imgurPattern = /^(https?:\/\/)?(www\.)?imgur\.com\/([a-zA-Z0-9]+)(\/)?$/i;
    const match = trimmedUrl.match(imgurPattern);

    if (match) {
      const imageId = match[3];
      return `https://i.imgur.com/${imageId}.jpg`;
    }

    // Se é um link do i.imgur.com mas sem extensão, adicionar .jpg
    const iImgurPattern = /^(https?:\/\/)?i\.imgur\.com\/([a-zA-Z0-9]+)(\/)?$/i;
    const iMatch = trimmedUrl.match(iImgurPattern);

    if (iMatch) {
      const imageId = iMatch[2];
      return `https://i.imgur.com/${imageId}.jpg`;
    }

    // Para outros links, retornar como está (pode ser de outros serviços)
    return trimmedUrl;
  } catch (error) {
    // Em caso de erro, retornar a URL original
    console.warn('Erro ao normalizar URL da imagem:', error);
    return trimmedUrl;
  }
};

