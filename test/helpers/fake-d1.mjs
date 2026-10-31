import { DatabaseSync } from 'node:sqlite';

// La petite partie de l'API D1 de Cloudflare dont le compteur se sert (prepare, bind, run, batch),
// sur un vrai SQLite en mémoire : le SQL de la fonction est donc vraiment exécuté.
export function fakeD1({ broken = false } = {}) {
  const db = new DatabaseSync(':memory:');
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    run: async () => {
      if (broken) throw new Error('D1 indisponible');
      db.prepare(sql).run(...params);
      return { success: true };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      for (const one of statements) await one.run();
    },
    read() {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'totaux'").get();
      return exists ? db.prepare('SELECT * FROM totaux').all().map((row) => ({ ...row })) : null;
    },
  };
}
