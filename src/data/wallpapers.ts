export interface Wallpaper {
  id: string;
  src: string;
  title: string;
  category: string;
  isPremium: boolean;
}

export interface Category {
  id: string;
  name: string;
  thumbnail: string;
  count: number;
}

// All wallpapers are now served from R2 cloud via the image-proxy edge function.
// Local static images have been removed to reduce bundle size.
export const wallpapers: Wallpaper[] = [];
export const categories: Category[] = [];
