import { useState, useMemo } from 'react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import {
  canAccessClientsDirectory,
  canCreateOrManageCompanies,
} from '../../../services/companyService';
import { formatMinutesSexagesimal } from '../../../services/attendanceService';
import { useOperationalCatalogSync } from '../../../hooks/useLiveTeamTimers';
import { CompanyLogoBadge } from '../../../components/common/CompanyLogoBadge';
import { CreateCompanyModal } from './CreateCompanyModal';
import { RayonerProjectModal } from './RayonerProjectModal';
import type { Client } from '../../../types/rayoner';

type StatusFilter = 'all' | 'active' | 'renewal' | 'inactive';
type SortOption = 'newest' | 'alpha_asc' | 'hours_desc' | 'renewal_asc';

/**
 * Calcula los días calendario restantes hasta una fecha YYYY-MM-DD.
 * Retorna null si no hay fecha válida.
 */
function getDaysUntilDate(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function ClientsDirectoryView() {
  useOperationalCatalogSync();

  const user = useCheckinStore((state) => state.user);
  const { clients, projects, tasks, taskActualHours } = useRayonerStore();

  const canAccess = canAccessClientsDirectory(user?.role);
  const canManage = canCreateOrManageCompanies(user?.role);

  // Controles de búsqueda, filtros y ordenamiento
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Modales / Drawer de gestión
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Client | null>(null);
  const [selectedDetailCompany, setSelectedDetailCompany] = useState<Client | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null);

  // Sectores únicos dinámicos desde Firestore
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      const ind = (c.industry || '').trim();
      if (ind) set.add(ind);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [clients]);

  // Enriquecer cada empresa con proyectos vinculados, tiempo invertido en minutos enteros y vigencia
  const enrichedCompanies = useMemo(() => {
    return clients.map((company) => {
      const companyProjects = projects.filter((p) => p.clientId === company.id);
      const activeProjectsCount = companyProjects.filter((p) => p.isActive !== false).length;
      const projectIds = new Set(companyProjects.map((p) => p.id));

      let investedMinutes = 0;
      tasks.forEach((t) => {
        if (projectIds.has(t.projectId)) {
          const hrs = taskActualHours[t.id] || 0;
          investedMinutes += Math.round(hrs * 60);
        }
      });

      const daysToRenewal = getDaysUntilDate(company.renewalDate);
      const isUpcomingRenewal =
        company.isActive !== false &&
        daysToRenewal !== null &&
        daysToRenewal >= 0 &&
        daysToRenewal <= 30;

      return {
        company,
        companyProjects,
        activeProjectsCount,
        investedMinutes,
        daysToRenewal,
        isUpcomingRenewal,
      };
    });
  }, [clients, projects, tasks, taskActualHours]);

  // Filtrado reactivo + Ordenamiento
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = enrichedCompanies.filter((item) => {
      const { company, isUpcomingRenewal } = item;

      // 1. Buscador instantáneo multi-campo
      if (q) {
        const haystack = [
          company.name,
          company.commercialName,
          company.code,
          company.taxId,
          company.contactName,
          company.contactEmail,
          company.contactPhone,
          company.industry,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      // 2. Filtro por Estatus
      if (statusFilter === 'active' && company.isActive === false) return false;
      if (statusFilter === 'inactive' && company.isActive !== false) return false;
      if (statusFilter === 'renewal' && !isUpcomingRenewal) return false;

      // 3. Filtro por Giro / Sector
      if (sectorFilter !== 'all') {
        const ind = (company.industry || '').trim();
        if (ind !== sectorFilter) return false;
      }

      return true;
    });

    // 4. Ordenamiento
    return [...filtered].sort((a, b) => {
      if (sortBy === 'alpha_asc') {
        const nameA = (a.company.commercialName || a.company.name || '').toLowerCase();
        const nameB = (b.company.commercialName || b.company.name || '').toLowerCase();
        return nameA.localeCompare(nameB, 'es');
      }
      if (sortBy === 'hours_desc') {
        return b.investedMinutes - a.investedMinutes;
      }
      if (sortBy === 'renewal_asc') {
        const dateA = a.company.renewalDate ? new Date(`${a.company.renewalDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        const dateB = b.company.renewalDate ? new Date(`${b.company.renewalDate}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      }
      // 'newest' (por Fecha de Inicio más reciente)
      const startA = a.company.startDate ? new Date(`${a.company.startDate}T00:00:00`).getTime() : 0;
      const startB = b.company.startDate ? new Date(`${b.company.startDate}T00:00:00`).getTime() : 0;
      if (startB !== startA) return startB - startA;
      return b.company.id.localeCompare(a.company.id);
    });
  }, [enrichedCompanies, searchQuery, statusFilter, sectorFilter, sortBy]);

  // Guardia RBAC estricta en componente: Supervisor, Colaborador y RH bloqueados
  if (!canAccess) {
    return (
      <div className="bg-white dark:bg-[#101726] border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
        <h3 className="text-sm font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
          Acceso Restringido
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          El Directorio de Clientes y Empresas está reservado exclusivamente para Socio, Gerente y Administración TI.
        </p>
      </div>
    );
  }

  const handleOpenCreateCompany = () => {
    setEditingCompany(null);
    setIsCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (company: Client) => {
    setSelectedDetailCompany(null);
    setEditingCompany(company);
    setIsCompanyModalOpen(true);
  };

  const handleOpenNewProjectForCompany = (companyId: string) => {
    setSelectedDetailCompany(null);
    setPreselectedClientId(companyId);
    setIsProjectModalOpen(true);
  };

  const detailData = selectedDetailCompany
    ? enrichedCompanies.find((e) => e.company.id === selectedDetailCompany.id) || null
    : null;

  const hasActiveFilters =
    searchQuery.trim() !== '' || statusFilter !== 'all' || sectorFilter !== 'all';

  return (
    <div className="space-y-6 py-2 font-sans animate-fade-in">
      {/* Encabezado y Acción Principal Minimalista */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800/60">
        <div>
          <h1 className="text-xl font-semibold font-['Space_Grotesk'] text-slate-900 dark:text-slate-100 tracking-tight">
            Clientes y Empresas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Catálogo corporativo y expedientes vigentes
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            data-tour="btn-directory-new-company"
            onClick={handleOpenCreateCompany}
            className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors cursor-pointer shrink-0"
          >
            Nueva Empresa
          </button>
        )}
      </div>

      {/* Barra de Búsqueda, Filtros y Ordenamiento (Aireada sin cajas anidadas) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1 pb-2">
        {/* Buscador */}
        <div className="md:col-span-5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por razón social, clave, RFC o contacto..."
            className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 text-sm border border-slate-200 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 focus:outline-none focus:border-[#1E3A8A] transition-colors"
          />
        </div>

        {/* Filtro Estatus */}
        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full bg-white dark:bg-[#0D1320] text-slate-800 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 focus:outline-none focus:border-[#1E3A8A] cursor-pointer transition-colors"
          >
            <option value="all">Estatus: Todos</option>
            <option value="active">Activas</option>
            <option value="renewal">Próx. Renovación</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>

        {/* Filtro Sector */}
        <div className="md:col-span-2">
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="w-full bg-white dark:bg-[#0D1320] text-slate-800 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 focus:outline-none focus:border-[#1E3A8A] cursor-pointer transition-colors"
          >
            <option value="all">Sector: Todos</option>
            {availableSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>

        {/* Ordenar por */}
        <div className="md:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="w-full bg-white dark:bg-[#0D1320] text-slate-800 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 focus:outline-none focus:border-[#1E3A8A] cursor-pointer transition-colors"
          >
            <option value="newest">Ordenar: Más recientes</option>
            <option value="alpha_asc">Ordenar: Nombre (A - Z)</option>
            <option value="hours_desc">Ordenar: Mayor tiempo invertido</option>
            <option value="renewal_asc">Ordenar: Renovación próxima</option>
          </select>
        </div>
      </div>

      {/* Tabla de Directorio o Estado Vacío Limpio */}
      {clients.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-4 border-b border-slate-200 dark:border-slate-800/60">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
            No hay clientes o empresas registradas en el directorio.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Da de alta tu primera empresa para vincular proyectos, presupuestos en horas y asignación de tareas.
          </p>
          {canManage && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={handleOpenCreateCompany}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors cursor-pointer"
              >
                Registrar Primera Empresa
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-5 min-w-[240px]">Empresa</th>
                <th className="py-3.5 px-5 min-w-[180px]">Clave / RFC</th>
                <th className="py-3.5 px-5 min-w-[180px]">Contacto Principal</th>
                <th className="py-3.5 px-5 min-w-[160px]">Inicio / Vigencia</th>
                <th className="py-3.5 px-5 text-right min-w-[150px]">Tiempo Invertido</th>
                <th className="py-3.5 px-5 min-w-[110px]">Estatus</th>
                <th className="py-3.5 px-5 text-right min-w-[160px]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-sm text-slate-700 dark:text-slate-300">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-5 text-center text-slate-500 dark:text-slate-400 space-y-2">
                    <div>No se encontraron empresas con los filtros aplicados.</div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setSectorFilter('all');
                        }}
                        className="text-sm font-medium text-[#1E3A8A] dark:text-sky-400 hover:underline cursor-pointer"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(
                  ({
                    company,
                    activeProjectsCount,
                    investedMinutes,
                    daysToRenewal,
                    isUpcomingRenewal,
                  }) => {
                    const isActive = company.isActive !== false;
                    return (
                      <tr
                        key={company.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        {/* 1. Empresa */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <CompanyLogoBadge
                              name={company.name}
                              commercialName={company.commercialName}
                              logoUrl={company.logoUrl}
                              className="w-9 h-9 text-xs"
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedDetailCompany(company)}
                                className="font-medium text-slate-900 dark:text-slate-100 hover:text-[#1E3A8A] dark:hover:text-sky-400 text-left block truncate max-w-[240px] cursor-pointer"
                              >
                                {company.commercialName || company.name}
                              </button>
                              {company.commercialName && company.commercialName !== company.name && (
                                <span className="text-xs text-slate-500 dark:text-slate-400 block truncate max-w-[240px] mt-0.5">
                                  {company.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Clave / RFC */}
                        <td className="py-4 px-5">
                          <div className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {company.code || company.taxId || '—'}
                          </div>
                          {company.code && company.taxId && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                              RFC: {company.taxId}
                            </div>
                          )}
                          {company.industry && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[180px]">
                              {company.industry}
                            </div>
                          )}
                        </td>

                        {/* 3. Contacto Principal */}
                        <td className="py-4 px-5">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[190px]">
                            {company.contactName || '—'}
                          </div>
                          {(company.contactEmail || company.contactPhone) && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[200px] tabular-nums">
                              {[company.contactEmail, company.contactPhone]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                          )}
                        </td>

                        {/* 4. Inicio / Vigencia */}
                        <td className="py-4 px-5 tabular-nums">
                          <div className="text-slate-800 dark:text-slate-200">
                            {company.startDate || '—'}
                          </div>
                          {company.renewalDate ? (
                            <div
                              className={`text-xs mt-0.5 ${
                                isUpcomingRenewal
                                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              Renov.: {company.renewalDate}
                              {isUpcomingRenewal && daysToRenewal !== null
                                ? ` (${daysToRenewal}d)`
                                : ''}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              Sin vencimiento
                            </div>
                          )}
                        </td>

                        {/* 5. Proyectos y Tiempo Invertido (Xh Ym) */}
                        <td className="py-4 px-5 text-right">
                          <div className="font-['Space_Grotesk'] font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatMinutesSexagesimal(investedMinutes)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {activeProjectsCount}{' '}
                            {activeProjectsCount === 1 ? 'proyecto' : 'proyectos'}
                          </div>
                        </td>

                        {/* 6. Estatus (Punto discreto 6px, sin píldoras chillonas) */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isActive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-slate-500'
                              }`}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </td>

                        {/* 7. Acciones */}
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedDetailCompany(company)}
                              className="text-sm font-medium text-blue-700 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-300 transition cursor-pointer"
                            >
                              Gestionar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenNewProjectForCompany(company.id)}
                              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                            >
                              + Proyecto
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer de Expediente Corporativo Completo */}
      {detailData && (
        <div
          className="fixed inset-0 z-[65] flex justify-end bg-slate-950/75 backdrop-blur-xs"
          onClick={() => setSelectedDetailCompany(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg h-full bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800/80 shadow-2xl flex flex-col font-sans"
          >
            {/* Header del Expediente */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800/80 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <CompanyLogoBadge
                  name={detailData.company.name}
                  commercialName={detailData.company.commercialName}
                  logoUrl={detailData.company.logoUrl}
                  size="md"
                />
                <div className="min-w-0">
                  <h3 className="text-base font-semibold font-['Space_Grotesk'] text-slate-900 dark:text-white truncate">
                    {detailData.company.commercialName || detailData.company.name}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                    {detailData.company.code || 'Sin clave'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailCompany(null)}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Contenido del Expediente (Aireado, sin cajas dentro de cajas) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Resumen de Métricas */}
              <div className="grid grid-cols-3 gap-4 border-b border-slate-200 dark:border-slate-800/60 pb-5">
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                    Proyectos Activos
                  </span>
                  <span className="text-xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white tabular-nums mt-1 block">
                    {detailData.activeProjectsCount}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                    Tiempo Invertido
                  </span>
                  <span className="text-xl font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white tabular-nums mt-1 block">
                    {formatMinutesSexagesimal(detailData.investedMinutes)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                    Estatus
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        detailData.company.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {detailData.company.isActive !== false ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Datos Fiscales y Corporativos */}
              <div className="space-y-3 pb-5 border-b border-slate-200 dark:border-slate-800/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Identificación y Datos Fiscales
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Razón Social</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right">
                      {detailData.company.name}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">RFC / ID Fiscal</span>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums text-right">
                      {detailData.company.taxId || '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Giro / Sector</span>
                    <span className="text-sm text-slate-800 dark:text-slate-200 text-right">
                      {detailData.company.industry || '—'}
                    </span>
                  </div>
                  {detailData.company.taxRegime && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Régimen Fiscal</span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 text-right">
                        {detailData.company.taxRegime}
                      </span>
                    </div>
                  )}
                  {detailData.company.fiscalAddress && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Dirección Fiscal</span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 text-right max-w-xs">
                        {detailData.company.fiscalAddress}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contacto y Vigencia */}
              <div className="space-y-3 pb-5 border-b border-slate-200 dark:border-slate-800/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Contacto Principal y Vigencia
                </div>
                <div className="space-y-3 pt-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Representante</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 text-right">
                      {detailData.company.contactName || '—'}
                      {detailData.company.contactRole && (
                        <span className="text-xs text-slate-500 block">{detailData.company.contactRole}</span>
                      )}
                    </span>
                  </div>
                  {(detailData.company.contactEmail || detailData.company.contactPhone) && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Correo / Teléfono</span>
                      <span className="text-sm text-slate-800 dark:text-slate-200 tabular-nums text-right">
                        {[detailData.company.contactEmail, detailData.company.contactPhone]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Fecha de Inicio</span>
                    <span className="text-sm text-slate-800 dark:text-slate-200 tabular-nums text-right">
                      {detailData.company.startDate || '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Renovación / Corte</span>
                    <span
                      className={`text-sm tabular-nums text-right ${
                        detailData.isUpcomingRenewal
                          ? 'text-amber-600 dark:text-amber-400 font-medium'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {detailData.company.renewalDate || 'Sin vencimiento'}
                      {detailData.isUpcomingRenewal && detailData.daysToRenewal !== null
                        ? ` (${detailData.daysToRenewal}d restantes)`
                        : ''}
                    </span>
                  </div>
                  {detailData.company.notes && (
                    <div className="pt-2">
                      <span className="text-xs text-slate-500 block mb-1">Notas y Acuerdos</span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {detailData.company.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Proyectos Vinculados */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proyectos Asociados ({detailData.companyProjects.length})
                </div>
                {detailData.companyProjects.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                    Aún no hay proyectos vinculados a esta empresa.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800/40">
                    {detailData.companyProjects.map((proj) => {
                      const projTasks = tasks.filter((t) => t.projectId === proj.id);
                      const mins = projTasks.reduce(
                        (acc, t) => acc + Math.round((taskActualHours[t.id] || 0) * 60),
                        0
                      );
                      const plannedMins =
                        typeof proj.plannedMinutes === 'number'
                          ? proj.plannedMinutes
                          : Math.round((proj.totalBudgetHours || 0) * 60);
                      return (
                        <div key={proj.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white truncate">
                              {proj.name}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                              {proj.code} • Líder: {proj.leadUserName}
                            </div>
                          </div>
                          <div className="text-right tabular-nums shrink-0">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatMinutesSexagesimal(mins)}
                            </div>
                            <div className="text-xs text-slate-500">
                              de {formatMinutesSexagesimal(plannedMins)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer de Acciones del Drawer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3 bg-white dark:bg-[#101726]">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => handleOpenEditCompany(detailData.company)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                >
                  Editar Expediente
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => handleOpenNewProjectForCompany(detailData.company.id)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors cursor-pointer"
              >
                Crear Proyecto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alta / Edición de Empresa */}
      <CreateCompanyModal
        isOpen={isCompanyModalOpen}
        editingCompany={editingCompany}
        onClose={() => {
          setIsCompanyModalOpen(false);
          setEditingCompany(null);
        }}
      />

      {/* Modal de Creación Rápida de Proyecto vinculado a la Empresa */}
      <RayonerProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setPreselectedClientId(null);
        }}
        initialClientId={preselectedClientId}
      />
    </div>
  );
}
