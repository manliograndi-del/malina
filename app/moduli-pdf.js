/*
 * Compilatutto – moduli PDF compilabili. Tutto avviene sul dispositivo con la libreria pdf-lib (lib/pdf-lib.min.js).
 */
const ModuliPdf = (function () {
  'use strict';

  let caricamento = null;
  function carica() {
    if (window.PDFLib) { return Promise.resolve(window.PDFLib); }
    if (caricamento) { return caricamento; }
    caricamento = new Promise(function (ok, ko) {
      const s = document.createElement('script');
      s.src = 'lib/pdf-lib.min.js';
      s.onload = function () { ok(window.PDFLib); };
      s.onerror = function () { caricamento = null; ko(new Error('libreria')); };
      document.head.appendChild(s);
    });
    return caricamento;
  }

  function nomeBreve(nome) {
    const parti = String(nome || '').split('.');
    return parti[parti.length - 1].replace(/\[\d+\]/g, '').replace(/[_#]+/g, ' ').trim();
  }
  function tipoDi(L, f) {
    if (f instanceof L.PDFTextField) { return 'testo'; }
    if (f instanceof L.PDFCheckBox) { return 'spunta'; }
    if (f instanceof L.PDFRadioGroup) { return 'scelta'; }
    if (f instanceof L.PDFDropdown || f instanceof L.PDFOptionList) { return 'menu'; }
    return 'altro';
  }

  // Apre il PDF e descrive i suoi campi in ordine di pagina e posizione
  async function apri(buffer) {
    const L = await carica();
    let doc;
    try {
      doc = await L.PDFDocument.load(buffer, { updateMetadata: false });
    } catch (e) {
      if (/encrypt/i.test(String(e && e.message))) { return { errore: 'protetto' }; }
      return { errore: 'illeggibile' };
    }
    // XFA va guardato prima di getForm(), che lo toglie
    let xfa = false;
    try {
      const af = doc.catalog.lookup(L.PDFName.of('AcroForm'));
      xfa = !!(af && af.get && af.get(L.PDFName.of('XFA')));
    } catch (e) { xfa = false; }
    const form = doc.getForm();
    const pagine = doc.getPages();
    const campi = [];
    form.getFields().forEach(function (f) {
      const tipo = tipoDi(L, f);
      if (tipo === 'altro') { return; }
      let descr = '';
      try {
        const tu = f.acroField.dict.get(L.PDFName.of('TU'));
        if (tu && typeof tu.decodeText === 'function') { descr = tu.decodeText(); }
      } catch (e) { /* nessuna descrizione */ }
      let pagina = 0;
      let x = 0;
      let y = 0;
      try {
        const w = f.acroField.getWidgets()[0];
        const r = w.getRectangle();
        x = r.x;
        y = r.y;
        const ref = w.P();
        const i = pagine.findIndex(function (p) { return p.ref === ref; });
        pagina = i >= 0 ? i : 0;
      } catch (e) { /* posizione sconosciuta */ }
      let opzioni = [];
      try { if (tipo === 'scelta' || tipo === 'menu') { opzioni = f.getOptions(); } } catch (e) { opzioni = []; }
      let max = 0;
      try { if (tipo === 'testo') { max = f.getMaxLength() || 0; } } catch (e) { max = 0; }
      let sola = false;
      try { sola = f.isReadOnly(); } catch (e) { sola = false; }
      campi.push({ nome: f.getName(), breve: nomeBreve(f.getName()), descr: descr, tipo: tipo, opzioni: opzioni,
        max: max, pagina: pagina, x: x, y: y, solaLettura: sola });
    });
    campi.sort(function (a, b) { return a.pagina - b.pagina || b.y - a.y || a.x - b.x; });
    return { doc: doc, campi: campi, xfa: xfa, pagine: pagine.length };
  }

  // Propone un valore per ogni campo usando il motore (api di compilaModulo)
  function proponi(campi, api) {
    let precedente = null;
    // Sezioni per chi vive all'estero (es. «quadroD stato estero»): i loro campi di residenza restano vuoti per chi vive in Italia
    const gruppo = function (c) { return String(c.breve).split(/[\s_.]+/)[0].toLowerCase(); };
    const esteri = new Set(campi.filter(function (c) { return /\bester[oa]\b|\bforeign\b|\babroad\b/.test(api.norm(c.breve + ' ' + c.descr)); }).map(gruppo));
    // Serie numerate come «codice fiscale 1 … 4»: valgono per scelte diverse del modulo, le sceglie chi compila
    const radice = function (c) {
      const m = /^(.*\D)\s*\d+$/.exec(String(c.breve).trim());
      const r = m ? m[1].trim().toLowerCase() : '';
      return c.descr || /^(text|testo|campo|campo di testo|field|casella|casella di controllo|check ?box)$/.test(r) ? '' : r;
    };
    const conta = {};
    campi.forEach(function (c) { const r = radice(c); if (r) { conta[r] = (conta[r] || 0) + 1; } });
    // Menu con «Via, Piazza, Viale…»: è il tipo di strada, e allora l'indirizzo va senza
    const menuStrade = function (c) {
      const o = (c.opzioni || []).map(function (x) { return api.norm(x); });
      return (c.tipo === 'menu' || c.tipo === 'scelta') && o.indexOf('via') >= 0 && o.indexOf('piazza') >= 0;
    };
    const conDug = campi.some(function (c) {
      if (c.solaLettura) { return false; }
      if (menuStrade(c)) { return true; }
      const a = api.riconosciIndizi([[c.descr, 3], [c.breve, 2]], '');
      return a && a.k === 'dug';
    });
    return campi.map(function (c) {
      if (c.solaLettura) { return { a: null, valore: '' }; }
      if (c.tipo === 'testo' && conta[radice(c)] > 1) { return { a: null, valore: '' }; }
      const indizi = [[c.descr, 3], [c.breve, 2]];
      let a = menuStrade(c) ? { k: 'dug', r: '' } : api.riconosciIndizi(indizi, '');
      if (a && esteri.has(gruppo(c)) && /^(indirizzo|civico|cap|citta|provincia|nazione|indirizzo_completo)$/.test(a.k) &&
        /^ital/.test(api.norm(api.valore({ k: 'nazione', r: a.r }, '') || 'italia'))) { a = null; }
      // «Via ___ N. ___», «Nato a ___ Prov. ___»: come sulle pagine web
      const corto = api.norm(c.descr || c.breve);
      if (!a && precedente) {
        if (precedente.k === 'indirizzo' && /^(n|nr|num|numero)$/.test(corto)) { a = { k: 'civico', r: precedente.r }; }
        else if (precedente.k === 'luogo_nascita' && /^(prov|pr|provincia)$/.test(corto)) { a = { k: 'provincia_nascita', r: precedente.r }; }
      }
      if (a && a.k === 'provincia' && precedente && precedente.k === 'luogo_nascita') { a = { k: 'provincia_nascita', r: precedente.r }; }
      precedente = a;
      if (c.tipo === 'spunta') {
        if (!a && /^(maschio|femmina|maschile|femminile|m|f)$/.test(corto)) { a = { k: 'sesso', r: '' }; }
        if (!a) { return { a: null, valore: false }; }
        const val = api.valore(a, '');
        const t = api.norm((c.descr || '') + ' ' + c.breve);
        const ultimo = t.split(' ').pop();
        let ok = false;
        if (a.k === 'sesso') {
          const s = api.norm(val);
          ok = (s === 'm' && /^(m|maschio|maschile|uomo)$/.test(ultimo)) || (s === 'f' && /^(f|femmina|femminile|donna)$/.test(ultimo));
        } else {
          ok = api.opzioneValore(val, [t]) >= 0 && !!val;
        }
        return { a: a, valore: ok };
      }
      if (!a) { return { a: null, valore: '' }; }
      if (c.tipo === 'scelta' || c.tipo === 'menu') {
        const i = api.opzione(a, c.opzioni);
        return { a: a, valore: i >= 0 ? c.opzioni[i] : '' };
      }
      // Codice fiscale in 11 caselline: è quello di una società o di un ente
      if (a.k === 'codice_fiscale' && c.max === 11) { return { a: null, valore: '' }; }
      return { a: a, valore: adatta(api.valore(a, c.descr || c.breve, { senzaDug: conDug }), c.max) };
    });
  }

  // Caselline a numero fisso (codice fiscale, data in 8 caselle): il valore senza spazi e separatori
  function adatta(val, max) {
    const v = String(val || '');
    if (!max || v.length <= max) { return v; }
    const d = /^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/.exec(v);
    if (d) { return max >= 8 ? d[1] + d[2] + d[3] : d[1] + d[2] + d[3].slice(2); }
    const compatto = v.replace(/[\s.\-\/()]/g, '');
    if (compatto.length <= max) { return compatto; }
    const senzaPrefisso = compatto.replace(/^(\+39|0039)/, '');
    return senzaPrefisso.length <= max ? senzaPrefisso : v;
  }

  // Scrive i valori e restituisce il PDF compilato
  async function compila(doc, campi, valori) {
    const L = await carica();
    const form = doc.getForm();
    if (typeof form.hasXFA === 'function' && form.hasXFA()) { form.deleteXFA(); }
    const problemi = [];
    campi.forEach(function (c, i) {
      const v = valori[i];
      if (c.solaLettura) { return; }
      try {
        if (c.tipo === 'testo') {
          const f = form.getTextField(c.nome);
          const s = String(v == null ? '' : v);
          if (c.max && s.length > c.max) { problemi.push(c.breve); return; }
          f.setText(s || undefined);
        } else if (c.tipo === 'spunta') {
          const f = form.getCheckBox(c.nome);
          if (v) { f.check(); } else { f.uncheck(); }
        } else if (c.tipo === 'scelta') {
          if (v) { form.getRadioGroup(c.nome).select(v); }
        } else if (c.tipo === 'menu') {
          if (v) {
            const f = form.getField(c.nome);
            f.select(v);
          }
        }
      } catch (e) {
        problemi.push(c.breve);
      }
    });
    let byte;
    try {
      byte = await doc.save();
    } catch (e) {
      // Caratteri che il carattere standard del PDF non sa disegnare: lascia che sia il lettore PDF a farlo
      form.acroForm.dict.set(L.PDFName.of('NeedAppearances'), L.PDFBool.True);
      byte = await doc.save({ updateFieldAppearances: false });
    }
    return { byte: byte, problemi: problemi };
  }

  return { carica: carica, apri: apri, proponi: proponi, compila: compila };
})();
