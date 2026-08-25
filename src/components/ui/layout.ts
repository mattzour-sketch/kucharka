/**
 * Dvě zapsané úrovně max-šířky obsahu. Hlavička i `main` každé obrazovky sdílejí
 * tentýž token, aby měly identickou šířku.
 */
export const SCREEN_WIDTH = {
  wide: 'max-w-5xl', // mřížky karet: Recepty, Hledat, Potraviny
  narrow: 'max-w-2xl', // čtení/formuláře/jednosloupcové seznamy: vše ostatní (vč. Detailu)
} as const;

export type ScreenWidth = keyof typeof SCREEN_WIDTH;
