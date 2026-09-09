import json
import subprocess
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:3199"
OUT = "gateway/_dump_check.json"
proc = subprocess.Popen(
    [sys.executable, "gateway/server.py", "--port", "3199", "--db", ":memory:"],
    stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
time.sleep(2.0)


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


try:
    # 1 week of data at 10-min interval = 1008 readings
    sim = call("POST", "/api/edge/simulate", {"hours": 168, "interval": 10, "live": False})
    hist = call("GET", "/api/edge/history/EDGE-PUNE-01?limit=200")
    verdicts = {}
    for r in hist.get("readings", []):
        v = r.get("verdict")
        verdicts[v] = verdicts.get(v, 0) + 1
    result = {"sim": sim, "history_returned": len(hist.get("readings", [])),
              "verdicts": verdicts, "sample": (hist.get("readings") or [{}])[0]}
finally:
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except Exception:
        proc.kill()

with open(OUT, "w") as f:
    json.dump(result, f, indent=2, default=str)
print("wrote", OUT)
