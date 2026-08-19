// ============================================================
// Labels voor keuzelijsten
// De titel bevat de klant- of merknaam vaak al ("Rituals — reel").
// Die dan niet nog een keer ervoor zetten.
// ============================================================

function combineer(voorvoegsel, titel) {
  if (!voorvoegsel) return titel;
  if (!titel) return voorvoegsel;
  return titel.toLowerCase().includes(voorvoegsel.toLowerCase())
    ? titel
    : `${voorvoegsel} — ${titel}`;
}

export function samenwerkingLabel(samenwerking) {
  return combineer(samenwerking.klant, samenwerking.titel);
}

export function briefingLabel(briefing) {
  return combineer(briefing.opdrachtgever, briefing.titel);
}
