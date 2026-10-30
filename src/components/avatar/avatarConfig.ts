// Tipos y configuraciones del Creador de Avatar Personalizado de CheckinRB
// Estética vectorial ilustrada limpia, elegante y armoniosa

export type SkinToneId = 
  | 'very_fair' 
  | 'fair' 
  | 'medium_light' 
  | 'medium' 
  | 'tan' 
  | 'brown' 
  | 'dark';

export type GlassesStyleId = 
  | 'none' 
  | 'square' 
  | 'round' 
  | 'semi_rimless' 
  | 'sunglasses';

export type ClothingStyleId = 
  | 'shirt_tie' 
  | 'turtleneck_jacket' 
  | 'suit_formal' 
  | 'casual_turtleneck' 
  | 'classic_polo';

export type HairStyleId = 
  | 'box_cut'
  | 'bald_clean'
  | 'wavy_stylish' 
  | 'buzz_fade' 
  | 'short_clean' 
  | 'side_sweep' 
  | 'curtain_part' 
  | 'comma_bangs' 
  | 'curly_crop' 
  | 'slick_back' 
  | 'long_wavy' 
  | 'bob_cut';

export type HairColorId = 
  | 'chestnut' 
  | 'dark_coffee' 
  | 'jet_black' 
  | 'burgundy' 
  | 'caramel' 
  | 'silver';

export type FacialHairId = 
  | 'none' 
  | 'stubble' 
  | 'mustache' 
  | 'goatee';

export type BackgroundId = 
  | 'sky_pastel' 
  | 'lilac_pastel' 
  | 'mint_pastel' 
  | 'peach_pastel' 
  | 'rb_signature' 
  | 'corporate_navy' 
  | 'warm_sunset';

export interface AvatarConfig {
  skinTone: SkinToneId;
  glasses: GlassesStyleId;
  glassesColor: string;
  clothing: ClothingStyleId;
  clothingColor: string;
  tieColor?: string;
  hairStyle: HairStyleId;
  hairColor: HairColorId;
  facialHair: FacialHairId;
  background: BackgroundId;
}

export const SKIN_TONES: Record<SkinToneId, { name: string; base: string; shadow: string }> = {
  very_fair: {
    name: 'Porcelana',
    base: '#FDE4D8',
    shadow: '#F0C2AE',
  },
  fair: {
    name: 'Clara Natural',
    base: '#FAD2B6',
    shadow: '#E8B38E',
  },
  medium_light: {
    name: 'Apiñonada Clara',
    base: '#EBB486',
    shadow: '#CE9361',
  },
  medium: {
    name: 'Canela Cálido',
    base: '#D99863',
    shadow: '#BA7A45',
  },
  tan: {
    name: 'Bronceada',
    base: '#B77647',
    shadow: '#94582E',
  },
  brown: {
    name: 'Morena Cálida',
    base: '#8C5432',
    shadow: '#6D3A1B',
  },
  dark: {
    name: 'Morena Oscura',
    base: '#57331F',
    shadow: '#3D2011',
  },
};

export const HAIR_COLORS: Record<HairColorId, { name: string; base: string; shadow: string; highlight: string }> = {
  chestnut: {
    name: 'Castaño Cálido',
    base: '#8B5A4B',
    shadow: '#5E382E',
    highlight: '#A87161',
  },
  dark_coffee: {
    name: 'Café Oscuro',
    base: '#42281D',
    shadow: '#281710',
    highlight: '#5E3B2C',
  },
  jet_black: {
    name: 'Negro Azabache',
    base: '#1E1E22',
    shadow: '#0D0D10',
    highlight: '#383842',
  },
  burgundy: {
    name: 'Borgoña / Vino',
    base: '#6B1D2F',
    shadow: '#46111D',
    highlight: '#8E2840',
  },
  caramel: {
    name: 'Rubio Caramelo',
    base: '#B45309',
    shadow: '#78350F',
    highlight: '#D97706',
  },
  silver: {
    name: 'Gris Plata',
    base: '#94A3B8',
    shadow: '#64748B',
    highlight: '#CBD5E1',
  },
};

export const CLOTHING_COLORS = [
  { name: 'Turquesa Corporativo', hex: '#5E9CA8' },
  { name: 'Naranja Tartán', hex: '#F59E0B' },
  { name: 'Blanco Puro', hex: '#FFFFFF' },
  { name: 'Gris Carbón', hex: '#4B5563' },
  { name: 'Azul RB Oficial', hex: '#0D5C75' },
  { name: 'Azul Noche Oscuro', hex: '#002D42' },
  { name: 'Negro Imperial', hex: '#18181B' },
  { name: 'Borgoña Tinto', hex: '#831843' },
  { name: 'Verde Esmeralda', hex: '#065F46' },
  { name: 'Lavanda Suave', hex: '#818CF8' },
];

export const TIE_COLORS = [
  { name: 'Negro Corbata', hex: '#18181B' },
  { name: 'Azul Noche Cuello Alto', hex: '#1E3E62' },
  { name: 'Gris Carbón Cuello Alto', hex: '#374151' },
  { name: 'Azul RB Oficial', hex: '#0D5C75' },
  { name: 'Borgoña Vino', hex: '#831843' },
  { name: 'Verde Botella', hex: '#065F46' },
];

