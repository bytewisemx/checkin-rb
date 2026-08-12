import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSecureServerTime, captureClientIP, calculateLateness } from '../services/security';
export interface TaskTag {
  text: string;
  colorClass: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'progress' | 'review' | 'completed';
  timeSpent: string;
  estimatedTime: string;
  tags?: TaskTag[];
  assignee?: string;
  dueDate?: string;
  subtasksCount?: number;
}

export interface User {
  id: string;
  name: string;
  lastName?: string;
  email: string;
  role: 'employee' | 'supervisor';
  verified: boolean;
  birthDate?: string;
  team?: string;
  isProfileComplete: boolean;
  expectedEntryTime: string; // Ej: "09:00"
  profileImage?: string;
}

export interface PauseBlock {
  startMs: number;
  endMs: number | null;
}

export interface CheckinRecord {
  id: string;
  date: string; // ISO String format YYYY-MM-DD
  checkInTimeMs: number | null; // Usamos MS de NTP en vez de Strings inestables
  checkOutTimeMs: number | null;
  pauses: PauseBlock[];
  location: { lat: number; lng: number } | null;
  address: string | null;
  totalDurationMinutes: number | null;
  clientIp: string | null;
  isLate: boolean;
  minutesLate: number;
}

export interface MockEmployee {
  id: string;
  email: string;
  name: string;
  team: string;
  status: 'active' | 'inactive';
  workedMinutesToday: number;
  isProfileComplete: boolean;
  history: CheckinRecord[];
  expectedEntryTime: string;
}

export interface GlobalToast {
  message: string;
  type: 'info' | 'success' | 'error';
  id: number;
}

interface CheckinState {
  user: User | null;
  isAuthenticated: boolean;
  activeCheckin: CheckinRecord | null;
  history: CheckinRecord[]; // Historial de sesión actual

  mockEmployeesData: MockEmployee[];
  toasts: GlobalToast[];
  tasks: Task[];

  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  removeToast: (id: number) => void;
  moveTask: (taskId: string, newStatus: Task['status']) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
  deleteTask: (taskId: string) => void;

  login: (email: string, password?: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;

  startCheckin: (lat: number, lng: number, address: string) => Promise<void>;
  pauseCheckin: () => Promise<void>;
  resumeCheckin: () => Promise<void>;
  endCheckin: () => Promise<void>;
}

// Helpers de tiempo para mocks
const getPastDateStr = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const generateMockHistory = (days: number): CheckinRecord[] => {
  const history: CheckinRecord[] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 1; i <= days; i++) {
    // Fecha calculada
    const d = new Date(now - i * dayMs);
    // Saltarse fines de semana (0=Dom, 6=Sab) para que sea realista
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    // Aleatoriedad para llegadas tarde
    const isLate = Math.random() > 0.7; // 30% de probabilidad de llegar tarde
    const minutesLate = isLate ? Math.floor(Math.random() * 45) + 11 : 0;

    // Checkin a las 9:00 AM aprox + minutos tarde
    const checkinDate = new Date(d);
    checkinDate.setHours(9, isLate ? minutesLate : Math.floor(Math.random() * 9), 0, 0);

    // Checkout 8-9 horas despues
    const checkoutDate = new Date(checkinDate);
    const workedHours = 8 + (Math.random() * 1.5); // entre 8 y 9.5 horas de trabajo
    checkoutDate.setHours(checkoutDate.getHours() + Math.floor(workedHours));
    checkoutDate.setMinutes(Math.floor(Math.random() * 60));

    const durationMins = Math.floor((checkoutDate.getTime() - checkinDate.getTime()) / 60000);

    history.push({
      id: `mock-r-${i}`,
      date: checkinDate.toISOString().split('T')[0],
      checkInTimeMs: checkinDate.getTime(),
      checkOutTimeMs: checkoutDate.getTime(),
      pauses: [],
      location: { lat: 19.4326 + (Math.random() * 0.01), lng: -99.1332 + (Math.random() * 0.01) },
      address: 'Av. Reforma, CDMX (Simulado)',
      totalDurationMinutes: durationMins,
      clientIp: '189.200.10.15',
      isLate,
      minutesLate
    });
  }
  return history;
};

const initialMockEmployees: MockEmployee[] = [
  {
    id: 'mock-emp-101',
    email: 'demo@russellbedford.mx',
    name: 'Ana Demo Historial',
    team: 'Auditoría Interna',
    status: 'inactive',
    isProfileComplete: true,
    workedMinutesToday: 0,
    expectedEntryTime: '09:00',
    history: generateMockHistory(60) // Genera 60 días hacia atrás de historia
  }
];

