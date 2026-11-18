import { useState, useEffect, useRef } from 'react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import {
  ALLOWED_LOGO_TYPES,
  MAX_LOGO_SIZE_BYTES,
  canCreateOrManageCompanies,
  generateCompanyCodeSuggestion,
  getCompanyInitials,
  optimizeCompanyLogoToDataUrl,
  saveCompanyToFirestore,
  uploadCompanyLogo,
} from '../../../services/companyService';
import { normalizeRole } from '../../../services/rbac';
import type { Client } from '../../../types/rayoner';

export interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCompany?: Client | null;
  onCreated?: (companyId: string, companyName: string) => void;
}

const COMMON_TAX_REGIMES = [
  '601 - General de Ley Personas Morales',
  '603 - Personas Morales con Fines no Lucrativos',
  '612 - Personas Físicas con Actividades Empresariales y Profesionales',
  '626 - Régimen Simplificado de Confianza (RESICO)',
  '620 - Sociedades Cooperativas de Producción',
];

export function CreateCompanyModal({
  isOpen,
  onClose,
  editingCompany = null,
  onCreated,
}: CreateCompanyModalProps) {
  const { groups, clients, addGroup } = useRayonerStore();
  const { user, addToast } = useCheckinStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditing = Boolean(editingCompany);
  const todayIso = new Date().toISOString().split('T')[0];

  // Identidad y Marca
  const [name, setName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [code, setCode] = useState('');
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');

  // Datos Fiscales y Corporativos
  const [taxId, setTaxId] = useState('');
  const [taxRegime, setTaxRegime] = useState('');
  const [industry, setIndustry] = useState('');
  const [fiscalAddress, setFiscalAddress] = useState('');

  // Contacto Principal
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Fechas, Vigencia Contractual y Estatus
  const [startDate, setStartDate] = useState(todayIso);
  const [renewalDate, setRenewalDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canCreate = canCreateOrManageCompanies(user?.role);

  useEffect(() => {
    if (!isOpen) return;
    const today = new Date().toISOString().split('T')[0];
    if (editingCompany) {
      setName(editingCompany.name || '');
      setCommercialName(editingCompany.commercialName || '');
      setCode(editingCompany.code || '');
      setIsCodeManuallyEdited(true);
      setLogoFile(null);
      setLogoPreviewUrl(editingCompany.logoUrl || '');
      setTaxId(editingCompany.taxId || '');
      setTaxRegime(editingCompany.taxRegime || '');
      setIndustry(editingCompany.industry || '');
      setFiscalAddress(editingCompany.fiscalAddress || '');
      setContactName(editingCompany.contactName || '');
      setContactRole(editingCompany.contactRole || '');
      setContactEmail(editingCompany.contactEmail || '');
      setContactPhone(editingCompany.contactPhone || '');
      setStartDate(editingCompany.startDate || today);
      setRenewalDate(editingCompany.renewalDate || '');
      setNotes(editingCompany.notes || '');
      setStatus(editingCompany.isActive === false ? 'inactive' : 'active');
    } else {
      setName('');
      setCommercialName('');
      setCode('');
      setIsCodeManuallyEdited(false);
      setLogoFile(null);
      setLogoPreviewUrl('');
      setTaxId('');
      setTaxRegime('');
      setIndustry('');
      setFiscalAddress('');
      setContactName('');
      setContactRole('');
      setContactEmail('');
      setContactPhone('');
      setStartDate(today);
      setRenewalDate('');
      setNotes('');
      setStatus('active');
    }
    setErrorMsg('');
    setIsSubmitting(false);
  }, [isOpen, editingCompany]);

  if (!isOpen) return null;

  const monogram = getCompanyInitials(name, commercialName);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isCodeManuallyEdited) {
      if (val.trim().length >= 2) {
        setCode(generateCompanyCodeSuggestion(val, clients.length + 1));
      } else {
        setCode('');
      }
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setErrorMsg('Formato de logotipo no soportado. Selecciona PNG, JPG, WEBP o SVG.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setErrorMsg('El logotipo excede el tamaño máximo de 2 MB.');
      e.target.value = '';
      return;
    }

    try {
      const preview = await optimizeCompanyLogoToDataUrl(file, 256);
      setLogoFile(file);
      setLogoPreviewUrl(preview);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo previsualizar el logotipo.');
    }
  };

  const handleClearLogo = () => {
    setLogoFile(null);
    setLogoPreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!canCreate) {
      const msg = 'Acceso restringido: solo Socio, Gerente y TI pueden dar de alta empresas.';
      setErrorMsg(msg);
      addToast(msg, 'error');
      return;
    }

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

    if (!cleanName) {
      setErrorMsg('La razón social de la empresa es obligatoria.');
      return;
    }
    if (!cleanCode) {
      setErrorMsg('La clave interna es obligatoria (ej. CIC-2026-01).');
      return;
    }
    if (!startDate) {
      setErrorMsg('La fecha de inicio de relación comercial es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Asegurar que exista al menos una cartera corporativa en el store local
      let targetGroupId = groups[0]?.id || '';
      if (!targetGroupId) {
        addGroup('Cartera Corporativa', false);
        const updatedGroups = useRayonerStore.getState().groups;
        targetGroupId = updatedGroups[0]?.id || 'grp-corp';
      }

      // Subir logotipo a Firebase Storage (con fallback automático a DataURL <= 256x256px)
      let finalLogoUrl = logoPreviewUrl;
      if (logoFile) {
        finalLogoUrl = await uploadCompanyLogo(logoFile, cleanCode);
      }

      const companyId = editingCompany ? editingCompany.id : `cmp-${Date.now()}`;
      const actorUid = user?.id || 'demo_socio';
      const actorRole = normalizeRole(user?.role);

      const res = await saveCompanyToFirestore({
        id: companyId,
        name: cleanName,
        commercialName: commercialName.trim(),
        code: cleanCode,
        logoUrl: finalLogoUrl,
        taxId: taxId.trim().toUpperCase(),
        taxRegime: taxRegime.trim(),
        industry: industry.trim(),
        fiscalAddress: fiscalAddress.trim(),
        contactName: contactName.trim(),
        contactRole: contactRole.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        startDate,
        renewalDate,
        notes: notes.trim(),
        status,
        createdBy: editingCompany?.createdBy || actorUid,
        createdByRole: actorRole,
        isUpdate: isEditing,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'No se pudo guardar la empresa en Firestore.');
        addToast(res.error || 'Error al guardar la empresa.', 'error');
        return;
      }

      // Reflejar inmediatamente en el store local
      useRayonerStore.setState((state) => {
        const mappedClient: Client = {
          id: companyId,
          groupId: editingCompany?.groupId || targetGroupId,
          name: res.data!.name,
          commercialName: res.data!.commercialName,
          code: res.data!.code,
          logoUrl: res.data!.logoUrl,
          taxId: res.data!.taxId,
          taxRegime: res.data!.taxRegime,
          industry: res.data!.industry,
          fiscalAddress: res.data!.fiscalAddress,
          contactName: res.data!.contactName,
          contactRole: res.data!.contactRole,
          contactEmail: res.data!.contactEmail,
          contactPhone: res.data!.contactPhone,
          startDate: res.data!.startDate,
          renewalDate: res.data!.renewalDate,
          notes: res.data!.notes,
          createdBy: res.data!.createdBy,
          createdByRole: res.data!.createdByRole,
          isActive: res.data!.status !== 'inactive',
        };
        const exists = state.clients.some((c) => c.id === companyId);
        return {
          clients: exists
            ? state.clients.map((c) => (c.id === companyId ? mappedClient : c))
            : [...state.clients, mappedClient],
        };
      });

      addToast(
        isEditing
          ? `Expediente de "${res.data.name}" actualizado correctamente.`
          : `Empresa "${res.data.name}" (${res.data.code}) registrada correctamente.`,
        'success'
      );
      onCreated?.(companyId, res.data.name);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Error inesperado al registrar la empresa.';
      setErrorMsg(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar Empresa o Cliente"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header limpio sin iconos decorativos */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
              {isEditing ? 'Editar Expediente de Empresa' : 'Registrar Empresa / Cliente'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Expediente corporativo, datos fiscales y vigencia de servicio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-medium px-2 py-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>

        {!canCreate ? (
          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tu perfil no cuenta con autorización para registrar empresas. Esta acción está reservada para Socio, Gerente y TI.
            </p>
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <form
            id="create-company-form"
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Cuerpo con Scroll Controlado */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
              {/* Bloque de Logotipo e Identidad */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800 dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                  {logoPreviewUrl ? (
                    <img
                      src={logoPreviewUrl}
                      alt="Previsualización de logotipo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span className="font-['Space_Grotesk'] font-bold text-lg text-sky-400 select-none">
                      {monogram}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Logotipo de la Empresa
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer px-3 py-1.5 text-xs font-medium bg-slate-50 dark:bg-[#090E17] border border-slate-300 dark:border-slate-700 hover:border-blue-600 text-slate-800 dark:text-slate-200 transition">
                      Seleccionar Archivo
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>
                    {logoPreviewUrl && (
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
                      >
                        Quitar
                      </button>
                    )}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      PNG, JPG, WEBP o SVG (Máx. 2 MB)
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 1 — Identificación y Datos Fiscales */}
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sección 1 · Identificación y Datos Fiscales
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ej. Corporativo Industrial del Centro S.A. de C.V."
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Nombre Comercial
                    </label>
                    <input
                      type="text"
                      value={commercialName}
                      onChange={(e) => setCommercialName(e.target.value)}
                      placeholder="Ej. Grupo Industrial CIC"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Clave Interna *
                    </label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => {
                        setIsCodeManuallyEdited(true);
                        setCode(e.target.value.toUpperCase());
                      }}
                      placeholder="CIC-2026-01"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 tabular-nums border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm uppercase focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      RFC / ID Fiscal
                    </label>
                    <input
                      type="text"
                      maxLength={13}
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                      placeholder="CIC200101ABC"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 tabular-nums border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm uppercase focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Giro / Sector
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Ej. Manufactura / Automotriz"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Régimen Fiscal
                    </label>
                    <input
                      type="text"
                      list="common-tax-regimes-list"
                      value={taxRegime}
                      onChange={(e) => setTaxRegime(e.target.value)}
                      placeholder="Ej. 601 - General de Ley Personas Morales"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                    <datalist id="common-tax-regimes-list">
                      {COMMON_TAX_REGIMES.map((regime) => (
                        <option key={regime} value={regime} />
                      ))}
                    </datalist>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Dirección Fiscal / Sede
                    </label>
                    <input
                      type="text"
                      value={fiscalAddress}
                      onChange={(e) => setFiscalAddress(e.target.value)}
                      placeholder="Calle, número, colonia, ciudad y estado"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2 — Contacto Clave y Vigencia */}
              <div className="space-y-4 pt-5 border-t border-slate-200 dark:border-slate-800/60">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sección 2 · Contacto Clave y Vigencia Contractual
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Nombre del Contacto Principal
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Ej. Lic. Fernando Ruiz"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Cargo / Puesto
                    </label>
                    <input
                      type="text"
                      value={contactRole}
                      onChange={(e) => setContactRole(e.target.value)}
                      placeholder="Ej. Director de Administración"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="contacto@empresa.com.mx"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+52 449 123 4567"
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 tabular-nums border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Fecha de Inicio *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 tabular-nums border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Fecha de Renovación / Corte
                    </label>
                    <input
                      type="date"
                      value={renewalDate}
                      onChange={(e) => setRenewalDate(e.target.value)}
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 tabular-nums border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Observaciones / Acuerdos Importantes
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Condiciones de servicio, cierres fiscales mensuales o requerimientos especiales..."
                      className="w-full bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700/60 rounded-md py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#1E3A8A] resize-none transition-colors"
                    />
                  </div>

                  {isEditing && (
                    <div className="sm:col-span-2 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/60">
                      <div>
                        <span className="block text-[13px] font-medium text-slate-700 dark:text-slate-300">
                          Estatus Comercial
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Controla si la empresa está activa para nuevos proyectos.
                        </span>
                      </div>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                        className="bg-white dark:bg-[#0D1320] text-slate-900 dark:text-slate-100 text-sm font-medium border border-slate-300 dark:border-slate-700/60 rounded-md px-3.5 py-2 focus:outline-none focus:border-[#1E3A8A] transition-colors"
                      >
                        <option value="active">Activa</option>
                        <option value="inactive">Inactiva / En pausa</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="text-sm text-rose-600 dark:text-rose-400 border-l-2 border-rose-500 pl-3 py-1">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Footer Fijo con Botones Minimalistas */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-end gap-3 shrink-0 bg-white dark:bg-[#101726]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#1D4ED8] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Guardando...'
                  : isEditing
                  ? 'Guardar Cambios'
                  : 'Guardar Empresa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
