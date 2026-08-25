# Bouwt docs/whitepaper/PAI-whitepaper.pdf in de PA Atelier-huisstijl.
#
# Vereist: reportlab + Cormorant Garamond (OFL) als losse .ttf-bestanden.
# De fonts worden gezocht in de map die FONT_DIR aanwijst; download ze
# bijvoorbeeld via Google Fonts (familie "Cormorant Garamond") en bewaar ze
# als CG-Regular.ttf, CG-Medium.ttf, CG-SemiBold.ttf en CG-Italic.ttf.
#
#   FONT_DIR=/pad/naar/fonts python3 build_whitepaper.py

import os

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, NextPageTemplate, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.environ.get("FONT_DIR", os.path.join(HERE, "fonts"))
OUT = os.path.join(HERE, "PAI-whitepaper.pdf")

CHARCOAL = HexColor("#1B1B1A")
GOLD = HexColor("#9C7A3C")
BLUEGREY = HexColor("#5D7A93")
SAND = HexColor("#C9B79C")
PAPER = HexColor("#F6F1E9")
INK = HexColor("#2A2A28")

pdfmetrics.registerFont(TTFont("CG", os.path.join(FONT_DIR, "CG-Regular.ttf")))
pdfmetrics.registerFont(TTFont("CG-Md", os.path.join(FONT_DIR, "CG-Medium.ttf")))
pdfmetrics.registerFont(TTFont("CG-Sb", os.path.join(FONT_DIR, "CG-SemiBold.ttf")))
pdfmetrics.registerFont(TTFont("CG-It", os.path.join(FONT_DIR, "CG-Italic.ttf")))
pdfmetrics.registerFontFamily("CG", normal="CG", bold="CG-Sb", italic="CG-It",
                              boldItalic="CG-Sb")

W, H = A4
MARGIN = 72


def track(text, gap=" "):
    # Handmatige letterspacing voor kleine kapitaal-labels.
    return gap.join(text.upper()).replace(gap + " " + gap, gap + "  " + gap)


body = ParagraphStyle(
    "body", fontName="CG", fontSize=11.5, leading=17.5, textColor=INK,
    spaceAfter=9,
)
body_first = ParagraphStyle("body_first", parent=body, spaceBefore=4)
intro_it = ParagraphStyle(
    "intro_it", parent=body, fontName="CG-It", fontSize=12.5, leading=19,
    textColor=BLUEGREY, spaceAfter=14,
)
h_num = ParagraphStyle(
    "h_num", fontName="CG", fontSize=30, leading=30, textColor=GOLD,
    spaceBefore=18,
)
h_title = ParagraphStyle(
    "h_title", fontName="CG-Sb", fontSize=23, leading=27, textColor=CHARCOAL,
    spaceBefore=4, spaceAfter=12,
)
step_no = ParagraphStyle(
    "step_no", fontName="CG", fontSize=21, leading=24, textColor=GOLD,
)
step_title = ParagraphStyle(
    "step_title", fontName="CG-Sb", fontSize=13, leading=17, textColor=CHARCOAL,
    spaceAfter=2,
)
step_body = ParagraphStyle("step_body", parent=body, fontSize=11, leading=16,
                           spaceAfter=0)


def on_cover(canv, doc):
    canv.saveState()
    canv.setFillColor(CHARCOAL)
    canv.rect(0, 0, W, H, fill=1, stroke=0)

    canv.setFillColor(SAND)
    canv.setFont("CG-Md", 12)
    canv.drawCentredString(W / 2, H - 130, track("PA ATELIER"))

    canv.setFillColor(PAPER)
    canv.setFont("CG", 132)
    canv.drawCentredString(W / 2, H / 2 + 60, "PAI")

    canv.setStrokeColor(GOLD)
    canv.setLineWidth(0.8)
    canv.line(W / 2 - 60, H / 2 + 30, W / 2 + 60, H / 2 + 30)

    canv.setFillColor(SAND)
    canv.setFont("CG-It", 17)
    canv.drawCentredString(W / 2, H / 2 - 8, "Van briefing tot factuur.")
    canv.setFont("CG", 12.5)
    canv.setFillColor(HexColor("#B9A98D"))
    canv.drawCentredString(W / 2, H / 2 - 34,
                           "Alles wat er tussen een samenwerking en de betaling")
    canv.drawCentredString(W / 2, H / 2 - 52, "gebeurt, in één systeem.")

    canv.setFillColor(GOLD)
    canv.setFont("CG-Md", 10.5)
    canv.drawCentredString(W / 2, 110, track("WHITEPAPER"))
    canv.setFillColor(HexColor("#8A8478"))
    canv.setFont("CG", 10.5)
    canv.drawCentredString(W / 2, 90, "Augustus 2026")
    canv.restoreState()