const initialTasks: Task[] = [
  { 
    id: '1', title: 'Monthly budget for Community ads', description: '', status: 'pending', timeSpent: '00:00:00', estimatedTime: '120m',
    tags: [
      { text: 'Reviewing', colorClass: 'bg-green-100 text-green-700' },
      { text: 'Changes Needed', colorClass: 'bg-yellow-200 text-yellow-800' },
      { text: 'No', colorClass: 'bg-yellow-200 text-yellow-800' }
    ],
    assignee: 'Ana', dueDate: '16 Feb, 2025', subtasksCount: 1
  },
  { 
    id: '2', title: 'Identify web updates', description: '', status: 'progress', timeSpent: '00:00:00', estimatedTime: '60m',
    tags: [], assignee: 'Carlos', dueDate: 'Sunday', subtasksCount: 3
  },
  { 
    id: '3', title: '[Help Site] How to use the Community mobile app', description: '', status: 'review', timeSpent: '00:00:00', estimatedTime: '240m',
    tags: [
      { text: 'Not started', colorClass: 'bg-red-200 text-red-800' },
      { text: 'No', colorClass: 'bg-yellow-200 text-yellow-800' }
    ],
    assignee: 'Laura', dueDate: '17 Apr, 2025', subtasksCount: 2
  },
  { 
    id: '4', title: 'Community mobile app announcement', description: '', status: 'completed', timeSpent: '02:00:00', estimatedTime: '120m',
    tags: [
      { text: 'Not started', colorClass: 'bg-red-200 text-red-800' },
      { text: 'Ready for Review', colorClass: 'bg-teal-100 text-teal-800' }
    ],
    assignee: 'Luis', dueDate: '20 Apr, 2025', subtasksCount: 0
  },
];

