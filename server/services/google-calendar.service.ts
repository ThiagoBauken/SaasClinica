import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db';
import { users, appointments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendees?: string[];
  location?: string;
}

/**
 * Serviço de integração com Google Calendar
 */
export class GoogleCalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: any;

  constructor(config: GoogleCalendarConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Gera URL de autorização OAuth
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Força refresh token
    });
  }

  /**
   * Troca código de autorização por tokens
   */
  async getTokensFromCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from authorization code');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date || 0,
    };
  }

  /**
   * Define tokens de acesso
   */
  setCredentials(accessToken: string, refreshToken: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  /**
   * Atualiza tokens se necessário
   */
  async refreshAccessToken(): Promise<{ accessToken: string; expiryDate: number }> {
    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    return {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date || 0,
    };
  }

  /**
   * Cria evento no Google Calendar
   */
  async createEvent(event: GoogleCalendarEvent, calendarId: string = 'primary'): Promise<string> {
    try {
      const googleEvent = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: event.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        attendees: event.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 dia antes
            { method: 'popup', minutes: 60 }, // 1 hora antes
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId,
        resource: googleEvent,
        sendUpdates: 'all', // Notifica todos os participantes
      });

      return response.data.id;
    } catch (error: any) {
      console.error('Error creating Google Calendar event:', error);
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  /**
   * Atualiza evento no Google Calendar
   */
  async updateEvent(
    eventId: string,
    event: Partial<GoogleCalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      const updateData: any = {};

      if (event.summary) {
        updateData.summary = event.summary;
      }

      if (event.description !== undefined) {
        updateData.description = event.description;
      }

      if (event.location !== undefined) {
        updateData.location = event.location;
      }

      if (event.startTime) {
        updateData.start = {
          dateTime: event.startTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }

      if (event.endTime) {
        updateData.end = {
          dateTime: event.endTime.toISOString(),
          timeZone: 'America/Sao_Paulo',
        };
      }

      if (event.attendees) {
        updateData.attendees = event.attendees.map(email => ({ email }));
      }

      await this.calendar.events.patch({
        calendarId,
        eventId,
        resource: updateData,
        sendUpdates: 'all',
      });
    } catch (error: any) {
      console.error('Error updating Google Calendar event:', error);
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  /**
   * Deleta evento do Google Calendar
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (error: any) {
      // Se evento já foi deletado, não é erro
      if (error.code === 410 || error.code === 404) {
        console.log('Event already deleted or not found');
        return;
      }

      console.error('Error deleting Google Calendar event:', error);
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  }

  /**
   * Busca evento do Google Calendar
   */
  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<any> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      return response.data;
    } catch (error: any) {
      console.error('Error getting Google Calendar event:', error);
      throw new Error(`Failed to get event: ${error.message}`);
    }
  }

  /**
   * Lista eventos do calendário
   */
  async listEvents(
    startDate: Date,
    endDate: Date,
    calendarId: string = 'primary'
  ): Promise<any[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error: any) {
      console.error('Error listing Google Calendar events:', error);
      throw new Error(`Failed to list events: ${error.message}`);
    }
  }

  /**
   * Configura webhook para receber notificações de mudanças
   */
  async setupWebhook(webhookUrl: string, calendarId: string = 'primary'): Promise<string> {
    try {
      const response = await this.calendar.events.watch({
        calendarId,
        resource: {
          id: `webhook-${Date.now()}`, // ID único para o canal
          type: 'web_hook',
          address: webhookUrl,
        },
      });

      return response.data.id; // Retorna channelId
    } catch (error: any) {
      console.error('Error setting up Google Calendar webhook:', error);
      throw new Error(`Failed to setup webhook: ${error.message}`);
    }
  }

  /**
   * Para de receber notificações de webhook
   */
  async stopWebhook(channelId: string, resourceId: string): Promise<void> {
    try {
      await this.calendar.channels.stop({
        resource: {
          id: channelId,
          resourceId: resourceId,
        },
      });
    } catch (error: any) {
      console.error('Error stopping Google Calendar webhook:', error);
      throw new Error(`Failed to stop webhook: ${error.message}`);
    }
  }
}

