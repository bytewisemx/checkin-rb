import React, { useState, useRef, useMemo } from 'react';
import { useCheckinStore } from '../../store/useCheckinStore';
import { useRayonerStore } from '../../store/useRayonerStore';
import { useGamificationStore } from '../../store/useGamificationStore';
import { logoutFirebase } from '../../services/firebase';
import { 
  calculateGamification, 
  MONTHLY_GAMIFICATION_RULES, 
  RANK_TIERS 
} from '../../services/gamification';
import { RankMedal } from './RankMedal';
import { AvatarCreatorModal } from '../avatar';
import { FacialEnrollmentModal } from '../../features/checkin/FacialEnrollmentModal';
import { normalizeRole, isBiometricsRequiredForUser } from '../../services/rbac';
import { 
  X, Camera, LogOut, Calendar, Shield, User, 
  Briefcase, Award, TrendingUp, CheckCircle2, 
  Settings, Clock, AlertTriangle, Zap, PlayCircle,
  HelpCircle, ChevronDown, ChevronUp, Timer, Target, Copy,
  Sparkles, ScanFace, ShieldCheck, Sun, Moon
} from 'lucide-react';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: TabType;
}

type TabType = 'rank' | 'rules' | 'profile' | 'settings';

export function UserProfileModal({ isOpen, onClose, initialTab = 'rank' }: UserProfileModalProps) {
  const { user, updateProfile, logout, addToast, history, activeCheckin, theme, setTheme } = useCheckinStore();
  const { 
    manualEditsByDate, 
    taskSwitchesByDate, 
    previousSeason 
  } = useGamificationStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [showHistoryDetail, setShowHistoryDetail] = useState(false);
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);
  const [isRecalibrateModalOpen, setIsRecalibrateModalOpen] = useState(false);

  const normalizedRole = normalizeRole(user?.role);
  const requiresBiometrics = isBiometricsRequiredForUser(user);
  const activeVector = user?.biometrics?.faceDescriptor || user?.faceDescriptor || null;
  const vectorLastUpdated = user?.biometrics?.lastUpdated || null;

  // Estados locales para ajustes
  const [editName, setEditName] = useState(user?.name || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editBirthDate, setEditBirthDate] = useState(user?.birthDate || '');
  const [editTeam, setEditTeam] = useState(user?.team || 'Auditoría');
  const [isSaving, setIsSaving] = useState(false);

  // Cálculo del sistema de Gamificación mensual
  const gamification = useMemo(() => {
    return calculateGamification({
      history,
      activeCheckin,
      manualEditsByDate,
      taskSwitchesByDate,
      expectedEntryTime: user?.expectedEntryTime || '09:00',
    });
  }, [history, activeCheckin, manualEditsByDate, taskSwitchesByDate, user]);

  if (!isOpen) return null;

  // Cálculo de edad
  const calculateAge = (dateStr?: string) => {
    if (!dateStr) return null;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return null;
    const diffMs = Date.now() - birth.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const age = calculateAge(user?.birthDate);

  // Formato legible de fecha de nacimiento
  const formatBirthDate = (dateStr?: string) => {
    if (!dateStr) return 'No especificada';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return dateStr;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfile({ profileImage: reader.result as string });
        addToast('Foto de perfil actualizada con éxito', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateProfile({
        name: editName.trim(),
        lastName: editLastName.trim(),
        birthDate: editBirthDate,
        team: editTeam,
      });
      setIsSaving(false);
      addToast('Ajustes del perfil guardados correctamente', 'success');
      setActiveTab('profile');
    }, 400);
  };

  const handleLogout = async () => {
    await logoutFirebase();
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-[#090E17]/80 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl shadow-black/60 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="relative bg-white dark:bg-[#0B111E] border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-5 pb-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1A2742] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-4">
            {/* Foto con Botón de Cambio */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#1A2742] border border-slate-200 dark:border-[#233354] shadow-xs">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-[#1A2742] text-slate-400 dark:text-[#94A3B8]">
                    <User className="w-7 h-7" />
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Cambiar foto de perfil"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Identificación del Usuario (Limpio sin píldoras enmarcadas) */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
                  {normalizedRole}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {gamification.seasonName}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-slate-900 dark:text-[#F8FAFC] truncate mt-0.5">
                {user?.name} {user?.lastName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.email} • {user?.team || 'Auditoría Fiscal'}
              </p>

              {/* Botones de Acción de Avatar */}
              <div className="flex items-center space-x-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => setIsAvatarCreatorOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-heading font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                  <span>Diseñar Avatar</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#1A2742] dark:hover:bg-[#233354] text-slate-700 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  <span>Subir Foto</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navegación por 4 Pestañas (Diseño Abierto con Subrayado, Sin Caja Gris) */}
          <div className="flex items-center space-x-2 sm:space-x-6 mt-4 border-b border-slate-200 dark:border-[#233354] overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('rank')}
              className={`pb-2.5 pt-1 text-xs sm:text-sm font-heading transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'rank'
                  ? 'border-blue-600 dark:border-sky-400 text-blue-700 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>Medalla & Mes</span>
            </button>

            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-2.5 pt-1 text-xs sm:text-sm font-heading transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'rules'
                  ? 'border-blue-600 dark:border-sky-400 text-blue-700 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Target className="w-4 h-4 shrink-0" />
              <span>¿Cómo Ganar?</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-2.5 pt-1 text-xs sm:text-sm font-heading transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'profile'
                  ? 'border-blue-600 dark:border-sky-400 text-blue-700 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Datos Perfil</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`pb-2.5 pt-1 text-xs sm:text-sm font-heading transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap border-b-2 ${
                activeTab === 'settings'
                  ? 'border-blue-600 dark:border-sky-400 text-blue-700 dark:text-sky-400 font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Ajustes</span>
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-[#131D31]">
          
          {/* ==================================================== */}
          {/* PESTAÑA 1: MEDALLA Y TEMPORADA MENSUAL (DISEÑO ABIERTO) */}
          {/* ==================================================== */}
          {activeTab === 'rank' && (
            <div className="space-y-6">
              
              {/* Información de Temporada y Rango (Desencapsulado y sin fondo gris pesado) */}
              <div className="space-y-5">
                
                {/* Banner de Ciclo Mensual y Reinicio (Limpio y flotante) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-[#233354] text-xs gap-2">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <span className="font-heading font-medium text-slate-700 dark:text-slate-300">
                      Temporada activa: <strong className="text-slate-900 dark:text-white font-bold">{gamification.seasonName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                    <span>Quedan {gamification.daysRemainingInMonth} días para el reinicio mensual</span>
                  </div>
                </div>

                {/* Bloque Principal de Nivel y Puntuación */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center space-x-5">
                    {/* Medalla Animada */}
                    <div className="relative shrink-0">
                      <div 
                        className="absolute inset-0 rounded-full blur-md opacity-40 dark:opacity-70 animate-pulse"
                        style={{ backgroundColor: gamification.rank.color }}
                      />
                      <RankMedal tier={gamification.rank.tier} size="lg" className="relative z-10" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
                          RANGO ACTUAL DEL MES
                        </span>
                        <span className={`text-[10px] font-heading font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md ${gamification.rank.badgeBg} ${gamification.rank.textColor}`}>
                          {gamification.rank.title}
                        </span>
                      </div>
                      
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-3xl font-heading font-bold text-slate-900 dark:text-white">
                          {gamification.points.toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                          / {gamification.maxMonthlyPoints} pts máx mensual
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-sm leading-relaxed">
                        {gamification.rank.description}
                      </p>
                    </div>
                  </div>

                  {/* Honor del Mes Anterior si Existe */}
                  {previousSeason && (
                    <div className="bg-slate-50 dark:bg-[#1A2742]/40 rounded-xl p-3.5 border border-slate-200/80 dark:border-[#233354] text-center shrink-0 sm:min-w-[140px]">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8] block mb-1">
                        Mes Anterior
                      </span>
                      <RankMedal tier={previousSeason.tier} size="xs" className="mx-auto mb-1" />
                      <span className="text-xs font-heading font-bold text-slate-900 dark:text-white block uppercase">
                        {previousSeason.tier} ({previousSeason.points} pts)
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-[#64748B] block mt-0.5">
                        {previousSeason.monthName}
                      </span>
                    </div>
                  )}
                </div>

                {/* Barra de Progreso hacia el Siguiente Rango */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-400 flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-1 text-blue-600 dark:text-sky-400" />
                      {gamification.nextRank 
                        ? `Meta: Avanzar a rango ${gamification.nextRank.title}`
                        : '¡Has alcanzado el rango máximo Diamante del mes!'}
                    </span>
                    <span className="font-heading font-bold text-slate-900 dark:text-white">
                      {gamification.nextRank 
                        ? `${gamification.pointsForNext} pts restantes (${gamification.progressPercent}%)`
                        : '100% completado'}
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0B111E] rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-[#233354]">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${gamification.rank.gradient}`}
                      style={{ width: `${gamification.progressPercent}%` }}
                    />
                  </div>

                  {/* Escala de Progresión de los 4 Rangos (Sin cajas duras repetitivas) */}
                  <div className="grid grid-cols-4 gap-2 pt-3 text-center">
                    {(['bronce', 'plata', 'oro', 'diamante'] as const).map(tierKey => {
                      const tierConfig = RANK_TIERS[tierKey];
                      const isActive = gamification.rank.tier === tierKey;
                      return (
                        <div 
                          key={tierKey}
                          className={`p-2.5 rounded-xl text-center transition-all ${
                            isActive 
                              ? 'bg-blue-50/80 dark:bg-blue-950/30 border border-blue-500/40 dark:border-sky-400/50 shadow-xs' 
                              : 'bg-slate-50/60 dark:bg-[#1A2742]/20 border border-slate-200/50 dark:border-transparent opacity-75 hover:opacity-100'
                          }`}
                        >
                          <RankMedal tier={tierKey} size="xs" className="mx-auto mb-1" />
                          <span className={`text-[11px] font-heading font-bold uppercase block tracking-wider ${isActive ? 'text-blue-700 dark:text-sky-300' : 'text-slate-800 dark:text-[#F8FAFC]'}`}>
                            {tierConfig.title}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block font-semibold">
                            {tierConfig.minPoints}+ pts
                          </span>
                          <span className="text-[9px] text-slate-400 dark:text-[#64748B] block mt-0.5 hidden sm:block">
                            {tierConfig.weekTarget.split(' ')[0]} {tierConfig.weekTarget.split(' ')[1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Auditoría del Día de Hoy: Desglose en Vivo de Puntos (Sin cajas anidadas) */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#233354] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-600 dark:text-sky-400 fill-current" />
                    <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-[#F8FAFC]">
                      Rendimiento de Hoy ({gamification.todayAudit.totalDayPoints} / 100 pts)
                    </h3>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-md ${
                    gamification.todayAudit.totalDayPoints === 100 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-sky-300'
                  }`}>
                    {gamification.todayAudit.totalDayPoints === 100 ? '⭐ Día Perfecto' : 'En progreso hoy'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Criterio 1: Puntualidad */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/70 dark:border-[#233354] transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">1. Puntualidad</span>
                      <span className="text-xs font-heading font-bold text-blue-600 dark:text-sky-400">+{gamification.todayAudit.punctualityPoints} pts</span>
                    </div>
                    <div className="flex items-center space-x-1.5 mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                      <span>{gamification.todayAudit.punctualityPoints > 0 ? 'Tolerancia ≤ 10 min cumplida' : 'Entrada tardía (> 10 min)'}</span>
                    </div>
                  </div>

                  {/* Criterio 2: Jornada Completa */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/70 dark:border-[#233354] transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">2. Jornada Completa</span>
                      <span className="text-xs font-heading font-bold text-blue-600 dark:text-sky-400">+{gamification.todayAudit.fullShiftPoints} pts</span>
                    </div>
                    <div className="flex items-center space-x-1.5 mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                      <span>{gamification.todayAudit.fullShiftPoints > 0 ? '8 horas cumplidas' : `${Math.floor(gamification.todayAudit.workedMinutes / 60)}h ${gamification.todayAudit.workedMinutes % 60}m trabajadas`}</span>
                    </div>
                  </div>

                  {/* Criterio 3: Trabajo en Vivo vs Ediciones */}
                  <div className={`p-3.5 rounded-xl border transition-all ${
                    gamification.todayAudit.isPenalizedForManualEdits 
                      ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                      : 'bg-slate-50 dark:bg-[#1A2742]/30 border-slate-200/70 dark:border-[#233354]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">3. Tiempo en Vivo</span>
                      <span className="text-xs font-heading font-bold text-blue-600 dark:text-sky-400">+{gamification.todayAudit.liveTrackingPoints} pts</span>
                    </div>
                    <div className="flex items-center space-x-1.5 mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {gamification.todayAudit.isPenalizedForManualEdits ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                          <span className="text-rose-700 dark:text-rose-300">Anulado ({gamification.todayAudit.manualEditsCount} ajustes)</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-sky-400" />
                          <span>Cronómetro real en vivo</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {gamification.todayAudit.isPenalizedForManualEdits && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>
                      <strong>Aviso formativo:</strong> Has realizado {gamification.todayAudit.manualEditsCount} ediciones manuales hoy. Para sumar los 40 puntos diarios, conéctate a las tareas usando el cronómetro en vivo en lugar de ajustes manuales.
                    </span>
                  </div>
                )}
              </div>

              {/* Botón para Ver Historial de Días del Mes */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowHistoryDetail(!showHistoryDetail)}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-[#1A2742]/40 dark:hover:bg-[#1A2742] text-slate-700 dark:text-slate-200 rounded-xl text-xs font-heading font-semibold transition-colors flex items-center justify-between cursor-pointer border border-slate-200/80 dark:border-[#233354]"
                >
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                    <span>Historial de Días Computados en {gamification.seasonName} ({gamification.daysWorkedInMonth} días)</span>
                  </div>
                  {showHistoryDetail ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {showHistoryDetail && (
                  <div className="mt-2.5 bg-white dark:bg-[#131D31] border border-slate-200 dark:border-[#233354] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-[#233354] text-xs">
                    {gamification.monthlyAuditHistory.map((d) => (
                      <div key={d.date} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#1A2742]/30 transition-colors">
                        <div>
                          <span className="font-heading font-semibold text-slate-900 dark:text-white block capitalize">{d.dateFormatted}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            Puntual: {d.isPunctual ? '✓ (+30 pts)' : `Tarde (${d.minutesLate}m)`} • 
                            Jornada 8h: {d.isFullShift ? '✓ (+30 pts)' : `${Math.floor(d.workedMinutes / 60)}h`} • 
                            En Vivo: {d.isPenalizedForManualEdits ? 'Anulado por edición manual' : '✓ (+40 pts)'}
                          </span>
                        </div>
                        <span className="font-heading font-bold text-blue-700 dark:text-sky-400 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40">
                          +{d.totalDayPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* PESTAÑA 2: ¿CÓMO GANAR PUNTOS? (REGLAS Y NIVELES) */}
          {/* ==================================================== */}
          {activeTab === 'rules' && (
            <div className="space-y-5">
              
              {/* Explicación de la Filosofía Mensual (Diseño Abierto) */}
              <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-[#233354]">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Sistema de Niveles Mensual Russell Bedford
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  El sistema está diseñado para que te tome <strong className="text-slate-900 dark:text-white font-semibold">exactamente un mes de constancia</strong> alcanzar el rango máximo <strong className="text-blue-700 dark:text-sky-400 font-semibold">Diamante (2,000 pts)</strong>. Al finalizar el mes, el puntaje se reinicia a cero para una nueva temporada, conservando en tu perfil el honor del rango alcanzado.
                </p>
              </div>

              {/* 4 Criterios Oficiales de Puntuación */}
              <div className="space-y-3">
                <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
                  Criterios Diarios para Obtener Puntos (Hasta 100 pts / día)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MONTHLY_GAMIFICATION_RULES.map((rule) => (
                    <div 
                      key={rule.id}
                      className="bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/80 dark:border-[#233354] rounded-xl p-4 space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${rule.tagColor}`}>
                          {rule.tag}
                        </span>
                        {rule.id === 'punctuality' && <Clock className="w-4 h-4 text-blue-600 dark:text-sky-400" />}
                        {rule.id === 'full_shift' && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-sky-400" />}
                        {rule.id === 'live_tracking' && <PlayCircle className="w-4 h-4 text-blue-600 dark:text-sky-400" />}
                        {rule.id === 'manual_edits_penalty' && <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                      </div>

                      <h5 className="font-heading font-semibold text-xs text-slate-900 dark:text-white leading-snug">
                        {rule.title}
                      </h5>

                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {rule.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escala de Rangos por Semanas del Mes */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#233354]">
                <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center">
                  <Award className="w-4 h-4 mr-1.5 text-blue-600 dark:text-sky-400" />
                  Escala de Progresión Durante el Mes
                </h4>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 dark:bg-[#1A2742]/30 rounded-xl border border-slate-200/80 dark:border-[#233354] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <RankMedal tier="bronce" size="xs" />
                      <div>
                        <strong className="text-slate-900 dark:text-white font-heading font-semibold">Bronce (0 – 499 pts)</strong>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block">Semana 1: Arranque y aclimatación de registros.</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-[#131D31] px-2 py-0.5 rounded-md">Días 1 a 5</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#1A2742]/30 rounded-xl border border-slate-200/80 dark:border-[#233354] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <RankMedal tier="plata" size="xs" />
                      <div>
                        <strong className="text-slate-900 dark:text-white font-heading font-semibold">Plata (500 – 999 pts)</strong>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block">Semana 2: Jornadas completas y puntualidad continuada.</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-[#131D31] px-2 py-0.5 rounded-md">Días 6 a 10</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#1A2742]/30 rounded-xl border border-slate-200/80 dark:border-[#233354] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <RankMedal tier="oro" size="xs" />
                      <div>
                        <strong className="text-slate-900 dark:text-white font-heading font-semibold">Oro (1,000 – 1,599 pts)</strong>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block">Semana 3: Alta disciplina en vivo sin ajustes manuales.</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-200/60 dark:bg-[#131D31] px-2 py-0.5 rounded-md">Días 11 a 15</span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#1A2742]/30 rounded-xl border border-slate-200/80 dark:border-[#233354] flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2.5">
                      <RankMedal tier="diamante" size="xs" />
                      <div>
                        <strong className="text-blue-700 dark:text-sky-400 font-heading font-semibold">Diamante (1,600 – 2,000+ pts)</strong>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block">Semana 4 / Fin de mes: Maestría absoluta y máxima puntuación.</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-blue-700 dark:text-sky-300 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">Días 16 a 20+</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-start space-x-2">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    <strong className="text-slate-900 dark:text-white">Reinicio mensual:</strong> Al llegar el día 1 del siguiente mes calendario, el contador se reinicia a 0 para que todos los colaboradores inicien la nueva temporada en igualdad de condiciones. Tu rango alcanzado en el mes previo quedará guardado como honor en tu perfil.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* PESTAÑA 3: DATOS DEL PERFIL CORPORATIVO */}
          {/* ==================================================== */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
                Información Personal y Asignación
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Fecha de Nacimiento */}
                <div className="bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/80 dark:border-[#233354] rounded-xl p-4 flex items-start space-x-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-heading font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider block">
                      Fecha de Nacimiento
                    </span>
                    <p className="text-xs font-heading font-semibold text-slate-900 dark:text-white mt-0.5">
                      {formatBirthDate(user?.birthDate)}
                    </p>
                    {age !== null && (
                      <span className="inline-block text-[10px] font-semibold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md mt-1">
                        {age} años cumplidos
                      </span>
                    )}
                  </div>
                </div>

                {/* Área / Especialidad */}
                <div className="bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/80 dark:border-[#233354] rounded-xl p-4 flex items-start space-x-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-heading font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider block">
                      Área de Especialidad
                    </span>
                    <p className="text-xs font-heading font-semibold text-slate-900 dark:text-white mt-0.5">
                      {user?.team || 'Auditoría Fiscal'}
                    </p>
                    <span className="inline-block text-[10px] font-semibold text-blue-700 dark:text-sky-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md mt-1">
                      Activo en Russell Bedford
                    </span>
                  </div>
                </div>

                {/* Información de Supervisión / Código de Invitación */}
                {user?.role === 'supervisor' ? (
                  <div className="bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/80 dark:border-[#233354] rounded-xl p-4 flex items-start space-x-3.5 sm:col-span-2">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-heading font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Mi Código de Invitación de Supervisor
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        Comparte este código para que los colaboradores se vinculen a tu equipo al registrarse:
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <code className="text-xs font-mono font-bold bg-white dark:bg-[#0B111E] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#233354] text-slate-900 dark:text-white shadow-2xs">
                          {useRayonerStore.getState().getSupervisorCode(user?.id || '')}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            const code = useRayonerStore.getState().getSupervisorCode(user?.id || '');
                            navigator.clipboard.writeText(code);
                            addToast(`Código ${code} copiado al portapapeles.`, 'success');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-heading font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-[#1A2742]/30 border border-slate-200/80 dark:border-[#233354] rounded-xl p-4 flex items-start space-x-3.5 sm:col-span-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] font-heading font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider block">
                        Supervisor de Equipo
                      </span>
                      <p className="text-xs font-heading font-semibold text-slate-900 dark:text-white mt-0.5">
                        {user?.supervisorName || 'Supervisor Prueba'}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Código de vinculación:
                        </span>
                        <code className="text-xs font-mono font-bold bg-white dark:bg-[#0B111E] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#233354] text-blue-700 dark:text-sky-400">
                          {user?.supervisorCode || 'SUP-RB-9901'}
                        </code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* PESTAÑA 4: FORMULARIO DE AJUSTES */}
          {/* ==================================================== */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* ===================================================================== */}
              {/* SECCIÓN DE APARIENCIA: TONALIDAD CLARA Y OSCURA (DISEÑO ABIERTO) */}
              {/* ===================================================================== */}
              <div className="space-y-3 pb-4 border-b border-slate-100 dark:border-[#233354]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Tonalidad de la Interfaz (Tema)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Alterna entre el modo claro con fondos blancos limpios o el modo oscuro corporativo.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-heading font-semibold uppercase px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-400">
                    {theme === 'dark' ? 'Oscuro Activo' : 'Claro Activo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      addToast('Tema cambiado a Tonalidad Clara', 'info');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      theme === 'light'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-600/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-[#131D31] border-slate-200 dark:border-[#233354] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center space-x-2">
                        <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400 dark:text-[#94A3B8]'}`} />
                        <span className={`text-xs font-heading font-bold ${theme === 'light' ? 'text-slate-900' : 'text-slate-700 dark:text-[#F8FAFC]'}`}>
                          Tonalidad Clara
                        </span>
                      </div>
                      {theme === 'light' && (
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                      )}
                    </div>
                    <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-500 dark:text-[#94A3B8]'}`}>
                      Fondos limpios en blanco puro y slate con alto contraste y nitidez visual para entornos iluminados.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      addToast('Tema cambiado a Tonalidad Oscura', 'info');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      theme === 'dark'
                        ? 'bg-[#0B111E] border-sky-400 ring-2 ring-sky-400/20 shadow-xs'
                        : 'bg-slate-50 dark:bg-[#131D31] border-slate-200 dark:border-[#233354] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <div className="flex items-center space-x-2">
                        <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-sky-400' : 'text-slate-400 dark:text-[#94A3B8]'}`} />
                        <span className={`text-xs font-heading font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-700 dark:text-[#F8FAFC]'}`}>
                          Tonalidad Oscura
                        </span>
                      </div>
                      {theme === 'dark' && (
                        <span className="w-2 h-2 rounded-full bg-sky-400" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500 dark:text-[#94A3B8]">
                      Superficies azul marino profundo y contrastes sobrios para reducir el cansancio visual.
                    </p>
                  </button>
                </div>
              </div>

              {/* Formulario de Datos Personales */}
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-heading font-semibold text-slate-700 dark:text-[#94A3B8] mb-1">
                      Nombre(s)
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1A2742] border border-slate-300 dark:border-[#233354] text-xs text-slate-900 dark:text-[#F8FAFC] focus:border-blue-600 dark:focus:border-[#38BDF8] outline-hidden transition-colors"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-semibold text-slate-700 dark:text-[#94A3B8] mb-1">
                      Apellido(s)
                    </label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1A2742] border border-slate-300 dark:border-[#233354] text-xs text-slate-900 dark:text-[#F8FAFC] focus:border-blue-600 dark:focus:border-[#38BDF8] outline-hidden transition-colors"
                      placeholder="Tus apellidos"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-heading font-semibold text-slate-700 dark:text-[#94A3B8] mb-1">
                      Fecha de Nacimiento
                    </label>
                    <input
                      type="date"
                      value={editBirthDate}
                      onChange={(e) => setEditBirthDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1A2742] border border-slate-300 dark:border-[#233354] text-xs text-slate-900 dark:text-[#F8FAFC] focus:border-blue-600 dark:focus:border-[#38BDF8] outline-hidden transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-semibold text-slate-700 dark:text-[#94A3B8] mb-1">
                      Área / Especialidad
                    </label>
                    <select
                      value={editTeam}
                      onChange={(e) => setEditTeam(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white dark:bg-[#1A2742] border border-slate-300 dark:border-[#233354] text-xs text-slate-900 dark:text-[#F8FAFC] focus:border-blue-600 dark:focus:border-[#38BDF8] outline-hidden transition-colors"
                    >
                      <option value="Auditoría Fiscal">Auditoría Fiscal</option>
                      <option value="Auditoría Financiera">Auditoría Financiera</option>
                      <option value="Consultoría y Riesgos">Consultoría y Riesgos</option>
                      <option value="Impuestos y Legal">Impuestos y Legal</option>
                      <option value="Supervisión General">Supervisión General</option>
                      <option value="Capital Humano y Asistencia">Capital Humano y Asistencia</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* SECCIÓN DE BIOMETRÍA VECTORIAL: ACTUALIZAR REGISTRO FACIAL (SIN FOTOS) */}
              {/* ===================================================================== */}
              <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-[#233354]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <ScanFace className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Actualizar Registro Facial
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Endpoint: <code className="text-blue-600 dark:text-sky-400">PUT /api/users/me/biometrics</code> • Modelo: <code className="text-blue-600 dark:text-sky-400">face_recognition_v1</code>
                      </p>
                    </div>
                  </div>

                  {requiresBiometrics ? (
                    <span className="text-[10px] font-heading font-semibold uppercase px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-400 w-fit">
                      Biometría Requerida ({normalizedRole})
                    </span>
                  ) : (
                    <span className="text-[10px] font-heading font-semibold uppercase px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A2742] text-slate-600 dark:text-slate-300 w-fit">
                      Exento por Defecto ({normalizedRole})
                    </span>
                  )}
                </div>

                {/* Estado actual del vector numérico */}
                {activeVector && activeVector.length > 0 ? (
                  <div className="bg-slate-50 dark:bg-[#0B111E] rounded-xl p-3.5 border border-slate-200/80 dark:border-[#233354] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-semibold text-blue-700 dark:text-sky-400 flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                        <span>Vector Facial Activo ({activeVector.length} floats • 0 imágenes)</span>
                      </span>
                      {vectorLastUpdated && (
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] font-mono">
                          {new Date(vectorLastUpdated).toLocaleString('es-MX')}
                        </span>
                      )}
                    </div>
                    <code className="block text-[10px] font-mono text-slate-600 dark:text-[#94A3B8] bg-white dark:bg-[#0F172A] px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-[#233354] truncate">
                      {`{"faceDescriptor": [${activeVector.slice(0, 4).map((v) => Number(v).toFixed(3)).join(', ')}, ...], "model": "face_recognition_v1"}`}
                    </code>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                    Aún no cuentas con un <code>faceDescriptor</code> calibrado en este dispositivo. Presiona el botón inferior para capturar tu vector facial sin guardar fotografías.
                  </div>
                )}

                {/* Información de soporte: parámetros predefinidos en acceso / check-in */}
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Los parámetros de coincidencia biométrica están predefinidos por el sistema. Si presentas dificultades para que la cámara reconozca tu rostro o tu registro no coincide al marcar asistencia, puedes volver a capturar tu vector facial.
                </p>

                {/* Botón para abrir cámara y rehacer / recalibrar vector */}
                <button
                  id="btn-recalibrate-face"
                  type="button"
                  onClick={() => setIsRecalibrateModalOpen(true)}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-heading font-semibold transition-colors shadow-xs cursor-pointer flex items-center justify-center space-x-2"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>
                    {activeVector && activeVector.length > 0
                      ? 'Rehacer / Recalibrar Vector Facial'
                      : 'Capturar Vector Facial Ahora'}
                  </span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-heading font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-60 flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando cambios...' : 'Guardar Ajustes'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer con Botón de Cerrar y Cerrar Sesión (Sobrio y nítido) */}
        <div className="p-4 bg-white dark:bg-[#0F172A] border-t border-slate-200 dark:border-[#233354] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-slate-100 dark:hover:bg-[#1A2742] rounded-lg border border-slate-200 dark:border-[#233354] transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center space-x-1.5 px-4 py-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-lg text-xs font-heading font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>

      </div>

      {/* Modal del Estudio de Creación de Avatar */}
      <AvatarCreatorModal
        isOpen={isAvatarCreatorOpen}
        onClose={() => setIsAvatarCreatorOpen(false)}
        onSaveAvatar={(avatarUrl) => {
          updateProfile({ profileImage: avatarUrl });
          addToast('¡Avatar personalizado guardado y aplicado a tu perfil!', 'success');
        }}
      />

      {/* Modal de Recalibración del Vector Facial desde Ajustes (PUT /api/users/me/biometrics) */}
      <FacialEnrollmentModal
        isOpen={isRecalibrateModalOpen}
        onClose={() => setIsRecalibrateModalOpen(false)}
        mode="recalibrate"
        endpointTarget="me"
        onEnrollmentComplete={() => {
          setIsRecalibrateModalOpen(false);
          addToast('Registro facial recalibrado vía PUT /api/users/me/biometrics.', 'success');
        }}
      />

    </div>
  );
}
