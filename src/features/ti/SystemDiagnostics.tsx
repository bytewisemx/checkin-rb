import { useState, useEffect, useCallback } from 'react';
import {
  useFirestoreTelemetryStore,
  getClientMemoryMetrics,
  measureFirestoreLatency,
  scanFirestoreCollections,
  checkIndexedDbStatus,
  formatBytes,
  type ClientMemoryMetrics,
  type LatencyResult,
  type CollectionDiagnosticMetric,
  type IndexedDbStatus,
} from '../../services/firestoreTelemetry';

const SPARK_DAILY_READ_LIMIT = 50000;
const SPARK_DAILY_WRITE_LIMIT = 20000;

export function SystemDiagnostics() {
  const { reads, writes, deletes, activeListeners, resetSessionCounters } =
    useFirestoreTelemetryStore();

  const [memory, setMemory] = useState<ClientMemoryMetrics>(() =>
    getClientMemoryMetrics()
  );
  const [latency, setLatency] = useState<LatencyResult>({
    latencyMs: null,
    status: 'offline',
    checkedAt: 0,
  });
  const [collections, setCollections] = useState<CollectionDiagnosticMetric[]>([]);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [biometricVectorsCount, setBiometricVectorsCount] = useState<number>(0);
  const [biometricBytes, setBiometricBytes] = useState<number>(0);
  const [indexedDb, setIndexedDb] = useState<IndexedDbStatus>({
    supported: true,
    firestoreCacheDetected: false,
    databaseCount: 0,
    statusLabel: 'Verificando...',
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  const runFullDiagnostic = useCallback(async () => {
    setIsRunning(true);
    try {
      // 1. Memoria JS Heap del entorno cliente
      setMemory(getClientMemoryMetrics());

      // 2. Ping real a Firestore (default), escaneo de colecciones e IndexedDB en paralelo
      const [pingRes, scanRes, idbRes] = await Promise.all([
        measureFirestoreLatency(),
        scanFirestoreCollections(),
        checkIndexedDbStatus(),
      ]);

      setLatency(pingRes);
      setCollections(scanRes.collections);
      setTotalBytes(scanRes.totalBytes);
      setBiometricVectorsCount(scanRes.biometricVectorsCount);
      setBiometricBytes(scanRes.biometricBytes);
      setIndexedDb(idbRes);
      setLastRunAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    } finally {
      setIsRunning(false);
    }
  }, []);

  // Ejecución inicial al abrir la pestaña + refresco suave de JS Heap cada 5s
  useEffect(() => {
    void runFullDiagnostic();

    const memInterval = window.setInterval(() => {
      setMemory(getClientMemoryMetrics());
    }, 5000);

    return () => window.clearInterval(memInterval);
  }, [runFullDiagnostic]);

  const listenerList = Object.values(activeListeners);
  const activeCollectionsCount = collections.filter((c) => c.docCount > 0).length;
  const readPercent = Math.min(100, (reads / SPARK_DAILY_READ_LIMIT) * 100);
  const writePercent = Math.min(100, (writes / SPARK_DAILY_WRITE_LIMIT) * 100);

  return (
    <div className="space-y-6 py-2">
      {/* Encabezado sobrio corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold font-['Space_Grotesk'] text-slate-900 dark:text-slate-100">
            Diagnóstico de Infraestructura y Base de Datos
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Telemetría de memoria en tiempo real, latencia de Firestore y volumen de colecciones
            {lastRunAt ? ` · Última lectura: ${lastRunAt}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetSessionCounters}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
          >
            Reiniciar Contadores
          </button>
          <button
            id="btnRunDiagnostic"
            type="button"
            onClick={() => void runFullDiagnostic()}
            disabled={isRunning}
            className="px-3.5 py-1.5 text-xs font-medium bg-blue-700 hover:bg-blue-600 text-white transition cursor-pointer disabled:opacity-50"
          >
            {isRunning ? 'Ejecutando...' : 'Ejecutar Test de Latencia'}
          </button>
        </div>
      </div>

      {/* Fila de KPIs Técnicos (RAM, Latencia, Almacenamiento Estimado, Listeners) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Memoria RAM (JS Heap)
          </span>
          <div className="text-2xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-slate-100 mt-1">
            {memory.supported ? `${memory.usedMB.toFixed(1)} MB` : 'N/D'}
          </div>
          <span className="text-xs font-mono text-slate-500">
            {memory.supported
              ? `Límite: ${Math.round(memory.limitMB)} MB · Total: ${memory.totalMB.toFixed(1)} MB`
              : 'Performance.memory no expuesto'}
          </span>
        </div>

        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Latencia Firestore
          </span>
          <div
            className={`text-2xl font-bold font-['Space_Grotesk'] mt-1 ${
              latency.status === 'error'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-blue-700 dark:text-sky-400'
            }`}
          >
            {latency.latencyMs !== null ? `${latency.latencyMs} ms` : isRunning ? '...' : 'N/D'}
          </div>
          <span className="text-xs font-mono text-slate-500">
            Instancia: (default) ·{' '}
            {latency.status === 'online'
              ? 'Conectado'
              : latency.status === 'error'
              ? 'Error de red'
              : 'Sin conexión'}
          </span>
        </div>

        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Almacenamiento Datos
          </span>
          <div className="text-2xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-slate-100 mt-1">
            {formatBytes(totalBytes)}
          </div>
          <span className="text-xs font-mono text-slate-500">
            {activeCollectionsCount} de {collections.length || 6} colecciones con datos
          </span>
        </div>

        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Listeners en Vivo
          </span>
          <div className="text-2xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-slate-100 mt-1">
            {listenerList.length} {listenerList.length === 1 ? 'activo' : 'activos'}
          </div>
          <span className="text-xs font-mono text-slate-500">
            {listenerList.length <= 5
              ? 'Sin fugas de memoria'
              : 'Revisar suscripciones abiertas'}
          </span>
        </div>
      </div>

      {/* Monitor de Operaciones de Sesión (Cuotas Spark/Blaze) y Caché IndexedDB */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Lecturas Sesión (Reads)
            </span>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              {reads.toLocaleString('es-MX')} / {SPARK_DAILY_READ_LIMIT.toLocaleString('es-MX')}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-700 dark:bg-sky-400 transition-all duration-300"
              style={{ width: `${Math.max(reads > 0 ? 1 : 0, readPercent)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-500 block">
            Cuota diaria gratuita Spark: {readPercent.toFixed(2)}% consumido en sesión
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Escrituras / Borrados
            </span>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
              {writes.toLocaleString('es-MX')} W · {deletes.toLocaleString('es-MX')} D
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-slate-700 dark:bg-slate-300 transition-all duration-300"
              style={{ width: `${Math.max(writes > 0 ? 1 : 0, writePercent)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-slate-500 block">
            Límite diario gratuito: {SPARK_DAILY_WRITE_LIMIT.toLocaleString('es-MX')} escrituras
          </span>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Caché Local (IndexedDB) y Biometría
          </span>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {indexedDb.statusLabel}
          </div>
          <span className="text-[11px] font-mono text-slate-500 block">
            Vectores 128-D en users: {biometricVectorsCount} ({formatBytes(biometricBytes)})
          </span>
        </div>
      </div>

      {/* Desglose por Colección (Equivalente a uso de ROM / Disco en BD) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Volumen y Seguridad por Colección Firestore
          </h3>
          {latency.error && (
            <span className="text-xs font-mono text-rose-600 dark:text-rose-400">
              {latency.error}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-4">Colección Firestore</th>
                <th className="py-2.5 px-4 text-right">Documentos</th>
                <th className="py-2.5 px-4 text-right">Peso Estimado</th>
                <th className="py-2.5 px-4">Acceso RH</th>
                <th className="py-2.5 px-4 text-right">Estado Reglas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60 font-mono text-xs text-slate-700 dark:text-slate-300">
              {collections.map((col) => (
                <tr
                  key={col.name}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                >
                  <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-slate-100">
                    <span>{col.name}</span>
                    {col.extraNote && (
                      <span className="ml-2 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        ({col.extraNote})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {col.docCount.toLocaleString('es-MX')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatBytes(col.estimatedBytes)}
                  </td>
                  <td
                    className={`py-3 px-4 font-sans ${
                      col.rhBlocked
                        ? 'text-rose-600 dark:text-rose-400 font-medium'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {col.rhAccessLabel}
                  </td>
                  <td
                    className={`py-3 px-4 text-right ${
                      col.rulesStatus === 'Protegida'
                        ? 'text-blue-700 dark:text-sky-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {col.rulesStatus}
                  </td>
                </tr>
              ))}
              {collections.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 px-4 text-center font-sans text-xs text-slate-500"
                  >
                    Escaneando métricas de colecciones en (default)...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