def on_body(canv, doc):
    canv.saveState()
    canv.setFillColor(PAPER)
    canv.rect(0, 0, W, H, fill=1, stroke=0)

    canv.setFillColor(HexColor("#8A8478"))
    canv.setFont("CG-Md", 8.5)
    canv.drawString(MARGIN, H - 46, track("PAI — WHITEPAPER"))
    canv.drawRightString(W - MARGIN, H - 46, f"{doc.page:02d}")
    canv.setStrokeColor(GOLD)
    canv.setLineWidth(0.6)
    canv.line(MARGIN, H - 56, W - MARGIN, H - 56)

    canv.setFillColor(HexColor("#A79B85"))
    canv.setFont("CG", 8.5)
    canv.drawCentredString(W / 2, 42, "PA Atelier — personal assistance, curated.")
    canv.restoreState()


def on_closing(canv, doc):
    canv.saveState()
    canv.setFillColor(CHARCOAL)
    canv.rect(0, 0, W, H, fill=1, stroke=0)

    canv.setFillColor(SAND)
    canv.setFont("CG-Md", 10)
    canv.drawCentredString(W / 2, H - 120, track("TOT SLOT"))

    canv.setFillColor(PAPER)
    canv.setFont("CG", 21)
    canv.drawCentredString(W / 2, H - 210, "Er is geen gebrek aan tools.")
    canv.drawCentredString(W / 2, H - 240, "Er is een gebrek aan samenhang.")

    canv.setFillColor(HexColor("#C8BFAE"))
    canv.setFont("CG", 12.5)
    canv.drawCentredString(W / 2, H - 300,
                           "PAI brengt het hele traject — van briefing tot factuur —")
    canv.drawCentredString(W / 2, H - 320,
                           "terug naar één systeem, gebouwd vanuit de praktijk van het vak.")

    canv.setFont("CG-It", 15)
    canv.setFillColor(SAND)
    canv.drawCentredString(W / 2, H - 390,
                           "Achter iedere vrouw die schittert, zit een systeem dat klopt.")
    canv.drawCentredString(W / 2, H - 412, "Wij bouwen dat systeem.")

    canv.setStrokeColor(GOLD)
    canv.setLineWidth(0.8)
    canv.line(W / 2 - 60, H - 470, W / 2 + 60, H - 470)

    canv.setFillColor(GOLD)
    canv.setFont("CG-Md", 13)
    canv.drawCentredString(W / 2, H - 520, "Interesse? Neem contact met ons op.")

    canv.setFillColor(PAPER)
    canv.setFont("CG", 26)
    canv.drawCentredString(W / 2, 170, "PAI")
    canv.setFillColor(HexColor("#B9A98D"))
    canv.setFont("CG", 11)
    canv.drawCentredString(W / 2, 146,
                           "PA Atelier — personal assistance, curated. Voor wie zichtbaar is.")

    canv.setFillColor(HexColor("#7A7468"))
    canv.setFont("CG", 8.5)
    canv.drawCentredString(W / 2, 80,
                           "© 2026 PA Atelier. Dit document is vertrouwelijk en bedoeld "
                           "voor relaties van PA Atelier.")
    canv.restoreState()


