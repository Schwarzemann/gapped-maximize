# gapped-maximize
A lightweight Cinnamon desktop extension that adds configurable gaps around maximized windows and tiled windows.

## Installation

Clone the repository:

```bash
git clone https://github.com/Schwarzemann/gapped-maximization.git
cd gapped-maximization
```

Run the installer:

```bash
chmod +x install.sh
./install.sh
```

Then open **System Settings → Extensions**, find **Gapped Maximization**, and enable it.

## Manual Installation

Copy `extension.js` and `metadata.json` into:

```text
~/.local/share/cinnamon/extensions/gapped-maximize@local/
```

Then enable the extension through Cinnamon's Extensions manager.

## Uninstallation

Disable the extension through Cinnamon's Extensions manager, then remove its directory:

```bash
rm -rf ~/.local/share/cinnamon/extensions/gapped-maximize@local
```
