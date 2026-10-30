import { useState, useId } from 'react';
import type { FC } from 'react';
import type {
  AvatarConfig,
  SkinToneId,
  GlassesStyleId,
  ClothingStyleId,
  HairStyleId,
  HairColorId,
  BackgroundId,
} from './avatarConfig';
import {
  SKIN_TONES,
  HAIR_COLORS,
  CLOTHING_COLORS,
  TIE_COLORS,
  GLASSES_COLORS,
  BACKGROUNDS,
  DEFAULT_AVATAR_CONFIG,
  AVATAR_PRESETS,
} from './avatarConfig';
import { AvatarRenderer } from './AvatarRenderer';
import { generateAvatarSvg, exportAvatarToPng } from './generateAvatarSvg';
import { 
  X, Sparkles, Check, RefreshCw, Palette, 
  Glasses, Shirt, UserCheck, Image as ImageIcon,
  Dices, Loader2
} from 'lucide-react';

interface AvatarCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAvatar: (avatarDataUrl: string) => void;
  initialConfig?: Partial<AvatarConfig>;
}

type TabCategory = 'skin' | 'hair' | 'clothing' | 'glasses' | 'background';

export const AvatarCreatorModal: FC<AvatarCreatorModalProps> = ({
  isOpen,
  onClose,
  onSaveAvatar,
  initialConfig,
}) => {
  const [config, setConfig] = useState<AvatarConfig>({
    ...DEFAULT_AVATAR_CONFIG,
    ...initialConfig,
  });

  const [activeTab, setActiveTab] = useState<TabCategory>('skin');
  const [isExporting, setIsExporting] = useState(false);
  const previewId = useId().replace(/:/g, '');

  if (!isOpen) return null;

  // Actualizador genérico de propiedades del avatar
  const update = <K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Generador aleatorio de combinaciones
  const handleRandomize = () => {
    const skinKeys = Object.keys(SKIN_TONES) as SkinToneId[];
    const hairStyleKeys = ['box_cut', 'bald_clean', 'wavy_stylish', 'buzz_fade', 'short_clean', 'side_sweep', 'curtain_part', 'comma_bangs', 'curly_crop', 'slick_back'] as HairStyleId[];
    const hairColorKeys = Object.keys(HAIR_COLORS) as HairColorId[];
    const glassesKeys: GlassesStyleId[] = ['none', 'none', 'none', 'square', 'round', 'sunglasses'];
    const clothingKeys: ClothingStyleId[] = ['shirt_tie', 'turtleneck_jacket', 'suit_formal', 'casual_turtleneck', 'classic_polo'];
    const bgKeys = Object.keys(BACKGROUNDS) as BackgroundId[];

    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    setConfig({
      skinTone: pick(skinKeys),
      glasses: pick(glassesKeys),
      glassesColor: pick(GLASSES_COLORS).hex,
      clothing: pick(clothingKeys),
      clothingColor: pick(CLOTHING_COLORS).hex,
      tieColor: pick(TIE_COLORS).hex,
      hairStyle: pick(hairStyleKeys),
      hairColor: pick(hairColorKeys),
      facialHair: 'none',
      background: pick(bgKeys),
    });
  };

  // Exportar el Avatar generado a una imagen DataURL de alta resolución
  const handleSave = async () => {
    setIsExporting(true);
    try {
      // 1. Generamos el SVG puro bien formado sin dependencias del DOM
      const svgMarkup = generateAvatarSvg(config, `export-${Date.now()}`);
      
      // 2. Lo convertimos a una imagen PNG de alta resolución (512x512) infalible en <img>
      const finalImage = await exportAvatarToPng(svgMarkup, 512);

      // 3. Pasamos la imagen a la foto de perfil y cerramos
      onSaveAvatar(finalImage);
      onClose();
    } catch {
      // Fallback a SVG codificado
      const svgMarkup = generateAvatarSvg(config, `export-${Date.now()}`);
      onSaveAvatar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabecera del Estudio */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/40">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D5C75] to-cyan-500 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Creador de Avatar Ilustrado
              </h2>
              <p className="text-[11px] text-slate-500">
                Diseño minimalista moderno: personaliza piel, peinado, ropa, lentes y fondo
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRandomize}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#0D5C75] text-xs font-bold text-slate-700 hover:text-[#0D5C75] transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              title="Generar combinación al azar"
            >
              <Dices className="w-4 h-4 text-[#FF6B35]" />
              <span className="hidden sm:inline">Sorpréndeme</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          
          {/* LADO IZQUIERDO: Previsualización en Vivo & Plantillas */}
          <div className="md:col-span-5 p-5 flex flex-col items-center justify-between bg-gradient-to-b from-slate-50/70 to-white">
            
            <div className="w-full flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Vista Previa en Tiempo Real
              </span>

              {/* Contenedor del Avatar SVG */}
              <div className="relative group">
                <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full p-2 bg-gradient-to-tr from-slate-200 via-white to-blue-200 shadow-xl border border-slate-200/80">
                  <div className="w-full h-full rounded-full bg-white overflow-hidden shadow-inner flex items-center justify-center">
                    <AvatarRenderer 
                      config={config} 
                      size="100%" 
                      className="w-full h-full"
                      idPrefix={`preview-${previewId}`}
                    />
                  </div>
                </div>

                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                  <span className="text-[10px] font-bold bg-slate-900/80 backdrop-blur-xs text-white px-3 py-0.5 rounded-full shadow-xs">
                    Russell Bedford ID
                  </span>
                </div>
              </div>

              {/* Selector de Plantillas / Presets de la Imagen */}
              <div className="w-full mt-6 pt-4 border-t border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    Plantillas de la Imagen
                  </span>
                  <span className="text-[10px] text-slate-400">Clic para aplicar</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setConfig(preset.config)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-[#0D5C75] bg-white hover:bg-blue-50/40 text-left text-xs font-semibold text-slate-700 hover:text-[#0D5C75] transition-all cursor-pointer flex items-center space-x-1.5"
                    >
                      <Sparkles className="w-3 h-3 text-[#0D5C75] shrink-0" />
                      <span className="truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Botón de Reset */}
            <div className="w-full pt-4 mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setConfig(DEFAULT_AVATAR_CONFIG)}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Restablecer a valores iniciales</span>
              </button>
            </div>
          </div>

          {/* LADO DERECHO: Pestañas de Ajuste Fino */}
          <div className="md:col-span-7 flex flex-col h-full bg-white">
            
            {/* Barra de Pestañas */}
            <div className="flex border-b border-slate-200 px-4 pt-3 space-x-1 overflow-x-auto no-scrollbar bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab('skin')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  activeTab === 'skin'
                    ? 'border-[#0D5C75] text-[#0D5C75] bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Piel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('hair')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  activeTab === 'hair'
                    ? 'border-[#0D5C75] text-[#0D5C75] bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Cabello</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('clothing')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  activeTab === 'clothing'
                    ? 'border-[#0D5C75] text-[#0D5C75] bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>Ropa</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('glasses')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  activeTab === 'glasses'
                    ? 'border-[#0D5C75] text-[#0D5C75] bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Glasses className="w-3.5 h-3.5" />
                <span>Lentes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('background')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                  activeTab === 'background'
                    ? 'border-[#0D5C75] text-[#0D5C75] bg-white shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Fondo</span>
              </button>
            </div>

            {/* Contenido de la Pestaña Activa */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              
              {/* TAB 1: TONO DE PIEL */}
              {activeTab === 'skin' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                      1. Selecciona el Tono de Piel
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tono plano ilustrado con sombra trapezoidal bajo la barbilla, idéntico a la imagen.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(Object.keys(SKIN_TONES) as SkinToneId[]).map((key) => {
                      const tone = SKIN_TONES[key];
                      const isSelected = config.skinTone === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update('skinTone', key)}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
                            isSelected
                              ? 'border-[#0D5C75] bg-blue-50/60 ring-2 ring-[#0D5C75]/20 shadow-xs'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className="w-8 h-8 rounded-full shrink-0 border border-black/10 shadow-inner flex items-center justify-center"
                            style={{ backgroundColor: tone.base }}
                          >
                            {isSelected && <Check className="w-4 h-4 text-slate-800 stroke-[3]" />}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {tone.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: CABELLO */}
              {activeTab === 'hair' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                      1. Estilo de Peinado
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Flequillos modernos, raya en medio y mechones según la referencia gráfica.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'box_cut', label: '⏹️ Corto Cuadrado (Box Cut)' },
                      { id: 'bald_clean', label: '👨‍🦲 Pelón / Calvo Pulcro' },
                      { id: 'wavy_stylish', label: '🌊 Ondulado con Estilo' },
                      { id: 'buzz_fade', label: '✂️ Muy Corto / Fade' },
                      { id: 'short_clean', label: '👔 Corto Clásico Pulcro' },
                      { id: 'side_sweep', label: '✨ Raya Lateral Fluida' },
                      { id: 'curtain_part', label: '💫 Flequillo Natural Suave' },
                      { id: 'comma_bangs', label: '🔥 Estilo Coma Moderno' },
                      { id: 'curly_crop', label: '🌀 Rizado con Textura' },
                      { id: 'slick_back', label: '🎩 Peinado Hacia Atrás' },
                      { id: 'long_wavy', label: '💁 Melena Larga Ondulada' },
                      { id: 'bob_cut', label: '✨ Melena Bob Moderna' },
                    ].map((opt) => {
                      const isSelected = config.hairStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => update('hairStyle', opt.id as HairStyleId)}
                          className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0D5C75] bg-blue-50/60 text-[#0D5C75] ring-2 ring-[#0D5C75]/20 font-black shadow-xs'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                          } text-xs`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                      2. Color de Cabello
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.keys(HAIR_COLORS) as HairColorId[]).map((key) => {
                        const col = HAIR_COLORS[key];
                        const isSelected = config.hairColor === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => update('hairColor', key)}
                            className={`p-2 rounded-xl border flex items-center space-x-2 transition-all cursor-pointer ${
                              isSelected ? 'border-[#0D5C75] ring-2 ring-[#0D5C75]/20 bg-blue-50/30' : 'border-slate-200'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-xs"
                              style={{ backgroundColor: col.base }}
                            />
                            <span className="text-[10px] font-bold text-slate-700 truncate">
                              {col.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ROPA */}
              {activeTab === 'clothing' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                      1. Tipo de Prenda
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Camisas con corbata delgada o chaquetas sobre suéter de cuello alto como en la foto.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'shirt_tie', label: 'Camisa Formal + Corbata Delgada' },
                      { id: 'turtleneck_jacket', label: 'Chaqueta / Saco + Cuello Alto' },
                      { id: 'suit_formal', label: 'Traje Sastre Completo' },
                      { id: 'casual_turtleneck', label: 'Suéter de Cuello Alto Minimal' },
                      { id: 'classic_polo', label: 'Polo Ejecutiva' },
                    ].map((opt) => {
                      const isSelected = config.clothing === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => update('clothing', opt.id as ClothingStyleId)}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0D5C75] bg-blue-50/60 text-[#0D5C75] ring-2 ring-[#0D5C75]/20 font-black shadow-xs'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                          } text-xs`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                      2. Color de la Prenda
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CLOTHING_COLORS.map((col) => {
                        const isSelected = config.clothingColor === col.hex;
                        return (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => update('clothingColor', col.hex)}
                            className={`p-2 rounded-xl border flex items-center space-x-2 transition-all cursor-pointer ${
                              isSelected ? 'border-[#0D5C75] ring-2 ring-[#0D5C75]/20 bg-blue-50/30' : 'border-slate-200'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-xs"
                              style={{ backgroundColor: col.hex }}
                            />
                            <span className="text-[10px] font-bold text-slate-700 truncate">
                              {col.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(config.clothing === 'shirt_tie' || config.clothing === 'turtleneck_jacket' || config.clothing === 'suit_formal') && (
                    <div className="pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                        3. Color de Corbata / Cuello Alto Interior
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {TIE_COLORS.map((col) => {
                          const isSelected = config.tieColor === col.hex;
                          return (
                            <button
                              key={col.hex}
                              type="button"
                              onClick={() => update('tieColor', col.hex)}
                              className={`p-2 rounded-xl border flex items-center space-x-2 transition-all cursor-pointer ${
                                isSelected ? 'border-[#0D5C75] ring-2 ring-[#0D5C75]/20 bg-blue-50/30' : 'border-slate-200'
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full border border-black/10 shrink-0 shadow-xs"
                                style={{ backgroundColor: col.hex }}
                              />
                              <span className="text-[10px] font-bold text-slate-700 truncate">
                                {col.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: LENTES */}
              {activeTab === 'glasses' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                      Estilo de Lentes
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Marcos vectoriales delgados adaptados al diseño minimalista.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'none', label: 'Sin Lentes' },
                      { id: 'square', label: 'Cuadrados Finos' },
                      { id: 'round', label: 'Redondos Minimal' },
                      { id: 'semi_rimless', label: 'Medio Marco' },
                      { id: 'sunglasses', label: 'Gafas Oscuras' },
                    ].map((opt) => {
                      const isSelected = config.glasses === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => update('glasses', opt.id as GlassesStyleId)}
                          className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#0D5C75] bg-blue-50/60 text-[#0D5C75] ring-2 ring-[#0D5C75]/20 font-black shadow-xs'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                          } text-xs`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {config.glasses !== 'none' && (
                    <div className="pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                        Color de Montura
                      </h4>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {GLASSES_COLORS.map((col) => {
                          const isSelected = config.glassesColor === col.hex;
                          return (
                            <button
                              key={col.hex}
                              type="button"
                              onClick={() => update('glassesColor', col.hex)}
                              className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                                isSelected ? 'border-[#0D5C75] ring-2 ring-[#0D5C75]/20 bg-blue-50/30' : 'border-slate-200'
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: col.hex }}
                              />
                              <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                                {col.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: FONDO */}
              {activeTab === 'background' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-1">
                      Fondo Circular
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Colores pastel suaves como en la referencia y degradados corporativos.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(BACKGROUNDS) as BackgroundId[]).map((key) => {
                      const bg = BACKGROUNDS[key];
                      const isSelected = config.background === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => update('background', key)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
                            isSelected
                              ? 'border-[#0D5C75] bg-blue-50/60 ring-2 ring-[#0D5C75]/20 shadow-xs'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className="w-9 h-9 rounded-full shrink-0 border border-black/10 shadow-xs flex items-center justify-center"
                            style={{
                              background: `linear-gradient(135deg, ${bg.stops[0]}, ${bg.stops[1]})`,
                            }}
                          >
                            {isSelected && <Check className="w-4 h-4 text-slate-800 stroke-[3]" />}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {bg.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Círculo Pastel
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Barra de Acciones Inferior */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isExporting}
                onClick={handleSave}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0D5C75] to-cyan-600 hover:from-[#0a4b60] hover:to-cyan-700 text-white text-xs font-black shadow-md shadow-[#0D5C75]/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando avatar...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Guardar y Establecer como Foto</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
