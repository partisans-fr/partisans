// Bluesky, par l'API officielle AT Protocol.
// Connexion par mot de passe d'application : seule la session (jetons) est conservée, jamais le mot de passe.

// Erreur de l'API. Son type (kind) dit quoi faire :
// - entry : la requête est refusée pour ce compte ou cet enregistrement ;
// - rateLimit : limite de débit atteinte, on reprend à retryAt (horodatage en ms) ;
// - auth : session invalide, il faut se reconnecter ;
// - network : Bluesky est injoignable ou en erreur.
export class PlatformError extends Error {
  constructor(kind, message, { code, retryAt } = {}) {
    super(message);
    this.name = 'PlatformError';
    this.kind = kind;
    this.code = code;
    this.retryAt = retryAt;
  }
}

const ENTRYWAY = 'https://bsky.social';
const PUBLIC_API = 'https://public.api.bsky.app';
const PLC_DIRECTORY = 'https://plc.directory';
const APP_PASSWORD = /^[a-z0-9]{4}(-[a-z0-9]{4}){3}$/i;

const LOGIN_ERRORS = {
  AuthenticationRequired: 'Identifiant ou mot de passe d\'application incorrect.',
  AuthFactorTokenRequired: 'Ce compte demande un code de confirmation : utilise un mot de passe d\'application.',
  AccountTakedown: 'Ce compte Bluesky est suspendu.',
};

async function xrpc(fetch, service, method, nsid, { params = {}, body, token } = {}) {
  const url = new URL(`/xrpc/${nsid}`, service);
  for (const [name, value] of Object.entries(params)) {
    for (const item of [value].flat()) url.searchParams.append(name, item);
  }
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
  } catch (error) {
    throw new PlatformError('network', `Bluesky est injoignable (${error.message}).`);
  }
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;

  const code = data.error;
  const message = data.message ?? code ?? `HTTP ${response.status}`;
  if (response.status === 429) {
    const reset = Number(response.headers.get('ratelimit-reset'));
    const retryAt = reset ? reset * 1000 : Date.now() + 60_000;
    throw new PlatformError('rateLimit', 'Limite de débit Bluesky atteinte.', { code, retryAt });
  }
  if (response.status >= 500) throw new PlatformError('network', `Bluesky est en erreur (${message}).`, { code });
  if (response.status === 401) throw new PlatformError('auth', 'Session Bluesky refusée : reconnecte-toi.', { code });
  throw new PlatformError('entry', message, { code });
}

const pdsEndpoint = (didDoc) =>
  didDoc?.service?.find((service) => service.id.endsWith('#atproto_pds'))?.serviceEndpoint;

async function fetchDidDocument(did, fetch) {
  const url = did.startsWith('did:web:')
    ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
    : `${PLC_DIRECTORY}/${did}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`document DID introuvable (HTTP ${response.status})`);
  return response.json();
}

// Trouve le serveur (PDS) qui héberge le compte. Les comptes hébergés par Bluesky et les
// adresses e-mail passent par bsky.social ; un handle est résolu pour couvrir les PDS indépendants.
async function findService(identifier, fetch) {
  if (identifier.includes('@')) return ENTRYWAY;
  try {
    const { did } = await xrpc(fetch, PUBLIC_API, 'GET', 'com.atproto.identity.resolveHandle', { params: { handle: identifier } });
    return pdsEndpoint(await fetchDidDocument(did, fetch)) ?? ENTRYWAY;
  } catch {
    return ENTRYWAY;
  }
}

// Ouvre une session et renvoie le compte à conserver : { did, handle, service, accessJwt, refreshJwt }.
export async function login(identifier, appPassword, { fetch }) {
  const password = appPassword.trim();
  if (!APP_PASSWORD.test(password)) {
    throw new Error('Utilise un mot de passe d\'application (Paramètres > Confidentialité et sécurité > Mots de passe d\'application), jamais ton mot de passe principal.');
  }
  let normalized = identifier.trim().replace(/^@/, '');
  if (!normalized.includes('@')) normalized = normalized.toLowerCase();

  const service = await findService(normalized, fetch);
  try {
    const session = await xrpc(fetch, service, 'POST', 'com.atproto.server.createSession', {
      body: { identifier: normalized, password },
    });
    const { did, handle, accessJwt, refreshJwt } = session;
    return { did, handle, service: pdsEndpoint(session.didDoc) ?? service, accessJwt, refreshJwt };
  } catch (error) {
    if (error.kind === 'rateLimit') {
      const time = new Date(error.retryAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      throw new Error(`Trop de tentatives de connexion : réessaie après ${time}.`);
    }
    throw new Error(LOGIN_ERRORS[error.code] ?? error.message);
  }
}

// Client authentifié. Rafraîchit la session quand elle expire et signale les nouveaux jetons
// par onSessionUpdate, pour qu'ils soient sauvegardés.
export function createClient(account, { fetch, onSessionUpdate = () => {} }) {
  let session = { ...account };

  async function refresh() {
    try {
      const { accessJwt, refreshJwt } = await xrpc(fetch, session.service, 'POST', 'com.atproto.server.refreshSession', {
        token: session.refreshJwt,
      });
      session = { ...session, accessJwt, refreshJwt };
    } catch (error) {
      if (error.kind === 'network' || error.kind === 'rateLimit') throw error;
      throw new PlatformError('auth', 'Session Bluesky expirée : reconnecte-toi.');
    }
    await onSessionUpdate(session);
  }

  async function call(method, nsid, options) {
    const send = () => xrpc(fetch, session.service, method, nsid, { ...options, token: session.accessJwt });
    try {
      return await send();
    } catch (error) {
      if (error.code !== 'ExpiredToken') throw error;
      await refresh();
      return send();
    }
  }

  return {
    did: account.did,
    get: (nsid, params) => call('GET', nsid, { params }),
    post: (nsid, body) => call('POST', nsid, { body }),
  };
}

const PROFILES_PER_REQUEST = 25; // maximum accepté par app.bsky.actor.getProfiles

// DID des comptes trouvés, et handles introuvables. Le DID (id) est prioritaire sur le handle, qui peut avoir changé.
export async function resolveAccounts(client, entries) {
  const dids = new Set();
  const notFound = [];
  for (let start = 0; start < entries.length; start += PROFILES_PER_REQUEST) {
    const batch = entries.slice(start, start + PROFILES_PER_REQUEST);
    const { profiles } = await client.get('app.bsky.actor.getProfiles', {
      actors: batch.map((entry) => entry.id ?? entry.handle),
    });
    for (const entry of batch) {
      const profile = profiles.find((p) => (entry.id ? p.did === entry.id : p.handle === entry.handle));
      if (profile) dids.add(profile.did);
      else notFound.push(entry.handle);
    }
  }
  return { dids: [...dids], notFound };
}
