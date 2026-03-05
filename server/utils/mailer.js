const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#1e1b4b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1b4b;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
              <!-- Header -->
              <tr>
                <td align="center" style="padding-bottom:30px;">
                  <span style="font-size:36px;">&#9889;</span>
                  <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:8px 0 0;">Quizonaire</h1>
                </td>
              </tr>
              <!-- Card -->
              <tr>
                <td style="background-color:#ffffff;border-radius:16px;padding:40px 32px;">
                  <h2 style="color:#111827;font-size:20px;font-weight:800;margin:0 0 12px;">Wachtwoord resetten</h2>
                  <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
                    Je hebt een verzoek ingediend om je wachtwoord te resetten. Klik op de knop hieronder om een nieuw wachtwoord in te stellen.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:8px 0 24px;">
                        <a href="${resetUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                          Wachtwoord resetten
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:0 0 8px;">
                    Deze link is <strong>1 uur</strong> geldig. Als je geen wachtwoord-reset hebt aangevraagd, kun je deze email negeren.
                  </p>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
                  <p style="color:#d1d5db;font-size:11px;margin:0;">
                    Werkt de knop niet? Kopieer deze link:<br>
                    <a href="${resetUrl}" style="color:#6366f1;word-break:break-all;">${resetUrl}</a>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding-top:24px;">
                  <p style="color:#6366f1;font-size:12px;margin:0;">Quizonaire &mdash; De leukste quiz-app!</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Quizonaire" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Wachtwoord resetten - Quizonaire',
    html,
  });
}

module.exports = { sendPasswordResetEmail };