/**
 * Cria instância do GoogleCalendarService
 */
export function createGoogleCalendarService(
  accessToken: string,
  refreshToken: string
): GoogleCalendarService {
  const config: GoogleCalendarConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
  };

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Google Calendar credentials not configured');
  }

  const service = new GoogleCalendarService(config);
  service.setCredentials(accessToken, refreshToken);

  return service;
}

/**
 * Sincroniza agendamento com Google Calendar (criar)
 */
export async function syncAppointmentToGoogle(
  appointmentId: number,
  professionalId: number,
  companyId: number
): Promise<string | null> {
  try {
    // Buscar profissional e verificar se tem Google Calendar conectado
    const [professional] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, professionalId), eq(users.companyId, companyId)))
      .limit(1);

    if (!professional || !professional.googleCalendarId || !professional.googleAccessToken) {
      console.log('Professional does not have Google Calendar connected');
      return null;
    }

    // Buscar appointment (usando storage para obter dados enriquecidos)
    const { storage } = await import('../storage');
    const appointment = await storage.getAppointment(appointmentId, companyId);

    if (!appointment) {
      return null;
    }

    const service = createGoogleCalendarService(
      professional.googleAccessToken,
      professional.googleRefreshToken || ''
    );

    const eventId = await service.createEvent({
      summary: `${(appointment as any).patientName || 'Paciente'} - Consulta`,
      description: appointment.notes || '',
      startTime: new Date(appointment.startTime),
      endTime: new Date(appointment.endTime),
      location: 'Clínica Odontológica',
    });

    // Atualizar appointment com eventId
    await db
      .update(appointments)
      .set({ googleCalendarEventId: eventId })
      .where(eq(appointments.id, appointmentId));

    return eventId;
  } catch (error) {
    console.error('Error syncing appointment to Google Calendar:', error);
    return null;
  }
}

/**
 * Atualiza evento no Google Calendar
 */
export async function updateGoogleCalendarEvent(
  appointmentId: number,
  professionalId: number,
  companyId: number
): Promise<boolean> {
  try {
    // Buscar appointment com eventId (usando storage para obter dados enriquecidos)
    const { storage } = await import('../storage');
    const appointment = await storage.getAppointment(appointmentId, companyId);

    if (!appointment || !appointment.googleCalendarEventId) {
      // Se não tem eventId, criar novo evento
      if (appointment) {
        await syncAppointmentToGoogle(appointmentId, professionalId, companyId);
      }
      return false;
    }

    // Buscar profissional
    const [professional] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, professionalId), eq(users.companyId, companyId)))
      .limit(1);

    if (!professional || !professional.googleCalendarId || !professional.googleAccessToken) {
      return false;
    }

    const service = createGoogleCalendarService(
      professional.googleAccessToken,
      professional.googleRefreshToken || ''
    );

    await service.updateEvent(appointment.googleCalendarEventId, {
      summary: `${(appointment as any).patientName || 'Paciente'} - Consulta`,
      description: appointment.notes || '',
      startTime: new Date(appointment.startTime),
      endTime: new Date(appointment.endTime),
    });

    return true;
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    return false;
  }
}

/**
 * Deleta evento do Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  eventId: string,
  professionalId: number,
  companyId: number
): Promise<boolean> {
  try {
    // Buscar profissional
    const [professional] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, professionalId), eq(users.companyId, companyId)))
      .limit(1);

    if (!professional || !professional.googleCalendarId || !professional.googleAccessToken) {
      return false;
    }

    const service = createGoogleCalendarService(
      professional.googleAccessToken,
      professional.googleRefreshToken || ''
    );

    await service.deleteEvent(eventId);
    return true;
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    return false;
  }
}
