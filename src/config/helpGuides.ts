import type { UserRole } from '../services/rbac';

export interface HelpStep {
  target: string;
  text: string;
  title?: string;
  navHint?: string; // Ruta o pestaña sugerida si el elemento no se encuentra de inmediato
}

export interface HelpGuideItem {
  id: string;
  question: string;
  description?: string;
  steps: HelpStep[];
}

export type HelpCatalog = Partial<Record<UserRole, HelpGuideItem[]>>;

const BASE_CATALOG: HelpCatalog = {
  RH: [
    {
      id: "rh_time_by_user",
      question: "¿Cómo consulto el tiempo de trabajo por usuario?",
      description: "Aprende a filtrar y auditar las horas laboradas de los colaboradores.",
      steps: [
        { 
          target: "#nav-metrics-time", 
          text: "Dirígete al apartado de Registros de Tiempo.",
          title: "1. Sección de Métricas"
        },
        { 
          target: "#filter-user-select", 
          text: "Selecciona al colaborador que deseas auditar mediante el buscador o filtro de estado.",
          title: "2. Filtro de Colaborador"
        },
        { 
          target: "#time-summary-view", 
          text: "Aquí visualizas las horas netas sin detalles de clientes ni tareas.",
          title: "3. Resumen Sanitizado de Horas"
        }
      ]
    },
    {
      id: "rh_headcount",
      question: "¿Cómo consultar el total de personal activo?",
      description: "Visualiza el censo general, activos hoy y distribución de turnos.",
      steps: [
        { 
          target: "#nav-headcount", 
          text: "Consulta el censo general de usuarios en este panel con los KPIs de personal activo y fuera de turno.",
          title: "Censo General de Personal"
        }
      ]
    }
  ],

  Empleado: [
    {
      id: "emp_extra_task",
      question: "¿Cómo doy de alta una tarea extraordinaria?",
      description: "Registra una labor no planificada previamente.",
      steps: [
        { 
          target: "#btn-extra-task", 
          text: "Haz clic en '+ Tarea Extraordinaria' para abrir el formulario de actividad independiente.",
          title: "1. Botón de Tarea Extraordinaria"
        },
        { 
          target: "#task-title-input", 
          text: "Escribe el nombre de la actividad y tu estimado de horas requeridas.",
          title: "2. Datos de la Actividad"
        },
        { 
          target: "#task-submit-btn", 
          text: "Confirma para notificar automáticamente a tu supervisor y comenzar a computar tiempo.",
          title: "3. Registro y Confirmación"
        }
      ]
    },
    {
      id: "emp_facial_update",
      question: "¿Cómo recalibro mi registro facial?",
      description: "Actualiza tu vector numérico biométrico sin guardar fotografías.",
      steps: [
        { 
          target: "#nav-settings", 
          text: "Ingresa a tu perfil y ajustes desde tu avatar en la barra superior.",
          title: "1. Perfil y Ajustes"
        },
        { 
          target: "#btn-recalibrate-face", 
          text: "Pulsa aquí para abrir el visor biométrico y capturar nuevamente tu vector numérico.",
          title: "2. Recalibración Facial"
        }
      ]
    }
  ],

  Supervisor: [
    {
      id: "sup_review_task",
      question: "¿Cómo devuelvo una tarea a revisión?",
      description: "Aprende el flujo de supervisión para observar tareas de colaboradores.",
      steps: [
        { 
          target: "#board-in-review-col", 
          text: "Ubica la tarea dentro de tu columna 'En Revisión' o en el panel de supervisión.",
          title: "1. Columna En Revisión"
        },
        { 
          target: "#btn-reject-task", 
          text: "Selecciona devolver para requerir ajustes al empleado con observaciones específicas.",
          title: "2. Devolución de Tarea"
        }
      ]
    },
    {
      id: "sup_invite_member",
      question: "¿Cómo invito a un nuevo colaborador a mi equipo?",
      description: "Genera tokens de whitelist criptográfica para nuevos integrantes.",
      steps: [
        { 
          target: "#btn-invite-team", 
          text: "Ingresa el correo para enviarle el link con token único e incorporarlo a la lista blanca.",
          title: "Invitación de Equipo"
        }
      ]
    }
  ],

  TI: [
    {
      id: "ti_toggle_permissions",
      question: "¿Cómo activo o desactivo módulos a un usuario?",
      description: "Gestiona los accesos individuales mediante checkboxes.",
      steps: [
        { 
          target: "#nav-user-permissions", 
          text: "Abre la matriz de control de usuarios para configurar permisos granulares.",
          title: "1. Pestaña de Permisos"
        },
        { 
          target: ".user-row-checkboxes", 
          text: "Marca o desmarca los módulos requeridos (tareas, biometría, check-in, reportes).",
          title: "2. Asignación Granular"
        },
        { 
          target: "#btn-save-modules", 
          text: "Guarda para sincronizar de inmediato en el perfil del usuario vía API.",
          title: "3. Sincronización Inmediata"
        }
      ]
    },
    {
      id: "ti_invite_supervisor",
      question: "¿Cómo emitir enlace de invitación para un Supervisor?",
      description: "Habilita a un nuevo supervisor de equipo con privilegios de gestión.",
      steps: [
        { 
          target: "#btn-new-supervisor-invite", 
          text: "Genera el enlace raíz desde este botón para vincular al nuevo líder.",
          title: "Emisión de Token de Supervisor"
        }
      ]
    }
  ]
};

export const HELP_CATALOG: HelpCatalog = {
  ...BASE_CATALOG,
  Colaborador: BASE_CATALOG.Empleado,
  Gerente: BASE_CATALOG.Supervisor,
  Socio: BASE_CATALOG.Supervisor,
};

