#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])' 2>/dev/null || echo "dev")"
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/zotero-obsidian-linker-$VERSION.xpi"
UPDATE_MANIFEST="$ROOT/updates.json"
ADDON_ID="zotero-obsidian-linker@qiansiyuan.local"
REPOSITORY="SiriYep/zotero-obsidian-linker"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

cd "$ROOT"
zip -r "$OUT" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  content \
  defaults \
  locale \
  README.md \
  -x '*.DS_Store'

HASH="$(shasum -a 256 "$OUT" | awk '{print $1}')"
UPDATE_LINK="${UPDATE_LINK:-https://github.com/$REPOSITORY/releases/download/v$VERSION/zotero-obsidian-linker-$VERSION.xpi}"
cat > "$UPDATE_MANIFEST" <<EOF
{
  "addons": {
    "$ADDON_ID": {
      "updates": [
        {
          "version": "$VERSION",
          "update_link": "$UPDATE_LINK",
          "update_hash": "sha256:$HASH",
          "applications": {
            "zotero": {
              "strict_min_version": "6.999",
              "strict_max_version": "10.*"
            }
          }
        }
      ]
    }
  }
}
EOF

echo "$OUT"
