"""Mock GitHub gist API for the Words sidecar tests (sidecar-testplan.md 0.2).

Usage: python sidecar-mock-gist.py PORT OUTDIR
Never talks to GitHub. OUTDIR receives artifacts posted to /__save?name=...
"""
import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

PORT = int(sys.argv[1])
OUT = sys.argv[2]
LOCK = threading.Lock()
S = {}


def reset():
    S.clear()
    S.update(gists={}, next_id=1, log=[], seq=0, auth=False, delay={}, overlap=False,
             patch_active=0, fail_next=None, truncate=set(), raw_fail=False, deletes=[])


reset()


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, code, obj=None, text=None, ctype="application/json"):
        body = (text if text is not None else json.dumps(obj)).encode("utf-8")
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, text="")

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n).decode("utf-8") if n else ""

    def _gist_json(self, g):
        files = {}
        for name, content in g["files"].items():
            if name in S["truncate"]:
                files[name] = {"filename": name, "content": "", "truncated": True,
                               "raw_url": f"http://127.0.0.1:{PORT}/raw/{g['id']}/{name}"}
            else:
                files[name] = {"filename": name, "content": content, "truncated": False,
                               "raw_url": f"http://127.0.0.1:{PORT}/raw/{g['id']}/{name}"}
        return {"id": g["id"], "files": files}

    def _api(self, method):
        u = urlparse(self.path)
        path = u.path
        body = self._body() if method in ("POST", "PATCH") else ""
        # control endpoints
        if path == "/__ctl":
            o = json.loads(body or "{}")
            with LOCK:
                if o.get("reset"):
                    reset()
                if "set" in o:
                    gid = o.get("id") or str(S["next_id"])
                    if not o.get("id"):
                        S["next_id"] += 1
                    S["gists"][gid] = {"id": gid, "files": dict(o["set"])}
                if "setfile" in o:  # {"setfile": {"id":..., "name":..., "content":...}}
                    f = o["setfile"]
                    g = S["gists"][f["id"]]
                    if f.get("content") is None:
                        g["files"].pop(f["name"], None)
                    else:
                        g["files"][f["name"]] = f["content"]
                if "auth" in o:
                    S["auth"] = bool(o["auth"])
                if "delay_ms" in o:
                    S["delay"].update(o["delay_ms"])
                if "conflict_overlap" in o:
                    S["overlap"] = bool(o["conflict_overlap"])
                if "fail_next" in o:
                    S["fail_next"] = o["fail_next"]
                if "truncate" in o:
                    S["truncate"] = set(o["truncate"])
                if "raw_fail" in o:
                    S["raw_fail"] = bool(o["raw_fail"])
                gids = list(S["gists"].keys())
            return self._send(200, {"ok": True, "gists": gids})
        if path == "/__log":
            with LOCK:
                return self._send(200, S["log"])
        if path == "/__state":
            with LOCK:
                return self._send(200, {"gists": S["gists"], "deletes": S["deletes"]})
        if path == "/__save":
            name = os.path.basename(parse_qs(u.query)["name"][0])
            with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as f:
                f.write(body)
            return self._send(200, {"ok": True})

        with LOCK:
            S["seq"] += 1
            entry = {"seq": S["seq"], "t_start": time.time() * 1000, "method": method, "path": self.path,
                     "body": body, "tag": self.headers.get("X-Tag")}
            S["log"].append(entry)
            delay = S["delay"].get(method, 0)
        overlapped = False
        if method == "PATCH":
            with LOCK:
                overlapped = S["overlap"] and S["patch_active"] > 0
                S["patch_active"] += 1
        try:
            if delay:
                time.sleep(delay / 1000)
            code, obj, text = self._handle(method, path, body, overlapped)
        finally:
            if method == "PATCH":
                with LOCK:
                    S["patch_active"] -= 1
        with LOCK:
            entry["t_end"] = time.time() * 1000
            entry["status"] = code
        if text is not None:
            return self._send(code, text=text, ctype="text/plain")
        return self._send(code, obj)

    def _handle(self, method, path, body, overlapped):
        with LOCK:
            if path.startswith("/raw/"):
                if S["raw_fail"]:
                    return 500, {"message": "raw fail"}, None
                _, _, gid, name = path.split("/", 3)
                name = unquote(name)
                g = S["gists"].get(gid)
                if not g or name not in g["files"]:
                    return 404, {"message": "Not Found"}, None
                return 200, None, g["files"][name]
            if S["auth"]:
                return 401, {"message": "Bad credentials"}, None
            if S["fail_next"]:
                c = S["fail_next"]
                S["fail_next"] = None
                return c, {"message": "fail"}, None
            if overlapped:
                return 409, {"message": "conflict"}, None
            if path == "/user":
                return 200, {"login": "tester"}, None
            if path == "/gists" and method == "GET" or path.startswith("/gists?"):
                return 200, [self._gist_json(g) for g in S["gists"].values()], None
            if path == "/gists" and method == "POST":
                o = json.loads(body)
                gid = str(S["next_id"])
                S["next_id"] += 1
                S["gists"][gid] = {"id": gid, "files": {k: v["content"] for k, v in o["files"].items()}}
                return 201, self._gist_json(S["gists"][gid]), None
            if path.startswith("/gists/"):
                gid = path.split("/")[2]
                g = S["gists"].get(gid)
                if not g:
                    return 404, {"message": "Not Found"}, None
                if method == "GET":
                    return 200, self._gist_json(g), None
                if method == "PATCH":
                    o = json.loads(body)
                    for k, v in o.get("files", {}).items():
                        if v is None or (isinstance(v, dict) and v.get("content") is None):
                            S["deletes"].append(k)
                            g["files"].pop(k, None)
                        else:
                            g["files"][k] = v["content"]
                    return 200, self._gist_json(g), None
            return 404, {"message": "Not Found"}, None

    def do_GET(self):
        self._api("GET")

    def do_POST(self):
        self._api("POST")

    def do_PATCH(self):
        self._api("PATCH")


ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
