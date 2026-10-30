import { useState, useMemo } from 'react';
import { Quote, RefreshCw } from 'lucide-react';
import { getDailyQuote } from '../../services/quotes';

export function DailyQuoteCard() {
  const [quoteOffset, setQuoteOffset] = useState(0);
  const [isRotating, setIsRotating] = useState(false);

  const currentQuote = useMemo(() => {
    return getDailyQuote(quoteOffset);
  }, [quoteOffset]);

  const handleNextQuote = () => {
    setIsRotating(true);
    setQuoteOffset(prev => prev + 1);
    setTimeout(() => setIsRotating(false), 350);
  };

  return (
    <div className="group relative max-w-xl flex items-start space-x-3 select-none">
      {/* Icono de comillas sin recuadro ni caja contenedora */}
      <Quote className="w-4 h-4 text-blue-700 dark:text-[#38BDF8] fill-current shrink-0 mt-1 opacity-80" />

      {/* Frase y Autor en diseño abierto con contraste nítido */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-[#F8FAFC] italic leading-relaxed">
          "{currentQuote.quote}"
        </p>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-xs font-medium text-slate-500 dark:text-[#94A3B8] not-italic">
            — {currentQuote.author}
          </span>
          <button
            onClick={handleNextQuote}
            title="Cambiar frase"
            className="text-slate-400 hover:text-blue-700 dark:hover:text-[#38BDF8] p-0.5 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            aria-label="Siguiente frase"
          >
            <RefreshCw className={`w-3 h-3 transition-transform duration-300 ${isRotating ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
