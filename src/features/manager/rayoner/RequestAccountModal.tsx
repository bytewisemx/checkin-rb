import { useState, useMemo, useEffect } from 'react';
import { X, UserPlus, Users, Mail, ShieldCheck } from 'lucide-react';
import { useCheckinStore } from '../../../store/useCheckinStore';
import { useTeamStore } from '../../../store/useTeamStore';
import { normalizeRole } from '../../../services/rbac';
import { createAccountRequest } from '../../../services/accountRequestService';

interface RequestAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestAccountModal({ isOpen, onClose, onSuccess }: RequestAccountModalProps) {
  const { user, addToast } = useCheckinStore();
  const { teams, fetchTeams } = useTeamStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [requestedRole, setRequestedRole] = useState<'colaborador' | 'supervisor' | 'gerente' | 'socio'>('colaborador');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen, fetchTeams]);

  const activeTeams = useMemo(() => teams.filter((t) => t.status !== 'inactive'), [teams]);
  const normRole = normalizeRole(user?.role);
  const isSocio = normRole === 'Socio';

  // Roles permitidos según jerarquía de solicitud
  const roleOptions = useMemo(() => {
    if (isSocio) {
      return [
        { value: 'colaborador', label: 'Colaborador Operativo' },
        { value: 'supervisor', label: 'Supervisor de Área / Equipo' },
        { value: 'gerente', label: 'Gerente de Auditoría' },
        { value: 'socio', label: 'Socio de la Firma' },
      ];
    }
    // Gerente solo puede solicitar Colaborador y Supervisor
    return [
      { value: 'colaborador', label: 'Colaborador Operativo' },
      { value: 'supervisor', label: 'Supervisor de Área / Equipo' },
    ];
  }, [isSocio]);

  // Preselección de equipo destino
  useEffect(() => {
    if (isOpen && activeTeams.length > 0) {
      if (user?.teamId && activeTeams.some((t) => t.id === user.teamId)) {
        setSelectedTeamId(user.teamId);
      } else if (user?.team) {
        const match = activeTeams.find((t) => t.name === user.team);
        if (match) setSelectedTeamId(match.id);
        else setSelectedTeamId(activeTeams[0].id);
      } else {
        setSelectedTeamId(activeTeams[0].id);
      }
    }
  }, [isOpen, activeTeams, user]);

  const selectedTeam = useMemo(
    () => activeTeams.find((t) => t.id === selectedTeamId),
    [activeTeams, selectedTeamId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst || !cleanLast) {
      addToast('Ingresa el nombre y apellidos completos del nuevo usuario.', 'error');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      addToast('Ingresa un correo electrónico corporativo válido.', 'error');
      return;
    }

    if (!selectedTeamId || !selectedTeam) {
      addToast('Selecciona el equipo destino al que pertenecerá el usuario.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createAccountRequest({
        firstName: cleanFirst,
        lastName: cleanLast,
        email: cleanEmail,
        requestedRole,
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        requestedBy: {
          uid: user?.id || 'uid_gerente',
          name: user?.name || 'Solicitante',
          role: normRole.toLowerCase(),
        },
      });

      if (res.success) {
        addToast(
          `Solicitud de alta enviada a TI para ${cleanFirst} ${cleanLast}. Estado: Pendiente de Alta por TI.`,
          'success'
        );
        setFirstName('');
        setLastName('');
        setEmail('');
        setRequestedRole('colaborador');
        onSuccess?.();
        onClose();
      } else {
        addToast(res.error || 'Ocurrió un error al enviar la solicitud.', 'error');
      }
    } catch (err: any) {
      console.error('Error al enviar solicitud de alta:', err);
      addToast('Error de red al conectar con el servidor.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Encabezado Corporativo Sobrio */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800/80">
              <UserPlus className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Solicitud de Alta de Usuario
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aprovisionamiento oficial administrado por TI con n8n
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre(s) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre(s) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="ej. Juan Carlos"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Apellidos */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Apellidos <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="ej. Pérez García"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-9.5 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          {/* Correo Electrónico */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Correo Electrónico <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="ej. juan.perez@russellbedford.mx"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9.5 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              TI generará una contraseña temporal y la enviará automáticamente por correo vía n8n.
            </p>
          </div>

          {/* Rol Solicitado */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Rol Solicitado <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as any)}
                className="w-full h-9.5 pl-9 pr-8 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Equipo Destino */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Equipo Destino <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full h-9.5 pl-9 pr-8 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all cursor-pointer"
              >
                {activeTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code || 'Equipo'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nota informativa de flujo de seguridad */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-blue-800 dark:text-blue-300">Flujo Corporativo:</span> Al enviar la solicitud, el Administrador de TI recibirá la alerta en su consola, provisionará la cuenta con clave temporal y disparará el envío de credenciales mediante el webhook de n8n.
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg transition-all shadow-xs hover:shadow cursor-pointer flex items-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enviando Solicitud...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 stroke-[2]" />
                  <span>Enviar Solicitud a TI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
