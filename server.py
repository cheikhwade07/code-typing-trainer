#!/usr/bin/env python3
"""Local server for the Code Typing Trainer.

Serves the page on http://127.0.0.1:8765/ and saves progress automatically to
data/progress.json and data/report.md after every lesson. Only this computer
can reach it. If it is already running, it just opens the browser.

Usage: double-click start-trainer.bat, or run `python server.py`.
       Add --no-browser to start without opening a browser tab.
"""
import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
PORT = 8765
URL = f"http://127.0.0.1:{PORT}/"
ALLOWED_ORIGINS = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"}
MAX_BODY = 5_000_000


def write_atomic(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    os.replace(tmp, path)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/load":
            try:
                with open(os.path.join(DATA, "progress.json"), encoding="utf-8") as f:
                    progress = json.load(f)
            except (OSError, ValueError):
                progress = None
            return self._json(200, {"ok": True, "progress": progress})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/save":
            return self._json(404, {"ok": False})
        origin = self.headers.get("Origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return self._json(403, {"ok": False})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"ok": False})
        try:
            body = json.loads(self.rfile.read(length))
        except ValueError:
            return self._json(400, {"ok": False})
        os.makedirs(DATA, exist_ok=True)
        if isinstance(body.get("progress"), dict):
            write_atomic(os.path.join(DATA, "progress.json"), json.dumps(body["progress"], indent=1))
        if isinstance(body.get("report"), str):
            write_atomic(os.path.join(DATA, "report.md"), body["report"])
        return self._json(200, {"ok": True})


def already_running():
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", PORT)) == 0


def main():
    open_browser = "--no-browser" not in sys.argv
    if already_running():
        if open_browser:
            webbrowser.open(URL)
        return
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    if open_browser:
        threading.Timer(0.4, lambda: webbrowser.open(URL)).start()
    server.serve_forever()


if __name__ == "__main__":
    main()
