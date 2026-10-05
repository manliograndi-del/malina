/* Compilatutto – interfaccia dell'app. I dati restano nel localStorage di questo browser. */
(function () {
  'use strict';

  const CHIAVE = 'compilatutto.v1';
  const inCornice = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Dati che il motore usa per riconoscere i campi
  const DATI_MOTORE = {
    campi: CT.campi.map(function (c) { return { k: c.k, sin: c.sin, escl: c.escl, rel: c.rel, doc: c.doc }; }),
    spazi: CT.spazi, stop: CT.stop, salta: CT.salta, org: CT.org, altriAdulto: CT.altriAdulto,
    altriMinore: CT.altriMinore, altriDoc: CT.altriDoc, padre: CT.padre, madre: CT.madre,
    conferma: CT.conferma, mesi: CT.mesi, prov: CT.province,
  };
  // Il segnalibro porta con sé solo ciò che serve sulle pagine web
  const DATI_SEGNALIBRO = Object.assign({}, DATI_MOTORE, {
    campi: DATI_MOTORE.campi.filter(function (c) { return !c.doc; }),
    spazi: [], altriDoc: [],
  });

  const ESEMPIO = {
    n: 'Esempio – Mario Rossi', t: 'adulto',
    d: {
      nome: 'Mario', cognome: 'Rossi', sesso: 'M', data_nascita: '1980-03-12', luogo_nascita: 'Roma',
      provincia_nascita: 'RM', nazione_nascita: 'Italia', codice_fiscale: 'RSSMRA80C12H501E', cittadinanza: 'Italiana',
      nome_padre: 'Giuseppe', nome_madre: 'Anna', cognome_madre: 'Bianchi', indirizzo: 'Via Appia Nuova', civico: '12',
      cap: '00183', citta: 'Roma', provincia: 'RM', nazione: 'Italia', telefono: '333 1234567',
      email: 'mario.rossi@esempio.it', tipo_documento: "Carta d'identità elettronica", numero_documento: 'CA12345AB',
      rilasciato_da: 'Comune di Roma', data_rilascio: '2021-05-04', scadenza_documento: '2032-03-12', professione: 'Impiegato',
    },
    x: [{ e: 'IBAN', v: 'IT60X0542811101000000123456', p: 'iban, conto corrente' }],
  };

  // ---------- Stato ----------
  function nuovoId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function nuovoProfilo(nome) { return { id: nuovoId(), n: nome || 'Il mio profilo', t: 'adulto', d: {}, x: [] }; }
  function carica() {
    try {
      const s = JSON.parse(localStorage.getItem(CHIAVE));
      if (s && Array.isArray(s.profili) && s.profili.length) {
        if (!s.profili.some(function (p) { return p.id === s.attivo; })) { s.attivo = s.profili[0].id; }
        return s;
      }
    } catch (e) { /* memoria non disponibile */ }
    const p = nuovoProfilo();
    return { profili: [p], attivo: p.id, scheda: 'dati' };
  }
  let stato = carica();
  let salvataggioOk = true;
  function salva() {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(stato));
      salvataggioOk = true;
    } catch (e) {
      salvataggioOk = false;
    }
    mostraSalvato();
  }
  function profilo() {
    return stato.profili.find(function (p) { return p.id === stato.attivo; }) || stato.profili[0];
  }
  function datiPuliti(p) {
    const d = {};
    Object.keys(p.d || {}).forEach(function (k) { if (String(p.d[k] || '').trim()) { d[k] = String(p.d[k]).trim(); } });
    return { n: p.n, t: p.t, d: d, x: (p.x || []).filter(function (x) { return x.v; }) };
  }
  function vuotoProfilo(p) { return !Object.keys(datiPuliti(p).d).length && !(p.x || []).some(function (x) { return x.v; }); }
  function impronta(p) {
    const s = JSON.stringify(datiPuliti(p));
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return String(h);
  }
  function api(doc) { return compilaModulo(datiPuliti(profilo()), DATI_MOTORE, { api: true, doc: !!doc }); }

  // ---------- Avvisi ----------
  let timerAvviso = null;
  function avvisa(testo) {
    const a = $('#avviso');
    a.textContent = testo;
    a.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { a.hidden = true; }, 3200);
  }
  function mostraSalvato() {
    const s = $('#stato-salvataggio');
    if (!salvataggioOk) {
      s.textContent = 'Non riesco a salvare in questo browser (finestra anonima o memoria bloccata): i dati andranno persi alla chiusura.';
      s.className = 'stato-salvataggio no';
      return;
    }
    const ora = new Date();
    s.textContent = 'Salvato su questo dispositivo alle ' + ora.getHours() + ':' + String(ora.getMinutes()).padStart(2, '0') + '.';
    s.className = 'stato-salvataggio';
  }
  function copia(testo, messaggio) {
    const fallback = function () {
      const t = document.createElement('textarea');
      t.value = testo;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      avvisa(ok ? messaggio : 'Non riesco a copiare: tieni premuto sul testo e scegli Copia.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(testo).then(function () { avvisa(messaggio); }, fallback);
    } else {
      fallback();
    }
  }
  function scarica(nome, tipo, contenuto) {
    const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  // ---------- Codice fiscale ----------
  const DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13,
    G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22,
    X: 25, Y: 24, Z: 23 };
  function controllaCF(valore) {
    const cf = String(valore || '').toUpperCase().replace(/\s+/g, '');
    if (!cf) { return null; }
    if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) {
      return { ok: false, msg: 'Il codice fiscale ha 16 caratteri: 6 lettere, 2 cifre, 1 lettera, 2 cifre, 1 lettera, 3 cifre, 1 lettera.' };
    }
    let s = 0;
    for (let i = 0; i < 15; i++) {
      const c = cf.charAt(i);
      s += i % 2 === 0 ? DISPARI[c] : (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);
    }
    if (String.fromCharCode(65 + (s % 26)) !== cf.charAt(15)) {
      return { ok: false, msg: 'L\'ultimo carattere non torna: controlla di aver copiato bene il codice.' };
    }
    const cifra = function (ch) { return /\d/.test(ch) ? ch : String('LMNPQRSTUV'.indexOf(ch)); };
    const aa = Number(cifra(cf.charAt(6)) + cifra(cf.charAt(7)));
    const mese = 'ABCDEHLMPRST'.indexOf(cf.charAt(8)) + 1;
    let gg = Number(cifra(cf.charAt(9)) + cifra(cf.charAt(10)));
    const sesso = gg > 40 ? 'F' : 'M';
    if (gg > 40) { gg -= 40; }
    const anno = (aa > new Date().getFullYear() % 100 ? 1900 : 2000) + aa;
    const iso = anno + '-' + String(mese).padStart(2, '0') + '-' + String(gg).padStart(2, '0');
    return { ok: true, sesso: sesso, iso: iso };
  }
  function dataIt(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
  }
  function aggiornaCF() {
    const p = profilo();
    const box = $('#esito-cf');
    if (!box) { return; }
    const r = controllaCF(p.d.codice_fiscale);
    box.textContent = '';
    box.className = 'esito-cf';
    if (!r) { return; }
    if (!r.ok) { box.className = 'esito-cf no'; box.textContent = r.msg; return; }
    box.className = 'esito-cf ok';
    const diversi = (p.d.data_nascita && p.d.data_nascita !== r.iso) || (p.d.sesso && p.d.sesso !== r.sesso);
    const testo = document.createElement('span');
    testo.textContent = diversi
      ? 'Codice valido, ma indica ' + (r.sesso === 'F' ? 'nata' : 'nato') + ' il ' + dataIt(r.iso) + ' (' + r.sesso + '): è diverso da quello che hai scritto, controlla.'
      : 'Codice valido.';
    if (diversi) { box.className = 'esito-cf no'; }
    box.appendChild(testo);
    if (!p.d.data_nascita || !p.d.sesso) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-piccolo';
      b.textContent = 'Ricava data di nascita e sesso';
      b.addEventListener('click', function () {
        if (!p.d.data_nascita) { p.d.data_nascita = r.iso; }
        if (!p.d.sesso) { p.d.sesso = r.sesso; }
        salva();
        disegnaDati();
        aggiornaTutto();
      });
      box.appendChild(b);
    }
  }

  // ---------- Scheda «I miei dati» ----------
  function campoInput(c, p) {
    const id = 'f-' + c.k;
    const wrap = document.createElement('div');
    wrap.className = 'campo' + (c.tipo === 'cf' ? ' campo-cf' : '');
    const lab = document.createElement('label');
    lab.className = 'etichetta';
    lab.htmlFor = id;
    lab.textContent = c.e;
    wrap.appendChild(lab);
    let inp;
    if (c.tipo === 'sesso') {
      inp = document.createElement('select');
      [['', '—'], ['M', 'M – maschio'], ['F', 'F – femmina']].forEach(function (o) {
        const op = document.createElement('option');
        op.value = o[0];
        op.textContent = o[1];
        inp.appendChild(op);
      });
    } else {
      inp = document.createElement('input');
      inp.type = c.tipo === 'data' ? 'date' : (c.tipo === 'email' ? 'email' : (c.tipo === 'tel' ? 'tel' : 'text'));
      if (c.es) { inp.placeholder = c.es; }
      if (c.tipo === 'prov') { inp.setAttribute('list', 'lista-province'); inp.maxLength = 40; }
      if (c.tipo === 'doc') { inp.setAttribute('list', 'lista-documenti'); }
      if (c.tipo === 'cap') { inp.inputMode = 'numeric'; inp.maxLength = 5; }
      if (c.tipo === 'cf') { inp.maxLength = 16; inp.autocapitalize = 'characters'; }
      inp.spellcheck = false;
    }
    inp.id = id;
    inp.name = 'ct-' + c.k;
    inp.autocomplete = 'off';
    inp.value = p.d[c.k] || '';
    inp.addEventListener('input', function () {
      let v = inp.value;
      if (c.tipo === 'cf') { v = v.toUpperCase(); }
      profilo().d[c.k] = v;
      salvaPresto();
      if (c.tipo === 'cf' || c.k === 'data_nascita' || c.k === 'sesso') { aggiornaCF(); }
    });
    inp.addEventListener('change', function () {
      if (c.tipo === 'prov') {
        const sg = api().sigla(inp.value);
        if (sg) { inp.value = sg; profilo().d[c.k] = sg; salvaPresto(); }
      }
    });
    wrap.appendChild(inp);
    if (c.k === 'cognome_padre') {
      const a = document.createElement('span');
      a.className = 'aiuto';
      a.textContent = 'Se lo lasci vuoto uso il tuo cognome.';
      wrap.appendChild(a);
    }
    if (c.tipo === 'cf') {
      const e = document.createElement('div');
      e.id = 'esito-cf';
      e.className = 'esito-cf';
      e.setAttribute('aria-live', 'polite');
      wrap.appendChild(e);
    }
    return wrap;
  }
  function disegnaDati() {
    const p = profilo();
    const box = $('#gruppi-dati');
    box.textContent = '';
    CT.gruppi.forEach(function (g) {
      const fs = document.createElement('fieldset');
      fs.className = 'gruppo';
      const lg = document.createElement('legend');
      lg.textContent = g.titolo;
      fs.appendChild(lg);
      const gr = document.createElement('div');
      gr.className = 'griglia';
      CT.campi.filter(function (c) { return c.g === g.g; }).forEach(function (c) { gr.appendChild(campoInput(c, p)); });
      fs.appendChild(gr);
      box.appendChild(fs);
    });
    $('#f-nome-profilo').value = p.n || '';
    $('#tipo-adulto').checked = p.t !== 'minore';
    $('#tipo-minore').checked = p.t === 'minore';
    $('#inizio').hidden = !(stato.profili.length === 1 && vuotoProfilo(p));
    disegnaExtra();
    aggiornaCF();
  }
  function disegnaExtra() {
    const p = profilo();
    const box = $('#extra');
    box.textContent = '';
    box.style.display = 'grid';
    box.style.gap = '12px';
    (p.x || []).forEach(function (x, i) {
      const riga = document.createElement('div');
      riga.className = 'extra-riga';
      [['e', 'Nome del dato', 'Es. IBAN'], ['v', 'Valore', 'Es. IT60X05428...'], ['p', 'Parole chiave (separate da virgola)', 'Es. iban, conto corrente']].forEach(function (f) {
        const c = document.createElement('div');
        c.className = 'campo';
        const l = document.createElement('label');
        l.className = 'etichetta';
        l.htmlFor = 'x-' + i + '-' + f[0];
        l.textContent = f[1];
        const inp = document.createElement('input');
        inp.id = 'x-' + i + '-' + f[0];
        inp.placeholder = f[2];
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.value = x[f[0]] || '';
        inp.addEventListener('input', function () { x[f[0]] = inp.value; salvaPresto(); });
        c.appendChild(l);
        c.appendChild(inp);
        riga.appendChild(c);
      });
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-piccolo btn-pericolo';
      del.textContent = 'Togli';
      del.setAttribute('aria-label', 'Togli ' + (x.e || 'questo dato'));
      del.addEventListener('click', function () { p.x.splice(i, 1); salva(); disegnaExtra(); aggiornaTutto(); });
      riga.appendChild(del);
      box.appendChild(riga);
    });
  }
  let timerSalva = null;
  function salvaPresto() {
    clearTimeout(timerSalva);
    timerSalva = setTimeout(function () { salva(); aggiornaTutto(); }, 250);
  }
  function disegnaProfili() {
    const sel = $('#sel-profilo');
    sel.textContent = '';
    stato.profili.forEach(function (p) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.n || 'Senza nome';
      sel.appendChild(o);
    });
    sel.value = stato.attivo;
  }

  // ---------- Segnalibro «Compila» ----------
  function codiceSegnalibro(p) {
    const sorgente = compilaModulo.toString().split('\n')
      .filter(function (r) { return !/^\s*\/\//.test(r); })
      .map(function (r) { return r.trim(); })
      .filter(Boolean)
      .join('\n');
    const codice = '(' + sorgente + ')(' + JSON.stringify(datiPuliti(p)) + ',' + JSON.stringify(DATI_SEGNALIBRO) + ');void 0';
    return 'javascript:' + encodeURIComponent(codice);
  }
  function aggiornaSegnalibro() {
    const p = profilo();
    const a = $('#segnalibro');
    a.href = codiceSegnalibro(p);
    const nome = 'Compila' + (stato.profili.length > 1 ? ' · ' + (p.n || '') : '');
    $('#segnalibro-nome').textContent = nome;
    a.title = nome;
    $('#vecchio').hidden = !(p.segnalibro && p.segnalibro !== impronta(p));
  }
  function segnalibroCreato() {
    const p = profilo();
    p.segnalibro = impronta(p);
    salva();
    $('#vecchio').hidden = true;
  }

  // ---------- Modulo di prova ----------
  function preparaListe() {
    const lp = document.createElement('datalist');
    lp.id = 'lista-province';
    Object.keys(CT.province).forEach(function (s) {
      const o = document.createElement('option');
      o.value = s;
      o.label = CT.province[s];
      lp.appendChild(o);
    });
    const ld = document.createElement('datalist');
    ld.id = 'lista-documenti';
    ["Carta d'identità elettronica", "Carta d'identità cartacea", 'Patente di guida', 'Passaporto'].forEach(function (t) {
      const o = document.createElement('option');
      o.value = t;
      ld.appendChild(o);
    });
    document.body.appendChild(lp);
    document.body.appendChild(ld);
  }
  function preparaModuloProva() {
    const sel = $('#mp-prov');
    const vuota = document.createElement('option');
    vuota.value = '';
    vuota.textContent = '— scegli —';
    sel.appendChild(vuota);
    Object.keys(CT.province).sort(function (a, b) { return CT.province[a].localeCompare(CT.province[b], 'it'); }).forEach(function (s) {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = CT.province[s] + ' (' + s + ')';
      sel.appendChild(o);
    });
  }
  function svuotaProva() {
    const f = $('#modulo-prova');
    f.reset();
    $$('input,select,label', f).forEach(function (e) { e.style.outline = ''; e.style.outlineOffset = ''; });
    $('#esito-prova').textContent = '';
  }

  // ---------- Lettere e documenti ----------
  const ES_AUTO = [
    '<p style="text-align:center"><strong>DICHIARAZIONE SOSTITUTIVA DI CERTIFICAZIONE</strong><br>(art. 46 D.P.R. 28 dicembre 2000, n. 445)</p>',
    '<p>Il/La sottoscritto/a ______________________ nato/a a ________________ (____) il ____________, codice fiscale ____________________, residente a ________________ (____) in via ________________________ n. ______,</p>',
    '<p>consapevole delle sanzioni penali previste dall\'art. 76 del D.P.R. 445/2000 per le dichiarazioni false,</p>',
    '<p style="text-align:center"><strong>DICHIARA</strong></p>',
    '<p>di essere figlio/a di ____________________ e di ____________________.</p>',
    '<p>[Luogo], [Data]</p>',
    '<p style="text-align:right">Il/La dichiarante<br>[Firma]</p>',
  ].join('');
  const ES_LETTERA = [
    '<p>Spett.le Ufficio Anagrafe<br>Comune di [Comune destinatario]</p>',
    '<p><strong>Oggetto: richiesta di certificato di residenza</strong></p>',
    '<p>Il sottoscritto [Nome e cognome], nato a [Luogo di nascita] ([Provincia di nascita]) il [Data di nascita], codice fiscale [Codice fiscale], residente in [Indirizzo completo],</p>',
    '<p>chiede il rilascio del certificato di residenza in carta semplice.</p>',
    '<p>Per comunicazioni: tel. [Telefono], e-mail [Email].</p>',
    '<p>[Luogo], [Data]</p>',
    '<p style="text-align:right">[Nome e cognome]</p>',
  ].join('');

  const BLOCCHI = 'p,div,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre,tr';
  function completaDocumento() {
    const box = $('#documento');
    const A = api(true);
    const etichette = {};
    CT.campi.forEach(function (c) { etichette[c.k] = c.e; });
    (profilo().x || []).forEach(function (x, i) { etichette['x' + i] = x.e; });

    // Ripristina i punti rimasti da completare in un passaggio precedente
    $$('.ct-manca', box).forEach(function (s) { s.replaceWith(document.createTextNode(s.dataset.orig || s.textContent)); });
    box.normalize();

    const RE = /\[([^\[\]\n]{1,60})\]|\{\{\s*([^{}\n]{1,60}?)\s*\}\}|(_{3,}|\.{4,}|…{2,})/g;
    const trovati = [];
    const w = document.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) { return n.classList.contains('ct-valore') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let blocco = null;
    let prec = '';
    let coda = '';
    let n = w.nextNode();
    while (n) {
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') { prec = ''; coda = ''; }
        n = w.nextNode();
        continue;
      }
      const b = (n.parentElement && n.parentElement.closest(BLOCCHI)) || box;
      const bb = box.contains(b) ? b : box;
      if (bb !== blocco) { blocco = bb; prec = ''; coda = ''; }
      const t = n.nodeValue;
      RE.lastIndex = 0;
      let m;
      let ultimo = 0;
      while ((m = RE.exec(t))) {
        const prima = coda + t.slice(ultimo, m.index);
        const interno = m[1] || m[2] || '';
        let k = null;
        let descr = '';
        if (m[3]) {
          k = A.spazio(prima, prec);
          descr = prima;
        } else {
          if (!/[a-zà-ú]/i.test(interno)) { continue; }
          k = A.riconosci(interno);
          descr = interno;
        }
        trovati.push({ nodo: n, da: m.index, a: m.index + m[0].length, k: k, orig: m[0], descr: descr });
        prec = k || '';
        coda = '';
        ultimo = m.index + m[0].length;
      }
      coda = (coda + t.slice(ultimo)).slice(-120);
      n = w.nextNode();
    }

    const unisciCivico = !trovati.some(function (f) { return f.k === 'civico'; });
    let inseriti = 0;
    let mancanti = 0;
    for (let i = trovati.length - 1; i >= 0; i--) {
      const f = trovati[i];
      const val = f.k ? A.valore(f.k, f.descr, { unisciCivico: unisciCivico }) : '';
      f.nodo.splitText(f.a);
      const mezzo = f.nodo.splitText(f.da);
      const s = document.createElement('span');
      if (val) {
        s.className = 'ct-valore';
        s.dataset.k = f.k;
        s.title = etichette[f.k] || '';
        s.textContent = val;
        inseriti++;
      } else {
        s.className = 'ct-manca';
        s.dataset.orig = f.orig;
        s.title = f.k ? 'Manca il dato «' + (etichette[f.k] || f.k) + '»: aggiungilo in «I miei dati»' : 'Da completare a mano';
        s.textContent = f.orig;
        mancanti++;
      }
      mezzo.replaceWith(s);
    }
    const adattate = $('#adatta-genere').checked ? adattaGenere(box, profilo().d.sesso) : 0;
    mostraRiepilogo(inseriti, mancanti, adattate, trovati.length);
  }
  function adattaGenere(box, sesso) {
    const s = String(sesso || '').toUpperCase();
    if (s !== 'M' && s !== 'F') { return 0; }
    const f = s === 'F';
    let conta = 0;
    const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement.closest('.ct-valore,.ct-manca') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; },
    });
    const nodi = [];
    let n = w.nextNode();
    while (n) { nodi.push(n); n = w.nextNode(); }
    nodi.forEach(function (nd) {
      const prima = nd.nodeValue;
      let t = prima.replace(/\b([Ii])l\s?\/\s?([Ll])a\b/g, function (x, i, l) { conta++; return f ? (i === 'I' ? 'La' : 'la') : (i === 'I' ? 'Il' : 'il'); });
      t = t.replace(/\b([A-Za-zÀ-ÿ]+)o\s?\/\s?a\b/g, function (x, radice) { conta++; return radice + (f ? 'a' : 'o'); });
      t = t.replace(/\b(celibe)\s?\/\s?(nubile)\b/gi, function (x, c, nb) { conta++; return f ? nb : c; });
      if (t !== prima) { nd.nodeValue = t; }
    });
    return conta;
  }
  function mostraRiepilogo(ins, manc, adatt, tot) {
    const r = $('#riepilogo-doc');
    r.textContent = '';
    const pill = function (cls, testo) {
      const s = document.createElement('span');
      s.className = 'pillola ' + cls;
      s.textContent = testo;
      r.appendChild(s);
    };
    if (!tot) { pill('info', 'Non ho trovato segnaposti [ ] né spazi ____ da riempire.'); return; }
    if (ins) { pill('ok', ins + (ins === 1 ? ' dato inserito' : ' dati inseriti')); }
    if (manc) { pill('manca', manc + ' da completare (in giallo)'); }
    if (adatt) { pill('info', adatt + (adatt === 1 ? ' parola adattata' : ' parole adattate') + ' al ' + (profilo().d.sesso === 'F' ? 'femminile' : 'maschile')); }
  }
  function htmlPulito() {
    const c = $('#documento').cloneNode(true);
    $$('.ct-valore,.ct-manca', c).forEach(function (s) { s.replaceWith(document.createTextNode(s.textContent)); });
    c.normalize();
    return { html: c.innerHTML, testo: testoDa(c) };
  }
  function testoDa(nodo) {
    const tmp = document.createElement('div');
    tmp.style.position = 'fixed';
    tmp.style.left = '-9999px';
    tmp.style.whiteSpace = 'pre-wrap';
    tmp.innerHTML = nodo.innerHTML;
    document.body.appendChild(tmp);
    const t = tmp.innerText;
    tmp.remove();
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }
  function copiaDocumento() {
    const p = htmlPulito();
    if (!p.testo) { avvisa('Il documento è vuoto.'); return; }
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([p.html], { type: 'text/html' }),
        'text/plain': new Blob([p.testo], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]).then(function () { avvisa('Testo copiato: incollalo nella mail o in Word.'); }, function () { copia(p.testo, 'Testo copiato.'); });
    } else {
      copia(p.testo, 'Testo copiato.');
    }
  }
  function scaricaWord() {
    const p = htmlPulito();
    if (!p.testo) { avvisa('Il documento è vuoto.'); return; }
    const doc = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
      '<head><meta charset="utf-8"><title>Documento</title><style>body{font-family:"Times New Roman",serif;font-size:12pt;line-height:1.5}</style></head><body>' +
      p.html + '</body></html>';
    scarica('documento-compilato.doc', 'application/msword', '﻿' + doc);
  }
  function disegnaSegnaposti() {
    const box = $('#segnaposti');
    box.textContent = '';
    CT.campi.filter(function (c) { return c.seg; }).forEach(function (c) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '[' + c.seg + ']';
      b.title = c.e;
      b.addEventListener('click', function () { copia('[' + c.seg + ']', 'Copiato [' + c.seg + ']'); });
      box.appendChild(b);
    });
  }

  // ---------- Copia rapida ----------
  function disegnaCopia() {
    const box = $('#elenco-copia');
    box.textContent = '';
    const p = profilo();
    const A = api(true);
    const righe = function (titolo, voci) {
      const piene = voci.filter(function (v) { return v[1]; });
      if (!piene.length) { return; }
      const h = document.createElement('h3');
      h.className = 'etichetta';
      h.textContent = titolo;
      box.appendChild(h);
      piene.forEach(function (v) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'riga-copia';
        const e = document.createElement('span');
        e.className = 'etichetta';
        e.textContent = v[0];
        const val = document.createElement('span');
        val.className = 'valore';
        val.textContent = v[1];
        const az = document.createElement('span');
        az.className = 'azione';
        az.textContent = 'Copia';
        b.appendChild(e);
        b.appendChild(val);
        b.appendChild(az);
        b.addEventListener('click', function () { copia(v[1], 'Copiato: ' + v[0]); });
        box.appendChild(b);
      });
    };
    const val = function (k) {
      const c = CT.campi.find(function (x) { return x.k === k; });
      if (c && c.tipo === 'data') { return dataIt(p.d[k] || ''); }
      return A.valore(k, '');
    };
    righe('Più usati', [
      ['Nome e cognome', val('nome_completo')], ['Codice fiscale', val('codice_fiscale')],
      ['Indirizzo completo', val('indirizzo_completo')], ['Luogo e data di nascita', val('luogo_data_nascita')],
    ]);
    CT.gruppi.forEach(function (g) {
      righe(g.titolo, CT.campi.filter(function (c) { return c.g === g.g; }).map(function (c) { return [c.e, val(c.k)]; }));
    });
    righe('Altri dati', (p.x || []).map(function (x) { return [x.e || 'Dato', x.v]; }));
    if (!box.children.length) {
      const v = document.createElement('p');
      v.className = 'vuoto';
      v.textContent = 'Qui compariranno i tuoi dati, pronti da copiare. Scrivili prima in «I miei dati».';
      box.appendChild(v);
    }
  }

  // ---------- Schede ----------
  function apriScheda(nome) {
    $$('.schede button').forEach(function (b) {
      const sel = b.dataset.scheda === nome;
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.tabIndex = sel ? 0 : -1;
      $('#' + b.getAttribute('aria-controls')).hidden = !sel;
    });
    stato.scheda = nome;
    salva();
    if (nome === 'copia') { disegnaCopia(); }
    if (nome === 'siti') { aggiornaSegnalibro(); }
  }

  function aggiornaTutto() {
    disegnaProfili();
    aggiornaSegnalibro();
    if (!$('#sez-copia').hidden) { disegnaCopia(); }
    $('#inizio').hidden = !(stato.profili.length === 1 && vuotoProfilo(profilo()));
  }

  // ---------- Importa ed esporta ----------
  function esportaJSON() {
    return JSON.stringify({ app: 'compilatutto', versione: 1, esportato: new Date().toISOString(), profili: stato.profili }, null, 2);
  }
  function importa(testo) {
    let dati;
    try { dati = JSON.parse(testo); } catch (e) { avvisa('Il testo non è un file di Compilatutto valido.'); return; }
    const lista = dati && Array.isArray(dati.profili) ? dati.profili : null;
    if (!lista || !lista.length) { avvisa('Nel file non ci sono profili da importare.'); return; }
    let conta = 0;
    lista.forEach(function (p) {
      if (!p || typeof p !== 'object' || typeof p.d !== 'object') { return; }
      const pulito = {
        id: typeof p.id === 'string' ? p.id : nuovoId(),
        n: String(p.n || 'Profilo importato'),
        t: p.t === 'minore' ? 'minore' : 'adulto',
        d: {},
        x: Array.isArray(p.x) ? p.x.map(function (x) { return { e: String(x.e || ''), v: String(x.v || ''), p: String(x.p || '') }; }) : [],
      };
      Object.keys(p.d).forEach(function (k) { if (typeof p.d[k] === 'string') { pulito.d[k] = p.d[k]; } });
      const i = stato.profili.findIndex(function (q) { return q.id === pulito.id; });
      if (i >= 0) { stato.profili[i] = pulito; } else { stato.profili.push(pulito); }
      conta++;
    });
    stato.profili = stato.profili.filter(function (q) { return !(vuotoProfilo(q) && stato.profili.length > 1 && q.n === 'Il mio profilo'); });
    if (!stato.profili.some(function (q) { return q.id === stato.attivo; })) { stato.attivo = stato.profili[0].id; }
    salva();
    disegnaDati();
    aggiornaTutto();
    $('#import-area').hidden = true;
    avvisa(conta === 1 ? 'Importato 1 profilo.' : 'Importati ' + conta + ' profili.');
  }

  // ---------- Eventi ----------
  function collega() {
    $$('.schede button').forEach(function (b) {
      b.addEventListener('click', function () { apriScheda(b.dataset.scheda); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
        const tutte = $$('.schede button');
        const i = tutte.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1);
        const prossimo = tutte[(i + tutte.length) % tutte.length];
        prossimo.focus();
        apriScheda(prossimo.dataset.scheda);
      });
    });
    $$('[data-vai]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); apriScheda(a.dataset.vai); window.scrollTo(0, 0); });
    });

    $('#sel-profilo').addEventListener('change', function (e) {
      stato.attivo = e.target.value;
      salva();
      disegnaDati();
      aggiornaTutto();
    });
    $('#btn-nuovo').addEventListener('click', function () {
      const p = nuovoProfilo('Profilo ' + (stato.profili.length + 1));
      stato.profili.push(p);
      stato.attivo = p.id;
      salva();
      apriScheda('dati');
      disegnaDati();
      aggiornaTutto();
      $('#f-nome-profilo').focus();
      $('#f-nome-profilo').select();
    });
    $('#f-nome-profilo').addEventListener('input', function (e) {
      profilo().n = e.target.value;
      salvaPresto();
    });
    $$('input[name="tipo-profilo"]').forEach(function (r) {
      r.addEventListener('change', function () { profilo().t = r.value; salva(); aggiornaTutto(); });
    });
    $('#btn-esempio').addEventListener('click', function () {
      const p = profilo();
      p.n = ESEMPIO.n;
      p.t = ESEMPIO.t;
      p.d = Object.assign({}, ESEMPIO.d);
      p.x = ESEMPIO.x.map(function (x) { return Object.assign({}, x); });
      salva();
      disegnaDati();
      aggiornaTutto();
      avvisa('Dati di esempio caricati. Quando vuoi, sostituiscili con i tuoi.');
    });
    $('#btn-extra').addEventListener('click', function () {
      const p = profilo();
      p.x = p.x || [];
      p.x.push({ e: '', v: '', p: '' });
      salva();
      disegnaExtra();
      const ultimo = $('#x-' + (p.x.length - 1) + '-e');
      if (ultimo) { ultimo.focus(); }
    });

    $('#btn-esporta').addEventListener('click', function () {
      if (inCornice) { copia(esportaJSON(), 'Dati copiati come testo: incollali in un file o nell\'altro dispositivo.'); return; }
      scarica('compilatutto-dati.json', 'application/json', esportaJSON());
    });
    $('#btn-esporta-testo').addEventListener('click', function () { copia(esportaJSON(), 'Dati copiati come testo.'); });
    $('#import-file').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (!f) { return; }
      const r = new FileReader();
      r.onload = function () { importa(String(r.result || '')); };
      r.readAsText(f);
      e.target.value = '';
    });
    $('#btn-mostra-import').addEventListener('click', function () {
      $('#import-area').hidden = !$('#import-area').hidden;
      if (!$('#import-area').hidden) { $('#import-testo').focus(); }
    });
    $('#btn-importa-testo').addEventListener('click', function () { importa($('#import-testo').value); });

    let timerElimina = null;
    $('#btn-elimina').addEventListener('click', function (e) {
      const b = e.currentTarget;
      if (!b.classList.contains('conferma')) {
        b.classList.add('conferma');
        b.textContent = 'Tocca di nuovo per eliminare «' + (profilo().n || 'profilo') + '»';
        clearTimeout(timerElimina);
        timerElimina = setTimeout(function () { b.classList.remove('conferma'); b.textContent = 'Elimina profilo'; }, 4000);
        return;
      }
      clearTimeout(timerElimina);
      b.classList.remove('conferma');
      b.textContent = 'Elimina profilo';
      const nome = profilo().n;
      stato.profili = stato.profili.filter(function (p) { return p.id !== stato.attivo; });
      if (!stato.profili.length) { stato.profili.push(nuovoProfilo()); }
      stato.attivo = stato.profili[0].id;
      salva();
      disegnaDati();
      aggiornaTutto();
      avvisa('Profilo «' + nome + '» eliminato.');
    });

    const seg = $('#segnalibro');
    seg.addEventListener('click', function (e) {
      e.preventDefault();
      avvisa('Trascina il pulsante nella barra dei preferiti (non cliccarlo qui).');
    });
    seg.addEventListener('dragstart', segnalibroCreato);
    $('#btn-copia-codice').addEventListener('click', function () {
      copia(codiceSegnalibro(profilo()), 'Codice copiato. Ora incollalo nell\'indirizzo del preferito.');
      segnalibroCreato();
    });

    $('#btn-prova').addEventListener('click', function () {
      svuotaProva();
      if (vuotoProfilo(profilo())) { avvisa('Scrivi prima i tuoi dati, oppure carica quelli di esempio.'); return; }
      const r = compilaModulo(datiPuliti(profilo()), DATI_SEGNALIBRO, { radice: $('#modulo-prova') });
      $('#esito-prova').textContent = r.compilati + ' campi compilati, ' + r.daCompletare + ' da completare.';
    });
    $('#btn-svuota-prova').addEventListener('click', svuotaProva);
    $('#modulo-prova').addEventListener('submit', function (e) {
      e.preventDefault();
      $('#esito-prova').textContent = 'È un modulo di prova: non viene inviato nulla.';
    });

    $('#btn-completa').addEventListener('click', function () {
      if (!$('#documento').textContent.trim()) { avvisa('Incolla prima un testo, oppure apri un esempio.'); return; }
      completaDocumento();
    });
    $('#btn-copia-doc').addEventListener('click', copiaDocumento);
    $('#btn-word').addEventListener('click', scaricaWord);
    $('#btn-stampa').addEventListener('click', function () {
      document.body.classList.add('stampa-doc');
      window.print();
      setTimeout(function () { document.body.classList.remove('stampa-doc'); }, 500);
    });
    $('#btn-es-auto').addEventListener('click', function () { $('#documento').innerHTML = ES_AUTO; $('#riepilogo-doc').textContent = ''; });
    $('#btn-es-lettera').addEventListener('click', function () { $('#documento').innerHTML = ES_LETTERA; $('#riepilogo-doc').textContent = ''; });
    $('#btn-svuota-doc').addEventListener('click', function () { $('#documento').innerHTML = ''; $('#riepilogo-doc').textContent = ''; });

    // Installazione come app (Chrome ed Edge su Windows e Android)
    let richiesta = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      richiesta = e;
      $('#btn-installa').hidden = false;
    });
    $('#btn-installa').addEventListener('click', function () {
      if (!richiesta) { return; }
      richiesta.prompt();
      richiesta = null;
      $('#btn-installa').hidden = true;
    });
  }

  // ---------- Avvio ----------
  if (inCornice) {
    // In un'anteprima incorniciata stampa e download non funzionano
    $('#btn-stampa').hidden = true;
    $('#btn-word').hidden = true;
  }
  preparaListe();
  preparaModuloProva();
  disegnaSegnaposti();
  disegnaDati();
  collega();
  const daIndirizzo = String(location.hash || '').replace('#', '');
  apriScheda(['dati', 'siti', 'doc', 'copia'].indexOf(daIndirizzo) >= 0 ? daIndirizzo : (stato.scheda || 'dati'));
  aggiornaTutto();
  $('#documento').innerHTML = ES_AUTO;

  if ('serviceWorker' in navigator && !inCornice && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* senza lavoro offline l'app funziona comunque */ });
  }
})();
