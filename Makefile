.PHONY: run build

# Serves the POC on http://localhost:8080/, pointing at Codeberg prod (app/auth/config.js).
# Must match the Redirect URI configured on the Codeberg OAuth app exactly.
run: build
	python3 scripts/local-server.py 8080

# Bundles the Puck editors + SSG renderer (editor-src/, app/puck/) via esbuild.
build:
	npm run build
