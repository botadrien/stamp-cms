.PHONY: run build

# Serves the POC on http://localhost:8080/, pointing at Codeberg prod (config.js).
# Must match the Redirect URI configured on the Codeberg OAuth app exactly.
run: build
	python3 scripts/local-server.py 8080

# Bundles the rich editor (BlockNote.js + React) — see editor-src/editor.jsx.
build:
	npm run build
