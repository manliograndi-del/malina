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
    const form = doc.getForm();
    const xfa = typeof form.hasXFA === 'function' && form.hasXFA();
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
    return campi.map(function (c) {
      if (c.solaLettura) { return { a: null, valore: '' }; }
      const indizi = [[c.descr, 3], [c.breve, 2]];
      let a = api.riconosciIndizi(indizi, '');
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
      return { a: a, valore: api.valore(a, c.descr || c.breve) };
    });
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
