"""Fase 2: apre ogni sito ufficiale e lo classifica.

Passi:
  1. ogni indirizzo diverso viene aperto con un client HTTP semplice, seguendo
     i reindirizzamenti uno alla volta (massimo una richiesta per volta per sito);
  2. gli indirizzi che non hanno risposto vengono riprovati dopo una pausa;
  3. i casi non chiari (errori, 403/429, pagine quasi vuote o che non citano
     museo/comune) vengono riaperti con un vero browser (Chromium), che esegue
     anche il JavaScript;
  4. per i link rotti si provano le varianti (con/senza www, http/https) solo
     per suggerire nella nota l'indirizzo che funziona;
  5. ogni museo viene classificato con il proprio nome e comune
     (lo stesso indirizzo puo' servire piu' musei).

Uso: python3 fase2_verifica_siti.py DATI   (legge DATI/musei.json, scrive DATI/verifica.json)
"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup

DATI = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--browser" else "dati"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9,en;q=0.8",
}
CA_BUNDLE = os.environ.get("REQUESTS_CA_BUNDLE") or "/root/.ccr/ca-bundle.crt"
MAX_BYTES = 4_000_000
PAUSA_STESSO_HOST = 2.0
THREAD = 6

SOCIAL = ("facebook.com", "fb.com", "fb.me", "instagram.com")
NOTA_ESTERO = ("nessuna risposta da questo computer, che si collega dagli USA: puo' essere un sito spento "
               "oppure un blocco verso l'estero; da verificare nel browser")


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)

# ---------------------------------------------------------------- testo


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("’", "'").replace("`", "'")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " " + re.sub(r"\s+", " ", s).strip() + " "


def testo_da_html(html):
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    extra = []
    for m in soup.find_all("meta", attrs={"content": True}):
        if (m.get("name") or m.get("property") or "").lower() in (
                "description", "og:title", "og:description", "og:site_name"):
            extra.append(m["content"])
    frames = [f.get("src") for f in soup.find_all(["frame", "iframe"]) if f.get("src")]
    for tag in soup(["script", "style", "noscript", "template", "svg"]):
        tag.decompose()
    for el in soup.find_all(["img", "a"]):
        for att in ("alt", "title"):
            if el.get(att):
                extra.append(el[att])
    corpo = soup.get_text(" ", strip=True)
    return title, corpo, " ".join(extra), frames


def decodifica(corpo, enc_header):
    enc = enc_header if enc_header and enc_header.lower() != "iso-8859-1" else None
    if not enc:
        m = re.search(rb'charset=["\']?([\w-]+)', corpo[:5000], re.I)
        enc = m.group(1).decode("ascii", "ignore") if m else None
    for e in (enc, "utf-8", "cp1252"):
        if not e:
            continue
        try:
            return corpo.decode(e)
        except (LookupError, UnicodeDecodeError):
            continue
    return corpo.decode("utf-8", errors="replace")


def meta_refresh(html, base):
    m = re.search(r'<meta[^>]+http-equiv=["\']?refresh["\']?[^>]*content=["\']?\s*(\d+)\s*;\s*(?:url\s*=\s*)?([^"\'>\s]+)',
                  html, re.I)
    if m and int(m.group(1)) <= 10:
        return urljoin(base, m.group(2).strip("'\""))
    return None


PARCHEGGIO_FORTE = [
    "domain for sale", "domain is for sale", "buy this domain", "this domain may be for sale",
    "dominio in vendita", "questo dominio e in vendita", "dominio e in vendita", "parked domain",
    "domain is parked", "domain parking", "hugedomains", "afternic", "sedoparking",
    "pagina di cortesia", "account suspended", "account has been suspended",
    "questo sito e sospeso", "sito sospeso", "dominio scaduto", "domain has expired",
    "this domain has expired", "domain expired",
]
PARCHEGGIO_DEBOLE = [
    "coming soon", "under construction", "in costruzione", "it works", "index of",
    "welcome to nginx", "default page", "godaddy", "dominio registrato", "plesk",
    "sito in manutenzione", "under maintenance", "maintenance mode", "in manutenzione", "maintenance",
]
# siti di scommesse/gioco: tipico dominio scaduto e ricomprato da altri
AZZARDO = ["togel", "gacor", "slot online", "judi online", "situs", "toto 4d", "maxwin", "scommesse", "betting",
           "casino online", "bonus benvenuto", "slot gacor", "bonus di benvenuto", "giri gratis"]
PARCHEGGIATORI = ["parking", "sedo.com", "bodis", "parkingcrew", "dan.com", "afternic", "hugedomains", "nidoma"]
SFIDA_BOT = ["just a moment", "attention required", "checking your browser",
             "checking the site connection security", "enable javascript and cookies to continue",
             "verify you are human", "ddos protection by", "access denied", "request unsuccessful",
             "are you a robot", "sei un robot", "why have i been blocked",
             "attendi che la tua richiesta venga verificata", "un momento, per favore"]


def e_sfida(r):
    if "sgcaptcha" in (r.get("finale") or "") or r.get("cf") or r.get("sg"):
        return "protezione anti-robot del sito"
    testa = norm((r.get("titolo") or "") + " " + (r.get("testo") or "")[:800])
    if len(r.get("testo") or "") < 3000:
        for k in SFIDA_BOT:
            if norm(k) in testa:
                return f"pagina anti-robot ({k!r})"
    return None

# ---------------------------------------------------------------- rete

_host_lock = {}
_host_last = {}
_glock = threading.Lock()


class NessunaRisposta(Exception):
    """Il 502/503 non viene dal sito ma dalla rete di questo computer (il sito non ha risposto)."""


def e_errore_rete_locale(status, testo):
    return status in (502, 503, 504) and bool(re.search(r"upstream (connect error|request failed)", testo or ""))


class TurnoHost:
    """Una sola richiesta per volta verso lo stesso sito, con pausa."""

    def __init__(self, host):
        with _glock:
            self.lk = _host_lock.setdefault(host, threading.Lock())
        self.host = host

    def __enter__(self):
        self.lk.acquire()
        d = time.time() - _host_last.get(self.host, 0)
        if d < PAUSA_STESSO_HOST:
            time.sleep(PAUSA_STESSO_HOST - d)

    def __exit__(self, *a):
        _host_last[self.host] = time.time()
        self.lk.release()


def dns_esiste(host):
    try:
        socket.getaddrinfo(host, 443)
        return True
    except socket.gaierror:
        return False
    except Exception:
        return None


_aia_cache = {}


def bundle_con_intermedio(host):
    """Certificato 'incompleto' sul server: scarica il certificato intermedio
    mancante dall'indirizzo indicato nel certificato stesso (come fanno i
    browser) e prepara un elenco di certificati fidati con quello in piu'.
    La verifica resta attiva."""
    if host in _aia_cache:
        return _aia_cache[host]
    out = None
    try:
        proxy = urlparse(os.environ.get("HTTPS_PROXY", "")).netloc
        cmd = ["openssl", "s_client", "-connect", f"{host}:443", "-servername", host, "-showcerts"]
        if proxy:
            cmd[2:2] = ["-proxy", proxy]
        pem = subprocess.run(cmd, input=b"", capture_output=True, timeout=25).stdout.decode("latin1")
        leaf = re.search(r"-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----", pem, re.S)
        if leaf:
            txt = subprocess.run(["openssl", "x509", "-noout", "-text"], input=leaf.group(0).encode(),
                                 capture_output=True, timeout=10).stdout.decode()
            m = re.search(r"CA Issuers - URI:(\S+)", txt)
            if m:
                der = requests.get(m.group(1), timeout=20, headers=HEADERS).content
                inter = subprocess.run(["openssl", "x509", "-inform", "DER", "-outform", "PEM"], input=der,
                                       capture_output=True, timeout=10).stdout
                if not inter.startswith(b"-----BEGIN"):
                    inter = der if der.startswith(b"-----BEGIN") else b""
                if inter:
                    f = tempfile.NamedTemporaryFile("wb", suffix=".pem", delete=False)
                    f.write(open(CA_BUNDLE, "rb").read() + b"\n" + inter)
                    f.close()
                    out = f.name
    except Exception:
        out = None
    _aia_cache[host] = out
    return out


def motivo_ssl(e):
    s = str(e)
    if "expired" in s:
        return "certificato scaduto"
    if "Hostname mismatch" in s or "doesn't match" in s or "not valid for" in s:
        return "certificato intestato a un altro dominio"
    if "self-signed" in s or "self signed" in s:
        return "certificato autofirmato"
    if "unable to get local issuer" in s:
        return "certificato emesso da un ente non riconosciuto"
    if "WRONG_VERSION_NUMBER" in s or "wrong version" in s:
        return "HTTPS non configurato correttamente"
    return "errore di certificato/HTTPS"


def una_richiesta(url, verify, timeout):
    host = urlparse(url).hostname or ""
    with TurnoHost(host):
        with requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=False,
                          verify=verify, stream=True) as r:
            corpo = b""
            ctype = r.headers.get("Content-Type", "")
            if not ctype or "html" in ctype.lower() or "text" in ctype.lower():
                for chunk in r.iter_content(65536):
                    corpo += chunk
                    if len(corpo) > MAX_BYTES:
                        break
            return r.status_code, r.headers, corpo, r.encoding


def scarica_http(url, timeout=(12, 25), tentativi_max=2):
    """Apre l'indirizzo seguendo i reindirizzamenti uno alla volta."""
    ris = {"url": url, "catena": [], "errore": None}
    corrente = url
    verify = CA_BUNDLE
    visti = set()
    for salto in range(12):
        host = urlparse(corrente).hostname or ""
        tentativi = 0
        while True:
            tentativi += 1
            try:
                st, hd, corpo, enc = una_richiesta(corrente, verify, timeout)
                if e_errore_rete_locale(st, corpo[:3000].decode("latin1")):
                    raise NessunaRisposta()
                break
            except NessunaRisposta:
                if tentativi < tentativi_max:
                    time.sleep(5)
                    continue
                ris.update(status=None, finale=corrente, errore="timeout",
                           dettaglio=f"il server non risponde entro il tempo limite ({tentativi_max} tentativi)")
                return ris
            except requests.exceptions.SSLError as e:
                s = str(e)
                if "unable to get local issuer" in s and verify == CA_BUNDLE:
                    b = bundle_con_intermedio(host)
                    if b:
                        verify = b
                        ris["nota_cert"] = ("certificato del server incompleto: i programmi lo rifiutano, "
                                            "i browser di solito lo aprono lo stesso")
                        continue
                ris.update(status=None, finale=corrente, errore="ssl", dettaglio=motivo_ssl(e))
                return ris
            except requests.exceptions.ProxyError as e:
                s = str(e)
                if " 403" in s or " 407" in s:
                    ris.update(status=None, finale=corrente, errore="rete_locale",
                               dettaglio="indirizzo bloccato dalla rete di questo computer, non dal sito")
                    return ris
                if dns_esiste(host) is False:
                    ris.update(status=None, finale=corrente, errore="dns", dettaglio="dominio inesistente")
                    return ris
                if tentativi < tentativi_max:
                    time.sleep(5)
                    continue
                ris.update(status=None, finale=corrente, errore="connessione",
                           dettaglio="il server non risponde (connessione non riuscita)")
                return ris
            except requests.exceptions.Timeout:
                if tentativi < tentativi_max:
                    time.sleep(5)
                    continue
                ris.update(status=None, finale=corrente, errore="timeout",
                           dettaglio=f"timeout ripetuto ({tentativi_max} tentativi)")
                return ris
            except requests.exceptions.ConnectionError as e:
                if dns_esiste(host) is False:
                    ris.update(status=None, finale=corrente, errore="dns", dettaglio="dominio inesistente")
                    return ris
                if tentativi < tentativi_max:
                    time.sleep(5)
                    continue
                ris.update(status=None, finale=corrente, errore="connessione",
                           dettaglio="connessione interrotta o rifiutata")
                return ris
            except Exception as e:
                ris.update(status=None, finale=corrente, errore="altro",
                           dettaglio=f"{type(e).__name__}: {str(e)[:150]}")
                return ris
        # risposta ottenuta
        ris.update(status=st, finale=corrente, ctype=hd.get("Content-Type", ""),
                   cf=hd.get("cf-mitigated", ""), sg=hd.get("sg-captcha", ""), server=hd.get("Server", ""))
        if ris["cf"] or ris["sg"]:
            return ris  # pagina di controllo anti-robot: non la seguo
        if 300 <= st < 400 and hd.get("Location"):
            nuovo = urljoin(corrente, hd["Location"].strip())
            if nuovo in visti:
                ris.update(status=None, errore="redirect", dettaglio="reindirizzamenti in ciclo infinito")
                return ris
            visti.add(corrente)
            ris["catena"].append(corrente)
            corrente = nuovo
            continue
        html = decodifica(corpo, enc) if corpo else ""
        if 200 <= st < 300 and html:
            nuovo = meta_refresh(html[:20000], corrente)
            if nuovo and nuovo.rstrip("/") != corrente.rstrip("/") and nuovo not in visti:
                visti.add(corrente)
                ris["catena"].append(corrente)
                corrente = nuovo
                continue
        if html:
            t, c, x, fr = testo_da_html(html)
            ris.update(titolo=t, testo=c, extra=x, frames=fr)
        return ris
    ris.update(status=None, errore="redirect", dettaglio="troppi reindirizzamenti")
    return ris


