const nodemailer = require('nodemailer');

// ============================================================
// Mailer
// Configuratie via .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).
// Zonder configuratie draait de app gewoon door: mails worden dan alleen
// gelogd en gemarkeerd als 'niet_geconfigureerd', zodat de flow in
// ontwikkeling volledig te testen is.
// ============================================================

let transporter = null;

function isGeconfigureerd() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

function getTransporter() {
  if (!isGeconfigureerd()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Verstuurt een e-mail. Gooit nooit: geeft altijd een status terug zodat de
 * aanroeper die op de factuur kan vastleggen.
 * @returns {Promise<{status: 'verzonden'|'mislukt'|'niet_geconfigureerd', fout?: string}>}
 */
async function verstuurMail({ naar, onderwerp, tekst, html, bijlagen }) {
  const t = getTransporter();

  if (!t) {
    console.log(`[mail] SMTP niet geconfigureerd — mail naar ${naar} niet verstuurd: "${onderwerp}"`);
    return { status: 'niet_geconfigureerd' };
  }

  try {
    await t.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
      to: naar,
      subject: onderwerp,
      text: tekst,
      html: html || undefined,
      attachments: bijlagen || undefined,
    });
    return { status: 'verzonden' };
  } catch (err) {
    console.error(`[mail] Versturen naar ${naar} mislukt:`, err.message);
    return { status: 'mislukt', fout: err.message };
  }
}

function formaatBedrag(bedrag, valuta = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: valuta }).format(bedrag || 0);
}

// ── Verkoopfactuur van de manager naar de klant ──────────────
function verkoopfactuurMail(factuur) {
  const onderwerp = `Factuur ${factuur.factuurnummer} — ${factuur.omschrijving}`;
  const tekst = [
    `Beste ${factuur.klant_contact || factuur.klant},`,
    '',
    `Hierbij ontvang je factuur ${factuur.factuurnummer} voor de samenwerking met ${factuur.influencer_naam || 'onze influencer'}.`,
    '',
    `Omschrijving : ${factuur.omschrijving}`,
    `Bedrag excl. : ${formaatBedrag(factuur.bedrag, factuur.valuta)}`,
    `BTW (${factuur.btw_percentage}%)  : ${formaatBedrag(factuur.btw_bedrag, factuur.valuta)}`,
    `Totaal       : ${formaatBedrag(factuur.totaal, factuur.valuta)}`,
    `Factuurdatum : ${factuur.factuurdatum}`,
    factuur.vervaldatum ? `Vervaldatum  : ${factuur.vervaldatum}` : null,
    '',
    'Met vriendelijke groet,',
    process.env.ORGANISATIE_NAAM || 'Scala Management',
  ].filter(v => v !== null).join('\n');

  return { onderwerp, tekst };
}

// ── Factuur van de influencer naar Scala Management ──────────
function influencerFactuurMail(factuur) {
  const onderwerp = `Factuur ${factuur.factuurnummer} — ${factuur.influencer_naam}`;
  const tekst = [
    `Beste ${factuur.ontvanger},`,
    '',
    `Hierbij de factuur van ${factuur.influencer_naam} voor de samenwerking "${factuur.samenwerking_titel || factuur.omschrijving}"${factuur.klant ? ` met ${factuur.klant}` : ''}.`,
    '',
    `Factuurnummer: ${factuur.factuurnummer}`,
    `Omschrijving : ${factuur.omschrijving}`,
    `Bedrag excl. : ${formaatBedrag(factuur.bedrag, factuur.valuta)}`,
    `BTW (${factuur.btw_percentage}%)  : ${formaatBedrag(factuur.btw_bedrag, factuur.valuta)}`,
    `Totaal       : ${formaatBedrag(factuur.totaal, factuur.valuta)}`,
    `Factuurdatum : ${factuur.factuurdatum}`,
    factuur.vervaldatum ? `Vervaldatum  : ${factuur.vervaldatum}` : null,
    factuur.aangemaakt_namens === 'pa' ? '\nDeze factuur is namens de influencer opgesteld door de PA.' : null,
    '',
    'Met vriendelijke groet,',
    factuur.influencer_naam,
  ].filter(v => v !== null).join('\n');

  return { onderwerp, tekst };
}

module.exports = {
  verstuurMail,
  isGeconfigureerd,
  verkoopfactuurMail,
  influencerFactuurMail,
  formaatBedrag,
};
