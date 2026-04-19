// api/notify-booking.js
// Deploy this on Vercel (or Netlify) as a serverless function.
// This endpoint receives a webhook from Supabase on every new booking
// and sends a notification email via Resend.

const RESEND_API_KEY = 're_Dgpj47mD_PPXh2QnFiU7cnSWXdCAzbdAB';
const NOTIFY_TO = 'primeflowautomacao@gmail.com';
const FROM_EMAIL = 'onboarding@resend.dev';

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Verify Supabase webhook secret header
  // const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  // if (req.headers['x-webhook-secret'] !== webhookSecret) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    const payload = req.body;
    // Supabase webhook sends: { type, table, record, old_record, schema }
    const record = payload.record || payload;

    const {
      name = '—',
      company = '—',
      email = '—',
      phone = '—',
      preferred_date = '—',
      preferred_time = '—',
      message = '—',
      created_at
    } = record;

    const formattedDate = preferred_date !== '—'
      ? new Date(preferred_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—';

    const formattedCreatedAt = created_at
      ? new Date(created_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })
      : new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' });

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo Agendamento — PrimeFlow</title>
</head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#f0f4ff;letter-spacing:-0.5px;">
                    Prime<span style="color:#38bdf8;">Flow</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0d1528;border:1px solid rgba(56,189,248,0.15);border-radius:16px;overflow:hidden;">

              <!-- Card Header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#1e5fcc,#38bdf8);padding:24px 32px;">
                    <p style="margin:0;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);">Novo pedido recebido</p>
                    <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Agendamento de Reuniao</h1>
                  </td>
                </tr>
              </table>

              <!-- Card Body -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px;">
                <tr>
                  <td>

                    <!-- Fields -->
                    ${buildField('Nome', name)}
                    ${buildField('Empresa', company)}
                    ${buildField('Email', `<a href="mailto:${email}" style="color:#38bdf8;text-decoration:none;">${email}</a>`)}
                    ${buildField('Telefone', phone)}
                    ${buildField('Data preferida', formattedDate)}
                    ${buildField('Hora', preferred_time)}
                    ${message && message !== '—' ? buildField('Mensagem', message, true) : ''}

                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                      <tr><td style="border-top:1px solid rgba(240,244,255,0.06);"></td></tr>
                    </table>

                    <!-- CTA -->
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background:linear-gradient(135deg,#1e5fcc,#38bdf8);border-radius:8px;">
                          <a href="mailto:${email}?subject=Confirma%C3%A7%C3%A3o%20de%20Reuni%C3%A3o%20%E2%80%94%20PrimeFlow"
                             style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.04em;">
                            Responder ao Cliente
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:11px;color:rgba(240,244,255,0.2);letter-spacing:0.04em;">
                Recebido em ${formattedCreatedAt} &nbsp;·&nbsp; PrimeFlow Automacao
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [NOTIFY_TO],
        subject: `Novo Agendamento — ${name}${company && company !== '—' ? ` (${company})` : ''} — ${formattedDate}`,
        html: emailHtml,
        // Optional: confirmation email to the client
        // reply_to: email
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error('Resend error:', resendData);
      return res.status(500).json({ error: 'Failed to send email', details: resendData });
    }

    // Also send a confirmation email to the client
    await sendConfirmationToClient({ name, email, formattedDate, preferred_time });

    return res.status(200).json({ success: true, id: resendData.id });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ─── Helper: build email field row ───
function buildField(label, value, isLong = false) {
  if (!value || value === '—') return '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="width:130px;vertical-align:top;padding-right:16px;">
          <p style="margin:0;font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:rgba(240,244,255,0.35);">${label}</p>
        </td>
        <td style="vertical-align:top;">
          <p style="margin:0;font-size:${isLong ? '13px' : '14px'};color:#f0f4ff;line-height:1.6;">${value}</p>
        </td>
      </tr>
    </table>`;
}

// ─── Confirmation email to client ───
async function sendConfirmationToClient({ name, email, formattedDate, preferred_time }) {
  const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding-bottom:28px;" align="center">
              <p style="margin:0;font-size:22px;font-weight:700;color:#f0f4ff;">Prime<span style="color:#38bdf8;">Flow</span></p>
            </td>
          </tr>
          <tr>
            <td style="background:#0d1528;border:1px solid rgba(56,189,248,0.15);border-radius:16px;padding:36px 32px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#38bdf8;">Pedido recebido</p>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#f0f4ff;letter-spacing:-0.5px;">Obrigado, ${name}.</h1>
              <p style="margin:0 0 20px;font-size:14px;color:rgba(240,244,255,0.65);line-height:1.7;">
                Recebemos o seu pedido de reuniao para <strong style="color:#f0f4ff;">${formattedDate}</strong> as <strong style="color:#f0f4ff;">${preferred_time}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:rgba(240,244,255,0.65);line-height:1.7;">
                A nossa equipa entrara em contacto em breve para confirmar a disponibilidade e enviar os detalhes de acesso.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#1e5fcc,#38bdf8);border-radius:8px;">
                    <a href="https://primeflow.pt" style="display:inline-block;padding:12px 24px;font-size:13px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:0.04em;">
                      Visitar o site
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;" align="center">
              <p style="margin:0;font-size:11px;color:rgba(240,244,255,0.18);">PrimeFlow Automacao &nbsp;·&nbsp; Este e um email automatico</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: 'Pedido de reuniao recebido — PrimeFlow',
        html
      })
    });
  } catch(e) {
    console.error('Confirmation email error:', e);
  }
}
