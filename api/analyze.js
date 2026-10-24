// Vercel-Funktion: nimmt die Eingabe entgegen, haelt die Regeln geheim und fragt Claude.
// Benoetigt die Umgebungsvariable ANTHROPIC_API_KEY (nur serverseitig).

const RULES = [

  'Du baust eine Produkttreppe für eine Fotografin oder Coachin. Die Treppe entsteht ausschließlich aus der Expertise, die sie beschreibt. Es gibt kein festes Schema. Jede Expertise bekommt eigene Ideen, keine Vorlagen und keine Wiederholung von Formulierungen aus anderen Treppen.',
  'Stufen: 1 Freebie (0 Euro) löst ein kleines Mini-Problem, das aus der Expertise folgt. 2 Mini-Produkt (27 Euro) ist die erste Methode oder ein Ablauf, der dieses Problem Schritt für Schritt löst. 3 Bump (19 Euro) ist immer eine Ergänzung, die das Mini-Produkt schneller oder einfacher macht, zum Beispiel Vorlagen oder Textbausteine. 4 Upsell (79 Euro) ist ein Tool oder ein Kurs, nie eine Coaching-Session. 5 Hauptprodukt: bei Fotografen (B2B) ein Online-Kurs, bei Brautpaaren oder Endkunden (B2C) die eigene Dienstleistung der Fotografin.',
  'Jede Stufe löst das Problem der nächsten Stufe. Alle Stufen führen zum Hauptprodukt. Die Kette muss logisch aufeinander aufbauen.',
  'Bei B2C (Endkunden) dürfen keine Produkte angeboten werden, die zu nah am Hauptprodukt liegen, also Shooting-Begleitung, Posing-Anleitung für das Shooting oder Outfit-Beratung. Eigene Dienstleistungen wie Kleiderschrank-Service sind keine Produkte.',
  'Ein Guide ist kein Produkt. Das Wort Guide wird nicht verwendet.',
  'Verwende keine Wörter: hustlen, rumschreien, Chatflow, Chatbot, Geschäft, Berufsfotografen. Schreibe keine Gendersternchen und keine Doppelpunkt-Formen. Verwende keinen Gedankenstrich als Trennzeichen. Sprich in der du-Form.',
  'Jede Idee ist konkret und nennt, was das Produkt ist, was es kann und welches Ziel es hat. Der Satz "what" erklärt das Produkt in einem Satz. Der Satz "can" erklärt den Nutzen in einem Satz. Keine Pflichtfelder fehlen.',
  'Tool nur setzen, wenn das Produkt ein interaktiver Rechner oder Check sein kann. Dann gib in "tool" in einem Satz die Eingaben und das Ergebnis an. Sonst leerer String.',
  'Wenn der Nutzer schon Produkte hat, baue die Treppe so, dass sie zu dessen eigenem Produkt führt (Anker). Die Stufen davor bereiten das Anker-Produkt vor.',
  'Gib die Antwort nur als JSON im folgenden Format zurück, ohne weiteren Text: {"freebie":{"name":"","what":"","can":"","tool":""},"mini":{"name":"","what":"","can":"","tool":""},"bump":{"name":"","what":"","can":"","tool":""},"upsell":{"name":"","what":"","can":"","tool":""},"haupt":{"name":"","what":"","can":"","tool":""},"texts":{"freebie":"","mini":"","bump":"","upsell":"","haupt":""}}',
  'Die "texts" sind je ein Satz pro Stufe, der erklärt, welche Rolle die Stufe in dieser Treppe spielt. Sie müssen zur Expertise passen.'

].join('\n');

const MODEL = 'claude-sonnet-5-5';

module.exports = async function handler(req, res){
  if (req.method !== 'POST') { res.status(405).json({ error: 'method' }); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).json({ error: 'no_key' }); return; }
  const b = req.body || {};
  const t = b.type === 'B2C' ? 'B2C' : 'B2B';
  const data = [
    'Richtung: ' + (t === 'B2C' ? 'B2C (Endkunden, Brautpaare)' : 'B2B (Fotografen und Coaches)'),
    'Nische: ' + String(b.niche || '').slice(0, 300),
    'Zielgruppe: ' + String(b.aud || '').slice(0, 300),
    'Expertise: ' + String(b.exp || '').slice(0, 3000),
    'Bereits vorhandene Produkte: ' + (b.hasProducts ? (String(b.products || '').slice(0, 2000) || '(keine Angabe)') : 'keine')
  ].join('\n');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages: [{ role: 'user', content: RULES + '\n\nDaten:\n' + data }] })
    });
    const j = await r.json();
    const text = (j.content || []).map(c => c.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { res.status(502).json({ error: 'no_json' }); return; }
    res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    res.status(502).json({ error: 'upstream' });
  }
};
