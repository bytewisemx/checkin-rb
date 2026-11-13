import { useState, useEffect, useRef, useCallback } from 'react';
import { useHelpTourStore } from '../../store/useHelpTourStore';
import { X, ChevronRight, ChevronLeft, Check, Compass } from 'lucide-react';

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

  // Actualizar coordenadas del elemento objetivo
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      setIsTargetVisible(false);
      return null;
    }

    const element = document.querySelector(currentStep.target) as HTMLElement | null;
    if (element) {
      const rect = element.getBoundingClientRect();
      const isVisibleOnScreen =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth;

      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      setIsTargetVisible(isVisibleOnScreen);
      return element;
    }

    setTargetRect(null);
    setIsTargetVisible(false);
    return null;
  }, [currentStep]);

  // Manejo de foco, scroll, observador de mutaciones y clic real para auto-avance
  useEffect(() => {
    if (!activeTour || !currentStep) return;

    let targetElement: HTMLElement | null = null;

    const handleTargetClick = () => {
      // Avanzar automáticamente cuando el usuario interactúa con el elemento
      nextStep();
    };

    const attachListener = (el: HTMLElement) => {
      if (targetElement !== el) {
        if (targetElement) {
          targetElement.removeEventListener('click', handleTargetClick);
        }
        targetElement = el;
        targetElement.addEventListener('click', handleTargetClick);
      }
    };

    // 1. Búsqueda y scroll inmediato
    const el = updateTargetPosition();
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      attachListener(el);
    }

    // 2. Reintentos y escucha de cambios dinámicos (scroll / resize)
    const handleScrollOrResize = () => {
      const found = updateTargetPosition();
      if (found) attachListener(found);
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    // 3. MutationObserver para detectar si el elemento se monta tras un cambio de pestaña o carga remota
    const observer = new MutationObserver(() => {
      const found = updateTargetPosition();
      if (found) attachListener(found);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // 4. Sondeo de respaldo cada 400ms mientras esté activo
    const interval = setInterval(() => {
      const found = updateTargetPosition();
      if (found) attachListener(found);
    }, 400);

    return () => {
      if (targetElement) {
        targetElement.removeEventListener('click', handleTargetClick);
      }
      observer.disconnect();
      clearInterval(interval);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [activeTour, currentStepIndex, currentStep, nextStep, updateTargetPosition]);

  if (!activeTour || !currentStep) return null;

  // Cálculo de coordenadas del Popover flotante
  const getPopoverStyle = () => {
    const padding = 16;
    const popoverWidth = 320; // w-80 = 20rem = 320px
    const estimatedHeight = 220;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!targetRect || !isTargetVisible) {
      // Si el elemento aún no está en pantalla, colocar en esquina inferior derecha sin tapar el centro
      return {
        bottom: `${padding}px`,
        right: `${padding}px`,
      };
    }

    // Preferir abajo si cabe, de lo contrario arriba
    const spaceBelow = viewportHeight - (targetRect.top + targetRect.height);
    const placeBelow = spaceBelow >= estimatedHeight + padding;

    let top = placeBelow
      ? targetRect.top + targetRect.height + 12
      : Math.max(padding, targetRect.top - estimatedHeight - 12);

    // Centrado horizontal con respecto al target
    let left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;

    // Confinar dentro de los límites de la ventana
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
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden">
      {/* 1. Anillo de enfoque Spotlight (Sin bloquear clics) */}
      {isTargetVisible && targetRect && (
        <div
          className="fixed rounded-xl border-2 border-blue-600 ring-4 ring-blue-600/40 pointer-events-none transition-all duration-300 shadow-xl"
          style={{
            top: `${Math.max(0, targetRect.top - 6)}px`,
            left: `${Math.max(0, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
          }}
        />
      )}

      {/* 2. Tarjeta Flotante de Instrucción (Popover) */}
      <div
        ref={popoverRef}
        style={getPopoverStyle()}
        className="fixed bg-white border-2 border-blue-700 rounded-xl shadow-2xl p-4 w-80 z-[9999] pointer-events-auto transition-all duration-200"
      >
        {/* Cabecera del Popover */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-blue-700 tracking-wide">
              Paso {currentStepIndex + 1} de {totalSteps}
            </span>
          </div>

          <button
            onClick={endTour}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar guía"
            aria-label="Cerrar guía"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Barra sutil de progreso */}
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-blue-700 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Contenido explicativo del paso */}
        <div className="py-3 space-y-1.5">
          {currentStep.title && (
            <h4 className="text-sm font-bold text-slate-900 leading-snug">
              {currentStep.title}
            </h4>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">
            {currentStep.text}
          </p>

          {!isTargetVisible && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start space-x-2 mt-2">
              <Compass className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
              <span>
                Navega a <strong>{currentStep.navHint || 'la vista correspondiente'}</strong> para ubicar este elemento en la pantalla.
              </span>
            </div>
          )}
        </div>

        {/* Botones de Navegación del Tour */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={endTour}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
          >
            Salir
          </button>

          <div className="flex items-center space-x-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={prevStep}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={nextStep}
              className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer flex items-center space-x-1"
            >
              <span>{isLastStep ? 'Finalizar' : 'Siguiente →'}</span>
              {isLastStep ? (
                <Check className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
