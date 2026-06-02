/** Regra de molhos: Na Brasa = 2 grátis em todos os hambúrgueres; demais = triplo/ENO com 2, resto 1. */

export const EXTRA_SAUCE_PRICE = 2;

export function isNaBrasaEstablishment(establishmentName: string): boolean {
  const n = (establishmentName || "").toLowerCase().trim();
  return (
    n.includes("na brasa") ||
    n.includes("nabrasa") ||
    n.includes("hamburgueria na brasa") ||
    n === "na brasa"
  );
}

function parseProductTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).toLowerCase());
  }
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed.map((t) => String(t).toLowerCase()) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Produtos sem seleção de molho padrão (Nutella, baguete, smash — molho próprio). */
export function productSkipsSauceSelection(product: {
  name?: string;
  tags?: unknown;
  customizations?: unknown;
}): boolean {
  const nameLower = (product.name || "").toLowerCase();
  if (nameLower.includes("baguete") || nameLower.includes("smash")) return true;
  if (nameLower.includes("nutella")) return true;

  const tags = parseProductTags(product.tags);
  if (tags.includes("sem-molhos")) return true;

  const cust = product.customizations as Record<string, unknown> | null | undefined;
  if (cust != null && Number(cust.molhos_gratis) === 0) return true;

  return false;
}

/** Triplo ou ENO Mostro (legado fora da regra “2 para todos” da Na Brasa). */
export function isTriploBurger(
  product: { name?: string } | null,
  establishmentName?: string
): boolean {
  if (!product) return false;
  const productNameLower = product.name.toLowerCase().trim();

  if (productNameLower.includes("triplo")) return true;

  if (establishmentName && isNaBrasaEstablishment(establishmentName)) {
    const normalizedName = productNameLower
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ");

    const hasEno = normalizedName.includes("eno");
    const hasMostro =
      normalizedName.includes("mostro") || normalizedName.includes("monstro");

    if (hasEno && hasMostro) return true;
  }

  return false;
}

export function getFreeSauceCount(
  product: { name?: string; tags?: unknown; customizations?: unknown } | null,
  options: { establishmentName: string; isHamburger: boolean }
): number {
  if (!product || !options.isHamburger) return 0;
  if (productSkipsSauceSelection(product)) return 0;

  if (isNaBrasaEstablishment(options.establishmentName)) {
    return 2;
  }

  return isTriploBurger(product, options.establishmentName) ? 2 : 1;
}

export function calculateExtraSaucePrice(
  product: { name?: string; tags?: unknown; customizations?: unknown } | null,
  selectedSauceCount: number,
  options: { establishmentName: string; isHamburger: boolean }
): number {
  const free = getFreeSauceCount(product, options);
  const extra = Math.max(0, selectedSauceCount - free);
  return extra * EXTRA_SAUCE_PRICE;
}
