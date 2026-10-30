import { create } from 'zustand';
import type { HelpGuideItem } from '../config/helpGuides';

interface HelpTourState {
  isHelpDrawerOpen: boolean;
  activeTour: HelpGuideItem | null;
  currentStepIndex: number;

  openHelpDrawer: () => void;
  closeHelpDrawer: () => void;
  toggleHelpDrawer: () => void;

  startTour: (guide: HelpGuideItem) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
}

export const useHelpTourStore = create<HelpTourState>((set, get) => ({
  isHelpDrawerOpen: false,
  activeTour: null,
  currentStepIndex: 0,

  openHelpDrawer: () => set({ isHelpDrawerOpen: true }),
  closeHelpDrawer: () => set({ isHelpDrawerOpen: false }),
  toggleHelpDrawer: () => set((state) => ({ isHelpDrawerOpen: !state.isHelpDrawerOpen })),

  startTour: (guide: HelpGuideItem) => {
    set({
      isHelpDrawerOpen: false, // Cierra el panel lateral al iniciar
      activeTour: guide,
      currentStepIndex: 0,
    });
  },

  nextStep: () => {
    const { activeTour, currentStepIndex } = get();
    if (!activeTour) return;

    if (currentStepIndex + 1 < activeTour.steps.length) {
      set({ currentStepIndex: currentStepIndex + 1 });
    } else {
      set({ activeTour: null, currentStepIndex: 0 });
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  endTour: () => {
    set({ activeTour: null, currentStepIndex: 0 });
  },
}));

