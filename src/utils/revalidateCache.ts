/**
 * Utility function to trigger Vercel On-Demand Revalidation
 * after database updates that should invalidate cached pages
 */
import { supabase } from "@/integrations/supabase/client";

export interface RevalidatePaths {
  paths: string[];
  establishmentSlug?: string;
}

/**
 * Triggers cache revalidation for specified paths
 * @param paths - Array of paths to revalidate (e.g., ['/dashboard/produtos', '/cardapio/slug'])
 * @param establishmentSlug - Optional establishment slug for dynamic routes
 */
export async function revalidateCache(paths: string[], establishmentSlug?: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return;
    }

    // Get full paths with slug if provided
    const fullPaths = establishmentSlug 
      ? paths.map(path => path.replace('[slug]', establishmentSlug))
      : paths;

    // Call the Edge Function that handles revalidation
    const response = await supabase.functions.invoke('revalidate-cache', {
      body: {
        paths: fullPaths,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    // Fail silently - revalidation should not break the main flow
  } catch (error) {
    // Fail silently - revalidation should not break the main flow
  }
}

/**
 * Helper functions for common revalidation scenarios
 */
export const revalidateHelpers = {
  /**
   * Revalidate after product changes
   */
  products: async (establishmentSlug?: string) => {
    const paths = ['/dashboard/produtos'];
    if (establishmentSlug) {
      paths.push(`/cardapio/${establishmentSlug}`);
    }
    await revalidateCache(paths, establishmentSlug);
  },

  /**
   * Revalidate after category changes
   */
  categories: async (establishmentSlug?: string) => {
    const paths = ['/dashboard/produtos'];
    if (establishmentSlug) {
      paths.push(`/cardapio/${establishmentSlug}`);
    }
    await revalidateCache(paths, establishmentSlug);
  },

  /**
   * Revalidate after customer changes
   */
  customers: async () => {
    await revalidateCache(['/dashboard/customers']);
  },

  /**
   * Revalidate after promotion changes
   */
  promotions: async (establishmentSlug?: string) => {
    const paths = ['/dashboard/promocoes'];
    if (establishmentSlug) {
      paths.push(`/cardapio/${establishmentSlug}`);
    }
    await revalidateCache(paths, establishmentSlug);
  },

  /**
   * Revalidate after combo changes
   */
  combos: async (establishmentSlug?: string) => {
    const paths = ['/dashboard/produtos'];
    if (establishmentSlug) {
      paths.push(`/cardapio/${establishmentSlug}`);
    }
    await revalidateCache(paths, establishmentSlug);
  },

  /**
   * Revalidate after supplier changes
   */
  suppliers: async () => {
    await revalidateCache(['/dashboard/fornecedores']);
  },
};

