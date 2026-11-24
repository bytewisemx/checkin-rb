import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { trackFirestoreRead, trackFirestoreWrite } from './firestoreTelemetry';
import type {
  ServiceTemplate,
  ServiceTemplateRubro,
} from '../types/serviceTemplate';

export const AUDIT_MASTER_TEMPLATE_ID = 'template_auditoria_estados_financieros';

/**
 * Plantilla oficial completa: "Auditoría de Estados Financieros"
 * 19 Bloques / Rubros con 156 procedimientos y exactamente 226.2 horas base.
 */
export const DEFAULT_AUDIT_RUBROS: ServiceTemplateRubro[] = [
  // Bloque 0 — Planeación General y Cierre (14 actividades de Resumen& General)
  {
    number: 0,
    name: 'Bloque 0 — Planeación General y Cierre',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 1,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-01',
        procedimiento: 'Visita de planeación',
        papelTrabajo: 'Memorándum de planeación general',
        fase: 'Previa',
        perfilSugerido: 'Gerente',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 2,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-02',
        procedimiento: 'Programas de auditoría',
        papelTrabajo: 'Programas de trabajo adaptados al cliente',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 3,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-03',
        procedimiento: 'Actualización de archivo permanente',
        papelTrabajo: 'Expediente legal, actas y contratos vigentes',
        fase: 'Previa',
        perfilSugerido: 'Staff',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 4,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-04',
        procedimiento: 'Control interno',
        papelTrabajo: 'Cuestionarios y evaluación del control interno',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 5,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-05',
        procedimiento: 'FOCOCA',
        papelTrabajo: 'Matriz FOCOCA de riesgos y controles clave',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 6,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-06',
        procedimiento: 'Fraude',
        papelTrabajo: 'Evaluación de riesgos de incorrección por fraude (NIA 240)',
        fase: 'Previa',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 7,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-07',
        procedimiento: 'HEVACC',
        papelTrabajo: 'Cédula HEVACC de controles a nivel entidad',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 8,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-08',
        procedimiento: 'Evaluaciones de personal',
        papelTrabajo: 'Evaluación técnica del personal del cliente',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 9,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-09',
        procedimiento: 'Relación de información',
        papelTrabajo: 'Checklist de requerimientos entregados al cliente',
        fase: 'Previa',
        perfilSugerido: 'Staff',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 10,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-10',
        procedimiento: 'Apartado General',
        papelTrabajo: 'Cédula de supervisión y control del encargo',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 11,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-11',
        procedimiento: 'Carta de recomendaciones',
        papelTrabajo: 'Carta a la administración con hallazgos de control',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 12,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-12',
        procedimiento: 'Carta confirmatoria',
        papelTrabajo: 'Carta de manifestaciones escritas de la administración',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 13,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-13',
        procedimiento: 'Elaboración de estados financieros',
        papelTrabajo: 'Borrador de estados financieros auditados y notas explicativas',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 5.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 14,
        rubro: 'Bloque 0 — Planeación General y Cierre',
        rubroNumber: 0,
        cuentaContable: 'GEN-14',
        procedimiento: 'Anexos fiscales',
        papelTrabajo: 'Cédulas de cruce y revisión para anexos SIPRED / DISIF',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },

  // Rubro 1 — Actividades Preliminares (8 actividades)
  {
    number: 1,
    name: '1. Actividades Preliminares',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 15, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.00 Política de encargo de auditoría', papelTrabajo: 'PT diseñado por auditor', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 16, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.01 Aceptación y continuidad de clientes', papelTrabajo: 'Cuestionario de aceptación', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 17, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.02 Carta compromiso de auditoría', papelTrabajo: 'Carta compromiso firmada', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 18, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.03 Independencia del equipo de trabajo', papelTrabajo: 'Declaración anual de independencia', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 19, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.04 Confirmación con auditor predecesor', papelTrabajo: 'Comunicación con auditor anterior', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 20, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.05 Conocimiento preliminar de la entidad', papelTrabajo: 'Perfil inicial de la empresa', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 21, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.06 Asignación del equipo y presupuesto', papelTrabajo: 'Cronograma de recursos operativos', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 22, rubro: '1. Actividades Preliminares', rubroNumber: 1, procedimiento: 'RB-A-02.07 Entendimiento de términos de encargo', papelTrabajo: 'Confirmación de alcances de auditoría', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 2 — Evaluación de Riesgo y Planeación (22 actividades)
  {
    number: 2,
    name: '2. Evaluación de Riesgo y Planeación',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Bajo' },
    activities: [
      { activityNumber: 23, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.01 Entendimiento de la entidad y su entorno', papelTrabajo: 'Cédula de análisis del entorno', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 24, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.02 Identificación de partes relacionadas', papelTrabajo: 'Mapeo de entidades vinculadas', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 25, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.03 Estimación de materialidad preliminar', papelTrabajo: 'Cálculo de materialidad global', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 26, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.04 Determinación de materialidad de ejecución', papelTrabajo: 'Materialidad por componentes', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 27, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.05 Discusión del equipo sobre riesgos', papelTrabajo: 'Minuta de junta de planeación', fase: 'Previa', perfilSugerido: 'Equipo', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 28, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.06 Evaluación de diseño de controles', papelTrabajo: 'Recorridos de procesos (walkthroughs)', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 29, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.07 Evaluación de implementación de controles', papelTrabajo: 'Pruebas de recorrido operativas', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 30, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.08 Procedimientos analíticos preliminares', papelTrabajo: 'Análisis de tendencias y variaciones', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 31, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.09 Indagaciones con la dirección', papelTrabajo: 'Entrevistas con gobierno corporativo', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 32, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.10 Indagaciones con auditoría interna', papelTrabajo: 'Revisión de informes internos', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 33, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.11 Identificación de leyes y regulaciones aplicables', papelTrabajo: 'Matriz de cumplimiento legal y fiscal', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 34, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.12 Evaluación del negocio en marcha preliminar', papelTrabajo: 'Evaluación de continuidad operativa', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 35, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.13 Estrategia general de auditoría', papelTrabajo: 'Documento rector de estrategia', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 36, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.14 Plan detallado de auditoría', papelTrabajo: 'Desglose por rubros contables', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 37, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.15 Identificación de cuentas significativas', papelTrabajo: 'Cédula de cuentas materiales', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 38, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.16 Aseveraciones relevantes por componente', papelTrabajo: 'Matriz aseveraciones vs riesgos', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 39, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.17 Muestreo de auditoría y alcance', papelTrabajo: 'Determinación de tamaño de muestras', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 40, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.18 Plan de pruebas a controles clave', papelTrabajo: 'Cédulas de pruebas de controles', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 41, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.19 Revisión del sistema contable', papelTrabajo: 'Catálogo de cuentas y flujos ERP', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 42, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.20 Matriz de riesgos y respuestas de auditoría', papelTrabajo: 'Matriz integral de auditoría', fase: 'Previa', perfilSugerido: 'Gerente', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 43, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.21 Cronograma de visitas de auditoría', papelTrabajo: 'Calendario de entregas y visitas', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 44, rubro: '2. Evaluación de Riesgo y Planeación', rubroNumber: 2, procedimiento: 'RB-A-03.22 Acta de junta inicial con el cliente', papelTrabajo: 'Minuta de arranque oficial', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 3 — Audit Brain (5 actividades)
  {
    number: 3,
    name: '3. Audit Brain',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 45, rubro: '3. Audit Brain', rubroNumber: 3, procedimiento: 'Parametrización y carga de balanzas en Audit Brain', papelTrabajo: 'Validación de carga en plataforma', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 46, rubro: '3. Audit Brain', rubroNumber: 3, procedimiento: 'Mapeo de cuentas a taxonomía RB', papelTrabajo: 'Cédula de homologación contable', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 47, rubro: '3. Audit Brain', rubroNumber: 3, procedimiento: 'Verificación de sumas y cuadre contable', papelTrabajo: 'Cruce de balanza de comprobación', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 48, rubro: '3. Audit Brain', rubroNumber: 3, procedimiento: 'Análisis de variaciones automatizado en Audit Brain', papelTrabajo: 'Reporte analítico de variaciones', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 49, rubro: '3. Audit Brain', rubroNumber: 3, procedimiento: 'Generación de cédulas sumarias iniciales', papelTrabajo: 'Cédulas analíticas prellenadas', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
    ],
  },

  // Rubro 4 — Pólizas de Diario (4 actividades)
  {
    number: 4,
    name: '4. Pólizas de Diario',
    riskLevel: { inherent: 'Medio', control: 'Medio', audit: 'Bajo' },
    activities: [
      { activityNumber: 50, rubro: '4. Pólizas de Diario', rubroNumber: 4, procedimiento: 'Selección de muestra de pólizas no estándar de fin de ejercicio', papelTrabajo: 'Cédula de muestreo de diario', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 51, rubro: '4. Pólizas de Diario', rubroNumber: 4, procedimiento: 'Revisión de autorizaciones y soportes de pólizas de diario', papelTrabajo: 'Inspección de firmas y evidencias', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 52, rubro: '4. Pólizas de Diario', rubroNumber: 4, procedimiento: 'Comprobación de reclasificaciones contables', papelTrabajo: 'Revisión de reclasificaciones', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 53, rubro: '4. Pólizas de Diario', rubroNumber: 4, procedimiento: 'Detección de ajustes inusuales o fuera de horario', papelTrabajo: 'Análisis de logs y fechas de captura', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
    ],
  },

  // Rubro 5 — Efectivo y Equivalentes (8 actividades — Bancos y Caja)
  {
    number: 5,
    name: '5. Efectivo y Equivalentes',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 54, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Arqueos sorpresivos de caja chica y fondos fijos', papelTrabajo: 'Acta de arqueo físico firmada', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 55, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Solicitud y control de confirmaciones bancarias externas', papelTrabajo: 'Cédula de control de circularizaciones', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 56, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Conciliación y cruce de confirmaciones bancarias', papelTrabajo: 'Cruce de respuestas vs saldos contables', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 57, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Revisión de conciliaciones bancarias al cierre', papelTrabajo: 'Auditoría de conciliaciones y cheques en tránsito', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 58, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Pruebas de corte de transferencias bancarias entre cuentas', papelTrabajo: 'Prueba de corte entre cuentas propias', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 59, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Verificación de inversiones temporales y valuación razonable', papelTrabajo: 'Cálculo de intereses y valuación NIF C-2', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 60, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Revisión de partidas en tránsito de más de 30 días', papelTrabajo: 'Aclaración de partidas antiguas', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 61, rubro: '5. Efectivo y Equivalentes', rubroNumber: 5, cuentaContable: '101-000-000-000 BANCOS', procedimiento: 'Cédula sumaria y de detalle de efectivo y equivalentes', papelTrabajo: 'Cédula sumaria del rubro A', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 6 — Cuentas por Cobrar (9 actividades — Clientes, Deudores, Impuestos a favor)
  {
    number: 6,
    name: '6. Cuentas por Cobrar',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Medio' },
    activities: [
      { activityNumber: 62, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Circularización y confirmación de saldos de clientes', papelTrabajo: 'Cédula de circularización de cartera', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 63, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Conciliación de respuestas y aclaraciones de clientes', papelTrabajo: 'Conciliación de saldos confirmados', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 64, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Pruebas de cobros posteriores en estados de cuenta', papelTrabajo: 'Cédula de cobros subsecuentes', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 65, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Análisis de antigüedad de saldos de clientes', papelTrabajo: 'Revisión de cartera vencida', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 66, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Evaluación de la estimación de pérdidas crediticias esperadas', papelTrabajo: 'Cálculo de estimación NIF C-16', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 67, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '107-000-000-000 DEUDORES', procedimiento: 'Revisión de deudores diversos y funcionarios/empleados', papelTrabajo: 'Cédula de saldos de deudores', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 68, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '113-000-000-000 IMPUESTOS FAVOR', procedimiento: 'Verificación de impuestos a favor e IVA acreditable por recuperar', papelTrabajo: 'Cruce con declaraciones y SAT', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 69, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Prueba de corte de facturación y notas de crédito', papelTrabajo: 'Corte de ventas antes y después del cierre', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 70, rubro: '6. Cuentas por Cobrar', rubroNumber: 6, cuentaContable: '105-000-000-000 CLIENTES', procedimiento: 'Cédula sumaria de cuentas por cobrar', papelTrabajo: 'Cédula sumaria del rubro C', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 7 — Partes Relacionadas (3 actividades)
  {
    number: 7,
    name: '7. Partes Relacionadas',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Medio' },
    activities: [
      { activityNumber: 71, rubro: '7. Partes Relacionadas', rubroNumber: 7, procedimiento: 'Identificación y confirmación de saldos con partes relacionadas', papelTrabajo: 'Confirmación directa de partes vinculadas', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 72, rubro: '7. Partes Relacionadas', rubroNumber: 7, procedimiento: 'Revisión de contratos, términos comerciales y precios de transferencia', papelTrabajo: 'Cuestionario NIF C-13 y estudio fiscal', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 73, rubro: '7. Partes Relacionadas', rubroNumber: 7, procedimiento: 'Revelación adecuada en notas a los estados financieros', papelTrabajo: 'Notas de partes relacionadas en borrador', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
    ],
  },

  // Rubro 8 — Inventarios / Almacén (13 actividades)
  {
    number: 8,
    name: '8. Inventarios / Almacén',
    riskLevel: { inherent: 'Alto', control: 'Alto', audit: 'Medio' },
    activities: [
      { activityNumber: 74, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Planeación y coordinación de la toma física de inventarios', papelTrabajo: 'Instrucciones de conteo físico', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 75, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Presencia física y conteos selectivos de auditoría', papelTrabajo: 'Cédula de conteos físicos y marbetes', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 3.5, status: 'pending' },
      { activityNumber: 76, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Pruebas de corte de entradas y salidas de almacén', papelTrabajo: 'Cédula de corte de inventarios', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 77, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Revisión de inventarios en consignación y en poder de terceros', papelTrabajo: 'Confirmación externa de almacenes terceros', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 78, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Conciliación de conteos físicos vs registros contables y kardex', papelTrabajo: 'Cédula de diferencias de inventario', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 79, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Pruebas de valuación de inventarios (PEPS / Promedios)', papelTrabajo: 'Revisión de capas de costo', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 80, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Pruebas de costo o valor neto de realización (VNR)', papelTrabajo: 'Cálculo de prueba de VNR (NIF C-4)', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 81, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Evaluación de estimación por obsolescencia y lento movimiento', papelTrabajo: 'Cálculo de reserva de obsolescencia', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 82, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Revisión de compras y producción en proceso', papelTrabajo: 'Pruebas a órdenes de manufactura', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 83, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Verificación de mercancías en tránsito y recepciones posteriores', papelTrabajo: 'Cédula de compras en tránsito', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 84, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Cruce de inventarios con seguros vigentes', papelTrabajo: 'Cobertura de pólizas de seguro', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 85, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Ajustes de inventario detectados y autorizaciones', papelTrabajo: 'Cédula de asientos de ajuste de inventario', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 86, rubro: '8. Inventarios / Almacén', rubroNumber: 8, cuentaContable: '115-000-000-000 INVENTARIOS', procedimiento: 'Cédula sumaria de inventarios', papelTrabajo: 'Cédula sumaria del rubro D', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 9 — Activo Fijo (8 actividades)
  {
    number: 9,
    name: '9. Activo Fijo',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 87, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Inspección física selectiva de maquinaria, equipo y vehículos', papelTrabajo: 'Acta de inspección física', fase: 'Previa', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 88, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Pruebas sustantivas de altas y adiciones del ejercicio con factura', papelTrabajo: 'Revisión de facturas y contratos de compra', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 89, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Revisión de bajas, retiros y desincorporaciones de activos', papelTrabajo: 'Cálculo de ganancia/pérdida en venta de activo', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 90, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Recálculo global de la depreciación acumulada y del ejercicio', papelTrabajo: 'Prueba global de depreciación (NIF C-6)', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 91, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Revisión de tasas de depreciación conforme a vidas útiles', papelTrabajo: 'Evaluación técnica de vidas útiles', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 92, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Comprobación de títulos de propiedad de inmuebles y vehículos', papelTrabajo: 'Escrituras y facturas originales', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 93, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Evaluación de indicios de deterioro en activos de larga duración', papelTrabajo: 'Cuestionario NIF C-15', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 94, rubro: '9. Activo Fijo', rubroNumber: 9, cuentaContable: '150-000-000-000 ACTIVO FIJO', procedimiento: 'Cédula sumaria de propiedades, planta y equipo', papelTrabajo: 'Cédula sumaria del rubro E', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 10 — Gastos Pagados por Anticipado (3 actividades)
  {
    number: 10,
    name: '10. Gastos Pagados por Anticipado',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 95, rubro: '10. Gastos Pagados por Anticipado', rubroNumber: 10, cuentaContable: '170-000-000-000 PAGOS ANTICIPADOS', procedimiento: 'Revisión de pólizas de seguros y fianzas pagadas por anticipado', papelTrabajo: 'Cédula analítica de seguros vigentes', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 96, rubro: '10. Gastos Pagados por Anticipado', rubroNumber: 10, cuentaContable: '170-000-000-000 PAGOS ANTICIPADOS', procedimiento: 'Recálculo de la amortización devengada en el periodo', papelTrabajo: 'Recálculo mensual de devengación NIF C-5', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 97, rubro: '10. Gastos Pagados por Anticipado', rubroNumber: 10, cuentaContable: '170-000-000-000 PAGOS ANTICIPADOS', procedimiento: 'Cédula analítica y sumaria de pagos anticipados', papelTrabajo: 'Cédula sumaria del rubro F', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 11 — Cuentas por Pagar (7 actividades)
  {
    number: 11,
    name: '11. Cuentas por Pagar',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 98, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Circularización y confirmación de saldos con proveedores clave', papelTrabajo: 'Circularización externa de proveedores', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 99, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Conciliación de estados de cuenta de proveedores', papelTrabajo: 'Cruce de respuestas vs saldos contables', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 100, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Búsqueda de pasivos no registrados (pagos posteriores al cierre)', papelTrabajo: 'Búsqueda de pasivos omitidos', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 101, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Pruebas de corte de recepciones y compras al cierre', papelTrabajo: 'Corte de compras días previos y posteriores', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 102, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '205-000-000-000 ACREEDORES', procedimiento: 'Revisión de acreedores diversos y retenciones', papelTrabajo: 'Cédula de acreedores varios', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 103, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Análisis de saldos con antigüedad mayor a 90 días', papelTrabajo: 'Revisión de saldos estancados', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 104, rubro: '11. Cuentas por Pagar', rubroNumber: 11, cuentaContable: '201-000-000-000 PROVEEDORES', procedimiento: 'Cédula sumaria de cuentas por pagar a corto plazo', papelTrabajo: 'Cédula sumaria del rubro G', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 12 — Impuestos (10 actividades)
  {
    number: 12,
    name: '12. Impuestos',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Medio' },
    activities: [
      { activityNumber: 105, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Conciliación de ingresos contables vs fiscales (ISR)', papelTrabajo: 'Cédula de conciliación contable fiscal', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 106, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Revisión de pagos provisionales de ISR y retenciones', papelTrabajo: 'Cruce de acuses SAT vs contabilidad', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 107, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Conciliación de IVA causado y acreditable mensual vs DIOT', papelTrabajo: 'Papel de trabajo mensual de IVA', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 108, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Verificación de retenciones de ISR e IVA enteradas al SAT', papelTrabajo: 'Cédula de retenciones por enterar', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 109, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Recálculo del impuesto sobre nóminas (ISN) estatal', papelTrabajo: 'Cálculo de base gravable de ISN', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 110, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Recálculo del impuesto sobre la renta del ejercicio (ISR anual)', papelTrabajo: 'Cálculo del ISR causado anual', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 111, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Revisión del cálculo de impuesto diferido (NIF D-4)', papelTrabajo: 'Cédula de diferencias temporales e ISR diferido', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 112, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Comprobación de saldos en buzón tributario y cumplimiento 32-D', papelTrabajo: 'Opinión de cumplimiento positiva 32-D', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 113, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Verificación de CFDI cancelados y nómina timbrada', papelTrabajo: 'Conciliación con visores del SAT', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 114, rubro: '12. Impuestos', rubroNumber: 12, cuentaContable: '210-000-000-000 IMPUESTOS POR PAGAR', procedimiento: 'Cédula sumaria de pasivos por impuestos acumulados', papelTrabajo: 'Cédula sumaria del rubro H', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 13 — Obligaciones Laborales (4 actividades)
  {
    number: 13,
    name: '13. Obligaciones Laborales',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 115, rubro: '13. Obligaciones Laborales', rubroNumber: 13, cuentaContable: '215-000-000-000 PROVISIONES LABORALES', procedimiento: 'Pruebas a la provisión de aguinaldo, prima vacacional y vacaciones', papelTrabajo: 'Recálculo de pasivos laborales a corto plazo', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 116, rubro: '13. Obligaciones Laborales', rubroNumber: 13, cuentaContable: '215-000-000-000 PROVISIONES LABORALES', procedimiento: 'Verificación del cálculo de la PTU del ejercicio y no reclamada', papelTrabajo: 'Cédula de determinación de base PTU', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 117, rubro: '13. Obligaciones Laborales', rubroNumber: 13, cuentaContable: '215-000-000-000 PROVISIONES LABORALES', procedimiento: 'Revisión del estudio actuarial de prima de antigüedad y pensiones', papelTrabajo: 'Revisión NIF D-3 de beneficios por retiro', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 118, rubro: '13. Obligaciones Laborales', rubroNumber: 13, cuentaContable: '215-000-000-000 PROVISIONES LABORALES', procedimiento: 'Cédula sumaria de beneficios a empleados', papelTrabajo: 'Cédula sumaria del rubro I', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 14 — Capital (4 actividades)
  {
    number: 14,
    name: '14. Capital',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 119, rubro: '14. Capital', rubroNumber: 14, cuentaContable: '301-000-000-000 CAPITAL SOCIAL', procedimiento: 'Lectura de actas de asamblea de accionistas del ejercicio', papelTrabajo: 'Extracto de acuerdos de asambleas', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 120, rubro: '14. Capital', rubroNumber: 14, cuentaContable: '301-000-000-000 CAPITAL SOCIAL', procedimiento: 'Verificación de aumentos/disminuciones de capital social con escrituras', papelTrabajo: 'Protocolizaciones y movimientos de capital', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 121, rubro: '14. Capital', rubroNumber: 14, cuentaContable: '301-000-000-000 CAPITAL SOCIAL', procedimiento: 'Revisión de dividendos decretados y pago de retenciones aplicables', papelTrabajo: 'Cálculo de CUFIN y retención de dividendos', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 122, rubro: '14. Capital', rubroNumber: 14, cuentaContable: '301-000-000-000 CAPITAL SOCIAL', procedimiento: 'Cédula sumaria de capital contable y conciliación de movimientos', papelTrabajo: 'Cédula sumaria del rubro J', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 15 — Ingresos (10 actividades)
  {
    number: 15,
    name: '15. Ingresos',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Medio' },
    activities: [
      { activityNumber: 123, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Entendimiento del flujo operativo de ventas y facturación', papelTrabajo: 'Narrativa y diagrama del ciclo de ingresos', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 124, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Conciliación de facturación electrónica emitida (CFDI) vs ingresos contables', papelTrabajo: 'Cruce CFDI del portal SAT vs Balanza', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 125, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Prueba sustantiva de ingresos por muestreo contra contratos y entregas', papelTrabajo: 'Revisión de muestra sustantiva NIF D-1', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 3.0, status: 'pending' },
      { activityNumber: 126, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Pruebas de corte de ventas días antes y después del cierre anual', papelTrabajo: 'Cédula de corte de facturación anual', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 127, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Revisión de notas de crédito, descuentos y devoluciones sobre ventas', papelTrabajo: 'Prueba a bonificaciones y cancelaciones', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 128, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Procedimiento analítico sustantivo de ventas mensuales vs año anterior', papelTrabajo: 'Análisis estacional y precios promedio', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 129, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Revisión de anticipos de clientes y su correcta aplicación', papelTrabajo: 'Amortización de anticipos devengados', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 130, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '405-000-000-000 PRODUCTOS FINANCIEROS', procedimiento: 'Verificación de ingresos financieros y fluctuación cambiaria', papelTrabajo: 'Cálculo de intereses ganados y tipo de cambio', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 131, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '408-000-000-000 OTROS INGRESOS', procedimiento: 'Comprobación de otros ingresos y partidas extraordinarias', papelTrabajo: 'Análisis de partidas no recurrentes', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 132, rubro: '15. Ingresos', rubroNumber: 15, cuentaContable: '401-000-000-000 VENTAS', procedimiento: 'Cédula sumaria de ingresos', papelTrabajo: 'Cédula sumaria del rubro K', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 16 — Costo y Gastos (15 actividades)
  {
    number: 16,
    name: '16. Costo y Gastos',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Medio' },
    activities: [
      { activityNumber: 133, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '501-000-000-000 COSTO VENTAS', procedimiento: 'Entendimiento y prueba de controles en el ciclo de compras y gastos', papelTrabajo: 'Narrativa del ciclo de egresos', fase: 'Previa', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 134, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '501-000-000-000 COSTO VENTAS', procedimiento: 'Conciliación de costos de ventas contra inventarios y compras', papelTrabajo: 'Prueba global de costo de ventas', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 135, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Pruebas sustantivas de gastos de operación con CFDI y pago bancario', papelTrabajo: 'Revisión de muestra de gastos mayores', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 3.5, status: 'pending' },
      { activityNumber: 136, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Análisis y recálculo de la nómina contra dispersión bancaria y SUA/CFDI', papelTrabajo: 'Prueba global de sueldos y salarios', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 2.5, status: 'pending' },
      { activityNumber: 137, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Verificación de deducciones de honorarios asimilados y profesionales', papelTrabajo: 'Contratos y comprobación de entregables', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 138, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Revisión de gastos de viaje, viáticos y representación con requisitos fiscales', papelTrabajo: 'Cédula de cumplimiento de viáticos', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 139, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Análisis de gastos de mantenimiento y reparación vs capitalizables', papelTrabajo: 'Cédula de gastos de conservación', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 140, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Revisión de arrendamientos conforme a NIF D-5', papelTrabajo: 'Revisión de contratos de arrendamiento', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 141, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Procedimiento analítico de gastos de administración y venta', papelTrabajo: 'Variaciones porcentuales vs presupuesto', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 142, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '701-000-000-000 GASTOS FINANCIEROS', procedimiento: 'Verificación de gastos financieros, intereses y comisiones bancarias', papelTrabajo: 'Recálculo de intereses pagados', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 143, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '701-000-000-000 GASTOS FINANCIEROS', procedimiento: 'Pruebas de pérdidas por fluctuación cambiaria', papelTrabajo: 'Comprobación de pérdidas en cambios', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 144, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Revisión de partidas no deducibles para efectos fiscales', papelTrabajo: 'Cédula de gastos no deducibles', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 145, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Búsqueda de gastos omitidos en el periodo', papelTrabajo: 'Prueba de pasivos no reconocidos en gastos', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 146, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Cruce de retenciones en recibos de honorarios y fletes', papelTrabajo: 'Validación de retenciones ISR/IVA en gastos', fase: 'Final', perfilSugerido: 'Staff', budgetedHours: 0.5, status: 'pending' },
      { activityNumber: 147, rubro: '16. Costo y Gastos', rubroNumber: 16, cuentaContable: '601-000-000-000 GASTOS OPERACION', procedimiento: 'Cédula sumaria de costo de ventas y gastos de operación', papelTrabajo: 'Cédula sumaria del rubro L', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 0.5, status: 'pending' },
    ],
  },

  // Rubro 17 — Trabajo de TI (1 actividad)
  {
    number: 17,
    name: '17. Trabajo de TI',
    riskLevel: { inherent: 'Alto', control: 'Alto', audit: 'Medio' },
    activities: [
      {
        activityNumber: 148,
        rubro: '17. Trabajo de TI',
        rubroNumber: 17,
        cuentaContable: 'TI-001',
        procedimiento: 'Evaluación de controles generales de tecnología de información (ITGC)',
        papelTrabajo: 'Cédula de auditoría de sistemas, accesos y respaldos',
        fase: 'Previa',
        perfilSugerido: 'Especialista',
        budgetedHours: 6.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },

  // Rubro 18 — Generales y Procedimientos de Conclusión y Cierre (10 actividades)
  {
    number: 18,
    name: '18. Generales y Procedimientos de Conclusión y Cierre',
    riskLevel: { inherent: 'Alto', control: 'Bajo', audit: 'Bajo' },
    activities: [
      { activityNumber: 149, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Procedimientos analíticos finales sobre estados financieros auditados', papelTrabajo: 'Revisión analítica final NIA 520', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 150, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Revisión de eventos posteriores a la fecha del balance (hasta dictamen)', papelTrabajo: 'Cédula de hechos posteriores NIA 560', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 151, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Confirmaciones legales y cartas de abogados sobre litigios', papelTrabajo: 'Cartas de confirmación de abogados externos', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 152, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Evaluación integral del principio de Negocio en Marcha', papelTrabajo: 'Evaluación de viabilidad continua NIA 570', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 153, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Acumulación y resumen de diferencias de auditoría no corregidas (SUM)', papelTrabajo: 'Cédula de ajustes no registrados (SUM)', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.5, status: 'pending' },
      { activityNumber: 154, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Lectura de actas posteriores al cierre y compromisos contractuales', papelTrabajo: 'Extracto de actas del nuevo ejercicio', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 155, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Revisión de revelaciones suficientes en notas a los estados financieros', papelTrabajo: 'Lista de verificación de revelaciones NIF', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 156, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Cuestionario de control de calidad final del encargo', papelTrabajo: 'Revisión de control de calidad EQCR', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 1.0, status: 'pending' },
      { activityNumber: 157, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Emisión del informe final de auditoría independiente (Dictamen)', papelTrabajo: 'Opinión de auditoría independiente', fase: 'Final', perfilSugerido: 'Gerente', budgetedHours: 2.0, status: 'pending' },
      { activityNumber: 158, rubro: '18. Generales y Procedimientos de Conclusión y Cierre', rubroNumber: 18, procedimiento: 'Cierre formal del archivo de auditoría y respaldo de papeles', papelTrabajo: 'Checklist de cierre de papeles de trabajo', fase: 'Final', perfilSugerido: 'Encargado', budgetedHours: 1.2, status: 'pending' },
    ],
  },
];

/**
 * Calcula la suma total exacta de horas presupuestadas de la plantilla
 */
export function calculateTemplateTotalHours(rubros: ServiceTemplateRubro[]): number {
  const sum = rubros.reduce((acc, r) => {
    return acc + r.activities.reduce((actAcc, a) => actAcc + (Number(a.budgetedHours) || 0), 0);
  }, 0);
  return Number(sum.toFixed(2));
}

/**
 * Retorna la plantilla maestra oficial "Auditoría de Estados Financieros"
 */
export function getDefaultAuditTemplate(): ServiceTemplate {
  return {
    id: AUDIT_MASTER_TEMPLATE_ID,
    name: 'Auditoría de Estados Financieros',
    description:
      'Plan maestro predeterminado de auditoría financiera con 19 bloques/rubros operativos y 156 procedimientos oficiales.',
    version: '1.0',
    totalBudgetHours: 226.2,
    rubros: JSON.parse(JSON.stringify(DEFAULT_AUDIT_RUBROS)),
    isSystemDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Obtiene todas las plantillas de servicio disponibles (desde Firestore con fallback en localStorage)
 */
export async function getServiceTemplates(): Promise<ServiceTemplate[]> {
  const defaultTpl = getDefaultAuditTemplate();
  const templatesMap = new Map<string, ServiceTemplate>();
  templatesMap.set(defaultTpl.id, defaultTpl);

  // 1. Cargar plantillas adicionales guardadas en localStorage
  try {
    const rawLocal = localStorage.getItem('rb_custom_service_templates');
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((t: ServiceTemplate) => {
          if (t && t.id) templatesMap.set(t.id, t);
        });
      }
    }
  } catch {
    // Ignorar errores locales
  }

  // 2. Cargar desde Firestore si está disponible
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, 'service_templates'));
      if (!snap.empty) {
        trackFirestoreRead(snap.size);
        snap.forEach((d) => {
          const data = d.data() as ServiceTemplate;
          if (data && data.name) {
            templatesMap.set(d.id, { ...data, id: d.id });
          }
        });
      } else {
        // Inicializar la plantilla por defecto en Firestore
        await setDoc(doc(db, 'service_templates', defaultTpl.id), defaultTpl, { merge: true });
        trackFirestoreWrite(1);
      }
    } catch (err) {
      console.warn('[serviceTemplateService] Error al consultar Firestore:', err);
    }
  }

  return Array.from(templatesMap.values());
}

/**
 * Guarda una nueva plantilla de servicio (ej. cuando el gerente edita y pulsa "Guardar estructura como Plantilla")
 */
export async function saveServiceTemplate(
  templateData: Omit<ServiceTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ServiceTemplate> {
  const nowIso = new Date().toISOString();
  const id =
    templateData.id ||
    `template_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const totalHours = calculateTemplateTotalHours(templateData.rubros);

  const fullTemplate: ServiceTemplate = {
    ...templateData,
    id,
    totalBudgetHours: totalHours,
    createdAt: nowIso,
    updatedAt: nowIso,
    isSystemDefault: id === AUDIT_MASTER_TEMPLATE_ID,
  };

  // Guardar en localStorage
  try {
    const rawLocal = localStorage.getItem('rb_custom_service_templates');
    const existing: ServiceTemplate[] = rawLocal ? JSON.parse(rawLocal) : [];
    const filtered = existing.filter((t) => t.id !== id);
    filtered.push(fullTemplate);
    localStorage.setItem('rb_custom_service_templates', JSON.stringify(filtered));
  } catch {
    // Ignorar error local
  }

  // Guardar en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'service_templates', id), fullTemplate, { merge: true });
      trackFirestoreWrite(1);
    } catch (err) {
      console.warn('[serviceTemplateService] Error al guardar plantilla en Firestore:', err);
    }
  }

  return fullTemplate;
}
