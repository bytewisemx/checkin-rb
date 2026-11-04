import { useState, useMemo, useRef, useEffect } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useInvitationStore } from '../../store/useInvitationStore';
import { Button } from '../../components/common/Button';
import { 
  UserCircle, Calendar, Users, ChevronRight, 
  Upload, ShieldCheck, Check, AlertCircle, Sparkles, Building2,
  Shield, UserCheck, KeyRound, Lock, Eye, EyeOff, ScanFace
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  AvatarCreatorModal, 
  AVATAR_PRESETS, 
  generateAvatarSvg, 
  svgToDataUrl 
} from '../../components/avatar';
import { FacialEnrollmentModal } from '../checkin/FacialEnrollmentModal';
import { isBiometricsRequiredForUser, getDefaultModulesForRole } from '../../services/rbac';

// Avatares rápidos ilustrados basados en la imagen de referencia
const ILLUSTRATED_AVATARS = AVATAR_PRESETS.map((p, idx) => ({
  name: p.name,
  url: svgToDataUrl(generateAvatarSvg(p.config, `quick-avatar-${idx}`))
}));

export function CompleteProfilePage() {
  const { user, updateProfile, addToast } = useCheckinStore();
  const { 
    validateSupervisorCode, 
    registerCollaborator, 
    registerSupervisorProfile,
    validateMasterCorporateKey,
    getSupervisorCode
  } = useRayonerStore();
  const { consumeToken } = useInvitationStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selector de Rol: Inicializado según la invitación verificada (TI -> Supervisor, Supervisor -> Empleado)
  const initialRoleFromInvite = (user?.role === 'Supervisor' || user?.role === 'supervisor' || !!user?.created_by_ti_id)
    ? 'supervisor'
    : 'employee';
  const [accountRole, setAccountRole] = useState<'employee' | 'supervisor'>(initialRoleFromInvite);

  // Estado del creador de avatares interactivo y del enrolamiento biométrico obligatorio
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [capturedVector, setCapturedVector] = useState<number[] | null>(
    user?.biometrics?.faceDescriptor || user?.faceDescriptor || null
  );

  // Regla de roles para biometría:
  // - Empleado y RH requieren captura inicial obligatoria
  // - Supervisor queda exento por defecto (salvo que TI haya activado explícitamente user.modules.facialCheckIn)
  const requiresInitialBiometrics = useMemo(() => {
    if (accountRole === 'supervisor') {
      return Boolean(user?.modules?.facialCheckIn === true);
    }
    return isBiometricsRequiredForUser({
      role: user?.role === 'RH' ? 'RH' : 'Empleado',
      modules: user?.modules,
    });
  }, [accountRole, user]);

  // Datos Personales
  const [name, setName] = useState(user?.name || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate || '');
  const [profilePhoto, setProfilePhoto] = useState<string>(
    user?.profileImage || ILLUSTRATED_AVATARS[0].url
  );
  const [team, setTeam] = useState(user?.team || 'Auditoría Fiscal');

  // Campos específicos de Colaborador (código obtenido en automático si proviene de invitación previa)
  const autoSupervisorCode = useMemo(() => {
    if (user?.supervisorCode) return user.supervisorCode;
    if (user?.supervisorId) return getSupervisorCode(user.supervisorId);
    return '';
  }, [user, getSupervisorCode]);

  const [supervisorCode, setSupervisorCode] = useState(autoSupervisorCode);

  useEffect(() => {
    if (autoSupervisorCode && (!supervisorCode || supervisorCode !== autoSupervisorCode)) {
      setSupervisorCode(autoSupervisorCode);
    }
  }, [autoSupervisorCode, supervisorCode]);

  const isCodeAutoAssigned = Boolean(autoSupervisorCode || user?.supervisorId);

  // Campos específicos de Supervisor (incluyendo Clave Maestra Corporativa o Invitación de TI)
  const [corporateKey, setCorporateKey] = useState(user?.created_by_ti_id ? 'RB-SOCIO-2026' : '');
  const [showCorporateKey, setShowCorporateKey] = useState(false);
  const [supervisorTitle, setSupervisorTitle] = useState('Supervisor de Auditoría');
  const [customSupervisorCode, setCustomSupervisorCode] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generar código de supervisor sugerido al escribir nombre o apellido
  useEffect(() => {
    if (accountRole === 'supervisor' && !customSupervisorCode) {
      const cleanLast = (lastName || name || 'RB')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 6);
      const randomNum = Math.floor(100 + Math.random() * 899);
      setCustomSupervisorCode(`SUP-${cleanLast || 'SOCIO'}-${randomNum}`);
    }
  }, [accountRole, lastName, name, customSupervisorCode]);

  // Validación reactiva de la Clave Maestra Corporativa para supervisores
  const isCorporateKeyValid = useMemo(() => {
    if (accountRole !== 'supervisor') return true;
    return validateMasterCorporateKey(corporateKey);
  }, [accountRole, corporateKey, validateMasterCorporateKey]);

  // Validación reactiva del código de supervisor para colaboradores
  const matchedSupervisor = useMemo(() => {
    if (accountRole !== 'employee') return null;
    if (supervisorCode.trim()) {
      return validateSupervisorCode(supervisorCode.trim());
    }
    if (user?.supervisorId) {
      return {
        supervisorId: user.supervisorId,
        supervisorName: user.supervisorName || 'Supervisor Asignado',
        supervisorTitle: 'Supervisor de Auditoría',
      };
    }
    return null;
  }, [accountRole, supervisorCode, validateSupervisorCode, user]);

  // Manejador de subida de imagen local
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('La imagen debe ser menor a 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfilePhoto(reader.result);
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  // Cálculo de edad aproximada
  const calculatedAge = useMemo(() => {
    if (!birthDate) return null;
    const bDate = new Date(birthDate);
    if (isNaN(bDate.getTime())) return null;
    const diff = Date.now() - bDate.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }, [birthDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Por favor ingresa tu nombre.');
      return;
    }
    if (!lastName.trim()) {
      setErrorMsg('Por favor ingresa tu apellido.');
      return;
    }
    if (!birthDate) {
      setErrorMsg('Por favor selecciona tu fecha de nacimiento.');
      return;
    }

    const userId = user?.id || `usr-${Date.now()}`;
    const fullName = `${name.trim()} ${lastName.trim()}`;

    // ============================================
    // VALIDACIÓN DE BIOMETRÍA VECTORIAL SEGÚN ROL
    // ============================================
    if (requiresInitialBiometrics && (!capturedVector || capturedVector.length === 0)) {
      setErrorMsg(
        'La captura inicial de tu vector biométrico facial es obligatoria para activar tu cuenta.'
      );
      return;
    }

    // ============================================
    // CASO A: REGISTRO DE SUPERVISOR / SOCIO
    // ============================================
    if (accountRole === 'supervisor') {
      if (!corporateKey.trim()) {
        setErrorMsg('Debes ingresar la Clave Maestra Corporativa para darte de alta como Supervisor.');
        return;
      }
      if (!isCorporateKeyValid) {
        setErrorMsg('La Clave Maestra Corporativa es incorrecta. Solo los socios autorizados poseen la clave de acceso directivo.');
        return;
      }

      const finalSupCode = (customSupervisorCode || `SUP-${name.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-3)}`)
        .trim()
        .toUpperCase();

      setIsSubmitting(true);

      try {
        // 1. Guardar perfil con rol Supervisor en CheckinStore (Exento de biometría por defecto salvo flag de TI)
        updateProfile({
          name: name.trim(),
          lastName: lastName.trim(),
          birthDate,
          team,
          profileImage: profilePhoto,
          role: 'Supervisor',
          modules: user?.modules || getDefaultModulesForRole('Supervisor'),
          isProfileComplete: true,
          supervisorId: userId,
          supervisor_id: null,
          created_by_ti_id: user?.created_by_ti_id || 'usr-ti-root',
          supervisorName: fullName,
        });

        // 2. Registrar el código y cargo de este supervisor en RayonerStore
        registerSupervisorProfile({
          id: userId,
          name: fullName,
          title: supervisorTitle,
          code: finalSupCode,
        });

        addToast(
          `¡Bienvenido ${fullName}! Tu perfil de Supervisor está activo con código de invitación ${finalSupCode}.`,
          'success'
        );

        navigate('/');
      } catch {
        setErrorMsg('Ocurrió un error al guardar tu perfil de supervisor. Intenta de nuevo.');
        setIsSubmitting(false);
      }
      return;
    }

    // ============================================
    // CASO B: REGISTRO DE COLABORADOR
    // ============================================
    if (!matchedSupervisor) {
      setErrorMsg('El código de supervisor no es válido. Solicita el código a tu supervisor para asignarte a su equipo.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Actualizar perfil del colaborador en CheckinStore (con vector biométrico ya enrolado sin fotos)
      const finalEmpRole = user?.role === 'RH' ? 'RH' : 'Empleado';
      updateProfile({
        name: name.trim(),
        lastName: lastName.trim(),
        birthDate,
        team,
        profileImage: profilePhoto,
        role: finalEmpRole,
        modules: user?.modules || getDefaultModulesForRole(finalEmpRole),
        supervisorId: matchedSupervisor.supervisorId,
        supervisor_id: matchedSupervisor.supervisorId,
        supervisorName: matchedSupervisor.supervisorName,
        isProfileComplete: true,
      });

      // 2. Registrar formalmente al nuevo colaborador en el equipo del Supervisor en RayonerStore
      registerCollaborator({
        id: userId,
        name: fullName,
        email: user?.email || `${name.toLowerCase()}.${lastName.toLowerCase()}@russellbedford.mx`,
        team,
        roleTitle: 'Auditor Junior',
        supervisorId: matchedSupervisor.supervisorId,
      });

      // 3. Si proviene de invitación corporativa, marcar el token como aceptado formalmente
      if (user?.invitationToken) {
        consumeToken(user.invitationToken, {
          uid: userId,
          email: user?.email || '',
          name: fullName,
        });
      }

      addToast(
        `¡Bienvenido ${name}! Fuiste vinculado exitosamente al equipo de ${matchedSupervisor.supervisorName}.`,
        'success'
      );

      navigate('/');
    } catch {
      setErrorMsg('Ocurrió un error al guardar tu perfil. Intenta de nuevo.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B111E] text-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      
      {/* Fondo estético sutil */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#1E40AF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-[#131D31] text-[#F8FAFC] w-full max-w-xl p-6 sm:p-8 rounded-md z-10 animate-fade-in shadow-2xl border border-[#233354] relative">
        
        {/* Encabezado */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-12 h-12 bg-[#1E40AF] rounded-md flex items-center justify-center shadow-xs mb-2.5 text-white">
            <UserCircle className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#F8FAFC] tracking-tight">
            Configura tu Cuenta
          </h1>
          <p className="text-xs text-[#94A3B8] max-w-md mt-0.5">
            Indica tu rol en el despacho y completa tus datos para acceder a tu plataforma de trabajo.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-[#1A2742] border border-[#E11D48]/40 text-[#E11D48] rounded-md text-xs font-medium flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#E11D48]" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Selector de Tipo de Cuenta / Rol (Colaborador vs Supervisor) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-heading font-semibold text-[#94A3B8] uppercase tracking-wider">
              1. Selecciona tu Rol en el Despacho
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Opción A: Colaborador */}
              <button
                type="button"
                onClick={() => {
                  setAccountRole('employee');
                  setErrorMsg('');
                }}
                className={`p-3.5 rounded-md border text-left transition-colors cursor-pointer relative ${
                  accountRole === 'employee'
                    ? 'bg-[#1E40AF]/20 border-[#1E40AF] ring-1 ring-[#1E40AF] text-[#F8FAFC]'
                    : 'bg-[#1A2742] border-[#233354] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-[#38BDF8]" />
                  <span className="text-xs font-heading font-bold text-[#F8FAFC]">Soy Colaborador</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                  Registro mi jornada diaria, realizo tareas asignadas y me vinculo con mi supervisor.
                </p>
                {accountRole === 'employee' && (
                  <span className="inline-block mt-2 text-[9px] font-heading font-bold uppercase text-[#38BDF8] bg-[#0F172A] border border-[#233354] px-2 py-0.5 rounded-sm">
                    Seleccionado
                  </span>
                )}
              </button>

              {/* Opción B: Supervisor / Socio */}
              <button
                type="button"
                onClick={() => {
                  setAccountRole('supervisor');
                  setErrorMsg('');
                }}
                className={`p-3.5 rounded-md border text-left transition-colors cursor-pointer relative ${
                  accountRole === 'supervisor'
                    ? 'bg-[#1E40AF]/20 border-[#1E40AF] ring-1 ring-[#1E40AF] text-[#F8FAFC]'
                    : 'bg-[#1A2742] border-[#233354] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-[#F59E0B]" />
                  <span className="text-xs font-heading font-bold text-[#F8FAFC]">Soy Supervisor / Socio</span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">
                  Superviso equipos, creo proyectos, asigno presupuesto y gestiono tareas.
                </p>
                {accountRole === 'supervisor' && (
                  <span className="inline-block mt-2 text-[9px] font-heading font-bold uppercase text-[#F59E0B] bg-[#0F172A] border border-[#233354] px-2 py-0.5 rounded-sm">
                    Seleccionado
                  </span>
                )}
              </button>

            </div>
          </div>

          {/* 2. Selector y Subida de Foto de Perfil */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Foto de Perfil</span>
              <span className="text-[10px] text-slate-400 font-normal lowercase">sube tu foto o elige un avatar</span>
            </label>

            <div className="flex items-center space-x-4">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#0D5C75] shadow-xs bg-white flex items-center justify-center">
                  <img
                    src={profilePhoto}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarCreatorOpen(true)}
                  className="absolute inset-0 bg-slate-900/60 rounded-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mb-0.5 text-amber-300" />
                  Editar
                </button>
              </div>

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAvatarCreatorOpen(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-[#0D5C75] to-cyan-600 hover:from-[#093e4f] hover:to-cyan-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Diseñar mi Avatar (Piel, Lentes, Ropa)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-[#0D5C75] rounded-xl text-xs font-bold text-slate-700 hover:text-[#0D5C75] transition-all cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir foto</span>
                  </button>
                </div>

                {/* Avatares rápidos ilustrados de la imagen de referencia */}
                <div className="flex items-center space-x-2 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium">O elige:</span>
                  <div className="flex items-center space-x-2">
                    {ILLUSTRATED_AVATARS.map((av, i) => (
                      <button
                        key={i}
                        type="button"
                        title={av.name}
                        onClick={() => setProfilePhoto(av.url)}
                        className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all cursor-pointer bg-white shadow-2xs ${
                          profilePhoto === av.url 
                            ? 'border-[#0D5C75] scale-110 shadow-md ring-2 ring-[#0D5C75]/30' 
                            : 'border-slate-200 hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Nombre y Apellido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Nombre(s) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Roberto o Carlos"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] bg-slate-50/50 text-sm font-semibold text-slate-800 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Apellido(s) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Silva o Ruiz"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] bg-slate-50/50 text-sm font-semibold text-slate-800 transition-all"
              />
            </div>
          </div>

          {/* 4. Fecha de Nacimiento y Área */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" /> Fecha de Nacimiento
                </span>
                {calculatedAge !== null && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                    {calculatedAge} años
                  </span>
                )}
              </label>
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] bg-slate-50/50 text-sm font-semibold text-slate-800 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center">
                <Users className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" /> Área / Especialidad
              </label>
              <select
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] bg-slate-50/50 text-sm font-semibold text-slate-800 transition-all"
              >
                <option value="Auditoría Fiscal">Auditoría Fiscal</option>
                <option value="Contabilidad Corporativa">Contabilidad Corporativa</option>
                <option value="Consultoría e Impuestos">Consultoría e Impuestos</option>
                <option value="Precios de Transferencia">Precios de Transferencia</option>
                <option value="Legal & Cumplimiento">Legal & Cumplimiento</option>
                <option value="Dirección & Supervisión General">Dirección & Supervisión General</option>
              </select>
            </div>
          </div>

          {/* ======================================================= */}
          {/* SECCIÓN ESPECÍFICA SEGÚN EL ROL SELECCIONADO */}
          {/* ======================================================= */}
          
          {/* CASO 1: COLABORADOR (Pide código de su supervisor) */}
          {accountRole === 'employee' && (
            <div className="space-y-3 pt-2 border-t border-slate-200/80 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#0D5C75]" />
                  <span>Código de tu Supervisor</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {isCodeAutoAssigned ? 'Asignado automáticamente por invitación' : 'Requerido para vincularte'}
                </span>
              </div>

              {/* Mensaje de Asignación Automática si proviene de invitación previa */}
              {isCodeAutoAssigned && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start space-x-2.5 animate-scale-up">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900">
                      ✓ Invitación Corporativa Validada en Automático
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Quedarás asignado a <b>{matchedSupervisor?.supervisorName || user?.supervisorName || 'Supervisor Asignado'}</b> con el código <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300">{supervisorCode}</span> sin necesidad de capturarlo manualmente.
                    </p>
                  </div>
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  required
                  readOnly={isCodeAutoAssigned}
                  value={supervisorCode}
                  onChange={(e) => {
                    if (!isCodeAutoAssigned) {
                      setSupervisorCode(e.target.value.toUpperCase());
                      setErrorMsg('');
                    }
                  }}
                  placeholder="Ej. SUP-CARLOS-784 o SUP-SILVA-101"
                  className={`w-full pl-4 pr-10 py-3 rounded-xl border text-sm font-bold uppercase tracking-wider transition-all ${
                    isCodeAutoAssigned
                      ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 cursor-not-allowed select-none'
                      : matchedSupervisor
                      ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 focus:ring-2 focus:ring-emerald-500/20'
                      : 'border-slate-300 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75]'
                  }`}
                />
                {matchedSupervisor && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                    {isCodeAutoAssigned && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded hidden sm:inline">
                        Auto
                      </span>
                    )}
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                )}
              </div>

              {!isCodeAutoAssigned && (
                matchedSupervisor ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start space-x-2.5 animate-scale-up">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900">
                        ✓ Vinculado con: {matchedSupervisor.supervisorName}
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        {matchedSupervisor.supervisorTitle}. Tu cuenta quedará registrada en su panel para asignarte proyectos y clientes.
                      </p>
                    </div>
                  </div>
                ) : supervisorCode.trim().length > 0 ? (
                  <p className="text-xs font-semibold text-rose-600 flex items-center space-x-1">
                    <span>Código no reconocido. Usa un código válido de supervisor (ej. SUP-CARLOS-784 o SUP-SILVA-101).</span>
                  </p>
                ) : (
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-[#0D5C75] shrink-0" />
                    <span>
                      Códigos activos de demostración: <strong>SUP-CARLOS-784</strong> o <strong>SUP-SILVA-101</strong>.
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {/* CASO 2: SUPERVISOR (Requiere Clave Maestra Corporativa de Socios) */}
          {accountRole === 'supervisor' && (
            <div className="space-y-4 pt-2 border-t border-slate-200/80 animate-fade-in bg-amber-50/60 p-4 sm:p-5 rounded-2xl border border-amber-200/80">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>Alta Restringida de Supervisor / Socio</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                  Seguridad Corporativa
                </span>
              </div>

              {/* CLAVE MAESTRA CORPORATIVA (OBLIGATORIA) */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-xl border border-amber-300/80 shadow-xs">
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Clave Maestra Corporativa de Socios</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">
                    autorización directiva
                  </span>
                </label>

                <div className="relative">
                  <input
                    type={showCorporateKey ? 'text' : 'password'}
                    required
                    value={corporateKey}
                    onChange={(e) => {
                      setCorporateKey(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Ingresa la clave maestra (ej. RB-SOCIO-2026)"
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-sm font-mono font-bold tracking-wider transition-all ${
                      isCorporateKeyValid && corporateKey.trim()
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 focus:ring-2 focus:ring-emerald-500/20'
                        : corporateKey.trim()
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCorporateKey(!showCorporateKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showCorporateKey ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showCorporateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Feedback de validación de clave maestra */}
                {isCorporateKeyValid && corporateKey.trim() ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-start space-x-2 animate-scale-up">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-emerald-900">✓ Clave Maestra Corporativa Verificada</p>
                      <p className="text-[11px] text-emerald-700">
                        Autorización concedida para crear y administrar proyectos, presupuestos y equipos directivos.
                      </p>
                    </div>
                  </div>
                ) : corporateKey.trim().length > 0 ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start space-x-2 animate-scale-up">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-800">Clave no autorizada</p>
                      <p className="text-[11px] text-rose-600">
                        La clave ingresada no es válida. Solo la Dirección de Socios posee la clave maestra.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Clave de demostración corporativa: <strong>RB-SOCIO-2026</strong> o <strong>SUPERVISOR2026</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* Cargo Ejecutivo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cargo / Título Ejecutivo
                </label>
                <select
                  value={supervisorTitle}
                  onChange={(e) => setSupervisorTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 bg-white text-sm font-semibold text-slate-800 transition-all"
                >
                  <option value="Socio Líder de Auditoría">Socio Líder de Auditoría</option>
                  <option value="Supervisor de Auditoría">Supervisor de Auditoría</option>
                  <option value="Gerente de Impuestos & Auditoría">Gerente de Impuestos & Auditoría</option>
                  <option value="Director de Proyectos Corporativos">Director de Proyectos Corporativos</option>
                  <option value="Socio Director Russell Bedford">Socio Director Russell Bedford</option>
                </select>
              </div>

              {/* Código Único que el supervisor entregará a sus empleados */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tu Código de Invitación para tus Colaboradores
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customSupervisorCode}
                    onChange={(e) => setCustomSupervisorCode(e.target.value.toUpperCase())}
                    placeholder="Ej. SUP-ROBERTO-789"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-black text-amber-900 uppercase tracking-wider focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-600">
                    <KeyRound className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  💡 Este código será tu <strong>identificador exclusivo</strong>. Compártelo con los colaboradores que desees que se unan a tu equipo.
                </p>
              </div>

              {/* Mensaje de Confirmación */}
              <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start space-x-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Al registrarte con la Clave Maestra Corporativa, tu cuenta tendrá acceso al <strong>Panel de Supervisión Rayoner</strong> para crear clientes, proyectos, asignar presupuestos y aprobar revisiones.
                </p>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* BIOMETRÍA VECTORIAL: OBLIGATORIA EMPLEADO/RH, EXENTO SUPERVISOR */}
          {/* ======================================================= */}
          {requiresInitialBiometrics ? (
            <div className="p-3.5 rounded-md border border-[#233354] bg-[#1A2742] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#F8FAFC] flex items-center space-x-1.5">
                  <ScanFace className="w-4 h-4 text-[#38BDF8]" />
                  <span>Captura Inicial de Vector Biométrico *</span>
                </span>
                <span className="text-[10px] font-heading font-semibold text-[#38BDF8] bg-[#0F172A] px-2 py-0.5 rounded-sm border border-[#233354]">
                  Obligatorio (0 imágenes)
                </span>
              </div>

              {capturedVector && capturedVector.length > 0 ? (
                <div className="bg-[#0F172A] border border-[#233354] rounded-md p-2.5 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#38BDF8] flex items-center space-x-1.5">
                      <Check className="w-4 h-4 text-[#38BDF8]" />
                      <span>Vector facial calibrado ({capturedVector.length} floats)</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8] block">
                      faceDescriptor: [{capturedVector.slice(0, 3).map((n) => n.toFixed(3)).join(', ')}, ...] • model: face_recognition_v1
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="px-2.5 py-1 bg-[#1A2742] hover:bg-[#233354] text-[#F8FAFC] border border-[#233354] rounded-md text-[11px] font-heading font-semibold cursor-pointer"
                  >
                    Recalibrar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0F172A] p-3 rounded-md border border-[#233354]">
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Se extraerán únicamente los parámetros matemáticos (<code>faceDescriptor</code>) con tolerancia <code>≤ 0.55</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-[#1D4ED8] text-white rounded-md text-xs font-heading font-semibold shrink-0 flex items-center space-x-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <ScanFace className="w-4 h-4 text-white" />
                    <span>Capturar Vector Facial</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-md border border-[#233354] bg-[#1A2742] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-start space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
                <div>
                  <span className="font-heading font-bold text-[#F8FAFC] block">
                    Exención de Biometría Facial (Rol Supervisor)
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">
                    Los Supervisores están exentos de registro facial por defecto.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBiometricModalOpen(true)}
                className="px-2.5 py-1 bg-[#131D31] hover:bg-[#0B111E] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#233354] rounded-md text-[10px] font-heading font-semibold shrink-0 cursor-pointer"
              >
                {capturedVector ? 'Vector Activo' : 'Calibrar (Opcional)'}
              </button>
            </div>
          )}

          {/* Botón de Envío */}
          <Button
            type="submit"
            variant="primary"
            className="w-full py-2.5 rounded-md font-heading font-semibold text-xs shadow-xs group flex items-center justify-center cursor-pointer bg-[#1E40AF] hover:bg-[#1D4ED8] text-white transition-colors"
            isLoading={isSubmitting}
            disabled={
              (requiresInitialBiometrics && !capturedVector) ||
              (accountRole === 'employee' && !matchedSupervisor) ||
              (accountRole === 'supervisor' && (!corporateKey.trim() || !isCorporateKeyValid))
            }
          >
            <span>
              {accountRole === 'supervisor' 
                ? 'Validar Clave Maestra y Activar Cuenta de Supervisor' 
                : 'Confirmar Perfil y Vincular a Supervisor'}
            </span>
            <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

        </form>

      </div>

      {/* Modal del Estudio de Creación de Avatar */}
      <AvatarCreatorModal
        isOpen={isAvatarCreatorOpen}
        onClose={() => setIsAvatarCreatorOpen(false)}
        onSaveAvatar={(avatarUrl) => {
          setProfilePhoto(avatarUrl);
          updateProfile({ profileImage: avatarUrl, isProfileComplete: false });
          addToast('¡Avatar personalizado generado y aplicado exitosamente!', 'success');
        }}
      />

      {/* Modal de Captura Inicial de Vector Biométrico (PUT /api/users/:id/biometrics) */}
      <FacialEnrollmentModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        mode="initial"
        endpointTarget={user?.id || 'me'}
        onEnrollmentComplete={(descriptor) => {
          if (descriptor) setCapturedVector(descriptor);
          setIsBiometricModalOpen(false);
        }}
      />

    </div>
  );
}
