#!/usr/bin/env python3
"""Audit RLS live : lecture anonyme (sans JWT) sur chaque table.
Avec RLS actif + aucune policy publique, une lecture anonyme doit renvoyer
0 ligne. Des lignes renvoyées => policy trop permissive (fuite)."""
import json
import re
import urllib.request
import urllib.error

env = {}
with open(".env.local") as fh:
    for line in fh:
        m = re.match(r"^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$", line.strip())
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")

url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
anon = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
service = env["SUPABASE_SERVICE_ROLE_KEY"]

def req(path, headers, method="GET"):
    r = urllib.request.Request(url + path, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# 1. Liste des tables via service role
code, body = req("/rest/v1/", {
    "apikey": service,
    "Authorization": f"Bearer {service}",
})
spec = json.loads(body)
tables = sorted(spec.get("definitions", {}).keys())
print("TABLES:", ", ".join(tables))

# 2. Vérif présence match_details + colonnes réclamations
for t in ("match_details", "reclamations"):
    if t in spec.get("definitions", {}):
        cols = list(spec["definitions"][t].get("properties", {}).keys())
        print(f"  {t}: OK — colonnes: {', '.join(cols)}")
    else:
        print(f"  {t}: MANQUANTE")

# 3. Lecture anonyme (sans JWT) sur chaque table : doit renvoyer 0 ligne
print("\n--- Lecture anonyme (RLS attendu: 0 ligne) ---")
for t in tables:
    if t.startswith("pg_") or t in ("schema_migrations",):
        continue
    code, body = req(f"/rest/v1/{t}?select=id&limit=5", {
        "apikey": anon,
        "Authorization": f"Bearer {anon}",
    })
    if code == 200:
        rows = json.loads(body)
        status = "FUITE" if rows else "0 ligne (RLS OK)"
        if t in ("weather_forecasts",):
            status += " [lecture publique acceptable?]"
    else:
        status = f"HTTP {code}"
    print(f"  {t:24s} -> {status}")
