.PHONY: run

# Serves the POC on http://localhost:8080/, pointing at Codeberg prod (config.js).
# Must match the Redirect URI configured on the Codeberg OAuth app exactly.
run:
	python3 -m http.server 8080