def varianti(url):
    p = urlparse(url)
    h = p.hostname or ""
    alt_h = h[4:] if h.startswith("www.") else "www." + h
    out = []
    for sch, host in (("https", alt_h), ("http", h), ("http", alt_h), ("https", h)):
        u = urlunparse((sch, host, p.path or "/", p.params, p.query, ""))
        if u != url and u not in out:
            out.append(u)
    return out


def prova_varianti(url):
    for v in varianti(url):
        r = scarica_http(v, timeout=(10, 20), tentativi_max=1)
        if r.get("status") and 200 <= r["status"] < 300 and len(r.get("testo") or "") > 150 and not e_sfida(r):
            return r["finale"]
    return None


def browser_uno(u):
    """Apre un solo indirizzo con Chromium (esegue il JavaScript)."""
    from playwright.sync_api import sync_playwright
    r = {"url": u, "errore": None}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(user_agent=UA, locale="it-IT", viewport={"width": 1366, "height": 900})
        pg = ctx.new_page()
        pg.set_default_timeout(20000)
        try:
            resp = pg.goto(u, timeout=45000, wait_until="load")
            try:
                pg.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass
            t, c, x, _ = testo_da_html(pg.content())
            for f in pg.frames[1:]:
                try:
                    _, c2, x2, _ = testo_da_html(f.content())
                    c += " " + c2
                    x += " " + x2
                except Exception:
                    pass
            st = resp.status if resp else None
            if e_errore_rete_locale(st, c):
                r.update(status=None, finale=u, errore="connessione non riuscita")
            else:
                r.update(status=st, finale=pg.url, titolo=t, testo=c, extra=x)
        except Exception as e:
            r.update(status=None, finale=u, errore=str(e).splitlines()[0][:200])
        b.close()
    return r


