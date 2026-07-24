import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { VatBreakdownLine } from '@/lib/utils/vat';

interface InvoiceItem {
  quantity: number;
  unitPrice: unknown;
  totalHT: unknown;
  totalTTC: unknown;
  vatRatePercent: unknown;
  product: { name: string };
}

interface InvoiceData {
  invoice: {
    invoiceNumber: string;
    issuedAt: Date | null;
    order: {
      orderNumber: string;
      pickupDate: Date | null;
      customer: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
      };
      items: InvoiceItem[];
      totalHT: unknown;
      totalTVA: unknown;
      totalTTC: unknown;
    };
    tenant: {
      name: string;
      email: string | null;
      phone: string | null;
      address: unknown;
      vatNumber: string | null;
    };
  };
  vatBreakdown: VatBreakdownLine[];
}

/**
 * Génère un PDF de facture en mémoire (Buffer).
 * Utilise une génération HTML → Buffer simple via une bibliothèque légère.
 * En production, remplacer par Puppeteer, WeasyPrint ou pdfmake selon les besoins.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const { invoice, vatBreakdown } = data;
  const order = invoice.order;
  const customer = order.customer;
  const tenant = invoice.tenant;
  const address = tenant.address as Record<string, string> | null;

  const issuedDate = invoice.issuedAt ? format(invoice.issuedAt, 'dd/MM/yyyy', { locale: fr }) : format(new Date(), 'dd/MM/yyyy', { locale: fr });
  const pickupDate = order.pickupDate ? format(order.pickupDate, 'dd/MM/yyyy', { locale: fr }) : '—';

  const itemRows = order.items.map((item) => `
    <tr>
      <td>${item.product.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${Number(item.unitPrice).toFixed(2)} €</td>
      <td style="text-align:right">${Number(item.vatRatePercent)}%</td>
      <td style="text-align:right">${Number(item.totalHT).toFixed(2)} €</td>
      <td style="text-align:right">${Number(item.totalTTC).toFixed(2)} €</td>
    </tr>
  `).join('');

  const vatRows = vatBreakdown.map((line) => `
    <tr>
      <td>TVA ${line.rate}</td>
      <td style="text-align:right">${line.base.toFixed(2)} €</td>
      <td style="text-align:right">${line.amount.toFixed(2)} €</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 40px; }
  h1 { font-size: 24px; color: #b45309; }
  h2 { font-size: 14px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th { background: #f5f5f5; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  .total-row { font-weight: bold; background: #fefce8; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
  .meta { margin-bottom: 24px; }
  .footer { margin-top: 40px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${tenant.name}</h1>
      ${address ? `<p>${address.street ?? ''}<br>${address.postalCode ?? ''} ${address.city ?? ''}</p>` : ''}
      ${tenant.email ? `<p>${tenant.email}</p>` : ''}
      ${tenant.phone ? `<p>${tenant.phone}</p>` : ''}
      ${tenant.vatNumber ? `<p>TVA : ${tenant.vatNumber}</p>` : ''}
    </div>
    <div style="text-align:right">
      <h2>FACTURE</h2>
      <p><strong>${invoice.invoiceNumber}</strong></p>
      <p>Date : ${issuedDate}</p>
      <p>Commande : ${order.orderNumber}</p>
      <p>Retrait : ${pickupDate}</p>
    </div>
  </div>

  <div class="meta">
    <h2>Client</h2>
    <p>${customer.firstName} ${customer.lastName}<br>
    ${customer.email}
    ${customer.phone ? `<br>${customer.phone}` : ''}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th style="text-align:center">Qté</th>
        <th style="text-align:right">Prix unit. TTC</th>
        <th style="text-align:right">TVA</th>
        <th style="text-align:right">Total HT</th>
        <th style="text-align:right">Total TTC</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table style="width:300px;margin-left:auto;margin-top:24px">
    <tbody>
      ${vatRows}
      <tr>
        <td>Total HT</td>
        <td style="text-align:right">${Number(order.totalHT).toFixed(2)} €</td>
      </tr>
      <tr>
        <td>Total TVA</td>
        <td style="text-align:right">${Number(order.totalTVA).toFixed(2)} €</td>
      </tr>
      <tr class="total-row">
        <td>Total TTC</td>
        <td style="text-align:right">${Number(order.totalTTC).toFixed(2)} €</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>Facture générée par ArtisaStock — ${tenant.name}</p>
  </div>
</body>
</html>`;

  // Retourner le HTML en tant que buffer UTF-8
  // En production, utiliser Puppeteer/Chromium pour générer un vrai PDF
  // Ex: const browser = await puppeteer.launch(); const page = await browser.newPage(); ...
  return Buffer.from(html, 'utf-8');
}
