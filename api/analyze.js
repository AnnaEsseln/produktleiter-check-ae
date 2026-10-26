// Vercel-Funktion: haelt die Regeln geheim und fragt Claude mit dem Key aus ANTHROPIC_API_KEY.

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
  'Bevor du die Stufen schreibst, arbeite konkret heraus: Nenne dir drei konkrete Aussagen aus der Expertise (wer, was, wie). Jede Stufe muss auf eine dieser Aussagen zurückgehen. Verwende keine allgemeinen Ideen, die auch zu anderen Expertisen passen würden. Jede Formulierung muss genau zu dieser Expertise passen.',
  'Zu jeder Stufe gehört ein Feld "basis": eine genaue Wendung oder ein kurzes Zitat aus der Expertise, auf das die Stufe zurückgeht. Ohne passende Wendung darf die Stufe nicht geschrieben werden. Gib die Antwort nur als JSON im folgenden Format zurück, ohne weiteren Text: {"freebie":{"name":"","what":"","can":"","tool":"","basis":""},"mini":{"name":"","what":"","can":"","tool":"","basis":""},"bump":{"name":"","what":"","can":"","tool":"","basis":""},"upsell":{"name":"","what":"","can":"","tool":"","basis":""},"haupt":{"name":"","what":"","can":"","basis":""},"texts":{"freebie":"","mini":"","bump":"","upsell":"","haupt":""}}',
  'Die "texts" sind je ein Satz pro Stufe, der erklärt, welche Rolle die Stufe in dieser Treppe spielt. Sie müssen zur Expertise passen.'

].join('\n');

const MODEL = 'claude-sonnet-5-5';

function send(res, status, body){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.status(status).json(body);
}

module.exports = async function handler(req, res){
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  if (req.method !== 'POST') { send(res, 405, { error: 'method_not_allowed', detail: 'Nur POST erlaubt.' }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { send(res, 500, { error: 'missing_key', detail: 'ANTHROPIC_API_KEY ist in Vercel nicht gesetzt.' }); return; }

  const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
  const t = b.type === 'B2C' ? 'B2C' : 'B2B';
  const data = [
    'Richtung: ' + (t === 'B2C' ? 'B2C (Endkunden, Brautpaare)' : 'B2B (Fotografen und Coaches)'),
    'Nische: ' + String(b.niche || '').slice(0, 300),
    'Zielgruppe: ' + String(b.aud || '').slice(0, 300),
    'Expertise: ' + String(b.exp || '').slice(0, 3000),
    'Bereits vorhandene Produkte: ' + (b.hasProducts ? (String(b.products || '').slice(0, 2000) || '(keine Angabe)') : 'keine')
  ].join('\n');

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [
          { role: 'user', content: RULES + '\n\nDaten:\n' + data }
        ]
      })
    });
  } catch (e) {
    send(res, 502, { error: 'network', detail: String((e && e.message) || e).slice(0, 300) });
    return;
  }

  let j;
  try { j = await upstream.json(); }
  catch (e) { send(res, 502, { error: 'anthropic_not_json', detail: 'HTTP ' + upstream.status }); return; }

  if (!upstream.ok) {
    send(res, 502, { error: 'anthropic_' + upstream.status, detail: (j.error && (j.error.type + ': ' + j.error.message)) || 'unbekannt' });
    return;
  }

  const text = (j.content || []).map(c => c.text || '').join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) { send(res, 502, { error: 'no_json', detail: text.slice(0, 300) }); return; }
  let out;
  try { out = JSON.parse(text.slice(start, end + 1)); }
  catch (e) { send(res, 502, { error: 'bad_json', detail: String(e.message).slice(0, 200) + ' | Ende: ' + text.slice(-200) }); return; }

  send(res, 200, out);
};