def heading(num, title):
    return [Paragraph(num, h_num), Paragraph(title, h_title)]


def steps_table(steps):
    rows = []
    for i, (title, text) in enumerate(steps, 1):
        rows.append([
            Paragraph(f"{i:02d}", step_no),
            [Paragraph(title, step_title), Paragraph(text, step_body)],
        ])
    t = Table(rows, colWidths=[46, W - 2 * MARGIN - 46])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor("#DDD3C1")),
    ]))
    return t


doc = BaseDocTemplate(OUT, pagesize=A4, title="PAI — Whitepaper",
                      author="PA Atelier")
frame_cover = Frame(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN, id="c")
frame_body = Frame(MARGIN, 64, W - 2 * MARGIN, H - 64 - 80, id="b")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame_cover], onPage=on_cover),
    PageTemplate(id="body", frames=[frame_body], onPage=on_body),
    PageTemplate(id="closing", frames=[frame_cover], onPage=on_closing),
])

story = [Spacer(1, 1), NextPageTemplate("body"), PageBreak()]

story += heading("01", "Het onzichtbare werk")
story.append(Paragraph(
    "Achter iedere vrouw die schittert, zit een systeem dat klopt.", intro_it))
story.append(Paragraph(
    "Maar voor de meeste creators, personal assistants en managementbureaus "
    "bestaat dat systeem uit losse onderdelen: de agenda leeft in drie "
    "verschillende apps, sponsor-mails worden om 23:00 beantwoord en de "
    "briefing van een samenwerking staat verspreid over een PDF, een "
    "mailwisseling en een spraakmemo.", body_first))
story.append(Paragraph(
    "Tussen het moment dat een samenwerking binnenkomt en het moment dat de "
    "factuur betaald is, zitten tientallen kleine handelingen: deadlines "
    "overtypen, herinneringen zetten, content afstemmen, feedbackrondes "
    "bijhouden, bedragen terugzoeken, facturen opstellen. Elk van die "
    "handelingen is klein. Samen zijn ze een dagtaak — en elke overdracht "
    "tussen tools is een kans op fouten.", body))
story.append(Paragraph(
    "Dat werk is onzichtbaar zolang het goed gaat, en pijnlijk zichtbaar "
    "zodra er iets tussendoor glipt: een gemiste deadline, een vergeten "
    "deliverable, een factuur die drie weken te laat de deur uit gaat.", body))

story += heading("02", "De oplossing: PAI")
story.append(Paragraph(
    "PAI is de app van PA Atelier die dit hele traject in één systeem "
    "onderbrengt. Niet als zoveelste tool naast de bestaande stapel, maar "
    "als de plek waar het leven van een creator samenkomt: van briefing "
    "tot factuur.", body_first))
story.append(Paragraph(
    "De kern van PAI is een simpele belofte: <b>wat één keer in de briefing "
    "staat, hoeft nooit meer overgetypt te worden.</b> Deadlines, "
    "deliverables en tarieven stromen vanuit de briefing automatisch door "
    "naar de agenda, de contentplanning en uiteindelijk de factuur.", body))
story.append(Paragraph(
    "PAI is gebouwd vanuit 5,5 jaar praktijkervaring als personal assistant "
    "voor zichtbare vrouwen — niet vanuit een vergaderruimte, maar vanuit "
    "het werk zelf.", body))

story.append(PageBreak())
story += heading("03", "De workflow: van briefing tot factuur")
story.append(steps_table([
    ("Briefing",
     "De briefing komt binnen en PAI leest 'm uit. Deadlines, deliverables "
     "en tarieven staan er meteen in. Niets meer overtypen."),
    ("Agenda",
     "Alles staat meteen in de agenda, met herinneringen. Niemand hoeft nog "
     "achter een deadline aan te bellen."),
    ("Content Studio",
     "Hier maak je de content nooit alleen. De studio geeft je de echte "
     "trends, kijkt naar jouw inspiraties, komt met ideeën en captions, en "
     "houdt alles in lijn met de briefing."),
    ("De feed",
     "Zien hoe het staat vóór je post. Sleep je beeld in de feedplanner en "
     "kijk of het klopt naast wat er al staat."),
    ("Feedback &amp; akkoord",
     "De klant kijkt mee via één link. Feedback, revisies en akkoord: alles "
     "op één plek, zonder losse mailtjes. Zodra de klant akkoord geeft, "
     "krijgt de creator een melding: je mag posten."),
    ("Factuur",
     "En de factuur staat er al. Automatisch opgemaakt uit de briefing, "
     "want daar stonden de bedragen al in. Jij keurt alleen goed."),
]))

