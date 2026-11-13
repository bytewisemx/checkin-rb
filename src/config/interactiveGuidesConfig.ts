export interface TourStep {
  target: string;
  title: string;
  text: string;
  navHint?: string;
}

export interface InteractiveGuide {
  id: string;
  title: string;
  question: string; // Para compatibilidad total con HelpGuideItem
  description: string;
  role: 'colaborador' | 'supervisor' | 'gerente' | 'socio' | 'rh' | 'ti';
  steps: TourStep[];
}

export const INTERACTIVE_GUIDES: Record<string, InteractiveGuide[]> = {
  colaborador: [
    {
      id: 'colab_checkin',
      title: 'Registro de Jornada y Biometría',
      question: '¿Cómo registrar mi jornada y validar biometría?',
      description: 'Aprende a iniciar o pausar tu turno diario y verificar tu asistencia.',
      role: 'colaborador',
      steps: [
        {
          target: '[data-tour="checkin-biometric-btn"]',
          title: 'Botón de Registro Biométrico',
          text: 'Haz clic aquí para iniciar tu jornada laboral. Se verificará tu ubicación y biometría.',
          navHint: 'Pestaña Asistencia Global',
        },
        {
          target: '[data-tour="active-timer-display"]',
          title: 'Cronómetro de Jornada Activa',
          text: 'Aquí visualizas el tiempo computado en vivo de tu turno de trabajo actual.',
          navHint: 'Pestaña Asistencia Global con jornada en curso',
        },
      ],
    },
    {
      id: 'colab_tasks',
      title: 'Gestión y Cambio de Tareas',
      question: '¿Cómo gestionar y cambiar mis tareas en curso?',
      description: 'Crea tareas extraordinarias, selecciónalas y actualiza su estado en el tablero.',
      role: 'colaborador',
      steps: [
        {
          target: '[data-tour="btn-new-task"]',
          title: 'Nueva Tarea Extraordinaria',
          text: 'Pulsa aquí para registrar actividades imprevistas o extraordinarias sin cliente asignado.',
          navHint: 'Pestaña Mis Tareas Asignadas',
        },
        {
          target: '[data-tour="task-selector"]',
          title: 'Filtro de Empresas Asignadas',
          text: 'Filtra tus tareas por empresa asignada o visualiza todas tus actividades pendientes.',
          navHint: 'Pestaña Mis Tareas Asignadas',
        },
        {
          target: '[data-tour="board-column-progress"]',
          title: 'Columna En Proceso',
          text: 'Las tareas que inicies o pauses se agruparán aquí reflejando tu trabajo activo ante tu supervisor.',
          navHint: 'Pestaña Mis Tareas Asignadas',
        },
      ],
    },
    {
      id: 'colab_attendance_history',
      title: 'Consulta de Asistencia Personal',
      question: '¿Cómo consultar mi historial de asistencia y checadas?',
      description: 'Revisa tus registros pasados, retardos, horas acumuladas y constancia del mes.',
      role: 'colaborador',
      steps: [
        {
          target: '[data-tour="attendance-history-card"]',
          title: 'Historial y Calendario de Asistencia',
          text: 'Consulta tus checadas diarias, puntualidad, estatus y validaciones biométricas de la quincena.',
          navHint: 'Pestaña Asistencia Global (parte inferior)',
        },
      ],
    },
  ],

  supervisor: [
    {
      id: 'sup_supervise_projects',
      title: 'Supervisión de Proyectos y Presupuestos',
      question: '¿Cómo supervisar proyectos, avance y horas presupuestadas?',
      description: 'Monitorea el progreso, horas consumidas y margen de presupuesto de cada proyecto.',
      role: 'supervisor',
      steps: [
        {
          target: '[data-tour="nav-projects-tab"]',
          title: 'Pestaña Proyectos y Tiempos',
          text: 'Accede a la matriz de control de proyectos asignados a tu supervisión.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="project-card-metrics"]',
          title: 'Consumo y Presupuesto',
          text: 'Monitorea el total de horas consumidas respecto al presupuesto pactado y detecta sobregiros.',
          navHint: 'Tabla de proyectos',
        },
        {
          target: '[data-tour="btn-new-project"]',
          title: 'Creación de Proyecto',
          text: 'Da de alta nuevos proyectos vinculados a clientes autorizados para tu área.',
          navHint: 'Barra superior de proyectos',
        },
      ],
    },
    {
      id: 'sup_team_timesheet',
      title: 'Revisión y Ajuste de Tiempos del Equipo',
      question: '¿Cómo auditar las horas y estado de los colaboradores de mi equipo?',
      description: 'Supervisa en vivo quién se encuentra en turno y valida sus tiempos acumulados.',
      role: 'supervisor',
      steps: [
        {
          target: '[data-tour="nav-team-tab"]',
          title: 'Pestaña Asistencia y Equipos',
          text: 'Dirígete a la sección de control del personal asignado a tu liderazgo.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="team-timesheet-table"]',
          title: 'Tabla de Tiempos del Equipo',
          text: 'Audita las horas acumuladas en el turno por cada colaborador y sus tareas asignadas.',
          navHint: 'Pestaña Asistencia y Equipos',
        },
        {
          target: '[data-tour="team-member-status"]',
          title: 'Estatus del Colaborador',
          text: 'Identifica si el colaborador está trabajando en vivo o fuera de turno.',
          navHint: 'Fila de colaborador en la tabla',
        },
      ],
    },
    {
      id: 'sup_personal_checkin',
      title: 'Check-in Personal de Supervisor',
      question: '¿Cómo registrar mi propia asistencia diaria?',
      description: 'Realiza tu check-in diario con validación de jornada.',
      role: 'supervisor',
      steps: [
        {
          target: '[data-tour="checkin-biometric-btn"]',
          title: 'Registro de Asistencia',
          text: 'Pulsa aquí para iniciar tu propio turno diario como líder de equipo.',
          navHint: 'Pestaña Mi Asistencia o Mi Check-in Facial',
        },
      ],
    },
    {
      id: 'sup_attendance_history',
      title: 'Consulta de Asistencia Personal',
      question: '¿Cómo revisar mi calendario de asistencia personal?',
      description: 'Visualiza tus asistencias y constancia laboral quincenal.',
      role: 'supervisor',
      steps: [
        {
          target: '[data-tour="attendance-history-card"]',
          title: 'Calendario de Asistencia',
          text: 'Revisa tus entradas, salidas y puntualidad en el calendario mensual.',
          navHint: 'Pestaña Mi Asistencia',
        },
      ],
    },
  ],

  gerente: [
    {
      id: 'ger_clients_projects',
      title: 'Alta de Clientes y Creación de Proyectos',
      question: '¿Cómo dar de alta proyectos y fijar presupuestos?',
      description: 'Administra la cartera de clientes, crea proyectos y asigna techos de horas.',
      role: 'gerente',
      steps: [
        {
          target: '[data-tour="nav-projects-tab"]',
          title: 'Gestión de Proyectos',
          text: 'Accede al módulo de supervisión general de proyectos.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="btn-new-project"]',
          title: 'Nuevo Proyecto',
          text: 'Inicia el formulario para crear un proyecto con su cliente y fecha de entrega.',
          navHint: 'Barra superior de proyectos',
        },
        {
          target: '[data-tour="project-card-metrics"]',
          title: 'Control de Presupuesto',
          text: 'Supervisa el porcentaje consumido frente al techo de horas contratado.',
          navHint: 'Tabla de proyectos',
        },
      ],
    },
    {
      id: 'ger_assign_personnel',
      title: 'Asignación y Revocación de Personal',
      question: '¿Cómo vincular colaboradores a los proyectos del área?',
      description: 'Asigna o retira integrantes del equipo en cada proyecto activo.',
      role: 'gerente',
      steps: [
        {
          target: '[data-tour="nav-projects-tab"]',
          title: 'Proyectos y Tiempos',
          text: 'Localiza el proyecto en el que deseas modificar la plantilla.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="project-actions-team"]',
          title: 'Gestionar Personal',
          text: 'Abre el panel de asignación para vincular o retirar colaboradores del proyecto con un clic.',
          navHint: 'Columna Equipo Asignado',
        },
      ],
    },
    {
      id: 'ger_send_invites',
      title: 'Emisión de Invitaciones',
      question: '¿Cómo invitar a nuevos colaboradores y supervisores?',
      description: 'Genera tokens y envía invitaciones oficiales por correo vía webhook de n8n.',
      role: 'gerente',
      steps: [
        {
          target: '[data-tour="nav-invitations-tab"]',
          title: 'Pestaña Invitaciones',
          text: 'Accede al módulo de control de accesos y lista blanca.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="invite-form-email"]',
          title: 'Correo Institucional',
          text: 'Ingresa la dirección de correo corporativa del destinatario.',
          navHint: 'Formulario de invitación',
        },
        {
          target: '[data-tour="invite-form-submit"]',
          title: 'Emitir Invitación',
          text: 'Envía el correo de activación con token criptográfico seguro a través de n8n.',
          navHint: 'Botón de envío',
        },
      ],
    },
    {
      id: 'ger_reports',
      title: 'Descarga de Informes Ejecutivos',
      question: '¿Cómo exportar reportes de horas y rentabilidad a Excel / PDF?',
      description: 'Genera resúmenes ejecutivos consolidados para análisis de costos y horas.',
      role: 'gerente',
      steps: [
        {
          target: '[data-tour="nav-reports-tab"]',
          title: 'Pestaña Informes',
          text: 'Accede a la sección de reportes ejecutivos.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="reports-export-excel"]',
          title: 'Exportar a Excel / PDF',
          text: 'Descarga el informe completo con desglose de tareas, horas reales y costos.',
          navHint: 'Barra superior de informes',
        },
      ],
    },
  ],

  socio: [
    {
      id: 'socio_clients_projects',
      title: 'Alta de Clientes y Creación de Proyectos',
      question: '¿Cómo dar de alta proyectos y presupuestos de práctica?',
      description: 'Control integral de cartera de proyectos, asignación de horas y márgenes.',
      role: 'socio',
      steps: [
        {
          target: '[data-tour="nav-projects-tab"]',
          title: 'Proyectos y Tiempos',
          text: 'Accede a la cartera ejecutiva de proyectos de la firma.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="btn-new-project"]',
          title: 'Creación de Proyecto',
          text: 'Da de alta nuevos proyectos y asigna el líder responsable.',
          navHint: 'Barra superior de proyectos',
        },
        {
          target: '[data-tour="project-card-metrics"]',
          title: 'Métricas de Margen y Horas',
          text: 'Evalúa la rentabilidad y avance contra el presupuesto.',
          navHint: 'Tabla de proyectos',
        },
      ],
    },
    {
      id: 'socio_audit_logs',
      title: 'Bitácora de Auditoría y Movimientos',
      question: '¿Cómo auditar la bitácora inmutable de movimientos de la firma?',
      description: 'Rastrea descargas de informes, cambios de presupuestos y accesos.',
      role: 'socio',
      steps: [
        {
          target: '[data-tour="nav-audit-logs"]',
          title: 'Pestaña Bitácora de Movimientos',
          text: 'Ingresa a la trazabilidad completa de actividades de la firma.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="audit-log-table"]',
          title: 'Registro Inmutable de Movimientos',
          text: 'Examina quién realizó cada cambio, fecha, hora, recurso afectado y valores previos.',
          navHint: 'Tabla de auditoría',
        },
      ],
    },
    {
      id: 'socio_invites',
      title: 'Emisión de Invitaciones de Nivel Ejecutivo',
      question: '¿Cómo invitar a supervisores, gerentes o socios?',
      description: 'Emite invitaciones autorizadas con asignación de equipo.',
      role: 'socio',
      steps: [
        {
          target: '[data-tour="nav-invitations-tab"]',
          title: 'Pestaña Invitaciones',
          text: 'Accede a la emisión de invitaciones corporativas.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="invite-form-email"]',
          title: 'Correo del Invitado',
          text: 'Escribe el correo del nuevo integrante para emitir su token vía n8n.',
          navHint: 'Formulario de invitación',
        },
        {
          target: '[data-tour="invite-form-submit"]',
          title: 'Emisión',
          text: 'Dispara el envío de la invitación con token criptográfico.',
          navHint: 'Botón de envío',
        },
      ],
    },
    {
      id: 'socio_reports',
      title: 'Descarga de Informes Ejecutivos',
      question: '¿Cómo generar reportes ejecutivos consolidados?',
      description: 'Descarga informes en Excel o PDF de horas, tareas y costos.',
      role: 'socio',
      steps: [
        {
          target: '[data-tour="nav-reports-tab"]',
          title: 'Pestaña Informes',
          text: 'Dirígete a la sección de reportes ejecutivos.',
          navHint: 'Menú superior del panel',
        },
        {
          target: '[data-tour="reports-export-excel"]',
          title: 'Exportación Directa',
          text: 'Genera el archivo en Excel o PDF para juntas de consejo o auditoría fiscal.',
          navHint: 'Barra superior de informes',
        },
      ],
    },
  ],

  rh: [
    {
      id: 'rh_payroll_sheet',
      title: 'Sábana Quincenal y Prenómina',
      question: '¿Cómo auditar la sábana quincenal y exportar a prenómina?',
      description: 'Revisa horas ordinarias, retardos, faltas y descarga el reporte para nómina.',
      role: 'rh',
      steps: [
        {
          target: '[data-tour="rh-period-select"]',
          title: 'Filtro de Período y Quincena',
          text: 'Selecciona la 1ª o 2ª quincena, mes y equipo que deseas liquidar.',
          navHint: 'Barra superior de Recursos Humanos',
        },
        {
          target: '[data-tour="rh-timesheet-grid"]',
          title: 'Cuadrícula de Asistencias',
          text: 'Audita los días trabajados, retardos en minutos y justificaciones por empleado.',
          navHint: 'Tabla central de sábana quincenal',
        },
        {
          target: '[data-tour="rh-export-excel"]',
          title: 'Exportación a Excel de Nómina',
          text: 'Descarga la prenómina consolidada lista para procesar en el software contable.',
          navHint: 'Botón verde de exportación',
        },
      ],
    },
    {
      id: 'rh_kardex_individual',
      title: 'Kardex Individual y Constancias Laborales',
      question: '¿Cómo consultar el expediente de asistencia de un colaborador?',
      description: 'Genera constancias de trabajo y el Kardex individual detallado con geolocalización.',
      role: 'rh',
      steps: [
        {
          target: '[data-tour="rh-kardex-tab"]',
          title: 'Pestaña Historial y Auditoría',
          text: 'Ingresa al visor de auditoría individual por colaborador.',
          navHint: 'Menú superior de RH',
        },
        {
          target: '[data-tour="rh-user-search"]',
          title: 'Selector de Colaborador',
          text: 'Selecciona al empleado para auditar sus registros biométricos y puntualidad.',
          navHint: 'Filtros de búsqueda',
        },
        {
          target: '[data-tour="rh-btn-export-kardex"]',
          title: 'Descarga de Kardex / Constancia',
          text: 'Genera el archivo Excel de auditoría o imprime la constancia laboral formal.',
          navHint: 'Botones de acción superior derecha',
        },
      ],
    },
  ],

  ti: [
    {
      id: 'ti_users_rbac',
      title: 'Consola Central y Directorio RBAC',
      question: '¿Cómo administrar usuarios, permisos granulares y suspender cuentas?',
      description: 'Gestiona la matriz de roles, equipos y switches individuales de acceso.',
      role: 'ti',
      steps: [
        {
          target: '[data-tour="nav-users-tab"]',
          title: 'Directorio de Permisos',
          text: 'Accede al censo central de cuentas corporativas.',
          navHint: 'Pestaña Permisos y Equipos',
        },
        {
          target: '[data-tour="ti-users-table"]',
          title: 'Tabla Maestra de Cuentas',
          text: 'Supervisa los roles, equipos asignados, módulos activos y estado de cada usuario.',
          navHint: 'Tabla de usuarios',
        },
        {
          target: '[data-tour="ti-btn-edit-user"]',
          title: 'Permisos RBAC Individuales',
          text: 'Modifica de forma granular los permisos del colaborador o suspende su acceso.',
          navHint: 'Botón en fila de usuario',
        },
      ],
    },
    {
      id: 'ti_rbac_matrix',
      title: 'Políticas Maestras (Matriz RBAC)',
      question: '¿Cómo auditar la política de control de acceso por rol?',
      description: 'Consulta los permisos por defecto asignados a cada nivel jerárquico.',
      role: 'ti',
      steps: [
        {
          target: '[data-tour="nav-rbac-matrix"]',
          title: 'Pestaña Matriz RBAC',
          text: 'Ingresa a la visualización de la política institucional de roles.',
          navHint: 'Menú de pestañas superior',
        },
        {
          target: '[data-tour="rbac-save-btn"]',
          title: 'Matriz de Políticas Institucionales',
          text: 'Verifica los privilegios de cada rol sobre proyectos, auditorías y módulos.',
          navHint: 'Tabla de Matriz RBAC',
        },
      ],
    },
    {
      id: 'ti_hierarchy_teams',
      title: 'Estructura Organizacional y Árbol de Equipos',
      question: '¿Cómo crear y auditar equipos y departamentos en el organigrama?',
      description: 'Crea nuevos equipos en Firestore y organiza la jerarquía de líderes.',
      role: 'ti',
      steps: [
        {
          target: '[data-tour="nav-audit-hierarchy"]',
          title: 'Pestaña Auditar Jerarquía',
          text: 'Accede al organigrama interactivo de la firma.',
          navHint: 'Menú de pestañas superior',
        },
        {
          target: '[data-tour="btn-new-team"]',
          title: 'Alta de Nuevo Equipo',
          text: 'Crea un nuevo equipo o departamento con su líder y código institucional.',
          navHint: 'Barra superior de jerarquía',
        },
        {
          target: '[data-tour="hierarchy-tree-view"]',
          title: 'Árbol Jerárquico Operativo',
          text: 'Explora la cadena de mando desde Socios y Gerentes hasta Supervisores y miembros.',
          navHint: 'Árbol organizacional',
        },
      ],
    },
    {
      id: 'ti_high_level_invites',
      title: 'Invitaciones de Alto Nivel',
      question: '¿Cómo invitar a supervisores, gerentes y socios desde TI?',
      description: 'Emite tokens seguros de lista blanca con rol institucional y equipo vinculado.',
      role: 'ti',
      steps: [
        {
          target: '[data-tour="ti-invite-tab"]',
          title: 'Pestaña Invitar Supervisores',
          text: 'Accede al formulario de emisión de invitaciones de TI.',
          navHint: 'Menú de pestañas superior',
        },
        {
          target: '[data-tour="ti-invite-form"]',
          title: 'Formulario de Alta',
          text: 'Configura las cuentas de correo electrónico a invitar.',
          navHint: 'Panel de invitación',
        },
        {
          target: '[data-tour="ti-invite-role-select"]',
          title: 'Perfil / Rol Institucional',
          text: 'Asigna el perfil exacto (Colaborador, Supervisor, Gerente o Socio) y el equipo receptor.',
          navHint: 'Selector de rol en formulario',
        },
      ],
    },
  ],
};

/**
 * Obtiene las guías interactivas correspondientes a un rol canónico o normalizado.
 */
export function getInteractiveGuidesForRole(rawRole?: string): InteractiveGuide[] {
  if (!rawRole) return INTERACTIVE_GUIDES.colaborador;
  const normalized = rawRole.toLowerCase().trim();

  if (normalized.includes('ti') || normalized.includes('root') || normalized.includes('admin')) {
    return INTERACTIVE_GUIDES.ti;
  }
  if (normalized.includes('rh') || normalized.includes('recursos')) {
    return INTERACTIVE_GUIDES.rh;
  }
  if (normalized.includes('socio') || normalized.includes('director')) {
    return INTERACTIVE_GUIDES.socio;
  }
  if (normalized.includes('gerente')) {
    return INTERACTIVE_GUIDES.gerente;
  }
  if (normalized.includes('supervisor') || normalized.includes('lider')) {
    return INTERACTIVE_GUIDES.supervisor;
  }
  return INTERACTIVE_GUIDES.colaborador;
}

