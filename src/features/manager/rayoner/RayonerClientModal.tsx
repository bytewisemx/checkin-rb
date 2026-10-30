import { useState, useEffect } from 'react';
import { 
  X, Building2, FolderPlus, Check, Trash2, Hash 
} from 'lucide-react';
import { useRayonerStore } from '../../../store/useRayonerStore';
import { useCheckinStore } from '../../../store/useCheckinStore';

interface RayonerClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: string | null;
  initialGroupId?: string;
}

export function RayonerClientModal({
  isOpen,
  onClose,
  clientId,
  initialGroupId,
}: RayonerClientModalProps) {
  const { 
    clients, 
    groups, 
    projects,
    addClient, 
    updateClient, 
    deleteClient,
    addGroup 
  } = useRayonerStore();

  const addToast = useCheckinStore(state => state.addToast);

  const existingClient = clientId ? clients.find(c => c.id === clientId) : null;
  const isEditing = !!existingClient;

  // Estados del formulario
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Sincronizar cuando cambia el cliente seleccionado
  useEffect(() => {
    if (existingClient) {
      setName(existingClient.name);
      setTaxId(existingClient.taxId || '');
      setGroupId(existingClient.groupId);
      setIsActive(existingClient.isActive ?? true);
    } else {
      setName('');
      setTaxId('');
      setGroupId(initialGroupId || groups[0]?.id || 'grp-corp');
      setIsActive(true);
    }
    setIsCreatingNewGroup(false);
    setNewGroupName('');
  }, [existingClient, initialGroupId, groups, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('El nombre o razón social del cliente es obligatorio', 'error');
      return;
    }

    let finalGroupId = groupId;

    // Si está creando un nuevo grupo
    if (isCreatingNewGroup && newGroupName.trim()) {
      addGroup(newGroupName.trim(), false);
      const createdGroup = groups[groups.length - 1];
      if (createdGroup) {
        finalGroupId = createdGroup.id;
      }
    }

    if (isEditing && existingClient) {
      updateClient(existingClient.id, {
        name: name.trim(),
        taxId: taxId.trim(),
        groupId: finalGroupId,
        isActive,
      });
      addToast(`Cliente "${name.trim()}" actualizado exitosamente`, 'success');
    } else {
      addClient(finalGroupId, name.trim(), taxId.trim());
      addToast(`Cliente "${name.trim()}" creado exitosamente`, 'success');
    }

    onClose();
  };

  const handleDelete = () => {
    if (!existingClient) return;
    const clientProjects = projects.filter(p => p.clientId === existingClient.id);
    const confirmMsg = clientProjects.length > 0
      ? `¿Estás seguro de eliminar "${existingClient.name}"? Se eliminarán también sus ${clientProjects.length} proyectos asociados.`
      : `¿Estás seguro de eliminar "${existingClient.name}"?`;

    if (window.confirm(confirmMsg)) {
      deleteClient(existingClient.id);
      addToast(`Cliente eliminado correctamente`, 'info');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col">
        
        {/* Cabecera del Modal */}
        <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                {isEditing ? 'Editar Cliente' : 'Nuevo Cliente / Razón Social'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditing ? 'Modifica los datos y grupo del cliente' : 'Registra un nuevo cliente para gestionar sus proyectos'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="p-6 space-y-4.5">
          
          {/* Grupo de Clientes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center">
                <FolderPlus className="w-3.5 h-3.5 mr-1 text-[#0D5C75]" />
                Grupo / Cartera
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingNewGroup(!isCreatingNewGroup)}
                className="text-[11px] font-bold text-[#0D5C75] hover:underline"
              >
                {isCreatingNewGroup ? 'Elegir grupo existente' : '+ Crear nuevo grupo'}
              </button>
            </div>

            {isCreatingNewGroup ? (
              <input
                type="text"
                placeholder="Nombre del nuevo grupo (ej. Clientes Gubernamentales)"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              />
            ) : (
              <select
                value={groupId}
                onChange={e => setGroupId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
              >
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.isInternal ? '(Interno)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nombre o Razón Social */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Nombre o Razón Social *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Grupo Baluarte S.A. de C.V."
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
            />
          </div>

          {/* RFC / Identificación Fiscal */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center">
              <Hash className="w-3.5 h-3.5 mr-1 text-slate-400" />
              RFC / Identificador Fiscal
            </label>
            <input
              type="text"
              placeholder="Ej. GBA-980421-K32"
              value={taxId}
              onChange={e => setTaxId(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#0D5C75]/20 focus:border-[#0D5C75] outline-none"
            />
          </div>

          {/* Estado Activo / Inactivo */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Cliente Activo</span>
              <span className="text-[11px] text-slate-500">
                Los clientes inactivos no aparecerán en el cronómetro de los colaboradores.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                isActive ? 'bg-[#0D5C75]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Eliminar Cliente
              </button>
            ) : <span />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 bg-[#0D5C75] hover:bg-[#0A485C] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