def scarica_browser(urls, salva_uno, n_thread=3):
    """Ogni indirizzo viene aperto in un processo separato con un limite di tempo,
    cosi' una pagina che blocca il browser non ferma tutto il resto."""
    fatti = [0]
    lk = threading.Lock()

    def uno(u):
        try:
            out = subprocess.run([sys.executable, os.path.abspath(__file__), "--browser", u],
                                 capture_output=True, timeout=100, text=True)
            r = json.loads(out.stdout.strip().splitlines()[-1])
        except subprocess.TimeoutExpired:
            r = {"url": u, "status": None, "finale": u, "errore": "la pagina blocca il browser (oltre 100 s)"}
        except Exception as e:
            r = {"url": u, "status": None, "finale": u, "errore": f"errore del browser: {type(e).__name__}"}
        with lk:
            salva_uno(u, r)
            fatti[0] += 1
            if fatti[0] % 20 == 0:
                log("browser:", fatti[0])

    with ThreadPoolExecutor(n_thread) as ex:
        list(ex.map(uno, urls))


# ---------------------------------------------------------------- classificazione


GENERICHE = set("""museo musei museum museums civico civica civici civiche di del della delle dei degli dello
e ed il la lo le i gli l d a al alla allo ai agli alle in nel nella nei per con da dal dalla su sul the of and
collezione collezioni raccolta raccolte fondazione sede sale sala centro spazio mostra mostre permanente percorso
percorsi visita storico storica storici arte arti s san santa sant it www ecomuseo archeologico archeologica
nazionale regionale diocesano diocesana municipale comunale museale polo sistema rete area parco art gallery
scienze naturali naturale storia tesoro pinacoteca galleria biblioteca archivio casa chiesa""".split())
PAROLE_VUOTE = set("di del della delle dei degli dello e ed il la lo le gli al alla allo ai agli alle in nel nella "
                   "nei per con da dal dalla su sul the of and".split())
