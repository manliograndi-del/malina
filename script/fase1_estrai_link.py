"""Fase 1b: da ogni scheda salvata estrae il link "Sito web" della sezione Contatti.

Produce DATI/musei.json: una riga per museo (senza doppioni), con regione,
provincia, comune, nome, link alla scheda, sito ufficiale e fonte del link.
"""
import gzip
import json
import os
import re
import sys

from bs4 import BeautifulSoup

DATI = sys.argv[1] if len(sys.argv) > 1 else "dati"

REGIONI = {
    "Piemonte": ["AL", "AT", "BI", "CN", "NO", "TO", "VB", "VC"],
    "Lombardia": ["BG", "BS", "CO", "CR", "LC", "LO", "MB", "MI", "MN", "PV", "SO", "VA"],
    "Valle d'Aosta": ["AO"],
}
REGIONE_DI = {p: r for r, ps in REGIONI.items() for p in ps}


def slug(url):
    return url.rstrip("/").rsplit("/", 1)[-1]


def dividi_luogo(luogo):
    m = re.match(r"^(.*?)\s*\((\w+)\)\s*$", luogo or "")
    return (m.group(1).strip(), m.group(2)) if m else (luogo or "", "")


def normalizza_url(u):
    u = (u or "").strip()
    if not u or u.lower().startswith(("mailto:", "tel:", "#", "javascript:")):
        return ""
    if u.startswith("//"):
        u = "https:" + u
    if not re.match(r"^https?://", u, re.I):
        u = "http://" + u.lstrip("/")
    return u


def estrai(html):
    soup = BeautifulSoup(html, "lxml")
    siti, indirizzo = [], ""
    for d in soup.select("div.scheda_museo_accordion div.dettaglio"):
        if d.find("i", class_="fa-map-marker-alt") and not indirizzo:
            indirizzo = d.get_text(" ", strip=True)
        for a in d.find_all("a", href=True):
            if a.get("aria-label") == "Sito web" or d.find("i", class_="fa-globe"):
                u = normalizza_url(a["href"])
                if u and u not in siti:
                    siti.append(u)
    return siti, indirizzo


def main():
    elenco = json.load(open(os.path.join(DATI, "elenco.json"), encoding="utf-8"))
    # siti trovati con la ricerca web per le schede che non riportano il sito
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "siti_da_ricerca.json")
    ricerca = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
    ripetizioni = {}
    for v in elenco:
        ripetizioni[v["scheda"]] = ripetizioni.get(v["scheda"], 0) + 1
    musei, visti = [], set()
    for v in elenco:
        if v["scheda"] in visti:
            continue
        visti.add(v["scheda"])
        comune, prov = dividi_luogo(v["luogo"])
        note = []
        if ripetizioni[v["scheda"]] > 1:
            note.append(f"compare {ripetizioni[v['scheda']]} volte nell'elenco AM: tenuto una volta")
        regione = REGIONE_DI.get(prov)
        if prov == "CH":
            regione = "Estero (Svizzera)"
            note.append("estero")
        elif not regione:
            regione = "?"
            note.append(f"provincia non riconosciuta: {prov!r}")
        path = os.path.join(DATI, "cards", slug(v["scheda"]) + ".html.gz")
        siti, indirizzo, scaricata = [], "", os.path.exists(path)
        if scaricata:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                siti, indirizzo = estrai(f.read())
        else:
            note.append("scheda AM non scaricata")
        if len(siti) > 1:
            note.append("la scheda riporta piu' siti: " + " ; ".join(siti[1:]))
        if indirizzo and comune and comune.lower() not in indirizzo.lower():
            note.append(f"indirizzo nella scheda: {indirizzo}")
        sito, fonte = (siti[0], "scheda AM") if siti else ("", "")
        if not siti and scaricata:
            fonte = "ricerca"
            trovato = ricerca.get(v["scheda"])
            if trovato:
                sito = trovato["sito"]
                if trovato.get("nota"):
                    note.append(trovato["nota"])
            else:
                note.append("ricerca web non ancora fatta")
        musei.append({
            "regione": regione,
            "provincia": prov,
            "comune": comune,
            "nome": v["nome"],
            "scheda": v["scheda"],
            "sito": sito,
            "fonte": fonte,
            "indirizzo": indirizzo,
            "note": note,
        })
    json.dump(musei, open(os.path.join(DATI, "musei.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"musei: {len(musei)} | sito da scheda AM: {sum(1 for m in musei if m['fonte'] == 'scheda AM')} | "
          f"da ricerca: {sum(1 for m in musei if m['fonte'] == 'ricerca' and m['sito'])} | "
          f"nessun sito: {sum(1 for m in musei if not m['sito'])}")


if __name__ == "__main__":
    main()