export const useCheckinStore = create<CheckinState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      activeCheckin: null,
      history: [],
      mockEmployeesData: [],
      toasts: [],
      tasks: initialTasks,

      moveTask: (taskId, newStatus) => {
        const { tasks, user, addToast } = get();
        if (!user) return;
        
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Regla: Si está en completado, solo el supervisor la puede sacar
        if (task.status === 'completed' && user.role !== 'supervisor') {
           addToast('Solo el supervisor puede reactivar una tarea completada.', 'error');
           return;
        }

        set({ tasks: tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t) });
      },

      addTask: (taskData) => {
        const id = Math.random().toString(36).substring(2, 9);
        set(state => ({ tasks: [...state.tasks, { ...taskData, id }] }));
      },

      deleteTask: (taskId) => {
        set(state => ({ tasks: state.tasks.filter(t => t.id !== taskId) }));
      },

      addToast: (msg, type = 'info') => {
        const id = Date.now();
        set(state => ({ toasts: [...state.toasts, { message: msg, type, id }] }));
        setTimeout(() => get().removeToast(id), 5000);
      },

      removeToast: (id) => {
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
      },

      login: (email, password) => {
        const { addToast, mockEmployeesData } = get();

        if (password !== 'admin123') {
          addToast('Contraseña incorrecta. (Usa: admin123)', 'error');
          return false;
        }

        if (email.toLowerCase().includes('supervisor')) {
          // Inyectar datos demo automáticamente si no existen en el caché
          const currentMockData = get().mockEmployeesData;
          let updatedMockData = currentMockData;
          if (!currentMockData.some(e => e.email === 'demo@russellbedford.mx')) {
            updatedMockData = [...currentMockData, initialMockEmployees[0]];
          }

          set({
            user: {
              id: 'admin-99',
              name: 'Supervisor',
              lastName: 'General',
              email,
              role: 'supervisor',
              verified: true,
              isProfileComplete: true,
              team: 'Administración',
              expectedEntryTime: '09:00'
            },
            isAuthenticated: true,
            mockEmployeesData: updatedMockData
          });
          return true;
        }

        let existingEmp = mockEmployeesData.find(e => e.email === email.toLowerCase());

        if (!existingEmp) {
          existingEmp = {
            id: 'user-' + Math.random().toString(36).substring(7),
            email: email.toLowerCase(),
            name: email.split('@')[0],
            team: 'Sin Asignar',
            status: 'inactive',
            isProfileComplete: false,
            workedMinutesToday: 0,
            history: [],
            expectedEntryTime: '09:00' // Regla fija de la compañía (9 AM)
          };
          set({ mockEmployeesData: [...mockEmployeesData, existingEmp] });
        }

        const activeToday = existingEmp.history.find(h => h.date === getPastDateStr(0) && !h.checkOutTimeMs);

        set({
          user: {
            id: existingEmp.id,
            name: existingEmp.name,
            email: existingEmp.email,
            role: 'employee',
            verified: true,
            isProfileComplete: existingEmp.isProfileComplete,
            team: existingEmp.team,
            expectedEntryTime: existingEmp.expectedEntryTime
          },
          isAuthenticated: true,
          history: [...existingEmp.history], // Historial de este usuario cargado del mock global
          activeCheckin: activeToday || null
        });

        return true;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, activeCheckin: null, history: [] });
      },

      updateProfile: (data) => {
        const { user, mockEmployeesData } = get();
        if (!user) return;

        const updatedUser = { ...user, ...data, isProfileComplete: true };
        const updatedMockData = mockEmployeesData.map(emp =>
          emp.id === user.id ? {
            ...emp,
            name: (data.name || '') + ' ' + (data.lastName || ''),
            team: data.team || emp.team,
            isProfileComplete: true
          } : emp
        );

        set({
          user: updatedUser,
          mockEmployeesData: updatedMockData
        });
      },

      startCheckin: async (lat, lng, address) => {
        const { user, history, mockEmployeesData, addToast } = get();
        if (!user) return;

        // 1. Backend Simulador (Lógica asíncrona Anti-Fraude)
        const [secureTimeMs, clientIp] = await Promise.all([
          getSecureServerTime(),
          captureClientIP()
        ]);

        const { late, minutesLate } = calculateLateness(secureTimeMs, user.expectedEntryTime);

        if (late) {
          addToast(`Registro tardío: Tienes ${minutesLate} minutos de retardo respecto a tu horario (${user.expectedEntryTime} AM).`, 'error');
        }

        const dateIsoStr = new Date(secureTimeMs).toISOString().split('T')[0];

        const newRecord: CheckinRecord = {
          id: Math.random().toString(36).substr(2, 9),
          date: dateIsoStr,
          checkInTimeMs: secureTimeMs,
          checkOutTimeMs: null,
          pauses: [],
          location: { lat, lng },
          address,
          totalDurationMinutes: null,
          clientIp,
          isLate: late,
          minutesLate
        };

        const updatedMockData = mockEmployeesData.map(emp =>
          emp.id === user.id ? {
            ...emp,
            status: 'active' as const,
            history: [newRecord, ...emp.history]
          } : emp
        );

        set({
          activeCheckin: newRecord,
          history: [newRecord, ...history],
          mockEmployeesData: updatedMockData
        });
      },

      pauseCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !user) return;

        const secureTimeMs = await getSecureServerTime();

        const newPause: PauseBlock = {
          startMs: secureTimeMs,
          endMs: null // Pausa abierta
        };

        const updatedRecord = {
          ...activeCheckin,
          pauses: [...activeCheckin.pauses, newPause]
        };

        const updatedMockData = mockEmployeesData.map(emp =>
          emp.id === user.id ? {
            ...emp,
            status: 'inactive' as const,
            history: emp.history.map(h => h.id === updatedRecord.id ? updatedRecord : h)
          } : emp
        );

        set({
          activeCheckin: updatedRecord,
          history: history.map(r => r.id === updatedRecord.id ? updatedRecord : r),
          mockEmployeesData: updatedMockData
        });
      },

      resumeCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !user || activeCheckin.pauses.length === 0) return;

        const secureTimeMs = await getSecureServerTime();

        // Cerrar la última pausa abierta
        const updatedPauses = [...activeCheckin.pauses];
        updatedPauses[updatedPauses.length - 1].endMs = secureTimeMs;

        const updatedRecord = {
          ...activeCheckin,
          pauses: updatedPauses
        };

        const updatedMockData = mockEmployeesData.map(emp =>
          emp.id === user.id ? {
            ...emp,
            status: 'active' as const,
            history: emp.history.map(h => h.id === updatedRecord.id ? updatedRecord : h)
          } : emp
        );

        set({
          activeCheckin: updatedRecord,
          history: history.map(r => r.id === updatedRecord.id ? updatedRecord : r),
          mockEmployeesData: updatedMockData
        });
      },

      endCheckin: async () => {
        const { activeCheckin, history, mockEmployeesData, user } = get();
        if (!activeCheckin || !activeCheckin.checkInTimeMs || !user) return;

        const secureTimeMs = await getSecureServerTime();

        // Validar si dejaron la pausa activa antes de salir
        const updatedPauses = [...activeCheckin.pauses];
        if (updatedPauses.length > 0 && !updatedPauses[updatedPauses.length - 1].endMs) {
          updatedPauses[updatedPauses.length - 1].endMs = secureTimeMs;
        }

        // Calcular minutos efectivos
        let totalPauseMs = 0;
        updatedPauses.forEach(p => {
          if (p.endMs) totalPauseMs += (p.endMs - p.startMs);
        });

        const effectiveMs = (secureTimeMs - activeCheckin.checkInTimeMs) - totalPauseMs;
        const durationMinutes = Math.floor(effectiveMs / 60000);

        const updatedRecord: CheckinRecord = {
          ...activeCheckin,
          pauses: updatedPauses,
          checkOutTimeMs: secureTimeMs,
          totalDurationMinutes: durationMinutes
        };

        const updatedMockData = mockEmployeesData.map(emp => {
          if (emp.id === user.id) {
            return {
              ...emp,
              status: 'inactive' as const,
              workedMinutesToday: emp.workedMinutesToday + durationMinutes,
              history: emp.history.map(h => h.id === updatedRecord.id ? updatedRecord : h)
            };
          }
          return emp;
        });

        set({
          activeCheckin: null,
          history: history.map(r => r.id === updatedRecord.id ? updatedRecord : r),
          mockEmployeesData: updatedMockData
        });
      }
    }),
    {
      name: 'checkin-rb-storage',
      partialize: (state) => ({
        mockEmployeesData: state.mockEmployeesData,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        activeCheckin: state.activeCheckin,
        history: state.history,
        tasks: state.tasks
      }),
    }
  )
);
