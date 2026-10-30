export interface DailyQuote {
  quote: string;
  author: string;
  tag?: string;
}

export const DAILY_QUOTES: DailyQuote[] = [
  {
    quote: "La excelencia no es un acto fortuito, sino un hábito constante.",
    author: "Aristóteles",
    tag: "Excelencia",
  },
  {
    quote: "El único modo de hacer un gran trabajo es amar lo que haces.",
    author: "Steve Jobs",
    tag: "Pasión",
  },
  {
    quote: "La disciplina es el puente entre las metas y los logros tangibles.",
    author: "Jim Rohn",
    tag: "Disciplina",
  },
  {
    quote: "La mejor manera de predecir el futuro es crearlo hoy.",
    author: "Peter Drucker",
    tag: "Liderazgo",
  },
  {
    quote: "Los grandes logros nacen del trabajo constante y la atención a cada detalle.",
    author: "Russell Bedford",
    tag: "Calidad",
  },
  {
    quote: "No cuentes los días, haz que cada día cuente.",
    author: "Muhammad Ali",
    tag: "Motivación",
  },
  {
    quote: "El talento gana partidos, pero el trabajo en equipo gana campeonatos.",
    author: "Michael Jordan",
    tag: "Equipo",
  },
  {
    quote: "La perseverancia convierte los esfuerzos ordinarios en resultados extraordinarios.",
    author: "Confucio",
    tag: "Perseverancia",
  },
  {
    quote: "La calidad nunca es un accidente; siempre es el resultado de un esfuerzo inteligente.",
    author: "John Ruskin",
    tag: "Precisión",
  },
  {
    quote: "Haz hoy lo que otros no quieren hacer, y mañana lograrás lo que otros no pueden.",
    author: "Jerry Rice",
    tag: "Enfoque",
  },
  {
    quote: "El éxito es la suma de pequeños esfuerzos repetidos día tras día.",
    author: "Robert Collier",
    tag: "Constancia",
  },
  {
    quote: "La confianza en uno mismo y el rigor técnico son la base del éxito profesional.",
    author: "Séneca",
    tag: "Integridad",
  },
  {
    quote: "Comienza donde estás, usa lo que tienes, haz lo que puedas.",
    author: "Arthur Ashe",
    tag: "Acción",
  },
  {
    quote: "Una meta sin un plan es simplemente un deseo.",
    author: "Antoine de Saint-Exupéry",
    tag: "Estrategia",
  },
  {
    quote: "La integridad es hacer lo correcto, incluso cuando nadie te está mirando.",
    author: "C.S. Lewis",
    tag: "Ética",
  },
  {
    quote: "El secreto para salir adelante es simplemente comenzar.",
    author: "Mark Twain",
    tag: "Iniciativa",
  },
  {
    quote: "La concentración es el arte de saber qué ignorar.",
    author: "Warren Buffett",
    tag: "Enfoque",
  },
  {
    quote: "El verdadero progreso es el que pone la tecnología al servicio de las personas.",
    author: "Henry Ford",
    tag: "Innovación",
  },
  {
    quote: "No busques el momento perfecto, toma este momento y hazlo perfecto.",
    author: "Zig Ziglar",
    tag: "Oportunidad",
  },
  {
    quote: "Cada proyecto concluido con éxito comenzó con una sola decisión valiente.",
    author: "Proverbio Empresarial",
    tag: "Valentía",
  },
];

/**
 * Devuelve la frase del día calculada en base a la fecha actual o con un desplazamiento.
 */
export function getDailyQuote(indexOffset = 0): DailyQuote {
  const now = new Date();
  // Día del año (1 a 366)
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const quoteIndex = (dayOfYear + indexOffset) % DAILY_QUOTES.length;
  return DAILY_QUOTES[Math.abs(quoteIndex)];
}
