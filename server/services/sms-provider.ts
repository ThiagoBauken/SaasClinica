import { logger } from '../logger';

const log = logger.child({ module: 'sms-provider' });

export interface SmsMessage {
  to: string; // Phone number with country code, e.g., +5511999991234
  body: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

/**
 * Normalize a raw phone string to E.164 format.
 *
 * Handles common Brazilian patterns:
 *   - 11 digits starting with 0  → strip leading 0, then prefix 55
 *   - 10 or 11 digits (local)    → prefix 55
 *   - Any string without leading + → add +
 */
function normalizePhone(raw: string): string {
  let phone = raw.replace(/\D/g, '');

  if (phone.length === 11 && phone.startsWith('0')) {
    phone = phone.slice(1);
  }

  if (phone.length === 10 || phone.length === 11) {
    phone = `55${phone}`;
  }

  if (!phone.startsWith('+')) {
    phone = `+${phone}`;
  }

  return phone;
}

/**
 * SMS Provider abstraction.
 *
 * Supports multiple Brazilian SMS providers:
 *   - Twilio  (international, reliable)
 *   - Zenvia  (Brazilian, cheaper for local traffic)
 *   - AWS SNS (scalable, requires proper Signature V4 in production)
 *
 * Falls back gracefully when credentials are not configured.
 * Select the active provider via the SMS_PROVIDER env var:
 *   SMS_PROVIDER=twilio | zenvia | sns | disabled (default)
 */
export async function sendSms(message: SmsMessage): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER || 'disabled';
  const phone = normalizePhone(message.to);

  switch (provider) {
    case 'twilio':
      return sendViaTwilio(phone, message.body);
    case 'zenvia':
      return sendViaZenvia(phone, message.body);
    case 'sns':
      return sendViaAwsSns(phone, message.body);
    default:
      log.warn(
        { to: phone },
        'SMS sending disabled — set SMS_PROVIDER env var (twilio|zenvia|sns)',
      );
      return { success: false, error: 'SMS provider not configured', provider: 'disabled' };
  }
}

// ---------------------------------------------------------------------------
// Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    log.warn('Twilio credentials not fully configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)');
    return { success: false, error: 'Twilio credentials not configured', provider: 'twilio' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body }).toString(),
      },
    );

    const data = await response.json() as Record<string, any>;

    if (response.ok) {
      log.info({ to, messageId: data.sid }, 'SMS sent via Twilio');
      return { success: true, messageId: data.sid, provider: 'twilio' };
    }

    log.error({ to, error: data.message }, 'Twilio SMS failed');
    return { success: false, error: String(data.message), provider: 'twilio' };
  } catch (err: any) {
    log.error({ err, to }, 'Twilio SMS error');
    return { success: false, error: err.message, provider: 'twilio' };
  }
}

// ---------------------------------------------------------------------------
// Zenvia
// ---------------------------------------------------------------------------

async function sendViaZenvia(to: string, body: string): Promise<SmsResult> {
  const apiToken = process.env.ZENVIA_API_TOKEN;
  const sender = process.env.ZENVIA_SENDER || 'clinica';

  if (!apiToken) {
    log.warn('Zenvia API token not configured (ZENVIA_API_TOKEN)');
    return { success: false, error: 'Zenvia credentials not configured', provider: 'zenvia' };
  }

  // Zenvia expects the number without the leading +
  const zenviaTo = to.replace('+', '');

  try {
    const response = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
      method: 'POST',
      headers: {
        'X-API-TOKEN': apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: zenviaTo,
        contents: [{ type: 'text', text: body }],
      }),
    });

    const data = await response.json() as Record<string, any>;

    if (response.ok) {
      log.info({ to, messageId: data.id }, 'SMS sent via Zenvia');
      return { success: true, messageId: data.id, provider: 'zenvia' };
    }

    const errDetail = JSON.stringify(data);
    log.error({ to, error: errDetail }, 'Zenvia SMS failed');
    return { success: false, error: errDetail, provider: 'zenvia' };
  } catch (err: any) {
    log.error({ err, to }, 'Zenvia SMS error');
    return { success: false, error: err.message, provider: 'zenvia' };
  }
}

// ---------------------------------------------------------------------------
// AWS SNS
// ---------------------------------------------------------------------------

/**
 * Sends an SMS via AWS SNS using a plain HTTP POST.
 *
 * IMPORTANT: This implementation omits AWS Signature V4 signing, which is
 * required for real requests.  In production, replace this function body with
 * the official @aws-sdk/client-sns package:
 *
 *   import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
 *   const client = new SNSClient({ region });
 *   await client.send(new PublishCommand({ PhoneNumber: to, Message: body,
 *     MessageAttributes: { 'AWS.SNS.SMS.SMSType': {
 *       DataType: 'String', StringValue: 'Transactional' } } }));
 *
 * The stub below keeps the package dependency optional during development.
 */
async function sendViaAwsSns(to: string, body: string): Promise<SmsResult> {
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKey || !secretKey) {
    log.warn('AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
    return { success: false, error: 'AWS credentials not configured', provider: 'sns' };
  }

  try {
    const params = new URLSearchParams({
      Action: 'Publish',
      PhoneNumber: to,
      Message: body,
      'MessageAttributes.entry.1.Name': 'AWS.SNS.SMS.SMSType',
      'MessageAttributes.entry.1.Value.DataType': 'String',
      'MessageAttributes.entry.1.Value.StringValue': 'Transactional',
      Version: '2010-03-31',
    });

    // NOTE: The request below will be rejected by AWS without proper
    // Signature V4 signing. Integrate @aws-sdk/client-sns for production use.
    const response = await fetch(`https://sns.${region}.amazonaws.com/?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.ok) {
      log.info({ to }, 'SMS sent via AWS SNS');
      return { success: true, provider: 'sns' };
    }

    const text = await response.text();
    log.error({ to, error: text }, 'AWS SNS SMS failed');
    return { success: false, error: text, provider: 'sns' };
  } catch (err: any) {
    log.error({ err, to }, 'AWS SNS SMS error');
    return { success: false, error: err.message, provider: 'sns' };
  }
}
