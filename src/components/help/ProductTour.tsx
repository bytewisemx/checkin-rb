import { useState, useEffect, useRef, useCallback } from 'react';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ProductTour() {
  const { activeTour, currentStepIndex, nextStep, prevStep, endTour } = useHelpTourStore();
  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [isTargetVisible, setIsTargetVisible] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const currentStep = activeTour?.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = activeTour ? currentStepIndex === activeTour.steps.length - 1 : false;
  const totalSteps = activeTour?.steps.length || 0;

  // Medir y enfocar el elemento target
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      setIsTargetVisible(false);
      return;
    }

    const element = document.querySelector(currentStep.target);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setIsTargetVisible(true);
    } else {
      setTargetRect(null);
      setIsTargetVisible(false);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!activeTour || !currentStep) return;

    // Intentar buscar el elemento y hacer scroll
    const element = document.querySelector(currentStep.target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Actualizar inmediatamente y tras una breve pausa para transiciones de scroll
    updateTargetPosition();
    const timeout1 = setTimeout(updateTargetPosition, 100);
    const timeout2 = setTimeout(updateTargetPosition, 400);

    const handleScrollOrResize = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [activeTour, currentStepIndex, currentStep, updateTargetPosition]);

  if (!activeTour || !currentStep) return null;

  // Cálculo de coordenadas para ubicar el popover flotante
  const getPopoverStyle = () => {
    if (!targetRect || !isTargetVisible) {
      // Posición central si el elemento no está en pantalla
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 12;
    const popoverWidth = 360;
    const popoverHeight = 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calcular posición vertical: preferir abajo si hay espacio, si no arriba
    const spaceBelow = viewportHeight - (targetRect.top + targetRect.height);
    const placeBelow = spaceBelow >= popoverHeight + padding;

    let top = placeBelow
      ? targetRect.top + targetRect.height + padding
      : Math.max(padding, targetRect.top - popoverHeight - padding);

    // Calcular posición horizontal centrada con respecto al target
    let left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;

    // Restringir a los límites de la pantalla
    if (left < padding) left = padding;
    if (left + popoverWidth > viewportWidth - padding) {
      left = viewportWidth - popoverWidth - padding;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* 1. Fondo Oscuro con Recorte Spotlight SVG */}
      <svg className="w-full h-full fixed inset-0 pointer-events-none transition-all duration-300">
        <defs>
          <mask id="spotlight-mask">
            {/* Relleno blanco cubre toda la pantalla */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Recorte negro transparente sobre el elemento target */}
            {isTargetVisible && targetRect && (
              <rect
                x={Math.max(0, targetRect.left - 6)}
                y={Math.max(0, targetRect.top - 6)}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(11, 17, 30, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* 2. Anillo Iluminado (Highlight Ring) alrededor del target */}
      {isTargetVisible && targetRect && (
        <div
          className="fixed rounded-lg border-2 border-blue-500 dark:border-sky-400 pointer-events-none transition-all duration-300 ring-4 ring-blue-500/30 dark:ring-sky-400/30 shadow-lg animate-pulse"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* 3. Popover Explicativo Paso a Paso */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="fixed w-[92vw] sm:w-[380px] bg-white dark:bg-[#131D31] text-slate-800 dark:text-[#F8FAFC] rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-[#233354] transition-all duration-300 z-[110]"
      >
        {/* Encabezado del Popover */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#233354]">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center font-heading font-bold text-xs shrink-0">
              {currentStepIndex + 1}
            </span>
            <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
              Paso {currentStepIndex + 1} de {totalSteps}
            </span>
          </div>

          <button
            onClick={endTour}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A2742] transition-colors cursor-pointer"
            title="Cerrar guía"
            aria-label="Cerrar guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Progreso del Tour */}
        <div className="w-full h-1 bg-slate-100 dark:bg-[#0B111E] rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-blue-600 dark:bg-sky-400 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Contenido del Paso */}
        <div className="py-3.5 space-y-2">
          {currentStep.title && (
            <h4 className="font-['Space_Grotesk'] text-sm font-bold text-slate-900 dark:text-white">
              {currentStep.title}
            </h4>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStep.text}
          </p>

          {!isTargetVisible && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start space-x-2 mt-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                El elemento resaltado ({currentStep.target}) se encuentra en otra vista o pestaña de la interfaz. Navega a la sección correspondiente para visualizarlo.
              </span>
            </div>
          )}
        </div>

        {/* Botones de Control de la Guía */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#233354] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={endTour}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            Cerrar guía
          </button>

          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevStep}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#233354] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2742] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-heading font-semibold transition-colors shadow-xs cursor-pointer flex items-center space-x-1"
            >
              <span>{isLastStep ? 'Finalizar' : 'Siguiente paso'}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
