#!/usr/bin/env python3
# Sert le dossier courant sur le port donné (8080 par défaut), sans cache navigateur.
# `python3 -m http.server` seul ne désactive pas le cache : le navigateur peut resservir
# une version périmée de app.js/index.html sans même refaire de requête, ce qui a déjà
# fait passer des correctifs pour "non appliqués" en test local.
import sys
from http.server import SimpleHTTPRequestHandler, test


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    test(HandlerClass=NoCacheHandler, port=port)
