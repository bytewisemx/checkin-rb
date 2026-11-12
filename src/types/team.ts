export interface Team {
  id: string;
  name: string;
  code: string;
  leaderId: string;
  leaderName: string;
  leaderRole?: string;
  memberIds: string[];
  status: 'active' | 'inactive';
  description?: string;
  parentLeaderId?: string; // Para vincularlo a un Socio o Director si aplica
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string | null;
  status: 'active' | 'inactive' | 'pending';
}

