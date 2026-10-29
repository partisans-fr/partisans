#!/bin/sh
# Installe les hooks git locaux (non versionnés) qui lancent le garde-fou d'anonymat
# avant chaque commit. À relancer après chaque clone.
set -e

hooks="$(git rev-parse --git-path hooks)"
mkdir -p "$hooks"

cat > "$hooks/pre-commit" <<'EOF'
#!/bin/sh
exec node scripts/check-privacy.mjs --staged
EOF

cat > "$hooks/commit-msg" <<'EOF'
#!/bin/sh
exec node scripts/check-privacy.mjs --message "$1"
EOF

chmod +x "$hooks/pre-commit" "$hooks/commit-msg"

patterns="$(git rev-parse --git-path info/privacy-patterns)"
if [ ! -f "$patterns" ]; then
  mkdir -p "$(dirname "$patterns")"
  printf '# Un motif par ligne, insensible à la casse : noms, pseudos, adresses, comptes.\n' > "$patterns"
  echo "Complète $patterns avant de commiter."
fi

echo "Hooks installés."
