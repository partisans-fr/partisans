// Redirige vers le dernier post Bluesky d'un compte de la liste (« Commenter leur dernier post »).
// La recherche se fait ici, côté serveur, pour que l'adresse du visiteur ne parte pas chez Bluesky.
// Seuls les comptes de la liste sont acceptés, et la redirection ne mène qu'à bsky.app ou à la page
// du compte, jamais à un domaine reçu dans la requête. Ne garde rien, ne journalise rien.

import list from '../../site/partisans.json' with { type: 'json' };
import { entryKey } from '../../site/lib/catalog.js';
import { profileUrl } from '../../site/lib/links.js';

const FEED_URL = 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
const POST_URI = /^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/([A-Za-z0-9._:~-]+)$/;

// Premier post du compte qui n'est pas un repartage (les réponses sont écartées par le filtre),
// ou null si rien n'arrive à temps.
export async function latestBlueskyPost(entry, { fetch, timeoutMs = 3000 }) {
  const url = new URL(FEED_URL);
  url.search = new URLSearchParams({ actor: entry.handle, filter: 'posts_no_replies', limit: '10' });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (response.status !== 200) return null;
    const { feed } = await response.json();
    const own = feed.find((item) => !item.reason);
    const [, key] = own?.post?.uri?.match(POST_URI) ?? [];
    return key ? `https://bsky.app/profile/${entry.handle}/post/${key}` : null;
  } catch {
    return null;
  }
}

export async function handle(request, { list, fetch, timeoutMs }) {
  const key = new URL(request.url).searchParams.get('compte');
  const entry = list.entries.find((candidate) => entryKey(candidate) === key);
  if (!entry) return new Response(null, { status: 404 });
  const post = entry.platform === 'bluesky' ? await latestBlueskyPost(entry, { fetch, timeoutMs }) : null;
  return new Response(null, { status: 302, headers: { Location: post ?? profileUrl(entry), 'Cache-Control': 'no-store' } });
}

export default (request) => handle(request, { list, fetch });