story.append(PageBreak())
story += heading("04", "De modules")
story.append(steps_table([
    ("Dashboard",
     "Eén overzicht van de dag: samenwerkingen, deadlines en wat er vandaag "
     "aandacht vraagt."),
    ("Briefings",
     "Briefings die zichzelf uitlezen: deliverables, deadlines en tarieven "
     "direct gestructureerd."),
    ("Content Studio &amp; Feedplanner",
     "Trends, ideeën en captions in lijn met de briefing; de feedplanner "
     "laat zien of nieuwe content klopt in de feed, en plaatst automatisch."),
    ("Engagement &amp; Research",
     "Interactie en community-signalen op één plek, plus influencer- en "
     "merkonderzoek ter voorbereiding van samenwerkingen."),
    ("Reizen",
     "Complete reisschema's: vervoer, route en planning rond shoots en "
     "events."),
    ("Financiën &amp; Facturatie",
     "Facturen maken, versturen en betalingen bijhouden, verzameld op één "
     "plek; desgewenst de volledige financiële administratie."),
    ("Pakketten &amp; Fee calculator",
     "Nooit meer onenigheid over tarieven dankzij de zeer gedetailleerde "
     "fee calculator."),
    ("Statistieken",
     "Bereik, groei en resultaten, klaar om te delen met merken."),
]))

story.append(PageBreak())
story += heading("05", "Voor wie")
story.append(steps_table([
    ("Personal assistants",
     "PAI is het verlengstuk van de PA: het neemt het registratiewerk over, "
     "zodat de PA zich kan richten op regie, discretie en niveau."),
    ("Influencers &amp; creators",
     "Voor wie zichtbaar is: één systeem dat de zakelijke kant van het "
     "creatorschap draagt, van samenwerking tot betaling."),
    ("Managementbureaus",
     "Overzicht over meerdere talenten, gestandaardiseerde briefings en "
     "facturatie, en een klantomgeving waarin merken meekijken en akkoord "
     "geven."),
]))
story.append(Spacer(1, 10))
story.append(Paragraph(
    "Binnen PA Atelier is PAI bovendien de drager van de <b>PA "
    "Atelier-standaard</b>: de vastgelegde werkwijze waarmee elke klant op "
    "hetzelfde niveau bediend wordt, door wie van het team dan ook.", body))

story += heading("06", "Status &amp; roadmap")
story.append(Paragraph(
    "PAI is werkend en in actieve ontwikkeling. De eerste klanten en een "
    "managementbureau draaien proef, en hun feedback stuurt de roadmap.",
    body_first))
story.append(steps_table([
    ("Nu",
     "Kernworkflow in gebruik: briefings, agenda, content, facturatie. "
     "Wekelijkse doorontwikkeling op basis van pilotfeedback."),
    ("Volgende fase",
     "Verfijning van de klantomgeving (feedback en akkoord via één link), "
     "verdieping van de Content Studio en automatisering van de financiële "
     "administratie."),
    ("Daarna",
     "PAI als los verkoopbaar product voor PA's, influencers en "
     "managementbureaus, naast het gebruik binnen PA Atelier."),
]))
story.append(Spacer(1, 10))
story.append(Paragraph("PAI is en blijft eigendom van PA Atelier.", body))

story.append(NextPageTemplate("closing"))
story.append(PageBreak())
story.append(Spacer(1, 1))

doc.build(story)
print(f"OK: {OUT}")
