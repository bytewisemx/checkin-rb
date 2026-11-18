import { useState, useEffect } from 'react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';
import {
  canCreateOrManageCompanies,
  generateCompanyCodeSuggestion,
  saveCompanyToFirestore,
} from '../../../services/companyService';
import { normalizeRole } from '../../../services/rbac';

export interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (companyId: string, companyName: string) => void;
}

export function CreateCompanyModal({
  isOpen,
  onClose,
  onCreated,
}: CreateCompanyModalProps) {
  const { groups, clients, addGroup } = useRayonerStore();
  const { user, addToast } = useCheckinStore();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canCreate = canCreateOrManageCompanies(user?.role);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setCode('');
      setIsCodeManuallyEdited(false);
      setTaxId('');
      setContactName('');
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      setErrorMsg('El nombre o razón social de la empresa es obligatorio.');
      return;
    }
    if (!cleanCode) {
      setErrorMsg('La clave interna es obligatoria (ej. CIC-2026-01).');
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

      const companyId = `cmp-${Date.now()}`;
      const actorUid = user?.id || 'demo_socio';
      const actorRole = normalizeRole(user?.role);

      const res = await saveCompanyToFirestore({
        id: companyId,
        name: cleanName,
        code: cleanCode,
        taxId: taxId.trim().toUpperCase(),
        contactName: contactName.trim(),
        status: 'active',
        createdBy: actorUid,
        createdByRole: actorRole,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'No se pudo registrar la empresa en Firestore.');
        addToast(res.error || 'Error al registrar la empresa.', 'error');
        return;
      }

      // Reflejar inmediatamente en el store local (en sincronía con onSnapshot)
      useRayonerStore.setState((state) => {
        const exists = state.clients.some((c) => c.id === companyId);
        if (exists) return state;
        return {
          clients: [
            ...state.clients,
            {
              id: companyId,
              groupId: targetGroupId,
              name: res.data!.name,
              code: res.data!.code,
              taxId: res.data!.taxId,
              contactName: res.data!.contactName,
              createdBy: res.data!.createdBy,
              createdByRole: res.data!.createdByRole,
              isActive: true,
            },
          ],
        };
      });

      addToast(`Empresa "${res.data.name}" (${res.data.code}) registrada correctamente.`, 'success');
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar Empresa o Cliente"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#101726] text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold font-['Space_Grotesk'] text-slate-900 dark:text-white">
              Registrar Empresa / Cliente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Da de alta una entidad para vincular proyectos y asignación de horas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm leading-none p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!canCreate ? (
          <div className="py-4 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tu perfil no cuenta con autorización para registrar empresas. Esta acción está reservada para Socio, Gerente y TI.
            </p>
            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Nombre o Razón Social *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej. Corporativo Industrial del Centro S.A. de C.V."
                className="w-full bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 text-sm border border-slate-300 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
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
                  className="w-full bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 font-mono text-sm border border-slate-300 dark:border-slate-700 px-3 py-2 uppercase focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  RFC (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={13}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.toUpperCase())}
                  placeholder="CIC200101ABC"
                  className="w-full bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 font-mono text-sm border border-slate-300 dark:border-slate-700 px-3 py-2 uppercase focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Contacto Principal (Opcional)
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nombre o correo de contacto"
                className="w-full bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 text-sm border border-slate-300 dark:border-slate-700 px-3 py-2 focus:outline-none focus:border-blue-600"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-600 dark:text-rose-400 border-l-2 border-rose-500 pl-3 py-1">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-transparent border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-600 disabled:opacity-50 transition cursor-pointer"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Empresa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