export const GLASSES_COLORS = [
  { name: 'Negro Mate', hex: '#18181B' },
  { name: 'Oro Ejecutivo', hex: '#D97706' },
  { name: 'Plata Pulida', hex: '#94A3B8' },
  { name: 'Azul Marino', hex: '#0D5C75' },
  { name: 'Carey Habana', hex: '#78350F' },
];

export const BACKGROUNDS: Record<BackgroundId, { name: string; stops: [string, string] }> = {
  sky_pastel: {
    name: 'Celeste Pastel',
    stops: ['#E0F2FE', '#BAE6FD'],
  },
  lilac_pastel: {
    name: 'Lavanda Pastel',
    stops: ['#E0E7FF', '#C7D2FE'],
  },
  mint_pastel: {
    name: 'Menta Suave',
    stops: ['#DCFCE7', '#BBF7D0'],
  },
  peach_pastel: {
    name: 'Melocotón Cálido',
    stops: ['#FFEDD5', '#FED7AA'],
  },
  rb_signature: {
    name: 'Russell Bedford (Azul / Cian)',
    stops: ['#002D42', '#0D5C75'],
  },
  corporate_navy: {
    name: 'Azul Noche Ejecutivo',
    stops: ['#0B192C', '#1E3E62'],
  },
  warm_sunset: {
    name: 'Atardecer Dorado',
    stops: ['#EA580C', '#F59E0B'],
  },
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skinTone: 'fair',
  glasses: 'none',
  glassesColor: '#18181B',
  clothing: 'shirt_tie',
  clothingColor: '#5E9CA8',
  tieColor: '#18181B',
  hairStyle: 'wavy_stylish',
  hairColor: 'chestnut',
  facialHair: 'none',
  background: 'sky_pastel',
};

// Presets representativos organizados y con estilos de cabello y lentes
export const AVATAR_PRESETS: Array<{ name: string; config: AvatarConfig }> = [
  {
    name: 'Ondulado & Camisa (Avatar 1)',
    config: {
      skinTone: 'fair',
      glasses: 'none',
      glassesColor: '#18181B',
      clothing: 'shirt_tie',
      clothingColor: '#5E9CA8',
      tieColor: '#18181B',
      hairStyle: 'wavy_stylish',
      hairColor: 'chestnut',
      facialHair: 'none',
      background: 'sky_pastel',
    },
  },
  {
    name: 'Muy Corto / Fade & Saco (Avatar 2)',
    config: {
      skinTone: 'fair',
      glasses: 'round',
      glassesColor: '#18181B',
      clothing: 'turtleneck_jacket',
      clothingColor: '#F59E0B',
      tieColor: '#1E3E62',
      hairStyle: 'buzz_fade',
      hairColor: 'dark_coffee',
      facialHair: 'none',
      background: 'sky_pastel',
    },
  },
  {
    name: 'Raya Lateral & Lentes Cuadrados (Avatar 3)',
    config: {
      skinTone: 'fair',
      glasses: 'square',
      glassesColor: '#18181B',
      clothing: 'shirt_tie',
      clothingColor: '#FFFFFF',
      tieColor: '#18181B',
      hairStyle: 'side_sweep',
      hairColor: 'jet_black',
      facialHair: 'none',
      background: 'lilac_pastel',
    },
  },
  {
    name: 'Flequillo Suave & Tartán (Avatar 4)',
    config: {
      skinTone: 'fair',
      glasses: 'none',
      glassesColor: '#D97706',
      clothing: 'turtleneck_jacket',
      clothingColor: '#4B5563',
      tieColor: '#374151',
      hairStyle: 'curtain_part',
      hairColor: 'burgundy',
      facialHair: 'none',
      background: 'lilac_pastel',
    },
  },
  {
    name: 'Socio Director (Traje y Lentes)',
    config: {
      skinTone: 'medium_light',
      glasses: 'square',
      glassesColor: '#0D5C75',
      clothing: 'suit_formal',
      clothingColor: '#002D42',
      tieColor: '#0D5C75',
      hairStyle: 'short_clean',
      hairColor: 'dark_coffee',
      facialHair: 'none',
      background: 'rb_signature',
    },
  },
  {
    name: 'Corto Cuadrado / Box Cut (Ejecutivo)',
    config: {
      skinTone: 'tan',
      glasses: 'none',
      glassesColor: '#18181B',
      clothing: 'shirt_tie',
      clothingColor: '#0D5C75',
      tieColor: '#18181B',
      hairStyle: 'box_cut',
      hairColor: 'jet_black',
      facialHair: 'none',
      background: 'mint_pastel',
    },
  },
  {
    name: 'Pelón Pulcro & Lentes Intelectuales',
    config: {
      skinTone: 'fair',
      glasses: 'round',
      glassesColor: '#18181B',
      clothing: 'turtleneck_jacket',
      clothingColor: '#4B5563',
      tieColor: '#1E3E62',
      hairStyle: 'bald_clean',
      hairColor: 'dark_coffee',
      facialHair: 'stubble',
      background: 'sky_pastel',
    },
  },
];
