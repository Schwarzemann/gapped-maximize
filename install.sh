
#!/usr/bin/env bash
set -euo pipefail

UUID="gapped-maximize@local"
DEST="$HOME/.local/share/cinnamon/extensions/$UUID"
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing Cinnamon Gapped Maximization..."

if ! command -v cinnamon >/dev/null 2>&1; then
    echo "Error: Cinnamon is not installed."
    exit 1
fi

if [[ ! -f "$SOURCE/extension.js" || ! -f "$SOURCE/metadata.json" ]]; then
    echo "Error: extension.js or metadata.json is missing."
    exit 1
fi

if [[ "$SOURCE" == "$DEST" ]]; then
    echo "Extension is already in the installation directory."
    exit 0
fi

mkdir -p "$DEST"

# Back up an existing installation before replacing it.
if [[ -f "$DEST/extension.js" ]]; then
    cp -p "$DEST/extension.js" \
        "$DEST/extension.js.bak.$(date +%Y%m%d%H%M%S)"
fi

install -m 644 "$SOURCE/extension.js" "$DEST/extension.js"
install -m 644 "$SOURCE/metadata.json" "$DEST/metadata.json"

echo
echo "Installation completed successfully!"
echo "Installed to: $DEST"
echo
echo "Open Cinnamon Settings > Extensions."
echo "Enable Gapped Maximization."
