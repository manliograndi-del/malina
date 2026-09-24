"""Fase 1a: legge l'elenco dei musei da abbonamentomusei.it e scarica ogni scheda.

- L'elenco completo si trova nei dati della mappa dentro la pagina /ricerca-musei/.
- Le schede vengono scaricate una alla volta, con una pausa tra le richieste,
  e salvate compresse in DATI/cards/ (se una scheda e' gia' stata salvata non
  viene riscaricata, cosi' il programma si puo' interrompere e riprendere).
"""
import gzip
import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

DATI = sys.argv[1] if len(sys.argv) > 1 else "dati"
PAUSA = 1.5
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
ELENCO_URL = "https://abbonamentomusei.it/ricerca-musei/"

os.makedirs(os.path.join(DATI, "cards"), exist_ok=True)
s = requests.Session()
s.headers["User-Agent"] = UA


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def leggi_elenco():
    r = s.get(ELENCO_URL, timeout=60)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")
    voci = []
    for m in soup.select("div.acf-map div.marker"):
        a = m.select_one(".title a")
        dettagli = [d.get_text(" ", strip=True) for d in m.select(".details")]
        luogo = next((d for d in dettagli if re.search(r"\(\w+\)\s*$", d)), "")
        voci.append({
            "nome": a.get_text(" ", strip=True),
            "luogo": luogo,
            "scheda": a["href"],
            "post_id": next((c for c in m.get("class", []) if c.startswith("post-")), ""),
        })
    return voci


def slug(url):
    return url.rstrip("/").rsplit("/", 1)[-1]


def main():
    voci = leggi_elenco()
    log("voci nell'elenco (mappa):", len(voci))
    with open(os.path.join(DATI, "elenco.json"), "w", encoding="utf-8") as f:
        json.dump(voci, f, ensure_ascii=False, indent=1)

    schede = list(dict.fromkeys(v["scheda"] for v in voci))
    log("schede distinte:", len(schede))
    fatte = errori = 0
    for i, url in enumerate(schede, 1):
        dest = os.path.join(DATI, "cards", slug(url) + ".html.gz")
        if os.path.exists(dest):
            continue
        esito = None
        for tentativo in range(3):
            try:
                r = s.get(url, timeout=60)
                esito = r.status_code
                if r.status_code == 200:
                    with gzip.open(dest, "wt", encoding="utf-8") as f:
                        f.write(r.text)
                    break
                if r.status_code in (429, 503):
                    log("rallento: codice", r.status_code)
                    time.sleep(60)
                else:
                    break
            except requests.RequestException as e:
                esito = type(e).__name__
                time.sleep(10)
        if esito != 200:
            errori += 1
            with open(os.path.join(DATI, "errori_schede.txt"), "a") as f:
                f.write(f"{url}\t{esito}\n")
        fatte += 1
        if i % 25 == 0:
            log(f"{i}/{len(schede)} schede (errori finora: {errori})")
        time.sleep(PAUSA)
    log(f"FINE: scaricate ora {fatte}, errori {errori}")


if __name__ == "__main__":
    main()
