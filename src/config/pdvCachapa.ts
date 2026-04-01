/**
 * PDV — ordem fixa de categorias só para o cliente Cachapa / Veneza.
 *
 * Ordem: CACHAPAS → HAMBURGUERES → BAGUETES → BEBIDAS
 *
 * - Dono: user_id em PDV_CACHAPA_AUTH_USER_IDS (já inclui o cliente atual).
 * - Equipe noutro PC/navegador: cole o establishment_id em PDV_CACHAPA_ESTABLISHMENT_IDS
 *   ou use VITE_PDV_CACHAPA_ESTABLISHMENT_ID no .env
 * - Depois que o dono abre o PDV uma vez, gravamos o establishment_id em localStorage
 *   para a mesma equipe no mesmo navegador.
 */

const LS_KEY = "burguer_pdv_cachapa_establishment_id";

const envEst = (import.meta.env.VITE_PDV_CACHAPA_ESTABLISHMENT_ID as string | undefined)?.trim();

/** Dono / contas que disparam a ordem (auth.users.id) */
export const PDV_CACHAPA_AUTH_USER_IDS = new Set<string>([
  "6fc801f1-5d59-4682-8b42-b88cdb941b19",
]);

/** Estabelecimentos (public.establishments.id) — equipe / deploy sem depender do dono */
export const PDV_CACHAPA_ESTABLISHMENT_IDS = new Set<string>([
  ...(envEst ? [envEst] : []),
]);

/** Chamado ao carregar o PDV: associa o estabelecimento do dono ao armazenamento local. */
export function registerCachapaEstablishmentIfOwner(
  establishmentId: string | null | undefined,
  authUserId: string | null | undefined
): void {
  if (!establishmentId || !authUserId) return;
  if (!PDV_CACHAPA_AUTH_USER_IDS.has(authUserId)) return;
  try {
    localStorage.setItem(LS_KEY, establishmentId);
  } catch {
    /* ignore */
  }
}

export function shouldUsePdvCachapaCategoryOrder(
  authUserId: string | null | undefined,
  establishmentId: string | null | undefined
): boolean {
  if (establishmentId && PDV_CACHAPA_ESTABLISHMENT_IDS.has(establishmentId)) return true;
  if (authUserId && PDV_CACHAPA_AUTH_USER_IDS.has(authUserId)) return true;
  if (establishmentId) {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored && stored === establishmentId) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** Normaliza para comparação estável */
function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Prioridade 0–3 = ordem Cachapa; 100+ = demais categorias (mantém sort_order relativo).
 */
export function pdvCachapaCategoryRank(categoryName: string, sortOrderFallback: number): number {
  const n = norm(categoryName);
  if (n.includes("cachapa")) return 0;
  if (n.includes("hamburguer") || n.includes("hamburg")) return 1;
  if (n.includes("baguete")) return 2;
  if (n.includes("bebida")) return 3;
  return 100 + (sortOrderFallback ?? 0);
}
