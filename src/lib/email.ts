import { Resend } from 'resend';

// Email désactivé tant que RESEND_API_KEY n'est pas configuré — ne bloque jamais l'appelant
// (inscription, invitation, etc. doivent réussir même sans service email branché).
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@artisastock.be';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<EmailResult> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY non configuré — email "${params.subject}" à ${params.to} non envoyé`);
    return { success: false, error: 'EMAIL_NOT_CONFIGURED' };
  }
  const { error } = await resend.emails.send({ from: FROM, ...params });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface EmailResult {
  success: boolean;
  error?: string;
}

// ─── Templates ──────────────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #FFF8F0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; border: 1px solid #f0e0d0; }
        .logo { color: #8B4513; font-size: 24px; font-weight: bold; margin-bottom: 24px; }
        .btn { display: inline-block; background: #8B4513; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
        .footer { color: #888; font-size: 12px; margin-top: 32px; border-top: 1px solid #f0e0d0; padding-top: 16px; }
        h1 { color: #2D1810; font-size: 22px; }
        p { color: #4a4a4a; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🥐 ArtisaStock</div>
        ${content}
        <div class="footer">
          <p>Cet email a été envoyé automatiquement. Ne pas répondre.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─── Email functions ─────────────────────────────────────────────────────────

export async function sendVerificationEmail(params: {
  to: string;
  firstName: string;
  token: string;
}): Promise<EmailResult> {
  const link = `${APP_URL}/auth/verify-email?token=${params.token}`;

  return sendEmail({
    to: params.to,
    subject: 'Vérifiez votre adresse email — ArtisaStock',
    html: emailWrapper(`
      <h1>Bienvenue, ${params.firstName} !</h1>
      <p>Merci de vous être inscrit sur ArtisaStock. Pour activer votre compte, cliquez sur le bouton ci-dessous :</p>
      <a href="${link}" class="btn">Vérifier mon email</a>
      <p>Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `),
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  firstName: string;
  token: string;
}): Promise<EmailResult> {
  const link = `${APP_URL}/auth/reset-password?token=${params.token}`;

  return sendEmail({
    to: params.to,
    subject: 'Réinitialisation de votre mot de passe — ArtisaStock',
    html: emailWrapper(`
      <h1>Réinitialisation du mot de passe</h1>
      <p>Bonjour ${params.firstName},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous :</p>
      <a href="${link}" class="btn">Réinitialiser mon mot de passe</a>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `),
  });
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  trackingToken: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalTTC: number;
  pickupDate: string;
  pickupSlot: string;
  tenantSlug: string;
  tenantName: string;
}): Promise<EmailResult> {
  const trackingUrl = `${APP_URL}/storefront/${params.tenantSlug}/order/${params.trackingToken}`;

  const itemsHtml = params.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0e0d0;">${item.name}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0e0d0; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #f0e0d0; text-align: right;">${(item.unitPrice * item.quantity).toFixed(2)} €</td>
        </tr>`
    )
    .join('');

  return sendEmail({
    to: params.to,
    subject: `Commande confirmée — ${params.orderNumber} — ${params.tenantName}`,
    html: emailWrapper(`
      <h1>Votre commande est confirmée !</h1>
      <p>Bonjour ${params.firstName},</p>
      <p>Merci pour votre commande chez <strong>${params.tenantName}</strong>.</p>
      <p><strong>N° commande :</strong> ${params.orderNumber}<br>
      <strong>Retrait le :</strong> ${params.pickupDate} de ${params.pickupSlot}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 0; border-bottom: 2px solid #8B4513;">Produit</th>
            <th style="text-align: center; padding: 8px 0; border-bottom: 2px solid #8B4513;">Qté</th>
            <th style="text-align: right; padding: 8px 0; border-bottom: 2px solid #8B4513;">Montant</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding: 12px 0; font-weight: bold;">Total TTC</td>
            <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #8B4513;">${params.totalTTC.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
      <a href="${trackingUrl}" class="btn">Suivre ma commande</a>
    `),
  });
}

export async function sendOrderReadyEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  tenantName: string;
  tenantAddress: string;
}): Promise<EmailResult> {
  return sendEmail({
    to: params.to,
    subject: `Votre commande est prête ! — ${params.orderNumber}`,
    html: emailWrapper(`
      <h1>Votre commande est prête !</h1>
      <p>Bonjour ${params.firstName},</p>
      <p>Votre commande <strong>${params.orderNumber}</strong> chez <strong>${params.tenantName}</strong> est prête à être retirée.</p>
      <p>📍 Rendez-vous à : <strong>${params.tenantAddress}</strong></p>
      <p>Présentez simplement votre numéro de commande lors du retrait.</p>
    `),
  });
}

export async function sendStockAlertEmail(params: {
  to: string;
  ingredients: Array<{ name: string; stock: number; alertThreshold: number; unit: string }>;
  tenantName: string;
}): Promise<EmailResult> {
  const ingredientRows = params.ingredients
    .map(
      (i) =>
        `<tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #f0e0d0;">${i.name}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #f0e0d0; text-align: center; color: #e53e3e; font-weight: bold;">${i.stock} ${i.unit}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #f0e0d0; text-align: center;">${i.alertThreshold} ${i.unit}</td>
        </tr>`
    )
    .join('');

  return sendEmail({
    to: params.to,
    subject: `⚠️ Alerte stock — ${params.ingredients.length} ingrédient(s) sous le seuil`,
    html: emailWrapper(`
      <h1>⚠️ Alerte stock bas</h1>
      <p>Les ingrédients suivants sont sous le seuil d'alerte chez <strong>${params.tenantName}</strong> :</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 0; border-bottom: 2px solid #8B4513;">Ingrédient</th>
            <th style="text-align: center; padding: 8px 0; border-bottom: 2px solid #8B4513;">Stock actuel</th>
            <th style="text-align: center; padding: 8px 0; border-bottom: 2px solid #8B4513;">Seuil d'alerte</th>
          </tr>
        </thead>
        <tbody>${ingredientRows}</tbody>
      </table>
      <p>Pensez à réapprovisionner vos stocks !</p>
    `),
  });
}

export async function sendEmployeeInviteEmail(params: {
  to: string;
  inviterName: string;
  tenantName: string;
  token: string;
}): Promise<EmailResult> {
  const link = `${APP_URL}/auth/accept-invite/${params.token}`;

  return sendEmail({
    to: params.to,
    subject: `Invitation à rejoindre ${params.tenantName} sur ArtisaStock`,
    html: emailWrapper(`
      <h1>Vous êtes invité !</h1>
      <p><strong>${params.inviterName}</strong> vous invite à rejoindre <strong>${params.tenantName}</strong> sur ArtisaStock.</p>
      <a href="${link}" class="btn">Accepter l'invitation</a>
      <p>Ce lien expire dans 7 jours.</p>
    `),
  });
}
