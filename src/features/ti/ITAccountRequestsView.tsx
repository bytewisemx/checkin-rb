import { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Search,
  Key,
  Send,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useTeamStore } from '../../store/useTeamStore';
import { normalizeRole } from '../../services/rbac';
import {
  type AccountRequest,
  subscribePendingAccountRequests,
  generateTemporaryPassword,
  provisionUserByIT,
} from '../../services/accountRequestService';

export function ITAccountRequestsView() {
  const { user: itUser, addToast } = useCheckinStore();
  const { teams, fetchTeams } = useTeamStore();

  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'completed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado del Modal de Aprovisionamiento
  const [selectedRequest, setSelectedRequest] = useState<AccountRequest | null>(null);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);

  // Campos del formulario modal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [assignedRole, setAssignedRole] = useState<string>('colaborador');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Suscripción en tiempo real a todas las solicitudes de alta
  useEffect(() => {
    const unsub = subscribePendingAccountRequests((list) => {
      setRequests(list);
    });
    return () => unsub();
  }, []);

  const activeTeams = useMemo(() => teams.filter((t) => t.status !== 'inactive'), [teams]);

  // Contador de pendientes en tiempo real
  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'pending_it').length,
    [requests]
  );

  // Filtrado de solicitudes
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus === 'pending' && r.status !== 'pending_it') return false;
      if (filterStatus === 'completed' && r.status !== 'completed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.teamName.toLowerCase().includes(q) ||
          r.requestedBy?.name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [requests, filterStatus, searchQuery]);

  // Abrir Modal de Aprovisionamiento con campos prellenados automáticamente
  const handleOpenProvisionModal = (req: AccountRequest) => {
    setSelectedRequest(req);
    setFirstName(req.firstName || '');
    setLastName(req.lastName || '');
    setEmail(req.email || '');
    setAssignedRole(normalizeRole(req.requestedRole).toLowerCase());
    setSelectedTeamId(req.teamId || (activeTeams[0]?.id || ''));

    // Generar contraseña temporal segura inicial
    const newPass = generateTemporaryPassword();
    setTempPassword(newPass);
    setCopiedKey(false);
    setIsProvisionModalOpen(true);
  };

  const handleRegeneratePassword = () => {
    const newPass = generateTemporaryPassword();
    setTempPassword(newPass);
    setCopiedKey(false);
    addToast('Nueva contraseña temporal generada.', 'info');
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopiedKey(true);
    addToast(`Contraseña temporal copiada al portapapeles.`, 'success');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handleSubmitProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst || !cleanLast || !cleanEmail || !tempPassword) {
      addToast('Todos los campos son obligatorios para aprovisionar.', 'error');
      return;
    }

    const targetTeam = activeTeams.find((t) => t.id === selectedTeamId);
    const teamName = targetTeam ? targetTeam.name : selectedRequest.teamName;

    setIsProvisioning(true);
    try {
      const result = await provisionUserByIT({
        requestId: selectedRequest.id,
        firstName: cleanFirst,
        lastName: cleanLast,
        email: cleanEmail,
        role: assignedRole,
        teamId: selectedTeamId,
        teamName,
        temporaryPassword: tempPassword,
        itUser: {
          id: itUser?.id || 'ti_root',
          name: itUser?.name || 'Administrador TI',
          email: itUser?.email || 'ti.root@russellbedford.mx',
          role: 'TI',
        },
      });

      if (result.success) {
        addToast(
          `¡Usuario ${cleanFirst} ${cleanLast} dado de alta exitosamente! Se notificaron las credenciales vía n8n.`,
          'success'
        );
        setIsProvisionModalOpen(false);
        setSelectedRequest(null);
      } else {
        addToast(result.error || 'Ocurrió un error al aprovisionar la cuenta.', 'error');
      }
    } catch (err: any) {
      console.error('Error al aprovisionar usuario:', err);
      addToast('Error inesperado durante el aprovisionamiento de la cuenta.', 'error');
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* 1. Alerta de Solicitudes Pendientes */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg border border-blue-200/80 dark:border-blue-800/80 shrink-0">
            <UserPlus className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Bandeja de Aprovisionamiento por TI
              </h2>
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums">
                {pendingCount} pendientes
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Solicitudes emitidas por Gerentes y Socios pendientes de creación de credenciales y despacho vía n8n.
            </p>
          </div>
        </div>

        {/* Filtros de Estado */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterStatus === 'pending'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('completed')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterStatus === 'completed'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Completadas
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-sky-400 font-semibold shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todas ({requests.length})
          </button>
        </div>
      </div>

      {/* 2. Barra de Búsqueda */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por colaborador, correo, equipo o solicitante..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9.5 pl-9 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
        />
      </div>

      {/* 3. Tabla de Solicitudes */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-4">Colaborador / Solicitud</th>
                <th className="p-4">Correo Electrónico</th>
                <th className="p-4">Rol Solicitado</th>
                <th className="p-4">Equipo Destino</th>
                <th className="p-4">Solicitado Por</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Estatus</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 px-4">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {filterStatus === 'pending'
                          ? 'No hay solicitudes de alta pendientes por procesar'
                          : 'No se encontraron registros de solicitud con los criterios aplicados'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Cuando un Gerente o Socio solicite una nueva cuenta, aparecerá inmediatamente en esta bandeja.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isPending = req.status === 'pending_it';
                  const isCompleted = req.status === 'completed';

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {req.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {req.firstName} • {req.lastName}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {req.email}
                      </td>
                      <td className="p-4">
                        <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                          {req.requestedRole}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                        {req.teamName}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-200">
                          {req.requestedBy?.name || 'Solicitante'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                          {req.requestedBy?.role || 'Directivo'}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                        {req.createdAt?.toDate
                          ? req.createdAt.toDate().toLocaleDateString('es-MX', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Reciente'}
                      </td>
                      <td className="p-4">
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            Pendiente de Alta por TI
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            Alta Completada por TI
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                            Rechazada
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {isPending ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProvisionModal(req)}
                            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-semibold rounded-lg shadow-2xs hover:shadow transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Procesar Alta</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Procesada</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal / Panel de Aprovisionamiento Prellenado */}
      {isProvisionModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Key className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Aprovisionar Cuenta y Credenciales
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Solicitud #{selectedRequest.id.substring(0, 8)} • Solicitado por {selectedRequest.requestedBy?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario Prellenado y Editable */}
            <form onSubmit={handleSubmitProvision} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre(s) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Apellidos <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

              {/* Correo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Correo Electrónico <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9.5 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-mono"
                  />
                </div>
              </div>

              {/* Rol Asignado y Equipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Rol Asignado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={assignedRole}
                    onChange={(e) => setAssignedRole(e.target.value)}
                    className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="gerente">Gerente</option>
                    <option value="socio">Socio</option>
                    <option value="rh">Recursos Humanos (RH)</option>
                    <option value="ti">Administrador TI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Equipo Asignado <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all cursor-pointer"
                  >
                    {activeTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Generador de Contraseña Temporal de Un Solo Uso */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Contraseña Temporal de Un Solo Uso <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="text-[11px] font-semibold text-blue-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generar Clave Segura</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full h-10 px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="h-10 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    title="Copiar contraseña temporal"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copiada</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  El colaborador estará forzado a cambiar esta clave en su primer inicio de sesión.
                </p>
              </div>

              {/* Botones de Confirmación */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProvisionModalOpen(false)}
                  disabled={isProvisioning}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg transition-all shadow-xs hover:shadow cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {isProvisioning ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Aprovisionando y Notificando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Dar de Alta y Notificar vía n8n</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
