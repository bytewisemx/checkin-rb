import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { trackFirestoreRead, trackFirestoreWrite } from './firestoreTelemetry';
import type {
  ServiceTemplate,
  ServiceTemplateRubro,
} from '../types/serviceTemplate';

// Identificadores Oficiales del Catálogo de Servicios
export const SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026 = 'service_auditoria_estados_financieros_2026';
export const SERVICE_DICTAMEN_FISCAL_IMSS = 'service_dictamen_fiscal_imss';
export const SERVICE_REVISION_LIMITADA = 'service_revision_limitada';
export const SERVICE_CONSULTORIA_CONTROL_INTERNO = 'service_consultoria_control_interno';

// Alias para retrocompatibilidad
export const AUDIT_MASTER_TEMPLATE_ID = SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026;

// Importar los rubros oficiales de auditoría existentes
import { DEFAULT_AUDIT_RUBROS } from './serviceTemplateService';

/**
 * 2. Dictamen Fiscal y Cumplimiento IMSS / INFONAVIT
 * 24 actividades | ~64 horas estimadas
 */
export const DEFAULT_DICTAMEN_FISCAL_RUBROS: ServiceTemplateRubro[] = [
  {
    number: 1,
    name: 'Rubro 1 — Planeación Fiscal y Entorno Normativo',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 1,
        rubro: 'Rubro 1 — Planeación Fiscal y Entorno Normativo',
        rubroNumber: 1,
        cuentaContable: 'FIS-01',
        procedimiento: 'Memorándum de planeación fiscal y alcance CFF / LISR / LIVA',
        papelTrabajo: 'Cédula de planeación fiscal y matriz de obligaciones',
        fase: 'Previa',
        perfilSugerido: 'Gerente',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 2,
        rubro: 'Rubro 1 — Planeación Fiscal y Entorno Normativo',
        rubroNumber: 1,
        cuentaContable: 'FIS-02',
        procedimiento: 'Diagnóstico de situación fiscal de ejercicios anteriores y créditos fiscales',
        papelTrabajo: 'Expediente fiscal y opinión de cumplimiento 32-D SAT',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 3,
        rubro: 'Rubro 1 — Planeación Fiscal y Entorno Normativo',
        rubroNumber: 1,
        cuentaContable: 'FIS-03',
        procedimiento: 'Carta de requerimientos de información fiscal y contable',
        papelTrabajo: 'Checklist de requerimientos fiscales entregado al contribuyente',
        fase: 'Previa',
        perfilSugerido: 'Staff',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 4,
        rubro: 'Rubro 1 — Planeación Fiscal y Entorno Normativo',
        rubroNumber: 1,
        cuentaContable: 'FIS-04',
        procedimiento: 'Cuestionario de control interno y políticas de facturación/CFDI',
        papelTrabajo: 'Cuestionario de control interno fiscal y emisión de CFDI',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 2,
    name: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 5,
        rubro: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
        rubroNumber: 2,
        cuentaContable: 'FIS-05',
        procedimiento: 'Conciliación de ingresos acumulables vs facturación emitida SAT',
        papelTrabajo: 'Cédula de amarre de ingresos contables vs fiscales y visores SAT',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 6,
        rubro: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
        rubroNumber: 2,
        cuentaContable: 'FIS-06',
        procedimiento: 'Revisión sustantiva de deducciones autorizadas e inversiones de activo fijo',
        papelTrabajo: 'Papel de trabajo de deducción de inversiones y depreciación fiscal',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 7,
        rubro: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
        rubroNumber: 2,
        cuentaContable: 'FIS-07',
        procedimiento: 'Verificación de requisitos de deducibilidad y validez de CFDI recibidos (69-B)',
        papelTrabajo: 'Cédula de validación de proveedores no listados en EFOS / 69-B',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 8,
        rubro: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
        rubroNumber: 2,
        cuentaContable: 'FIS-08',
        procedimiento: 'Validación de retenciones efectuadas de ISR e IVA (RESICO, honorarios, fletes)',
        papelTrabajo: 'Cédula de amarre de retenciones contables vs enteros en portal SAT',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 9,
        rubro: 'Rubro 2 — Revisión de Balanza y Deducciones Autorizadas',
        rubroNumber: 2,
        cuentaContable: 'FIS-09',
        procedimiento: 'Determinación y reclasificación de partidas no deducibles',
        papelTrabajo: 'Cédula de gastos no deducibles y partidas exentas de previsión social',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 3,
    name: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 10,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-01',
        procedimiento: 'Conciliación de nómina contable vs nómina timbrada en visores SAT',
        papelTrabajo: 'Cédula de confronta de nómina contable vs visor de nómina SAT',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 11,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-02',
        procedimiento: 'Validación de integración del Salario Base de Cotización (SBC fija y variable)',
        papelTrabajo: 'Papel de trabajo de muestra de integración de SBC para Seguro Social',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 12,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-03',
        procedimiento: 'Revisión de avisos afiliatorios (altas, bajas y modificaciones IDSE)',
        papelTrabajo: 'Cédula de verificación de movimientos afiliatorios vs expedientes',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 13,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-04',
        procedimiento: 'Verificación de retenciones y amortizaciones de créditos de vivienda INFONAVIT',
        papelTrabajo: 'Cédula de amortización de créditos INFONAVIT vs avisos de retención',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 14,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-05',
        procedimiento: 'Revisión y cálculo de la prima de riesgo de trabajo anual',
        papelTrabajo: 'Cédula de determinación de la siniestralidad laboral y prima de RT',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 15,
        rubro: 'Rubro 3 — Amarre de Nóminas, IMSS, INFONAVIT e ISN',
        rubroNumber: 3,
        cuentaContable: 'NOM-06',
        procedimiento: 'Amarre de pagos SUA vs emisiones mensuales SIPARE y conciliación ISN estatal',
        papelTrabajo: 'Cédula de amarre bimestral SUA vs pagos bancarios SIPARE e ISN',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 4,
    name: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
    riskLevel: { inherent: 'Alto', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 16,
        rubro: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
        rubroNumber: 4,
        cuentaContable: 'CON-01',
        procedimiento: 'Conciliación entre el resultado contable y la utilidad/pérdida fiscal',
        papelTrabajo: 'Cédula de conciliación contable-fiscal del ejercicio',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 17,
        rubro: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
        rubroNumber: 4,
        cuentaContable: 'CON-02',
        procedimiento: 'Determinación y actualización de saldos de CUFIN y CUCA',
        papelTrabajo: 'Papel de trabajo de saldos históricos y actualizados de CUFIN y CUCA',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 18,
        rubro: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
        rubroNumber: 4,
        cuentaContable: 'CON-03',
        procedimiento: 'Revisión y amortización de pérdidas fiscales de ejercicios anteriores',
        papelTrabajo: 'Cédula de amortización y actualización de pérdidas fiscales',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 19,
        rubro: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
        rubroNumber: 4,
        cuentaContable: 'CON-04',
        procedimiento: 'Verificación de pagos provisionales de ISR y retenciones aplicadas vs anual',
        papelTrabajo: 'Cédula de acreditamiento de pagos provisionales y retenciones',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 20,
        rubro: 'Rubro 4 — Conciliación Contable-Fiscal y Cierre',
        rubroNumber: 4,
        cuentaContable: 'CON-05',
        procedimiento: 'Cálculo de la base y validación del reparto de utilidades (PTU)',
        papelTrabajo: 'Cédula de cálculo de PTU por distribuir a los trabajadores',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 5,
    name: 'Rubro 5 — Emisión de Dictamen e Informes Fiscales',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 21,
        rubro: 'Rubro 5 — Emisión de Dictamen e Informes Fiscales',
        rubroNumber: 5,
        cuentaContable: 'INF-01',
        procedimiento: 'Elaboración de la cédula de observaciones fiscales preliminares',
        papelTrabajo: 'Cédula de hallazgos y diferencias fiscales preliminares',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 22,
        rubro: 'Rubro 5 — Emisión de Dictamen e Informes Fiscales',
        rubroNumber: 5,
        cuentaContable: 'INF-02',
        procedimiento: 'Junta de cierre con la administración y entrega de recomendaciones',
        papelTrabajo: 'Minuta de reunión de cierre de auditoría fiscal',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 23,
        rubro: 'Rubro 5 — Emisión de Dictamen e Informes Fiscales',
        rubroNumber: 5,
        cuentaContable: 'INF-03',
        procedimiento: 'Llenado y validación técnica de anexos SIPRED / SIDEIMSS',
        papelTrabajo: 'Archivo de validación y carga de anexos fiscales',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 24,
        rubro: 'Rubro 5 — Emisión de Dictamen e Informes Fiscales',
        rubroNumber: 5,
        cuentaContable: 'INF-04',
        procedimiento: 'Emisión, firma y presentación del Informe sobre la Situación Fiscal (ISSIF / Dictamen)',
        papelTrabajo: 'Dictamen fiscal final firmado por Socio y acuses oficiales',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
];

/**
 * 3. Revisión Limitada y Diagnóstico Financiero
 * 14 actividades | ~36 horas estimadas
 */
export const DEFAULT_REVISION_LIMITADA_RUBROS: ServiceTemplateRubro[] = [
  {
    number: 1,
    name: 'Rubro 1 — Entendimiento y Análisis Preliminar',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 1,
        rubro: 'Rubro 1 — Entendimiento y Análisis Preliminar',
        rubroNumber: 1,
        cuentaContable: 'REV-01',
        procedimiento: 'Entrevista preliminar con dirección general y levantamiento de objetivos',
        papelTrabajo: 'Minuta de entendimiento del negocio y alcance diagnóstico',
        fase: 'Previa',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 2,
        rubro: 'Rubro 1 — Entendimiento y Análisis Preliminar',
        rubroNumber: 1,
        cuentaContable: 'REV-02',
        procedimiento: 'Recopilación y cuadre de balanzas de comprobación y estados financieros base',
        papelTrabajo: 'Cédula de cuadre de balanza analítica y cifras base',
        fase: 'Previa',
        perfilSugerido: 'Staff',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 3,
        rubro: 'Rubro 1 — Entendimiento y Análisis Preliminar',
        rubroNumber: 1,
        cuentaContable: 'REV-03',
        procedimiento: 'Análisis horizontal y vertical comparativo de estados financieros (tendencias)',
        papelTrabajo: 'Cédula analítica de variaciones de balance y resultados',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 2,
    name: 'Rubro 2 — Pruebas Sustantivas Selectivas',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 4,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-04',
        procedimiento: 'Arqueo sorpresivo de caja general, fondos fijos e inventario físico selectivo',
        papelTrabajo: 'Actas de arqueo físico de caja y recuento selectivo de existencias',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 5,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-05',
        procedimiento: 'Revisión y conciliación bancaria de cuentas principales e inversiones líquidas',
        papelTrabajo: 'Cédula de verificación de conciliaciones bancarias y partidas en tránsito',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 6,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-06',
        procedimiento: 'Circularización selectiva y análisis de antigüedad de cuentas por cobrar',
        papelTrabajo: 'Cédula de antigüedad de saldos y confirmaciones de clientes clave',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 7,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-07',
        procedimiento: 'Revisión analítica de valuación de inventarios y prueba de obsolescencia',
        papelTrabajo: 'Cédula de margen bruto y análisis de rotación de inventarios',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 8,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-08',
        procedimiento: 'Confirmación selectiva de proveedores principales y pasivos contingentes',
        papelTrabajo: 'Cédula de amarre de pasivos comerciales y préstamos bancarios',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 9,
        rubro: 'Rubro 2 — Pruebas Sustantivas Selectivas',
        rubroNumber: 2,
        cuentaContable: 'REV-09',
        procedimiento: 'Verificación del cumplimiento de covenants y obligaciones financieras con terceros',
        papelTrabajo: 'Cédula de revisión de contratos de deuda y cláusulas financieras',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 3,
    name: 'Rubro 3 — Diagnóstico de Solvencia y Contingencias',
    riskLevel: { inherent: 'Medio', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 10,
        rubro: 'Rubro 3 — Diagnóstico de Solvencia y Contingencias',
        rubroNumber: 3,
        cuentaContable: 'REV-10',
        procedimiento: 'Identificación de contingencias fiscales, laborales y mercantiles visibles',
        papelTrabajo: 'Matriz de contingencias y estimaciones de pasivo',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 11,
        rubro: 'Rubro 3 — Diagnóstico de Solvencia y Contingencias',
        rubroNumber: 3,
        cuentaContable: 'REV-11',
        procedimiento: 'Evaluación preliminar de hipótesis de empresa en funcionamiento (NIA 570)',
        papelTrabajo: 'Cédula de indicadores de continuidad operativa y flujo de efectivo',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 12,
        rubro: 'Rubro 3 — Diagnóstico de Solvencia y Contingencias',
        rubroNumber: 3,
        cuentaContable: 'REV-12',
        procedimiento: 'Cálculo e interpretación de ratios de liquidez, solvencia, apalancamiento y rentabilidad',
        papelTrabajo: 'Tablero financiero comparativo de razones clave y benchmarks',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 4,
    name: 'Rubro 4 — Conclusiones e Informe Ejecutivo',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 13,
        rubro: 'Rubro 4 — Conclusiones e Informe Ejecutivo',
        rubroNumber: 4,
        cuentaContable: 'REV-13',
        procedimiento: 'Redacción del informe ejecutivo de diagnóstico financiero y áreas de mejora',
        papelTrabajo: 'Borrador de informe diagnóstico con conclusiones y semaforización',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 14,
        rubro: 'Rubro 4 — Conclusiones e Informe Ejecutivo',
        rubroNumber: 4,
        cuentaContable: 'REV-14',
        procedimiento: 'Presentación ejecutiva de hallazgos ante el Consejo de Administración o Dirección',
        papelTrabajo: 'Presentación ejecutiva final y minuta de acuerdos directivos',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
];

/**
 * 4. Consultoría de Control Interno y Gobierno TI
 * 12 actividades | ~40 horas estimadas
 */
export const DEFAULT_CONTROL_INTERNO_TI_RUBROS: ServiceTemplateRubro[] = [
  {
    number: 1,
    name: 'Rubro 1 — Levantamiento y Mapeo de Procesos Críticos',
    riskLevel: { inherent: 'Medio', control: 'Medio', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 1,
        rubro: 'Rubro 1 — Levantamiento y Mapeo de Procesos Críticos',
        rubroNumber: 1,
        cuentaContable: 'TI-01',
        procedimiento: 'Entrevistas de entendimiento con directores de área y líderes de procesos clave',
        papelTrabajo: 'Minutas de entrevistas y mapas de interacción departamental',
        fase: 'Previa',
        perfilSugerido: 'Gerente',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 2,
        rubro: 'Rubro 1 — Levantamiento y Mapeo de Procesos Críticos',
        rubroNumber: 1,
        cuentaContable: 'TI-02',
        procedimiento: 'Mapeo y diagramación de flujos de valor operativo (compras, ventas, tesorería)',
        papelTrabajo: 'Diagramas de flujo de procesos e identificación de puntos de control',
        fase: 'Previa',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 3,
        rubro: 'Rubro 1 — Levantamiento y Mapeo de Procesos Críticos',
        rubroNumber: 1,
        cuentaContable: 'TI-03',
        procedimiento: 'Revisión y levantamiento del inventario de políticas, manuales y procedimientos vigentes',
        papelTrabajo: 'Matriz de vigencia y suficiencia documental de políticas internas',
        fase: 'Previa',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 2,
    name: 'Rubro 2 — Matriz de Riesgos y Segregación de Funciones (SoD)',
    riskLevel: { inherent: 'Alto', control: 'Alto', audit: 'Medio' },
    activities: [
      {
        activityNumber: 4,
        rubro: 'Rubro 2 — Matriz de Riesgos y Segregación de Funciones (SoD)',
        rubroNumber: 2,
        cuentaContable: 'TI-04',
        procedimiento: 'Elaboración de la matriz de riesgos operacionales, financieros y de fraude',
        papelTrabajo: 'Matriz de riesgos y controles (RCM) por macroproceso',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 5,
        rubro: 'Rubro 2 — Matriz de Riesgos y Segregación de Funciones (SoD)',
        rubroNumber: 2,
        cuentaContable: 'TI-05',
        procedimiento: 'Análisis de perfiles y segregación incompatible de funciones (SoD) en el ERP / sistemas',
        papelTrabajo: 'Matriz de conflictos SoD y usuarios con privilegios incompatibles',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 4.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 6,
        rubro: 'Rubro 2 — Matriz de Riesgos y Segregación de Funciones (SoD)',
        rubroNumber: 2,
        cuentaContable: 'TI-06',
        procedimiento: 'Identificación de brechas de control y evaluación de la efectividad de controles clave',
        papelTrabajo: 'Cédula de pruebas de diseño y eficacia operativa de controles',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 3,
    name: 'Rubro 3 — Evaluación de Controles Generales de TI (ITGC)',
    riskLevel: { inherent: 'Alto', control: 'Medio', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 7,
        rubro: 'Rubro 3 — Evaluación de Controles Generales de TI (ITGC)',
        rubroNumber: 3,
        cuentaContable: 'TI-07',
        procedimiento: 'Evaluación de seguridad lógica, gestión de identidades y administración de accesos privilegiados',
        papelTrabajo: 'Cédula de revisión de políticas de contraseñas y cuentas de administración',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 8,
        rubro: 'Rubro 3 — Evaluación de Controles Generales de TI (ITGC)',
        rubroNumber: 3,
        cuentaContable: 'TI-08',
        procedimiento: 'Revisión de esquemas de respaldos de bases de datos, planes DRP y continuidad operativa',
        papelTrabajo: 'Cédula de verificación de políticas de respaldo y pruebas de restauración',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 9,
        rubro: 'Rubro 3 — Evaluación de Controles Generales de TI (ITGC)',
        rubroNumber: 3,
        cuentaContable: 'TI-09',
        procedimiento: 'Auditoría de gestión de cambios en sistemas y monitoreo de bitácoras de auditoría',
        papelTrabajo: 'Cédula de revisión de aprobaciones de cambios en producción y logs',
        fase: 'Final',
        perfilSugerido: 'Staff',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
  {
    number: 4,
    name: 'Rubro 4 — Plan de Remediación y Gobierno Institucional',
    riskLevel: { inherent: 'Bajo', control: 'Bajo', audit: 'Bajo' },
    activities: [
      {
        activityNumber: 10,
        rubro: 'Rubro 4 — Plan de Remediación y Gobierno Institucional',
        rubroNumber: 4,
        cuentaContable: 'TI-10',
        procedimiento: 'Taller de socialización de hallazgos y validación de planes de acción con la gerencia',
        papelTrabajo: 'Minuta de taller de retroalimentación de controles',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 2.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 11,
        rubro: 'Rubro 4 — Plan de Remediación y Gobierno Institucional',
        rubroNumber: 4,
        cuentaContable: 'TI-11',
        procedimiento: 'Elaboración del plan integral de remediación con priorización de criticidad y responsables',
        papelTrabajo: 'Matriz de plan de acción correctivo y hoja de ruta de remediación',
        fase: 'Final',
        perfilSugerido: 'Encargado',
        budgetedHours: 3.5,
        unbudgetedHours: 0,
        status: 'pending',
      },
      {
        activityNumber: 12,
        rubro: 'Rubro 4 — Plan de Remediación y Gobierno Institucional',
        rubroNumber: 4,
        cuentaContable: 'TI-12',
        procedimiento: 'Presentación formal del informe final de control interno y gobierno de TI al Comité de Auditoría',
        papelTrabajo: 'Informe final de control interno ejecutivo y ejecutivo de TI',
        fase: 'Final',
        perfilSugerido: 'Gerente',
        budgetedHours: 3.0,
        unbudgetedHours: 0,
        status: 'pending',
      },
    ],
  },
];

/**
 * Calcula la suma total de horas presupuestadas de un conjunto de rubros
 */
export function calculateTemplateTotalHours(rubros: ServiceTemplateRubro[]): number {
  if (!Array.isArray(rubros)) return 0;
  const sum = rubros.reduce((acc, rubro) => {
    const rubroSum = (rubro.activities || []).reduce(
      (actAcc, act) => actAcc + (Number(act.budgetedHours) || 0),
      0
    );
    return acc + rubroSum;
  }, 0);
  return Number(sum.toFixed(2));
}

/**
 * Cuenta el total de actividades en un conjunto de rubros
 */
export function countTemplateActivities(rubros: ServiceTemplateRubro[]): number {
  if (!Array.isArray(rubros)) return 0;
  return rubros.reduce((acc, r) => acc + (r.activities?.length || 0), 0);
}

/**
 * Catálogo Oficial Maestro de los 4 Servicios Institucionales
 */
export const DEFAULT_SERVICE_CATALOG: ServiceTemplate[] = [
  {
    id: SERVICE_AUDITORIA_ESTADOS_FINANCIEROS_2026,
    name: 'Auditoría de Estados Financieros 2026',
    description: 'Auditoría integral basada en Normas Internacionales de Auditoría (NIA). Comprende planeación general, 18 rubros de auditoría sustantiva y emisión de dictamen.',
    version: '2026.1',
    totalBudgetHours: calculateTemplateTotalHours(DEFAULT_AUDIT_RUBROS),
    totalActivities: countTemplateActivities(DEFAULT_AUDIT_RUBROS),
    rubros: DEFAULT_AUDIT_RUBROS,
    isSystemDefault: true,
  },
  {
    id: SERVICE_DICTAMEN_FISCAL_IMSS,
    name: 'Dictamen Fiscal y Cumplimiento IMSS / INFONAVIT',
    description: 'Revisión y dictamen de obligaciones fiscales, IMSS, INFONAVIT e ISN. Incluye amarre de CFDI, conciliación contable-fiscal y llenado de anexos SIPRED / SIDEIMSS.',
    version: '2026.1',
    totalBudgetHours: calculateTemplateTotalHours(DEFAULT_DICTAMEN_FISCAL_RUBROS),
    totalActivities: countTemplateActivities(DEFAULT_DICTAMEN_FISCAL_RUBROS),
    rubros: DEFAULT_DICTAMEN_FISCAL_RUBROS,
    isSystemDefault: true,
  },
  {
    id: SERVICE_REVISION_LIMITADA,
    name: 'Revisión Limitada y Diagnóstico Financiero',
    description: 'Diagnóstico express y revisión de estados financieros para directores, inversionistas y bancos. Incluye pruebas selectivas, análisis de solvencia y contingencias.',
    version: '2026.1',
    totalBudgetHours: calculateTemplateTotalHours(DEFAULT_REVISION_LIMITADA_RUBROS),
    totalActivities: countTemplateActivities(DEFAULT_REVISION_LIMITADA_RUBROS),
    rubros: DEFAULT_REVISION_LIMITADA_RUBROS,
    isSystemDefault: true,
  },
  {
    id: SERVICE_CONSULTORIA_CONTROL_INTERNO,
    name: 'Consultoría de Control Interno y Gobierno TI',
    description: 'Evaluación y fortalecimiento de control interno (COSO) y controles de TI (ITGC). Matriz de riesgos, segregación de funciones (SoD) y plan de remediación institucional.',
    version: '2026.1',
    totalBudgetHours: calculateTemplateTotalHours(DEFAULT_CONTROL_INTERNO_TI_RUBROS),
    totalActivities: countTemplateActivities(DEFAULT_CONTROL_INTERNO_TI_RUBROS),
    rubros: DEFAULT_CONTROL_INTERNO_TI_RUBROS,
    isSystemDefault: true,
  },
];

/**
 * Consulta y sincroniza el Catálogo Oficial de Servicios desde Firestore (`service_catalog`).
 * Si la colección no contiene los servicios predeterminados, los siembra automáticamente en la BD.
 */
export async function getServiceCatalog(): Promise<ServiceTemplate[]> {
  const catalogMap = new Map<string, ServiceTemplate>();

  // 1. Cargar servicios predeterminados como base
  DEFAULT_SERVICE_CATALOG.forEach((srv) => catalogMap.set(srv.id, srv));

  // 2. Consultar colección permanente 'service_catalog' en Firestore
  if (isFirebaseConfigured() && db) {
    try {
      const snap = await getDocs(collection(db, 'service_catalog'));
      if (!snap.empty) {
        trackFirestoreRead(snap.size);
        snap.forEach((d) => {
          const data = d.data() as ServiceTemplate;
          if (data && data.name) {
            catalogMap.set(d.id, { ...data, id: d.id });
          }
        });
      }

      // Si falta sembrar alguno de los 4 servicios maestros en Firestore, sembrarlos de inmediato
      const missingDefaults = DEFAULT_SERVICE_CATALOG.filter((srv) => !snap.docs.some((d) => d.id === srv.id));
      if (missingDefaults.length > 0) {
        for (const missingSrv of missingDefaults) {
          await setDoc(doc(db, 'service_catalog', missingSrv.id), missingSrv, { merge: true });
        }
        trackFirestoreWrite(missingDefaults.length);
      }
    } catch (err) {
      console.warn('[serviceCatalogService] Error al consultar service_catalog en Firestore:', err);
    }
  }

  return Array.from(catalogMap.values());
}

/**
 * Alias de compatibilidad hacia getServiceCatalog
 */
export const getServiceTemplates = getServiceCatalog;

/**
 * Guarda o actualiza un servicio en la colección `service_catalog` de Firestore
 */
export async function saveServiceCatalogItem(
  serviceData: Omit<ServiceTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<ServiceTemplate> {
  const nowIso = new Date().toISOString();
  const id =
    serviceData.id ||
    `service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const totalHours = calculateTemplateTotalHours(serviceData.rubros);
  const totalActivities = countTemplateActivities(serviceData.rubros);

  const fullService: ServiceTemplate = {
    ...serviceData,
    id,
    totalBudgetHours: totalHours,
    totalActivities,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (isFirebaseConfigured() && db) {
    try {
      await setDoc(doc(db, 'service_catalog', id), fullService, { merge: true });
      trackFirestoreWrite(1);
    } catch (err) {
      console.warn('[serviceCatalogService] Error al guardar servicio en Firestore:', err);
    }
  }

  return fullService;
}
