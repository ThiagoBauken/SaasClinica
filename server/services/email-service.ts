import * as nodemailer from 'nodemailer';

// Função para criar transporter sob demanda (lazy loading)
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outros
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@dentalsystem.com',
      to,
      subject,
      html,
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, data: info };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

// Email Templates

export function getTrialEndingSoonTemplate(companyName: string, daysLeft: number, planName: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Seu período de teste está acabando</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">⏰ Seu período de teste está acabando</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Olá,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Seu período de teste de <strong>${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}</strong> no plano <strong>${planName}</strong> está chegando ao fim.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Não se preocupe! Você não precisa fazer nada. Sua assinatura será automaticamente ativada e cobrada no método de pagamento cadastrado.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.BASE_URL}/billing" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Gerenciar Assinatura
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Se você deseja cancelar sua assinatura ou alterar o método de pagamento, pode fazer isso a qualquer momento no painel de controle.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
                © ${new Date().getFullYear()} DentalSystem. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getPaymentFailedTemplate(companyName: string, amount: number, planName: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Falha no pagamento</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">⚠️ Problema com o pagamento</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Olá,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Não conseguimos processar o pagamento de <strong>R$ ${amount.toFixed(2)}</strong> para sua assinatura do plano <strong>${planName}</strong>.
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Isso pode ter acontecido por diversos motivos:
              </p>
              <ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 16px; line-height: 1.5; color: #333333;">
                <li>Saldo insuficiente</li>
                <li>Cartão expirado</li>
                <li>Limite excedido</li>
              </ul>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.BASE_URL}/billing" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Atualizar Método de Pagamento
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Por favor, atualize seu método de pagamento o mais rápido possível para evitar a interrupção do serviço.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #dc3545; background-color: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
                <strong>Atenção:</strong> Sua conta será suspensa em 7 dias se o pagamento não for processado.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
                © ${new Date().getFullYear()} DentalSystem. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getInvoicePaidTemplate(companyName: string, amount: number, invoiceNumber: string, invoiceUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento confirmado</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">✅ Pagamento Confirmado!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Olá,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Recebemos o pagamento de <strong>R$ ${amount.toFixed(2)}</strong> referente à sua assinatura.
              </p>

              <!-- Invoice Box -->
              <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6c757d;">Número da Fatura:</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #333333; text-align: right; font-weight: bold;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6c757d;">Valor Pago:</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #333333; text-align: right; font-weight: bold;">R$ ${amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; font-size: 14px; color: #6c757d;">Data:</td>
                    <td style="padding: 10px 0; font-size: 14px; color: #333333; text-align: right; font-weight: bold;">${new Date().toLocaleDateString('pt-BR')}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invoiceUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Baixar Fatura (PDF)
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Obrigado por continuar conosco! Se tiver alguma dúvida, não hesite em entrar em contato.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
                © ${new Date().getFullYear()} DentalSystem. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getWelcomeTemplate(companyName: string, planName: string, trialDays: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao DentalSystem!</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px;">🎉 Bem-vindo ao DentalSystem!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Olá, <strong>${companyName}</strong>!
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                É com grande prazer que damos as boas-vindas ao DentalSystem! Você iniciou seu período de teste de <strong>${trialDays} dias</strong> no plano <strong>${planName}</strong>.
              </p>

              <!-- Features Box -->
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">O que você pode fazer:</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #555555;">
                  <li>Gerenciar agendamentos de pacientes</li>
                  <li>Controlar financeiro da clínica</li>
                  <li>Automatizar envios de mensagens</li>
                  <li>Controlar estoque e próteses</li>
                  <li>Digitalizar prontuários</li>
                  <li>E muito mais!</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.BASE_URL}/dashboard" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Acessar Meu Painel
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Durante o período de teste, você terá acesso completo a todos os recursos. Aproveite ao máximo!
              </p>

              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #28a745; background-color: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
                <strong>Dica:</strong> Precisa de ajuda? Nossa equipe de suporte está disponível para você. Basta responder este email!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
                © ${new Date().getFullYear()} DentalSystem. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getPlanChangedTemplate(companyName: string, oldPlanName: string, newPlanName: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plano alterado</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🔄 Plano Alterado com Sucesso!</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Olá,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Sua alteração de plano foi processada com sucesso!
              </p>

              <!-- Plan Change Box -->
              <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 25px; margin: 20px 0; text-align: center;">
                <div style="font-size: 18px; color: #6c757d; margin-bottom: 10px;">
                  <s>${oldPlanName}</s>
                </div>
                <div style="font-size: 32px; margin: 15px 0;">⬇️</div>
                <div style="font-size: 24px; color: #28a745; font-weight: bold;">
                  ${newPlanName}
                </div>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.BASE_URL}/billing" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Ver Detalhes da Assinatura
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #333333;">
                Agora você tem acesso a todos os recursos do plano <strong>${newPlanName}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #e9ecef;">
              <p style="margin: 0; font-size: 14px; color: #6c757d; text-align: center;">
                © ${new Date().getFullYear()} DentalSystem. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
