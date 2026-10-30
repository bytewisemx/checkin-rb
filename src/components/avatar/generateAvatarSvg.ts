import type { AvatarConfig } from './avatarConfig';
import {
  SKIN_TONES,
  HAIR_COLORS,
  BACKGROUNDS,
} from './avatarConfig';

/**
 * Genera el string XML de SVG completo, nítido y perfeccionado para el avatar.
 * Todos los peinados son siluetas unificadas y continuas (sin huecos, figuras flotantes ni separaciones).
 * Incluye opciones de cabello ondulado, muy corto/fade, ojos expresivos y lentes transparentes.
 */
export function generateAvatarSvg(config: AvatarConfig, uid = 'avatar'): string {
  const skin = SKIN_TONES[config.skinTone] || SKIN_TONES.fair;
  const hair = HAIR_COLORS[config.hairColor] || HAIR_COLORS.chestnut;
  const bg = BACKGROUNDS[config.background] || BACKGROUNDS.sky_pastel;

  const clipId = `clip-${uid}`;
  const bgGradId = `bg-${uid}`;
  const plaidPatternId = `plaid-${uid}`;

  // Determinamos si la prenda tiene textura/patrón (como los avatares 2 y 4 de la imagen)
  const isPlaid = config.clothing === 'turtleneck_jacket' && (config.clothingColor === '#F59E0B' || config.clothingColor === '#4B5563');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <!-- Clip circular principal -->
    <clipPath id="${clipId}">
      <circle cx="128" cy="128" r="128" />
    </clipPath>

    <!-- Gradiente / Color de Fondo -->
    <linearGradient id="${bgGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="${bg.stops[0]}" />
      <stop offset="100%" stopColor="${bg.stops[1] || bg.stops[0]}" />
    </linearGradient>

    <!-- Textura de cuadros elegante para chaquetas -->
    <pattern id="${plaidPatternId}" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="${config.clothingColor}" />
      <path d="M 0,0 L 16,0 M 0,8 L 16,8 M 0,0 L 0,16 M 8,0 L 8,16" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
      <path d="M 0,4 L 16,4 M 4,0 L 4,16" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
    </pattern>
  </defs>

  <g clip-path="url(#${clipId})">
    <!-- 1. FONDO CIRCULAR (con color sólido de respaldo + gradiente) -->
    <rect width="256" height="256" fill="${bg.stops[0]}" />
    <circle cx="128" cy="128" r="128" fill="url(#${bgGradId})" />

    <!-- 2. CABELLO POSTERIOR (para estilos largos) -->
    ${config.hairStyle === 'long_wavy' || config.hairStyle === 'bob_cut' ? `
      <path d="M72,96 C54,135 50,205 54,256 L202,256 C206,205 202,135 184,96 Z" fill="${hair.shadow}" />
    ` : ''}

    <!-- 3. CUELLO PROPORCIONADO Y SOMBRA DE MANDÍBULA -->
    <!-- Base del cuello con ancho y altura anatómica equilibrada -->
    <path d="M108,132 L108,186 C108,192 116,198 128,198 C140,198 148,192 148,186 L148,132 Z" fill="${skin.base}" />
    
    <!-- Sombra suave curva bajo la barbilla -->
    <path d="M108,148 C116,162 140,162 148,148 L148,156 C140,168 116,168 108,156 Z" fill="${skin.shadow}" opacity="0.8" />

    <!-- 4. ROPA / VESTIMENTA -->
    <g id="body-clothing">
      <!-- Base de hombros continua y armónica -->
      <path d="M44,256 C44,208 74,186 106,182 L150,182 C182,186 212,208 212,256 Z" 
            fill="${isPlaid ? `url(#${plaidPatternId})` : config.clothingColor}" />

      <!-- Líneas de costura de hombros -->
      <line x1="84" y1="212" x2="84" y2="256" stroke="rgba(0,0,0,0.22)" stroke-width="1.6" stroke-linecap="round" />
      <line x1="172" y1="212" x2="172" y2="256" stroke="rgba(0,0,0,0.22)" stroke-width="1.6" stroke-linecap="round" />

      <!-- ESTILO A: CAMISA FORMAL CON CORBATA DELGADA (Estilos 1 y 3 de la imagen) -->
      ${config.clothing === 'shirt_tie' || config.clothing === 'suit_formal' ? `
        <!-- Fondo de cuello de camisa blanco -->
        <polygon points="106,182 128,196 124,182" fill="#FFFFFF" />
        <polygon points="150,182 128,196 132,182" fill="#F1F5F9" />
        
        <!-- Cuello blanco con solapas definidas -->
        <polygon points="104,182 120,204 128,196" fill="#FFFFFF" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" />
        <polygon points="152,182 136,204 128,196" fill="#F8FAFC" stroke="rgba(0,0,0,0.25)" stroke-width="1.5" />

        <!-- Nudo de la corbata delgado -->
        <polygon points="125,196 131,196 133,206 123,206" fill="${config.tieColor || '#18181B'}" />
        <!-- Caída recta elegante de la corbata delgada -->
        <polygon points="123,206 133,206 135,256 121,256" fill="${config.tieColor || '#18181B'}" />

        ${config.clothing === 'suit_formal' ? `
          <!-- Solapas de saco encima bien ajustadas al torso -->
          <polygon points="80,186 112,246 94,256 64,236" fill="${config.clothingColor}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" />
          <polygon points="176,186 144,246 162,256 192,236" fill="${config.clothingColor}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" />
        ` : ''}
      ` : ''}

      <!-- ESTILO B: SUÉTER CUELLO ALTO CON SACO ABIERTO (Estilos 2 y 4 de la imagen) -->
      ${config.clothing === 'turtleneck_jacket' ? `
        <!-- Suéter interior de cuello alto -->
        <path d="M110,172 L146,172 L142,256 L114,256 Z" fill="${config.tieColor || '#1E3E62'}" />
        <polygon points="110,172 146,172 148,190 108,190" fill="${config.tieColor || '#1E3E62'}" />
        <line x1="108" y1="182" x2="148" y2="182" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" />

        <!-- Solapas de la chaqueta sobre los hombros (sin picos que sobresalgan) -->
        <path d="M106,182 L116,256 L54,256 C54,220 78,192 106,182 Z" fill="${isPlaid ? `url(#${plaidPatternId})` : config.clothingColor}" />
        <path d="M150,182 L140,256 L202,256 C202,220 178,192 150,182 Z" fill="${isPlaid ? `url(#${plaidPatternId})` : config.clothingColor}" />
        <line x1="116" y1="188" x2="116" y2="256" stroke="rgba(0,0,0,0.2)" stroke-width="1.8" />
        <line x1="140" y1="188" x2="140" y2="256" stroke="rgba(0,0,0,0.2)" stroke-width="1.8" />
      ` : ''}

      <!-- ESTILO C: CUELLO ALTO MINIMALISTA -->
      ${config.clothing === 'casual_turtleneck' ? `
        <polygon points="110,172 146,172 148,192 108,192" fill="${config.clothingColor}" />
        <line x1="108" y1="183" x2="148" y2="183" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" />
      ` : ''}

      <!-- ESTILO D: POLO EJECUTIVA -->
      ${config.clothing === 'classic_polo' ? `
        <polygon points="106,182 122,196 128,190" fill="rgba(0,0,0,0.15)" />
        <polygon points="150,182 134,196 128,190" fill="rgba(0,0,0,0.25)" />
        <rect x="124" y="190" width="8" height="30" fill="rgba(0,0,0,0.15)" rx="2" />
        <circle cx="128" cy="198" r="1.5" fill="#FFFFFF" />
        <circle cx="128" cy="210" r="1.5" fill="#FFFFFF" />
      ` : ''}
    </g>

    <!-- 5. CABEZA Y MANDÍBULA (Forma ovalada estilizada con barbilla armónica) -->
    <g id="head-structure">
      <!-- Oreja Izquierda pegada al cráneo -->
      <ellipse cx="87" cy="116" rx="5.5" ry="9.5" fill="${skin.base}" />
      <ellipse cx="88" cy="116" rx="3" ry="5.5" fill="${skin.shadow}" opacity="0.4" />
      
      <!-- Oreja Derecha pegada al cráneo -->
      <ellipse cx="169" cy="116" rx="5.5" ry="9.5" fill="${skin.base}" />
      <ellipse cx="168" cy="116" rx="3" ry="5.5" fill="${skin.shadow}" opacity="0.4" />

      <!-- Silueta del rostro: forma armónica con mandíbula suave y barbilla estilizada -->
      <path d="M88,94 C88,56 168,56 168,94 C168,122 154,150 128,150 C102,150 88,122 88,94 Z" fill="${skin.base}" />
    </g>

    <!-- 6. RASGOS FACIALES: OJOS EXPRESIVOS, CEJAS, NARIZ Y SONRISA -->
    <g id="face-features">
      <!-- Cejas elegantes acordes al color de cabello -->
      <path d="M98,102 Q108,98 118,102" stroke="${hair.base}" stroke-width="2.6" stroke-linecap="round" fill="none" />
      <path d="M138,102 Q148,98 158,102" stroke="${hair.base}" stroke-width="2.6" stroke-linecap="round" fill="none" />

      <!-- Ojo Izquierdo -->
      <g>
        <ellipse cx="108" cy="113" rx="7.5" ry="5.5" fill="#FFFFFF" />
        <ellipse cx="109" cy="113" rx="4.5" ry="4.5" fill="#292524" />
        <circle cx="109" cy="113" r="2.5" fill="#09090B" />
        <circle cx="107" cy="111.5" r="1.4" fill="#FFFFFF" />
        <!-- Párpado superior estilizado -->
        <path d="M100.5,112 Q108,107.5 115.5,112" stroke="#18181B" stroke-width="1.8" fill="none" stroke-linecap="round" />
      </g>

      <!-- Ojo Derecho -->
      <g>
        <ellipse cx="148" cy="113" rx="7.5" ry="5.5" fill="#FFFFFF" />
        <ellipse cx="147" cy="113" rx="4.5" ry="4.5" fill="#292524" />
        <circle cx="147" cy="113" r="2.5" fill="#09090B" />
        <circle cx="145" cy="111.5" r="1.4" fill="#FFFFFF" />
        <!-- Párpado superior estilizado -->
        <path d="M140.5,112 Q148,107.5 155.5,112" stroke="#18181B" stroke-width="1.8" fill="none" stroke-linecap="round" />
      </g>

      <!-- Nariz sutil y limpia -->
      <path d="M128,110 L126,124 Q128,127 132,125" stroke="${skin.shadow}" stroke-width="1.8" stroke-linecap="round" fill="none" />

      <!-- Sonrisa amable profesional -->
      <path d="M119,136 Q128,143 137,136" stroke="#991B1B" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M121,137 Q128,141 135,137" fill="#FFFFFF" opacity="0.9" />
    </g>

    <!-- 7. LENTES / ANTEOJOS (Transparentes sobre los ojos con reflejo de luz) -->
    ${config.glasses !== 'none' ? `
      <g id="glasses-layer">
        <!-- LENTES CUADRADOS MODERNOS -->
        ${config.glasses === 'square' ? `
          <rect x="94" y="104" width="28" height="19" rx="3" fill="rgba(255,255,255,0.22)" stroke="${config.glassesColor}" stroke-width="2.4" />
          <rect x="134" y="104" width="28" height="19" rx="3" fill="rgba(255,255,255,0.22)" stroke="${config.glassesColor}" stroke-width="2.4" />
          <line x1="122" y1="112" x2="134" y2="112" stroke="${config.glassesColor}" stroke-width="2.4" />
          <line x1="94" y1="111" x2="85" y2="113" stroke="${config.glassesColor}" stroke-width="2" />
          <line x1="162" y1="111" x2="171" y2="113" stroke="${config.glassesColor}" stroke-width="2" />
          <!-- Reflejo diagonal de cristal -->
          <line x1="98" y1="107" x2="106" y2="119" stroke="#FFFFFF" stroke-width="1.5" opacity="0.6" stroke-linecap="round" />
          <line x1="138" y1="107" x2="146" y2="119" stroke="#FFFFFF" stroke-width="1.5" opacity="0.6" stroke-linecap="round" />
        ` : ''}

        <!-- LENTES REDONDOS INTELECTUALES -->
        ${config.glasses === 'round' ? `
          <circle cx="108" cy="114" r="13" fill="rgba(255,255,255,0.22)" stroke="${config.glassesColor}" stroke-width="2.4" />
          <circle cx="148" cy="114" r="13" fill="rgba(255,255,255,0.22)" stroke="${config.glassesColor}" stroke-width="2.4" />
          <path d="M121,113 Q128,109 135,113" fill="none" stroke="${config.glassesColor}" stroke-width="2.4" />
          <line x1="95" y1="113" x2="85" y2="115" stroke="${config.glassesColor}" stroke-width="2" />
          <line x1="161" y1="113" x2="171" y2="115" stroke="${config.glassesColor}" stroke-width="2" />
          <path d="M102,108 A7,7 0 0,1 112,106" stroke="#FFFFFF" stroke-width="1.5" fill="none" opacity="0.7" />
          <path d="M142,108 A7,7 0 0,1 152,106" stroke="#FFFFFF" stroke-width="1.5" fill="none" opacity="0.7" />
        ` : ''}

        <!-- GAFAS OSCURAS POLARIZADAS -->
        ${config.glasses === 'sunglasses' ? `
          <rect x="92" y="103" width="31" height="21" rx="4" fill="#18181B" stroke="${config.glassesColor}" stroke-width="2.4" />
          <rect x="133" y="103" width="31" height="21" rx="4" fill="#18181B" stroke="${config.glassesColor}" stroke-width="2.4" />
          <line x1="123" y1="111" x2="133" y2="111" stroke="${config.glassesColor}" stroke-width="2.8" />
          <polygon points="95,105 104,105 98,122 94,122" fill="rgba(255,255,255,0.3)" />
          <polygon points="136,105 145,105 139,122 135,122" fill="rgba(255,255,255,0.3)" />
        ` : ''}

        <!-- MEDIO MARCO / SEMI-RIMLESS -->
        ${config.glasses === 'semi_rimless' ? `
          <path d="M94,110 L122,110 C122,120 118,124 108,124 C98,124 94,120 94,110 Z" fill="rgba(255,255,255,0.2)" stroke="${config.glassesColor}" stroke-width="2.2" />
          <path d="M134,110 L162,110 C162,120 158,124 148,124 C138,124 134,120 134,110 Z" fill="rgba(255,255,255,0.2)" stroke="${config.glassesColor}" stroke-width="2.2" />
          <line x1="122" y1="111" x2="134" y2="111" stroke="${config.glassesColor}" stroke-width="2.2" />
        ` : ''}
      </g>
    ` : ''}

    <!-- 8. CABELLO: SILUETAS UNIFICADAS CONTINUAS (Sin cortes, hendiduras ni huecos) -->
    <g id="hair-layer" fill="${hair.base}">
      
      <!-- PEINADO: CORTO CUADRADO / BOX CUT (box_cut) - Silueta geométrica limpia con tope recto y degradado -->
      ${config.hairStyle === 'box_cut' ? `
        <!-- Masa rectangular superior con esquinas nítidas y corte recto en sienes -->
        <path d="M84,96 L84,54 C84,48 88,46 94,46 L162,46 C168,46 172,48 172,54 L172,96 C166,90 156,84 140,84 L116,84 C100,84 90,90 84,96 Z" />
        <!-- Línea horizontal de luz y textura plana en el tope superior -->
        <line x1="94" y1="52" x2="162" y2="52" stroke="${hair.highlight}" stroke-width="2.2" stroke-linecap="round" opacity="0.6" />
        <!-- Sutil degradado/fade limpio en las sienes -->
        <path d="M84,98 L84,86 C88,84 96,84 104,84 L104,87 C96,87 88,89 84,98 Z" fill="${hair.shadow}" opacity="0.35" />
        <path d="M172,98 L172,86 C168,84 160,84 152,84 L152,87 C160,87 168,89 172,98 Z" fill="${hair.shadow}" opacity="0.35" />
      ` : ''}

      <!-- PEINADO: PELÓN / CALVO PULCRO (bald_clean) - Cráneo afeitado limpio con brillo de estudio y contorno liso -->
      ${config.hairStyle === 'bald_clean' ? `
        <!-- Iluminación y reflejo suave en la coronilla pulcra -->
        <ellipse cx="128" cy="68" rx="22" ry="7" fill="rgba(255,255,255,0.24)" />
        <ellipse cx="124" cy="66" rx="10" ry="3.5" fill="rgba(255,255,255,0.38)" />
        <!-- Borde sutil superior para definición del perfil craneal -->
        <path d="M90,94 C90,60 166,60 166,94" stroke="${skin.shadow}" stroke-width="1.8" fill="none" opacity="0.4" stroke-linecap="round" />
      ` : ''}

      <!-- PEINADO 1: ONDULADO CON ESTILO (wavy_stylish) -->
      ${config.hairStyle === 'wavy_stylish' ? `
        <!-- Masa única de cabello ondulado que cubre el cráneo y cae en ondas suaves y continuas sobre la frente -->
        <path d="M84,98 C78,50 114,40 144,42 C174,44 180,68 180,98 C176,98 168,90 158,94 C148,88 138,88 128,94 C116,88 104,90 96,96 C90,92 86,96 84,98 Z" />
        <!-- Ondas sutiles continuas que dan volumen sin separar figuras -->
        <path d="M92,62 Q108,50 126,56 Q144,48 162,58" fill="none" stroke="${hair.highlight}" stroke-width="2.2" stroke-linecap="round" opacity="0.6" />
        <path d="M98,76 Q118,66 138,72 Q152,68 166,76" fill="none" stroke="${hair.highlight}" stroke-width="1.8" stroke-linecap="round" opacity="0.4" />
      ` : ''}

      <!-- PEINADO 2: MUY CORTO / FADE EJECUTIVO (buzz_fade) - Frente completamente despejada -->
      ${config.hairStyle === 'buzz_fade' ? `
        <!-- Corte militar/buzz limpio pegado a la cabeza sin flequillo -->
        <path d="M86,94 C84,56 114,48 138,48 C162,48 174,58 174,94 C170,88 164,82 148,82 C132,82 120,82 108,82 C96,82 90,88 86,94 Z" />
        <!-- Degradado sutil en los laterales -->
        <path d="M86,104 L86,94 C92,86 102,82 118,82 L118,86 C104,86 94,92 88,104 Z" fill="${hair.shadow}" opacity="0.3" />
        <path d="M174,104 L174,94 C168,86 158,82 142,82 L142,86 C156,86 166,92 172,104 Z" fill="${hair.shadow}" opacity="0.3" />
      ` : ''}

      <!-- PEINADO 3: CORTO CLÁSICO PULCRO (short_clean) -->
      ${config.hairStyle === 'short_clean' ? `
        <!-- Corte tradicional formal sin flequillos extraños -->
        <path d="M84,96 C80,52 116,46 144,48 C172,50 178,70 178,96 C168,88 154,82 136,82 C116,82 98,88 84,96 Z" />
        <path d="M102,68 Q128,58 156,66" fill="none" stroke="${hair.highlight}" stroke-width="2" stroke-linecap="round" opacity="0.5" />
      ` : ''}

      <!-- PEINADO 4: RAYA AL LADO ELEGANTE (side_sweep) -->
      ${config.hairStyle === 'side_sweep' ? `
        <!-- Cabello peinado de lado en una sola masa sin hendiduras -->
        <path d="M84,98 C78,48 116,42 148,46 C176,50 178,74 178,98 C166,90 148,86 130,88 C112,88 96,92 84,98 Z" />
        <path d="M96,62 Q126,52 160,60" fill="none" stroke="${hair.highlight}" stroke-width="2" stroke-linecap="round" opacity="0.6" />
      ` : ''}

      <!-- PEINADO 5: FLEQUILLO NATURAL SUAVE (curtain_part) - Masa unificada continua -->
      ${config.hairStyle === 'curtain_part' ? `
        <!-- Una silueta continua: sube en el centro con una suave curvatura que enmarca la frente -->
        <path d="M84,98 C78,48 116,42 146,44 C176,46 180,70 180,98 C174,94 162,90 150,92 C138,94 132,90 128,88 C124,90 118,94 106,92 C94,90 88,94 84,98 Z" />
        <path d="M98,64 Q128,54 158,62" fill="none" stroke="${hair.highlight}" stroke-width="2" stroke-linecap="round" opacity="0.5" />
      ` : ''}

      <!-- PEINADO 6: ESTILO COMMA COREANO (comma_bangs) -->
      ${config.hairStyle === 'comma_bangs' ? `
        <!-- Silueta unificada con volumen superior y caída en coma continua -->
        <path d="M84,98 C78,46 116,40 146,42 C176,44 180,68 180,98 C172,92 156,88 142,90 C130,92 122,88 116,92 C108,96 96,92 84,98 Z" />
        <polygon points="156,42 172,36 164,50" />
      ` : ''}

      <!-- PEINADO 7: RIZADO CON TEXTURA (curly_crop) -->
      ${config.hairStyle === 'curly_crop' ? `
        <path d="M84,98 C76,46 118,38 148,42 C178,46 180,72 180,98 C172,92 156,88 138,88 C116,88 98,92 84,98 Z" />
        <circle cx="94" cy="72" r="10" />
        <circle cx="114" cy="58" r="12" />
        <circle cx="138" cy="56" r="12" />
        <circle cx="160" cy="68" r="10" />
      ` : ''}

      <!-- PEINADO 8: PEINADO HACIA ATRÁS EJECUTIVO (slick_back) -->
      ${config.hairStyle === 'slick_back' ? `
        <!-- Peinado hacia atrás con frente limpia y volumen superior -->
        <path d="M86,96 C82,50 114,44 140,44 C168,44 176,64 176,96 C170,88 158,80 140,80 C122,80 102,84 86,96 Z" />
        <line x1="110" y1="52" x2="110" y2="78" stroke="${hair.highlight}" stroke-width="1.8" opacity="0.4" stroke-linecap="round" />
        <line x1="128" y1="48" x2="128" y2="76" stroke="${hair.highlight}" stroke-width="1.8" opacity="0.5" stroke-linecap="round" />
        <line x1="146" y1="52" x2="146" y2="78" stroke="${hair.highlight}" stroke-width="1.8" opacity="0.4" stroke-linecap="round" />
      ` : ''}

      <!-- PEINADO 9: LARGO ONDULADO (long_wavy) -->
      ${config.hairStyle === 'long_wavy' ? `
        <path d="M84,96 C80,50 120,44 146,46 C174,48 178,72 178,96 C168,88 152,84 136,86 C120,86 104,90 84,96 Z" />
        <path d="M84,96 C78,136 74,180 80,216 C86,182 92,142 90,102 Z" />
        <path d="M178,96 C184,136 188,180 182,216 C176,182 170,142 172,102 Z" />
      ` : ''}

      <!-- PEINADO 10: MELENA BOB (bob_cut) -->
      ${config.hairStyle === 'bob_cut' ? `
        <path d="M82,98 C78,52 116,46 144,46 C172,46 178,70 178,98 C178,132 170,156 164,160 C166,132 164,88 138,78 C116,78 98,88 94,132 C88,156 82,132 82,98 Z" />
      ` : ''}
    </g>

    <!-- 9. VELLO FACIAL SUTIL (Opcional) -->
    ${config.facialHair === 'stubble' ? `
      <path d="M106,142 C114,148 142,148 150,142 C144,148 136,150 128,150 C120,150 112,148 106,142 Z" fill="${hair.base}" opacity="0.25" />
    ` : ''}
    ${config.facialHair === 'mustache' ? `
      <polygon points="116,132 140,132 134,138 122,138" fill="${hair.base}" />
    ` : ''}
    ${config.facialHair === 'goatee' ? `
      <polygon points="116,132 140,132 134,138 122,138" fill="${hair.base}" />
      <polygon points="122,140 134,140 132,146 124,146" fill="${hair.base}" />
    ` : ''}
  </g>
</svg>
  `.trim();
}

/**
 * Convierte un string SVG en un Data URL SVG seguro y codificado.
 */
export function svgToDataUrl(svgString: string): string {
  let clean = svgString.trim();
  if (!clean.includes('xmlns="http://www.w3.org/2000/svg"')) {
    clean = clean.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
}

/**
 * Renderiza el SVG en un Canvas y exporta una imagen PNG nítida (Data URL).
 * Garantiza compatibilidad universal en todas las etiquetas <img> y estados de React.
 */
export function exportAvatarToPng(svgString: string, size = 512): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgUrl = svgToDataUrl(svgString);

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            const pngUrl = canvas.toDataURL('image/png');
            resolve(pngUrl);
            return;
          }
        } catch {
          // Si canvas tiene algún problema de contexto, retornamos el SVG DataURL limpio
        }
        resolve(svgUrl);
      };

      img.onerror = () => {
        resolve(svgUrl);
      };

      img.src = svgUrl;
    } catch {
      resolve(svgToDataUrl(svgString));
    }
  });
}
