// Additionne les visites et les comptes ouverts envoyés par les navigateurs (site/lib/counter.js).
// Ne garde que deux totaux, ne lit ni l'adresse IP ni les en-têtes de la requête, ne journalise rien.
// Les totaux se lisent dans Cloudflare : Storage & databases > D1 > partisans > Console,
// avec SELECT * FROM totaux.

export const MAX_ACCOUNTS = 1000;

// Une addition valide : visiteurs 0 ou 1, comptes entier de 0 à MAX_ACCOUNTS, pas les deux à 0.
// Un champ absent vaut 0, les autres champs sont ignorés.
export function parseIncrements(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { visiteurs = 0, comptes = 0 } = body;
  if (visiteurs !== 0 && visiteurs !== 1) return null;
  if (!Number.isInteger(comptes) || comptes < 0 || comptes > MAX_ACCOUNTS) return null;
  if (visiteurs === 0 && comptes === 0) return null;
  return { visiteurs, comptes };
}

// Une seule ligne, créée au premier envoi. L'addition se fait dans la base, en une requête :
// deux envois simultanés comptent tous les deux.
const CREATE_TOTALS = 'CREATE TABLE IF NOT EXISTS totaux (id INTEGER PRIMARY KEY CHECK (id = 1), visiteurs INTEGER NOT NULL, comptes INTEGER NOT NULL)';
const ADD_TO_TOTALS = 'INSERT INTO totaux (id, visiteurs, comptes) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET visiteurs = visiteurs + excluded.visiteurs, comptes = comptes + excluded.comptes';

export async function addToTotals(db, { visiteurs, comptes }) {
  await db.batch([db.prepare(CREATE_TOTALS), db.prepare(ADD_TO_TOTALS).bind(visiteurs, comptes)]);
}

export async function handle(request, db) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const increments = parseIncrements(await request.text());
  if (!increments) return new Response(null, { status: 400 });
  try {
    await addToTotals(db, increments);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

// Cloudflare Pages : la base D1 est reliée au projet sous le nom DB.
export const onRequest = ({ request, env }) => handle(request, env.DB);