SEGMENTI_BANALI = {"it", "ita", "it-it", "it_it", "en", "eng", "en-gb", "en-us", "home", "homepage",
                   "home-page", "index", "default", "main", "portale", "web", "site", "sito"}


def host_senza_www(u):
    h = (urlparse(u).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def path_norm(u):
    segs = []
    for s in urlparse(u).path.lower().split("/"):
        s = re.sub(r"\.(html?|php|aspx?|jsp)$", "", s)
        if s:
            segs.append(s)
    while segs and segs[0] in SEGMENTI_BANALI:
        segs.pop(0)
    while segs and segs[-1] in SEGMENTI_BANALI:
        segs.pop()
    return "/".join(segs)


def e_home(u):
    return path_norm(u) == "" and not urlparse(u).query


def e_social(u):
    h = host_senza_www(u)
    return any(h == s or h.endswith("." + s) for s in SOCIAL)


def e_ente(u):
    h = host_senza_www(u)
    return bool(re.search(r"(^|\.)comune\.|\.gov\.it$|(^|\.)regione\.|(^|\.)provincia\.|cittametropolitana|"
                          r"unione|diocesi|chiesacattolica|beniculturali|cultura\.gov|parrocchia|"
                          r"fondazione|comunita|montana", h))


def token_distintivi(nome, comune=""):
    del_comune = set(norm(comune).split())
    return [t for t in norm(nome).split() if len(t) >= 4 and t not in GENERICHE and t not in del_comune]


def etichetta_dominio(u):
    parti = host_senza_www(u).split(".")
    return "".join(parti[:-1]).replace("-", "") if len(parti) > 1 else parti[0]


def nome_trovato(nome, comune, testo_n, url):
    n = norm(nome)
    if len(n.strip()) >= 6 and n in testo_n:
        return True
    for parte in re.split(r"\s+[-–|:]\s+|\s*\|\s*", nome):
        p = norm(parte)
        if len(p.strip()) >= 10 and p in testo_n and p.strip() not in ("museo civico", "museo diocesano"):
            return True
    parole = [t for t in norm(nome).split() if len(t) >= 3 and t not in PAROLE_VUOTE]
    if len(parole) >= 2 and sum(1 for t in parole if f" {t} " in testo_n) >= 0.8 * len(parole):
        return True
    tok = token_distintivi(nome, comune)
    if tok:
        presenti = sum(1 for t in tok if f" {t} " in testo_n)
        if presenti >= max(1, round(len(tok) * 2 / 3)):
            return True
        percorso = norm(urlparse(url).path + " " + urlparse(url).query)
        if any(f" {t} " in percorso for t in tok if len(t) >= 5):
            return True
    return False


def dominio_proprio(nome, comune, u):
    lab = etichetta_dominio(u)
    return any(t in lab for t in token_distintivi(nome, comune))


def redirect_significativo(orig, fin):
    if host_senza_www(orig) != host_senza_www(fin):
        return True
    return path_norm(orig) != path_norm(fin)


def analizza_pagina(m, r):
    """r: risultato (http o browser) con status 2xx. Restituisce (esito, note)."""
    note = []
    titolo, corpo, extra = r.get("titolo", ""), r.get("testo", ""), r.get("extra", "")
    tutto_n = norm(titolo + " " + corpo + " " + extra)
    fin = r.get("finale") or m["sito"]
    if e_social(fin):
        return "SOLO SOCIAL", [f"reindirizza a una pagina social ({fin})"]
    sf = e_sfida(r)
    if sf:
        return "BLOCCATO", [sf]
    if any(k in (urlparse(fin).hostname or "") for k in PARCHEGGIATORI):
        return "DUBBIO", [f"dominio parcheggiato, probabilmente scaduto o in vendita (finisce su {fin})"]
    azz = [k for k in AZZARDO if norm(k) in tutto_n]
    if len(azz) >= 2:
        return "DUBBIO", ["contenuto estraneo (gioco d'azzardo/scommesse: " + ", ".join(azz[:3])
                          + "): probabile dominio scaduto e ricomprato da altri"]
    for k in PARCHEGGIO_FORTE:
        if norm(k) in tutto_n and len(corpo) < 6000:
            return "DUBBIO", [f"sembra un dominio in vendita/parcheggiato o sospeso (compare {k!r})"]
    if len(corpo) < 1500:
        for k in PARCHEGGIO_DEBOLE:
            if norm(k) in tutto_n:
                return "DUBBIO", [f"pagina provvisoria o di default (compare {k!r})"]
    if len(corpo.strip()) < 150:
        return "DUBBIO", [f"pagina quasi vuota ({len(corpo.strip())} caratteri di testo)"]
    nh = nome_trovato(m["nome"], m["comune"], tutto_n, fin)
    ch = bool(m["comune"]) and norm(m["comune"]) in tutto_n
    red = redirect_significativo(m["sito"], fin)
    if red:
        note.append(f"finisce su {fin}")
    if not e_home(m["sito"]) and e_home(fin) and red and not dominio_proprio(m["nome"], m["comune"], fin):
        note.append("la pagina indicata non esiste piu' e rimanda alla home page del sito")
        return "GENERICO", note
    if not nh and e_home(fin) and not dominio_proprio(m["nome"], m["comune"], fin):
        note.append("home page di un ente o di un altro sito: il nome del museo non compare")
        return "GENERICO", note
    if not nh and not ch:
        note.append("nel testo non compaiono ne' il nome del museo ne' il comune")
        return "DUBBIO", note
    if not nh and e_ente(fin):
        note.append("pagina di un ente che non sembra parlare del museo (compare solo il comune)")
        return "DUBBIO", note
    if not nh:
        note.append("compare il comune ma non il nome esatto del museo")
    return ("REINDIRIZZA" if red else "FUNZIONA"), note


def ok(r):
    return bool(r) and bool(r.get("status")) and 200 <= r["status"] < 300 and r.get("testo") is not None


def nota_browser(m, rb):
    if ok(rb):
        e2, n2 = analizza_pagina(m, rb)
        if e2 in ("FUNZIONA", "REINDIRIZZA"):
            return "nel browser automatico (Chromium) invece si apre e cita il museo o il comune"
        if e2 == "BLOCCATO":
            return "anche il browser automatico viene fermato dalla protezione anti-robot"
        return f"nel browser automatico si apre, ma l'esito sarebbe {e2} (" + "; ".join(n2) + ")"
    if rb:
        if rb.get("status"):
            return f"anche il browser automatico riceve il codice {rb['status']}"
        return "anche il browser automatico non riesce ad aprirlo"
    return None


def classifica(m, rh, rb, variante):
    """rh: risultato client semplice; rb: risultato browser (o None)."""
    note = [rh["nota_cert"]] if rh.get("nota_cert") else []
    st = rh.get("status")
    # 1) il sito rifiuta i programmi
    sf = e_sfida(rh)
    if st in (403, 429) or sf:
        note.append(f"risponde {st} al programma" + (f": {sf}" if sf else ""))
        nb = nota_browser(m, rb)
        if nb:
            note.append(nb)
        return "BLOCCATO", st, rh.get("finale"), note
    # 2) pagina scaricata
    if ok(rh):
        esito, n = analizza_pagina(m, rh)
        if esito in ("DUBBIO", "GENERICO") and ok(rb):
            e2, n2 = analizza_pagina(m, rb)
            if e2 in ("FUNZIONA", "REINDIRIZZA", "SOLO SOCIAL") or (e2 == "GENERICO" and esito == "DUBBIO"):
                return e2, rb["status"], rb["finale"], note + n2 + [
                    "testo letto con il browser (la pagina si costruisce con JavaScript)"]
        return esito, st, rh.get("finale"), note + n
    # 3) errore del client semplice: il browser ci riesce?
    err = rh.get("errore")
    if err == "rete_locale":
        return "DUBBIO", None, rh.get("finale"), note + [rh["dettaglio"]]
    if err not in ("dns", "ssl") and ok(rb) and st not in (404, 410):
        e2, n2 = analizza_pagina(m, rb)
        motivo = rh.get("dettaglio") or f"codice {st}"
        return e2, rb["status"], rb["finale"], note + [
            f"al primo controllo non si apriva ({motivo}), il browser automatico si'"] + n2
    if st in (404, 410):
        motivo = f"pagina inesistente ({st})"
    elif st and st >= 500:
        motivo = f"errore del server ({st})"
    elif st:
        motivo = f"errore HTTP {st}"
    else:
        motivo = rh.get("dettaglio") or err
    note.append(motivo)
    if err in ("timeout", "connessione") and not (rb and rb.get("status")):
        note.append(NOTA_ESTERO)
    elif rb and rb.get("status") and rb.get("status") != st:
        note.append(f"nel browser automatico: codice {rb['status']}")
    if variante:
        note.append(f"funziona invece l'indirizzo {variante}")
    return "NON FUNZIONA", st, rh.get("finale"), note


def serve_browser(m, rh):
    if not rh or e_social(m["sito"]):
        return False
    if rh.get("errore") in ("dns", "ssl", "rete_locale"):
        return False
    if rh.get("status") in (404, 410):
        return False
    if not ok(rh) or e_sfida(rh):
        return True
    esito, _ = analizza_pagina(m, rh)
    return esito in ("DUBBIO", "GENERICO")


def main():
    musei = json.load(open(os.path.join(DATI, "musei.json"), encoding="utf-8"))
    cache_path = os.path.join(DATI, "cache_http.json")
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
    for u in [u for u, r in cache.items() if e_errore_rete_locale(r.get("status"), r.get("testo"))]:
        del cache[u]  # risposta generata dalla rete di questo computer: da riprovare
    tutti = sorted({m["sito"] for m in musei if m.get("sito") and not e_social(m["sito"])})
    da_fare = [u for u in tutti if u not in cache]
    log(f"indirizzi da aprire: {len(da_fare)} (gia' in cache: {len(tutti) - len(da_fare)})")
    lk = threading.Lock()

    def salva():
        json.dump(cache, open(cache_path, "w", encoding="utf-8"), ensure_ascii=False)

    def uno(u):
        r = scarica_http(u)
        with lk:
            cache[u] = r
            if len(cache) % 25 == 0:
                log("aperti:", len(cache))
                salva()

    with ThreadPoolExecutor(THREAD) as ex:
        list(ex.map(uno, da_fare))
    salva()

    # secondo giro, piu' lento, per chi non ha risposto
    rifare = [u for u in tutti if cache[u].get("errore") in ("timeout", "connessione", "altro")
              and not cache[u].get("riprovato")]
    if rifare:
        log(f"secondo giro per {len(rifare)} indirizzi che non hanno risposto (dopo 90 s di pausa)")
        time.sleep(90)
        for u in rifare:
            r = scarica_http(u, timeout=(20, 40))
            r["riprovato"] = True
            if r.get("errore") in ("timeout", "connessione", "altro"):
                r["dettaglio"] = (r.get("dettaglio") or "") + " (anche al secondo giro)"
            cache[u] = r
            time.sleep(1)
        salva()

    # browser
    bcache_path = os.path.join(DATI, "cache_browser.json")
    bcache = json.load(open(bcache_path, encoding="utf-8")) if os.path.exists(bcache_path) else {}
    for u, r in bcache.items():
        if e_errore_rete_locale(r.get("status"), r.get("testo")):
            r.update(status=None, errore="connessione non riuscita", testo=None)
    per_browser = sorted({m["sito"] for m in musei if m.get("sito") and serve_browser(m, cache.get(m["sito"]))}
                         - set(bcache))
    log(f"da riaprire con il browser: {len(per_browser)}")
    if per_browser:
        def salva_uno(u, r):
            bcache[u] = r
            json.dump(bcache, open(bcache_path, "w", encoding="utf-8"), ensure_ascii=False)
        scarica_browser(per_browser, salva_uno)

    # varianti per i link rotti
    vcache_path = os.path.join(DATI, "cache_varianti.json")
    vcache = json.load(open(vcache_path, encoding="utf-8")) if os.path.exists(vcache_path) else {}
    rotti = [u for u in tutti if cache[u].get("errore") in ("ssl", "dns", "timeout", "connessione")
             and not ok(bcache.get(u)) and u not in vcache]
    log(f"provo le varianti (www / http) per {len(rotti)} link rotti")
    with ThreadPoolExecutor(THREAD) as ex:
        for u, v in zip(rotti, ex.map(prova_varianti, rotti)):
            vcache[u] = v
    json.dump(vcache, open(vcache_path, "w", encoding="utf-8"), ensure_ascii=False)

    oggi = time.strftime("%d/%m/%Y")
    for m in musei:
        m["data"] = oggi
        if not m.get("sito"):
            m.update(esito="nessun sito trovato", codice=None, finale="")
            continue
        if e_social(m["sito"]):
            m.update(esito="SOLO SOCIAL", codice=None, finale="")
            m["note"] = m["note"] + ["il link e' una pagina Facebook/Instagram"]
            continue
        esito, cod, fin, note = classifica(m, cache[m["sito"]], bcache.get(m["sito"]), vcache.get(m["sito"]))
        m.update(esito=esito, codice=cod, finale=fin or "")
        m["note"] = m["note"] + note
    for m in musei:
        if m.get("altri_siti") and m["esito"] not in ("FUNZIONA", "REINDIRIZZA"):
            for alt in m["altri_siti"]:
                r = scarica_http(alt)
                e2 = analizza_pagina(dict(m, sito=alt), r)[0] if ok(r) else "NON FUNZIONA"
                m["note"].append(f"l'altro indirizzo riportato nella scheda ({alt}) "
                                 + ("invece funziona" if e2 in ("FUNZIONA", "REINDIRIZZA") else f"da' esito {e2}"))
    json.dump(musei, open(os.path.join(DATI, "verifica.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(dict(Counter(m["esito"] for m in musei)))


if __name__ == "__main__":
    if sys.argv[1:2] == ["--browser"]:
        print(json.dumps(browser_uno(sys.argv[2]), ensure_ascii=False))
    else:
        main()
