import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useAuditStore, type AuditEventType } from '../store/useAuditStore';
import { trackFirestoreWrite } from './firestoreTelemetry';

export interface SystemMovementData {
  eventType: AuditEventType | string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  targetResource: string;
  targetUserId?: string;
  targetUserName?: string;
  format?: 'PDF' | 'Excel';
  details: string;
  previousValue?: string | number;
  newValue?: string | number;
  metadata?: Record<string, any>;
}

/**
 * Servicio Centralizado para Registrar Movimientos en Firestore (audit_logs) y Zustand
 */
export async function logSystemMovement(eventData: SystemMovementData): Promise<{ success: boolean; id?: string }> {
  // 1. Actualizar el store de Zustand para reflejo visual inmediato en UI
  try {
    useAuditStore.getState().logAuditEvent({
      eventType: eventData.eventType as AuditEventType,
      actorId: eventData.actorId,
      actorName: eventData.actorName,
      actorEmail: eventData.actorEmail,
      actorRole: eventData.actorRole,
      targetResource: eventData.targetResource,
      targetUserId: eventData.targetUserId,
      targetUserName: eventData.targetUserName,
      format: eventData.format,
      details: eventData.details,
      previousValue: eventData.previousValue,
      newValue: eventData.newValue,
    });
  } catch (err) {
    console.warn('[auditLogger] Error al actualizar store local:', err);
  }

  // 2. Persistir permanentemente en Firestore collection `audit_logs`
  if (!isFirebaseConfigured() || !db) {
    return { success: true };
  }

  try {
    const payload = {
      eventType: eventData.eventType,
      actorId: eventData.actorId,
      actorName: eventData.actorName,
      actorEmail: eventData.actorEmail,
      actorRole: eventData.actorRole,
      targetResource: eventData.targetResource,
      targetUserId: eventData.targetUserId || null,
      targetUserName: eventData.targetUserName || null,
      format: eventData.format || null,
      details: eventData.details,
      previousValue: eventData.previousValue !== undefined ? String(eventData.previousValue) : null,
      newValue: eventData.newValue !== undefined ? String(eventData.newValue) : null,
      metadata: eventData.metadata || {},
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), payload);
    trackFirestoreWrite(1);
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('[auditLogger] Error al escribir en audit_logs de Firestore:', err);
    return { success: false };
  }
}
