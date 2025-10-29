import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ThemeContextType {
  themeColor: string;
  setThemeColor: (color: string) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeColor, setThemeColorState] = useState('#F97316'); // Default orange

  const hexToHsl = (hex: string) => {
    // Validação para evitar erro quando hex é null/undefined
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
      hex = '#F97316'; // Default orange
    }
    
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const applyTheme = (color: string) => {
    const root = document.documentElement;
    const hsl = hexToHsl(color);
    
    // Create a lighter version for hover/glow effects
    const [h, s, l] = hsl.split(' ');
    const lighterL = Math.min(parseInt(l.replace('%', '')) + 10, 100);
    const lighterHsl = `${h} ${s} ${lighterL}%`;

    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--primary-glow', lighterHsl);
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--accent', hsl);
  };

  const setThemeColor = (color: string) => {
    setThemeColorState(color);
    applyTheme(color);
  };

  const resetTheme = () => {
    const defaultColor = '#F97316';
    setThemeColorState(defaultColor);
    applyTheme(defaultColor);
  };

  const loadUserTheme = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        resetTheme();
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('establishment_id')
        .eq('user_id', session.user.id)
        .single();

      if (profileData?.establishment_id) {
        const { data: establishmentData } = await supabase
          .from('establishments')
          .select('settings')
          .eq('id', profileData.establishment_id)
          .single();

        const settings = establishmentData?.settings as any;
        const savedColor = settings?.theme_color;
        if (savedColor && typeof savedColor === 'string') {
          setThemeColor(savedColor);
        } else {
          resetTheme();
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      resetTheme();
    }
  };

  useEffect(() => {
    loadUserTheme();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // Small delay to ensure profile data is available
        setTimeout(loadUserTheme, 100);
      } else if (event === 'SIGNED_OUT') {
        resetTheme();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ThemeContext.Provider value={{ themeColor, setThemeColor, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}