// Petite liste Partisans pour les tests du site : les six catégories de la vraie liste, quelques
// personnes présentes sur un ou plusieurs réseaux, aucun journaliste.

const entry = (platform, handle, displayName, category) => ({
  platform,
  handle,
  displayName,
  category,
  source: 'https://example.com/source',
  addedAt: '2026-10-28',
});

export const miniList = {
  schemaVersion: 1,
  name: 'Partisans (essai)',
  maintainer: { name: 'Partisans' },
  contestUrl: 'https://example.com/signaler',
  suggestUrl: 'https://example.com/suggerer',
  version: '1',
  categories: {
    politique: 'Personnalités politiques',
    media: 'Médias',
    journaliste: 'Journalistes',
    influenceur: 'Influenceurs',
    parti: 'Partis et mouvements',
    association: 'Associations',
  },
  entries: [
    entry('instagram', 'alicemartin', 'Alice Martin', 'politique'),
    entry('x', 'alicemartin', 'Alice Martin', 'politique'),
    entry('x', 'brunopetit', 'Bruno Petit', 'politique'),
    entry('instagram', 'lejournal', 'Le Journal', 'media'),
    entry('x', 'lejournal', 'Le Journal', 'media'),
    entry('bluesky', 'lejournal.bsky.social', 'Le Journal', 'media'),
    entry('youtube', 'echo-cie', "L'Écho & <Cie>", 'media'),
    entry('mastodon', 'echo@exemple.social', "L'Écho & <Cie>", 'media'),
    entry('tiktok', 'chloevideo', 'Chloé Vidéo', 'influenceur'),
    entry('threads', 'mouvementcommun', 'Mouvement Commun', 'parti'),
    entry('instagram', 'collectifsolidaire', 'Collectif Solidaire', 'association'),
    entry('facebook', 'collectifsolidaire', 'Collectif Solidaire', 'association'),
  ],
};
