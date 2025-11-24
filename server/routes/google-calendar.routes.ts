import { Router } from 'express';
import { authCheck, asyncHandler } from '../middleware/auth';
import { GoogleCalendarService, createGoogleCalendarService } from '../services/google-calendar.service';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/v1/google/auth
 * Inicia fluxo OAuth do Google Calendar
 */
router.get(
  '/auth',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
    };

    if (!config.clientId || !config.clientSecret) {
      return res.status(500).json({ error: 'Google Calendar not configured' });
    }

    const service = new GoogleCalendarService(config);
    const authUrl = service.getAuthUrl();

    // Armazenar userId em sessão para recuperar no callback
    req.session.userId = user.id;

    res.json({
      authUrl,
      message: 'Redirect user to this URL to authorize Google Calendar access',
    });
  })
);

/**
 * GET /api/v1/google/callback
 * Callback OAuth do Google
 */
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, error } = req.query as any;

    if (error) {
      return res.status(400).json({ error: `OAuth error: ${error}` });
    }

    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Session expired. Please try again.' });
    }

    try {
      const config = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
      };

      const service = new GoogleCalendarService(config);
      const tokens = await service.getTokensFromCode(code);

      // Armazenar tokens de forma segura no banco de dados
      await db
        .update(users)
        .set({
          googleAccessToken: tokens.accessToken,
          googleRefreshToken: tokens.refreshToken,
          googleTokenExpiry: new Date(tokens.expiryDate),
          googleCalendarId: 'primary',
        })
        .where(eq(users.id, userId));

      console.log('Google Calendar connected successfully for user:', userId);

      // Redirecionar para página de sucesso
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Calendar Connected</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background: #f0f0f0;
              }
              .container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
              }
              .success {
                color: #22c55e;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 {
                color: #333;
                margin-bottom: 10px;
              }
              p {
                color: #666;
                margin-bottom: 20px;
              }
              button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
              }
              button:hover {
                background: #2563eb;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✓</div>
              <h1>Google Calendar Conectado!</h1>
              <p>Seus agendamentos agora serão sincronizados automaticamente.</p>
              <button onclick="window.close()">Fechar</button>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Error in Google OAuth callback:', error);
      res.status(500).json({ error: error.message });
    }
  })
);

/**
 * POST /api/v1/google/disconnect
 * Desconecta Google Calendar
 */
router.post(
  '/disconnect',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Remover tokens do banco de dados
    await db
      .update(users)
      .set({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        googleCalendarId: null,
      })
      .where(eq(users.id, user.id));

    res.json({
      success: true,
      message: 'Google Calendar disconnected',
    });
  })
);

/**
 * GET /api/v1/google/status
 * Verifica status da conexão com Google Calendar
 */
router.get(
  '/status',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const connected = !!userData?.googleCalendarId;

    res.json({
      connected,
      calendarId: userData?.googleCalendarId || null,
      message: connected
        ? 'Google Calendar is connected'
        : 'Google Calendar is not connected',
    });
  })
);

/**
 * POST /api/v1/google/sync-appointment/:id
 * Sincroniza agendamento específico manualmente
 */
router.post(
  '/sync-appointment/:id',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;
    const { id } = req.params;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verificar se usuário tem Google Calendar conectado
    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData?.googleAccessToken || !userData?.googleRefreshToken) {
      return res.json({
        success: false,
        message: 'Google Calendar not connected. Please connect first.',
        appointmentId: parseInt(id),
      });
    }

    try {
      const config = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
      };

      const service = new GoogleCalendarService(config);
      service.setCredentials(userData.googleAccessToken, userData.googleRefreshToken);

      // Buscar agendamento
      const { storage } = await import('../storage');
      const appointment = await storage.getAppointment(parseInt(id), user.companyId);

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Criar/atualizar evento no Google Calendar
      const event = {
        summary: `${appointment.patientName} - ${appointment.procedureName || 'Consulta'}`,
        description: appointment.notes || '',
        start: {
          dateTime: appointment.startTime,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: appointment.endTime,
          timeZone: 'America/Sao_Paulo',
        },
      };

      let eventId;
      if (appointment.googleCalendarEventId) {
        // Atualizar evento existente
        await service.updateEvent(appointment.googleCalendarEventId, event);
        eventId = appointment.googleCalendarEventId;
      } else {
        // Criar novo evento
        eventId = await service.createEvent(event);

        // Salvar event ID no agendamento
        await storage.updateAppointment(parseInt(id), {
          googleCalendarEventId: eventId,
        }, user.companyId);
      }

      res.json({
        success: true,
        message: 'Appointment synced to Google Calendar',
        appointmentId: parseInt(id),
        eventId,
      });
    } catch (error: any) {
      console.error('Error syncing appointment to Google Calendar:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        appointmentId: parseInt(id),
      });
    }
  })
);

/**
 * POST /api/v1/google/test-connection
 * Testa conexão com Google Calendar
 */
router.post(
  '/test-connection',
  authCheck,
  asyncHandler(async (req, res) => {
    const user = req.user as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userData?.googleCalendarId || !userData?.googleAccessToken) {
      return res.json({
        connected: false,
        message: 'Google Calendar not connected',
      });
    }

    // Testar conexão real com Google Calendar
    try {
      const config = {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/v1/google/callback',
      };

      const service = new GoogleCalendarService(config);
      service.setCredentials(userData.googleAccessToken, userData.googleRefreshToken || '');

      // Tentar listar eventos dos próximos 7 dias
      const events = await service.listEvents(
        new Date(),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      res.json({
        connected: true,
        message: 'Connection successful',
        eventsCount: events.length,
      });
    } catch (error: any) {
      console.error('Google Calendar connection test failed:', error);
      res.json({
        connected: false,
        message: `Connection failed: ${error.message}`,
      });
    }
  })
);

export default router;
