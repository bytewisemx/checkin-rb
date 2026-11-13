/**
 * Servicio de Integración con n8n Webhook para Despacho Automatizado de Correos
 * Russell Bedford Time & Checkin Suite
 */

export interface N8nInvitePayload {
  event: 'invite_created';
  recipientEmail: string;
  supervisorName: string;
  teamId?: string;
  teamName: string;
  roleName: string;
  activationUrl: string;
  expiresAt: string; // Formato ISO 8601
}

export interface N8nWebhookResponse {
  success: boolean;
  statusCode?: number;
  error?: string;
  simulated?: boolean;
}

export const DEFAULT_N8N_INVITE_WEBHOOK_URL =
  'https://n8n-n8n.bg5sbc.easypanel.host/webhook/checkin-invite';

/**
 * Obtiene la URL del Webhook configurada en las variables de entorno de Vite o del entorno.
 * Por defecto apunta al endpoint de n8n en Easypanel: https://n8n-n8n.bg5sbc.easypanel.host/webhook/checkin-invite
 */
export function getN8nInviteWebhookUrl(): string {
  const envUrl = (
    import.meta.env.VITE_N8N_INVITE_WEBHOOK_URL ||
    import.meta.env.VITE_N8N_WEBHOOK_URL ||
    ''
  ).trim();
  return envUrl || DEFAULT_N8N_INVITE_WEBHOOK_URL;
}

/**
 * Construye la URL de activación para el correo y registro (/activar-cuenta)
 */
export function buildActivationUrl(inviteToken: string, email?: string): string {
  const queryParams = new URLSearchParams({ token: inviteToken });
  if (email) {
    queryParams.set('email', email);
  }

  if (typeof window === 'undefined') {
    return `/activar-cuenta?${queryParams.toString()}`;
  }
  const origin = window.location.origin;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  return `${origin}${cleanBase}activar-cuenta?${queryParams.toString()}`;
}

/**
 * Envía el payload de la invitación al webhook de n8n mediante HTTP POST
 */
export async function dispatchInviteWebhook(
  payload: N8nInvitePayload
): Promise<N8nWebhookResponse> {
  const webhookUrl = getN8nInviteWebhookUrl();

  // Si no está configurada la URL del webhook en .env
  if (!webhookUrl) {
    console.info(
      '[N8N WEBHOOK] VITE_N8N_INVITE_WEBHOOK_URL no está configurada. La invitación fue creada localmente.'
    );
    return {
      success: false,
      error: 'NO_WEBHOOK_URL',
      simulated: true,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7 segundos timeout

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
      };
    } else {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        statusCode: response.status,
        error: `Error HTTP ${response.status}: ${errorText || response.statusText}`,
      };
    }
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al conectar con el servidor n8n (Timeout).',
      };
    }
    return {
      success: false,
      error: error.message || 'Error de red al intentar contactar el Webhook de n8n.',
    };
  }
}

/**
 * Alias estándar para despacho de webhooks de invitación
 */
export const sendInviteWebhook = dispatchInviteWebhook;
