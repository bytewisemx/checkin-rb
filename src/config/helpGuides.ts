import type { UserRole } from '../services/rbac';
import {
  INTERACTIVE_GUIDES,
  getInteractiveGuidesForRole,
  type InteractiveGuide,
  type TourStep,
} from './interactiveGuidesConfig';

export interface HelpStep extends TourStep {}

export interface HelpGuideItem extends InteractiveGuide {}

export type HelpCatalog = Partial<Record<UserRole, HelpGuideItem[]>>;

export const HELP_CATALOG: HelpCatalog = {
  Colaborador: INTERACTIVE_GUIDES.colaborador,
  Empleado: INTERACTIVE_GUIDES.colaborador,
  Supervisor: INTERACTIVE_GUIDES.supervisor,
  Gerente: INTERACTIVE_GUIDES.gerente,
  Socio: INTERACTIVE_GUIDES.socio,
  RH: INTERACTIVE_GUIDES.rh,
  TI: INTERACTIVE_GUIDES.ti,
};

export { INTERACTIVE_GUIDES, getInteractiveGuidesForRole };
