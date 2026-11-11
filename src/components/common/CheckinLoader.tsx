import React from 'react';

export interface CheckinLoaderProps {
  /** Texto descriptivo dinámico de la operación en curso */
  text?: string;
  /** Clase CSS adicional para personalizar el contenedor externo */
  className?: string;
  /** Si es true se comporta como overlay fixed de pantalla completa (por defecto true) */
  fullScreen?: boolean;
}

/**
 * Componente Loader de animación cúbica dinámica (jumping/rolling box)
 * para la plataforma Checkin, respetando la identidad institucional
 * y adaptabilidad a tema claro / oscuro.
 */
export const CheckinLoader: React.FC<CheckinLoaderProps> = ({
  text = 'Cargando Checkin...',
  className = '',
  fullScreen = true,
}) => {
  return (
    <div
      className={`checkin-loader-overlay ${
        fullScreen ? 'fixed inset-0 z-50' : 'relative w-full h-full min-h-[160px]'
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="loader-container">
        <div id="loader">
          <div id="shadow"></div>
          <div id="box"></div>
        </div>
        <span className="loader-text">{text}</span>
      </div>
    </div>
  );
};

