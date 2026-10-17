// Compilatutto: il motore che riconosce i campi di un modulo e li riempie con i dati della famiglia.
// La funzione deve restare autosufficiente, perché l'app la trasforma in testo per creare il pulsante «Compila».
// Regole per chi la modifica: niente variabili esterne, commenti solo su righe proprie, punto e virgola sempre.
//
// P   { persone: [{ id, rel, d: {}, x: [{ e, v, p }] }], veicoli: [{ id, prop, d: {} }], soggetto, figlio, veicolo }
// F   dati di riferimento (vedi campi.js)
// opz { radice, doc, api, silenzioso, scelta }
function compilaModulo(P, F, opz) {
  opz = opz || {};
  P = P || {};
  const STOP = new Set(F.stop);

  const norm = function (s) {
    let t = String(s == null ? '' : s).replace(/([a-z\u00e0-\u00fa])([A-Z])/g, '$1 $2');
    t = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    t = t.replace(/(\d+)/g, ' $1 ').replace(/[^a-z0-9]+/g, ' ');
    return t.split(' ').filter(function (w) { return w && !STOP.has(w); }).join(' ');
  };
  const lista = function (a) { return (a || []).map(norm).filter(Boolean); };
  const has = function (h, parole) {
    if (!h) { return false; }
    const s = ' ' + h + ' ';
    for (let i = 0; i < parole.length; i++) {
      if (s.indexOf(' ' + parole[i] + ' ') >= 0) { return true; }
    }
    return false;
  };

  // ---------- Persone e veicoli ----------
  const persone = (P.persone || []).filter(function (p) { return p && p.d; });
  const veicoli = (P.veicoli || []).filter(function (v) { return v && v.d; });
  const perId = function (id) { return persone.find(function (p) { return p.id === id; }) || null; };
  const io = persone.find(function (p) { return p.rel === 'io'; }) || null;
  const S = perId(P.soggetto) || io || persone[0] || { id: '', rel: 'io', d: {}, x: [] };
  const sogFiglio = S.rel === 'figlio';
  const sogAdulto = S.rel === 'io' || S.rel === 'coniuge';
  const figlioScelto = (function () {
    const f = perId(P.figlio);
    if (f && f.rel === 'figlio') { return f; }
    return persone.find(function (p) { return p.rel === 'figlio' && p.id !== S.id; }) || null;
  })();
  const veicolo = veicoli.find(function (v) { return v.id === P.veicolo; }) ||
    veicoli.find(function (v) { return v.prop === S.id; }) || veicoli[0] || null;

  const R = {};
  Object.keys(F.ruoli).forEach(function (k) { R[k] = lista(F.ruoli[k]); });
  const SOLO_RUOLO = new Set(['dati', 'nominativo', 'generalita']);
  ['padre', 'madre', 'coniuge', 'genitore', 'figlio'].forEach(function (k) {
    R[k].forEach(function (w) { if (w.indexOf(' ') < 0) { SOLO_RUOLO.add(w); } });
  });
  const SALTA = lista(F.salta);
  const ORG = lista(F.org);
  const CONFERMA = lista(F.conferma);
  const ALTRI_DOC = opz.doc ? lista(F.altriDoc) : [];
  const DOCS = Object.keys(F.documenti).map(function (t) {
    const d = F.documenti[t];
    return { t: t, nome: d.nome, parole: lista(d.parole), campi: d.campi };
  });
  const DOM = { parole: lista(F.domicilio.parole), campi: F.domicilio.campi };
  const VEIC_K = new Set((F.campiVeicolo || []).map(function (c) { return c.k; }));
  const DATE = new Set(F.campi.concat(F.campiVeicolo || []).filter(function (c) { return c.tipo === 'data'; }).map(function (c) { return c.k; }));
  const DEF = {};
  F.campi.concat(F.campiVeicolo || []).forEach(function (c) { DEF[c.k] = c; });

  const prepara = function (frasi) {
    const out = [];
    frasi.forEach(function (f) {
      const n = norm(f);
      if (!n) { return; }
      const lun = n.split(' ').length;
      out.push([n, lun]);
      if (lun > 1) { out.push([n.replace(/ /g, ''), lun]); }
    });
    return out;
  };
  const CAMPI = [];
  F.campi.forEach(function (c) {
    if (c.sin && c.sin.length && (opz.doc || !c.doc)) {
      CAMPI.push({ k: c.k, sin: prepara(c.sin), escl: lista(c.escl), org: !!c.org, v: false });
    }
  });
  (F.campiVeicolo || []).forEach(function (c) {
    if (c.sin && c.sin.length) { CAMPI.push({ k: c.k, sin: prepara(c.sin), escl: lista(c.escl), org: false, v: true }); }
  });
  // Altri dati scritti dalle persone: chiave «x:etichetta»
  const giaExtra = {};
  persone.forEach(function (p) {
    (p.x || []).forEach(function (x) {
      const n = norm(x.e);
      if (!n || !x.v || giaExtra[n]) { return; }
      giaExtra[n] = true;
      CAMPI.push({ k: 'x:' + n, sin: prepara([x.e].concat(String(x.p || '').split(','))), escl: [], org: false, v: false });
    });
  });

  // Di quale persona parla un testo: '' = di chi compila
  const categoria = function (t) {
    if (!t) { return ''; }
    if (has(t, R.padre)) { return 'padre'; }
    if (has(t, R.madre)) { return 'madre'; }
    if (has(t, R.coniuge)) { return 'coniuge'; }
    if (has(t, R.genitore)) { return 'genitore'; }
    if (has(t, R.figlio)) { return 'figlio'; }
    if (has(t, R.altro) || has(t, ALTRI_DOC)) { return 'altro'; }
    if (sogFiglio && has(t, R.dichiarante)) { return 'genitore'; }
    return '';
  };
  const ruoloDi = function (cat) {
    if (!cat) { return ''; }
    if (cat === 'altro') { return null; }
    if (sogFiglio) {
      if (cat === 'figlio') { return ''; }
      if (cat === 'coniuge') { return null; }
      return cat;
    }
    if (cat === 'genitore') { return ''; }
    if ((cat === 'coniuge' || cat === 'figlio') && !sogAdulto) { return null; }
    return cat;
  };
  const pseudoGenitore = function (quale) {
    const d = S.d || {};
    const n = d[quale === 'padre' ? 'nome_padre' : 'nome_madre'];
    if (!n) { return null; }
    const c = quale === 'padre' ? (d.cognome_padre || d.cognome) : d.cognome_madre;
    return { id: '~' + quale, rel: quale, d: { nome: n, cognome: c || '' }, x: [] };
  };
  const personaDi = function (r) {
    if (!r) { return S; }
    if (r === 'coniuge') {
      if (S.rel === 'coniuge') { return io; }
      return persone.find(function (p) { return p.rel === 'coniuge' && p.id !== S.id; }) || null;
    }
    if (r === 'figlio') { return figlioScelto; }
    if (r === 'genitore') { return sogFiglio ? io : S; }
    if (r === 'padre' || r === 'madre') {
      if (sogFiglio) {
        const sx = r === 'padre' ? 'M' : 'F';
        const g = persone.find(function (p) {
          return (p.rel === 'io' || p.rel === 'coniuge') && String(p.d.sesso || '').toUpperCase() === sx;
        });
        if (g) { return g; }
      } else {
        const g = persone.find(function (p) { return p.rel === r; });
        if (g) { return g; }
      }
      return pseudoGenitore(r);
    }
    return null;
  };

  const tipoDoc = function (t) {
    for (let i = 0; i < DOCS.length; i++) {
      if (has(t, DOCS[i].parole)) { return DOCS[i]; }
    }
    return null;
  };
  // «Numero» dentro «Passaporto» è il numero del passaporto; «Indirizzo» dentro «Domicilio» è il domicilio
  const variante = function (k, tutto, ctx) {
    const d = tipoDoc(tutto) || tipoDoc(ctx || '');
    if (d && d.campi[k]) { return d.campi[k]; }
    if (DOM.campi[k]) {
      const proprio = has(tutto, DOM.parole);
      const sezione = has(ctx || '', DOM.parole) && !has(ctx || '', ['residenza', 'residente']);
      if (proprio || sezione) { return DOM.campi[k]; }
    }
    return k;
  };

  // Riconosce il dato a partire dai testi che descrivono un campo.
  // indizi: [[testo normalizzato, peso]]; ctx: testo della sezione (legenda, titolo).
  // Risultato: { k, r } oppure { salta: true } (campo da lasciare stare) oppure null (non capito).
  const analizza = function (indizi, ctx, forzato) {
    const tutto = indizi.map(function (h) { return h[0]; }).join(' | ');
    if (has(tutto, SALTA)) { return { salta: true }; }
    const catOwn = categoria(tutto);
    const cat = catOwn || categoria(ctx);
    if (cat === 'altro') { return { salta: true }; }
    const org = has(tutto, ORG) || has(ctx || '', ORG);
    let k = forzato || null;
    if (!k) {
      let meglio = 0;
      CAMPI.forEach(function (c) {
        if (org && !c.org) { return; }
        if (c.v && !veicoli.length && !opz.doc) { return; }
        let p = 0;
        indizi.forEach(function (h) {
          if (!h[0] || has(h[0], c.escl)) { return; }
          const s = ' ' + h[0] + ' ';
          c.sin.forEach(function (sn) {
            if (s.indexOf(' ' + sn[0] + ' ') >= 0) {
              const val = (sn[1] + (h[0] === sn[0] ? 0.5 : 0)) * h[1];
              if (val > p) { p = val; }
            }
          });
        });
        if (p > meglio) { meglio = p; k = c.k; }
      });
      // «Numero» dentro «Documento di riconoscimento»: si prova a leggere l'etichetta insieme alla sezione
      if (!k && ctx && !opz.doc) {
        const conSezione = indizi.map(function (h) { return [h[0] + ' ' + ctx, 1]; });
        CAMPI.forEach(function (c) {
          if (org && !c.org) { return; }
          if (c.v && !veicoli.length) { return; }
          let p = 0;
          conSezione.forEach(function (h) {
            if (has(h[0], c.escl)) { return; }
            const s = ' ' + h[0] + ' ';
            c.sin.forEach(function (sn) {
              if (sn[1] > 1 && s.indexOf(' ' + sn[0] + ' ') >= 0 && sn[1] > p) { p = sn[1]; }
            });
          });
          if (p > meglio) { meglio = p; k = c.k; }
        });
      }
    }
    // Un campo che si chiama solo «Coniuge», «Padre», «Paternità»: il nome della persona
    if (!k && catOwn && indizi.some(function (h) { return h[0].split(' ').every(function (t) { return SOLO_RUOLO.has(t); }); })) {
      k = has(tutto, ['paternita', 'maternita']) ? 'nome' : 'nome_completo';
    }
    if (!k) { return org ? { salta: true } : null; }
    k = variante(k, tutto, ctx);
    if (VEIC_K.has(k)) { return { k: k, r: '' }; }
    const r = ruoloDi(cat);
    if (r === null || !personaDi(r)) { return { salta: true }; }
    return { k: k, r: r };
  };
  const riconosci = function (indizi, ctx, forzato) {
    const a = analizza(indizi, ctx, forzato);
    return a && !a.salta ? a : null;
  };

  // ---------- Valori ----------
  const due = function (n) { return (n < 10 ? '0' : '') + n; };
  const oggiIso = function () {
    const d = new Date();
    return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  };
  const unisci = function (parti, sep) { return parti.filter(Boolean).join(sep); };
  const sigla = function (val) {
    const s = String(val || '').trim();
    if (!s) { return ''; }
    const su = s.toUpperCase().replace(/[^A-Z]/g, '');
    if (su.length === 2 && F.prov[su]) { return su; }
    const n = norm(s);
    const ks = Object.keys(F.prov);
    for (let i = 0; i < ks.length; i++) {
      if (norm(F.prov[ks[i]]) === n) { return ks[i]; }
    }
    return '';
  };
  const fmtData = function (iso, el, parte) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) { return iso || ''; }
    const a = m[1];
    const me = m[2];
    const g = m[3];
    if (parte === 'g') { return g; }
    if (parte === 'm') { return me; }
    if (parte === 'a') { return a; }
    if (el && el.type === 'date') { return iso; }
    const ph = el && el.getAttribute ? String(el.getAttribute('placeholder') || '').toLowerCase() : '';
    let r = /(gg|dd)\s*([\/.\-])\s*(mm)\s*[\/.\-]\s*(aaaa|yyyy|aa|yy)/.exec(ph);
    if (r) { return g + r[2] + me + r[2] + (r[4].length === 2 ? a.slice(2) : a); }
    r = /(aaaa|yyyy)\s*([\/.\-])\s*(mm)/.exec(ph);
    if (r) { return a + r[2] + me + r[2] + g; }
    if (el && el.maxLength === 8) { return g + me + a; }
    return g + '/' + me + '/' + a;
  };
  const grezzo = function (pers, k) {
    if (!pers) { return ''; }
    if (k.indexOf('x:') === 0) {
      const x = (pers.x || []).find(function (y) { return y.v && norm(y.e) === k.slice(2); });
      return x ? String(x.v).trim() : '';
    }
    const d = pers.d || {};
    return String(d[k] == null ? '' : d[k]).trim();
  };
  const docPrincipale = function (pers) {
    const ordine = F.documentoPrincipale || ['ci', 'passaporto', 'patente'];
    for (let i = 0; i < ordine.length; i++) {
      const d = DOCS.find(function (x) { return x.t === ordine[i]; });
      if (d && grezzo(pers, d.campi.numero_documento)) { return d; }
    }
    return null;
  };
  const sessoDi = function (pers) { return grezzo(pers, 'sesso').toUpperCase().charAt(0); };
  const conCivico = function (pers, via, civ) { return unisci([grezzo(pers, via), grezzo(pers, civ)], ', '); };

  // Valore «da mostrare» (date gg/mm/aaaa) del dato k di una persona; h = testo del campo
  const calcola = function (k, pers, h, info) {
    h = h || '';
    info = info || {};
    if (VEIC_K.has(k)) {
      const vv = veicolo ? String(veicolo.d[k] == null ? '' : veicolo.d[k]).trim() : '';
      return DATE.has(k) ? fmtData(vv) : vv;
    }
    if (!pers) { return ''; }
    if (k === 'nome_completo') {
      const s = ' ' + h + ' ';
      const ic = s.indexOf(' cognome ');
      const inn = s.indexOf(' nome ');
      return (ic >= 0 && (inn < 0 || ic < inn)) ? unisci([grezzo(pers, 'cognome'), grezzo(pers, 'nome')], ' ') : unisci([grezzo(pers, 'nome'), grezzo(pers, 'cognome')], ' ');
    }
    if (k === 'indirizzo' || k === 'dom_indirizzo') {
      const civ = k === 'indirizzo' ? 'civico' : 'dom_civico';
      let r = (info.unisciCivico || has(h, ['civico', 'civ'])) ? conCivico(pers, k, civ) : grezzo(pers, k);
      if (opz.doc) {
        const ult = h.split(' ').pop();
        if (/^(via|viale|piazza|piazzale|corso|largo|vicolo|strada|contrada|localita|frazione)$/.test(ult)) {
          r = r.replace(new RegExp('^' + ult + '\\s+', 'i'), '');
        }
      }
      return r;
    }
    if (k === 'indirizzo_completo') {
      const p = sigla(grezzo(pers, 'provincia'));
      const luogo = (unisci([grezzo(pers, 'cap'), grezzo(pers, 'citta')], ' ') + (p ? ' (' + p + ')' : '')).trim();
      return unisci([conCivico(pers, 'indirizzo', 'civico'), luogo], ', ');
    }
    if (k === 'luogo_data_nascita') {
      const p = sigla(grezzo(pers, 'provincia_nascita'));
      return unisci([grezzo(pers, 'luogo_nascita') + (p ? ' (' + p + ')' : ''), fmtData(grezzo(pers, 'data_nascita'))], ', ');
    }
    if (k === 'eta') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(grezzo(pers, 'data_nascita'));
      if (!m) { return ''; }
      const o = new Date();
      let anni = o.getFullYear() - Number(m[1]);
      if (o.getMonth() + 1 < Number(m[2]) || (o.getMonth() + 1 === Number(m[2]) && o.getDate() < Number(m[3]))) { anni--; }
      return String(anni);
    }
    if (k === 'tipo_documento' || k === 'numero_documento' || k === 'rilasciato_da' || k === 'data_rilascio' || k === 'scadenza_documento') {
      const d = docPrincipale(pers);
      if (!d) { return ''; }
      if (k === 'tipo_documento') { return d.t === 'ci' ? (grezzo(pers, 'ci_tipo') || d.nome) : d.nome; }
      return d.campi[k] ? calcola(d.campi[k], pers, h, info) : '';
    }
    if (k === 'luogo') { return grezzo(pers, 'citta'); }
    if (k === 'oggi') { return fmtData(oggiIso()); }
    if (k === 'luogo_data') { return unisci([grezzo(pers, 'citta'), fmtData(oggiIso())], ', '); }
    if (k === 'stato_civile') {
      const s = grezzo(pers, k);
      const f = sessoDi(pers) === 'F';
      if (/celibe\s*\/\s*nubile/i.test(s)) { return f ? 'Nubile' : 'Celibe'; }
      return sessoDi(pers) ? s.replace(/o\s?\/\s?a\b/g, f ? 'a' : 'o') : s;
    }
    if (DATE.has(k)) { return fmtData(grezzo(pers, k)); }
    if (k === 'provincia' || k === 'provincia_nascita' || k === 'dom_provincia') { return sigla(grezzo(pers, k)) || grezzo(pers, k); }
    if (k === 'codice_fiscale') { return grezzo(pers, k).toUpperCase().replace(/\s+/g, ''); }
    if (k === 'sesso') { return sessoDi(pers); }
    return grezzo(pers, k);
  };
  // Valore adatto al campo del modulo (formato della data, parte di data)
  const valore = function (a, h, el, parte, info) {
    const pers = personaDi(a.r);
    let k = a.k;
    if (k === 'data_rilascio' || k === 'scadenza_documento') {
      const d = docPrincipale(pers);
      if (!d || !d.campi[k]) { return ''; }
      k = d.campi[k];
    }
    if (DATE.has(k)) {
      const iso = VEIC_K.has(k) ? String((veicolo && veicolo.d[k]) || '') : grezzo(pers, k);
      return fmtData(iso, el, parte);
    }
    return calcola(a.k, pers, h, info);
  };

  // Spazi vuoti nelle lettere: «nato a ______ il ______»
  const SPAZI = (F.spazi || []).map(function (s) { return [norm(s[0]), s[1]]; }).filter(function (s) { return s[0]; });
  const daChiave = function (s) {
    const i = s.indexOf(':');
    return i > 0 && s.slice(0, i) !== 'x' ? { k: s.slice(i + 1), r: s.slice(0, i), fisso: true } : { k: s, r: '' };
  };
  const RILASCI = { rilasciato_da: 'data_rilascio', ci_comune: 'ci_data_rilascio', passaporto_rilascio: 'passaporto_data_rilascio',
    patente_rilascio: 'patente_data_rilascio', permesso_rilascio: 'permesso_data_rilascio' };
  const spazio = function (prima, prec) {
    prec = prec || { k: '', r: '' };
    const t = norm(String(prima || '').slice(-80));
    const tok = t ? t.split(' ') : [];
    let scelto = null;
    let lun = 0;
    SPAZI.forEach(function (s) {
      const ft = s[0].split(' ');
      if (ft.length > tok.length || ft.length <= lun) { return; }
      for (let i = 1; i <= ft.length; i++) {
        if (tok[tok.length - i] !== ft[ft.length - i]) { return; }
      }
      scelto = s[1];
      lun = ft.length;
    });
    let a = null;
    if (scelto === '@n') {
      if (prec.k === 'indirizzo') { a = { k: 'civico', r: prec.r }; }
      else if (prec.k === 'tipo_documento') { a = { k: 'numero_documento', r: prec.r }; }
    } else if (scelto === '@il') {
      if (/^(luogo_nascita|provincia_nascita|nazione_nascita)$/.test(prec.k)) { a = { k: 'data_nascita', r: prec.r }; }
      else if (RILASCI[prec.k]) { a = { k: RILASCI[prec.k], r: prec.r }; }
    } else if (scelto === '@prov') {
      a = { k: /nascita/.test(prec.k) ? 'provincia_nascita' : 'provincia', r: prec.r };
    } else if (scelto) {
      a = daChiave(scelto);
    }
    if (a && !a.fisso) {
      // «il coniuge nato a ___»: le parole prima della frase (e la frase stessa) dicono di chi si parla
      const zona = tok.slice(Math.max(0, tok.length - lun - 3)).join(' ');
      const cat = categoria(zona);
      if (cat) {
        const r = ruoloDi(cat);
        if (r === null) { return null; }
        a = { k: a.k, r: r };
      }
    }
    if (!a && !tok.length && prec.k) {
      if (prec.k === 'luogo_nascita') { a = { k: 'provincia_nascita', r: prec.r }; }
      else if (prec.k === 'citta') { a = { k: 'provincia', r: prec.r }; }
      else if (prec.k === 'indirizzo') { a = { k: 'civico', r: prec.r }; }
      else if (prec.r === 'padre') { a = { k: 'nome_completo', r: 'madre' }; }
    }
    if (!a && tok.length) { a = riconosci([[tok.slice(-6).join(' '), 2]], ''); }
    if (a && !VEIC_K.has(a.k) && !personaDi(a.r)) { return null; }
    return a ? { k: a.k, r: a.r || '' } : null;
  };

  // Scelta di un'opzione (menu a tendina o pulsanti di scelta)
  const simile = function (o, cand) {
    let meglio = 0;
    cand.forEach(function (c, i) {
      if (!c || !o) { return; }
      const pen = i * 0.1;
      if (o === c) { meglio = Math.max(meglio, 100 - pen); return; }
      const ot = o.split(' ');
      const ct = c.split(' ');
      if (ct.every(function (x) { return ot.indexOf(x) >= 0; }) && ot.length <= ct.length + 2) {
        meglio = Math.max(meglio, 60 - pen);
      } else if (o.length >= 3 && ot.every(function (x) { return ct.indexOf(x) >= 0; })) {
        meglio = Math.max(meglio, 40 - pen);
      } else {
        let q = 0;
        while (q < o.length && q < c.length && o.charAt(q) === c.charAt(q)) { q++; }
        if (q >= 5 && q >= 0.7 * Math.min(o.length, c.length)) { meglio = Math.max(meglio, 30 - pen); }
      }
    });
    return meglio;
  };
  const candidati = function (a, parte, val) {
    const c = [];
    const pers = personaDi(a.r);
    const k = a.k;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(VEIC_K.has(k) ? String((veicolo && veicolo.d[k]) || '') : grezzo(pers, k));
    if (DATE.has(k) && iso && parte) {
      if (parte === 'g') { c.push(String(Number(iso[3])), iso[3]); }
      if (parte === 'a') { c.push(iso[1], iso[1].slice(2)); }
      if (parte === 'm') {
        const m = Number(iso[2]);
        c.push(String(m), iso[2]);
        F.mesi[m - 1].forEach(function (x) { c.push(x); });
      }
    } else if (k === 'sesso') {
      const s = sessoDi(pers);
      if (s === 'M') { c.push('m', 'maschio', 'maschile', 'uomo', 'male', 'man', 'maschi'); }
      if (s === 'F') { c.push('f', 'femmina', 'femminile', 'donna', 'female', 'woman', 'femmine'); }
    } else if (k === 'provincia' || k === 'provincia_nascita' || k === 'dom_provincia') {
      const sg = sigla(grezzo(pers, k));
      if (sg) { c.push(sg.toLowerCase(), norm(F.prov[sg]), norm(F.prov[sg] + ' ' + sg), norm(sg + ' ' + F.prov[sg])); }
      else { c.push(norm(grezzo(pers, k))); }
    } else {
      c.push(norm(val));
      if (k === 'stato_civile') { c.push(norm(grezzo(pers, k))); }
      if (/^(nazione|nazione_nascita|cittadinanza)$/.test(k) && /^itali/.test(norm(val))) {
        c.push('italia', 'italiana', 'italiano', 'italy', 'italian', 'it', 'ita');
      }
    }
    return c.map(function (x) { return norm(x); }).filter(Boolean);
  };
  const sceltaTra = function (testi, cand) {
    let meglio = 0;
    let scelta = -1;
    testi.forEach(function (t, i) {
      const p = Array.isArray(t) ? Math.max.apply(null, t.map(function (x) { return simile(norm(x), cand); })) : simile(norm(t), cand);
      if (p > meglio) { meglio = p; scelta = i; }
    });
    return meglio >= 30 ? scelta : -1;
  };

  // Elenco di tutti i dati, per il selettore e per «Cerca e copia»
  const RELB = {};
  (F.relazioni || []).forEach(function (r) { RELB[r.r] = r.breve; });
  const GRUPPI = {};
  (F.gruppi || []).concat(F.gruppiVeicolo || []).forEach(function (g) { GRUPPI[g.g] = g.titolo; });
  const nomeDi = function (p) { return unisci([grezzo(p, 'nome'), grezzo(p, 'cognome')], ' ') || RELB[p.rel] || 'Persona'; };
  const elenco = function () {
    const voci = [];
    const ordinate = [S].concat(persone.filter(function (p) { return p.id !== S.id; })).filter(function (p) { return p && p.id; });
    ordinate.forEach(function (p) {
      const chi = nomeDi(p) + (RELB[p.rel] ? ' · ' + RELB[p.rel] : '');
      const aggiungi = function (k, titolo, gruppo) {
        const val = calcola(k, p, '', {});
        if (!val) { return; }
        voci.push({ id: p.id + ':' + k, pid: p.id, k: k, titolo: titolo, gruppo: gruppo || '', chi: chi, valore: val,
          iso: DATE.has(k) ? grezzo(p, k) : '',
          cerca: norm(titolo + ' ' + (gruppo || '') + ' ' + chi + ' ' + val) });
      };
      aggiungi('nome_completo', 'Nome e cognome', '');
      F.campi.forEach(function (c) { if (c.g) { aggiungi(c.k, c.e, GRUPPI[c.g]); } });
      aggiungi('indirizzo_completo', 'Indirizzo completo', GRUPPI.residenza);
      aggiungi('luogo_data_nascita', 'Luogo e data di nascita', GRUPPI.anagrafica);
      aggiungi('eta', 'Età', GRUPPI.anagrafica);
      (p.x || []).forEach(function (x) { if (x.e && x.v) { aggiungi('x:' + norm(x.e), x.e, 'Altri dati'); } });
    });
    veicoli.forEach(function (v) {
      const chi = unisci([v.d.marca, v.d.modello, v.d.targa], ' ') || 'Veicolo';
      (F.campiVeicolo || []).forEach(function (c) {
        const val = String(v.d[c.k] || '').trim();
        if (!val) { return; }
        const mostra = c.tipo === 'data' ? fmtData(val) : val;
        voci.push({ id: v.id + ':' + c.k, vid: v.id, k: c.k, titolo: c.e, gruppo: GRUPPI[c.g] || 'Veicolo', chi: chi, valore: mostra,
          iso: c.tipo === 'data' ? val : '', cerca: norm(c.e + ' ' + (GRUPPI[c.g] || '') + ' veicolo auto ' + chi + ' ' + mostra) });
      });
    });
    return voci;
  };
  const cerca = function (q, voci) {
    const qt = norm(q).split(' ').filter(Boolean);
    if (!qt.length) { return voci.slice(); }
    const punti = [];
    voci.forEach(function (v, i) {
      const tt = v.cerca.split(' ');
      const titolo = norm(v.titolo + ' ' + v.gruppo).split(' ');
      let p = 0;
      for (let j = 0; j < qt.length; j++) {
        const inTitolo = titolo.some(function (x) { return x.indexOf(qt[j]) === 0; });
        const altrove = tt.some(function (x) { return x.indexOf(qt[j]) === 0; });
        if (!inTitolo && !altrove) { return; }
        p += inTitolo ? 3 : 1;
      }
      punti.push([p, i]);
    });
    punti.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    return punti.map(function (x) { return voci[x[1]]; });
  };

  if (opz.api) {
    return {
      norm: norm,
      sigla: sigla,
      riconosci: function (testo, ctx) { return riconosci([[norm(testo), 3]], ctx ? norm(ctx) : ''); },
      riconosciIndizi: function (indizi, ctx) {
        return riconosci(indizi.map(function (h) { return [norm(h[0]), h[1]]; }).filter(function (h) { return h[0]; }), ctx ? norm(ctx) : '');
      },
      valore: function (a, testo, info) { return a ? calcola(a.k, personaDi(a.r), norm(testo || ''), info) : ''; },
      valoreIso: function (a) { return a ? (VEIC_K.has(a.k) ? String((veicolo && veicolo.d[a.k]) || '') : grezzo(personaDi(a.r), a.k)) : ''; },
      spazio: spazio,
      opzione: function (a, testi) { return a ? sceltaTra(testi, candidati(a, '', calcola(a.k, personaDi(a.r), '', {}))) : -1; },
      opzioneValore: function (valoreTesto, testi) { return sceltaTra(testi, [norm(valoreTesto)]); },
      elenco: elenco,
      cerca: cerca,
      etichetta: function (a) {
        if (!a) { return ''; }
        const d = DEF[a.k];
        const pers = personaDi(a.r);
        const chi = VEIC_K.has(a.k) ? 'veicolo' : (a.r ? (pers ? nomeDi(pers) : a.r) : '');
        return (d ? d.e : a.k.replace(/^x:/, '')) + (chi ? ' · ' + chi : '');
      },
    };
  }

  // ---------- Da qui in poi lavora sulla pagina ----------
  const radice = opz.radice || document;
  const DOCUMENTO = radice.ownerDocument || radice;
  const testo = function (n) { return n ? String(n.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  const testoSenzaCampi = function (n) {
    const c = n.cloneNode(true);
    c.querySelectorAll('input,select,textarea,option,script,style').forEach(function (x) { x.remove(); });
    return testo(c);
  };
  const CONTROLLI = /^(INPUT|SELECT|TEXTAREA|BUTTON)$/;
  const testoPrima = function (cont, el) {
    const w = el.ownerDocument.createTreeWalker(cont, 5, {
      acceptNode: function (n) {
        return (n.nodeType === 1 && /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|OPTGROUP|DATALIST)$/.test(n.tagName)) ? 2 : 1;
      },
    });
    let acc = '';
    let n = w.nextNode();
    while (n) {
      if (n === el) { return acc.replace(/\s+/g, ' ').trim().slice(-80); }
      if (n.nodeType === 1) {
        if (CONTROLLI.test(n.tagName) && n.type !== 'hidden') { acc = ''; }
      } else {
        acc += ' ' + n.nodeValue;
      }
      n = w.nextNode();
    }
    return '';
  };
  const vicino = function (el) {
    const cella = el.closest('td,th');
    if (cella) {
      const t = testoPrima(cella, el);
      if (norm(t)) { return t; }
      let p = cella.previousElementSibling;
      while (p && !testo(p)) { p = p.previousElementSibling; }
      if (p && !p.querySelector('input,select,textarea')) { return testo(p).slice(-80); }
      return '';
    }
    let n = el.parentElement;
    for (let liv = 0; n && liv < 3; liv++) {
      const t = testoPrima(n, el);
      if (norm(t)) { return t; }
      if (/^(FORM|BODY|FIELDSET)$/.test(n.tagName)) { break; }
      n = n.parentElement;
    }
    return '';
  };
  const indiziDi = function (el) {
    const H = [];
    const add = function (t, peso) {
      const n = norm(t);
      if (n && n.length < 120) { H.push([n, peso]); }
    };
    try {
      if (el.labels) { Array.prototype.forEach.call(el.labels, function (l) { add(testoSenzaCampi(l), 3); }); }
    } catch (e) { /* etichette non disponibili */ }
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      lb.split(/\s+/).forEach(function (id) {
        const n = el.ownerDocument.getElementById(id);
        if (n) { add(testo(n), 3); }
      });
    }
    add(el.getAttribute('aria-label'), 3);
    add(el.getAttribute('placeholder'), 2);
    add(el.getAttribute('title'), 2);
    add(el.getAttribute('name'), 2);
    add(el.id, 2);
    add(vicino(el), 2);
    return H;
  };
  const contesto = function (el) {
    const parti = [];
    let n = el.parentElement;
    for (let liv = 0; n && liv < 12; liv++) {
      if (n.tagName === 'FIELDSET') {
        const lg = n.querySelector('legend');
        if (lg) { parti.push(testo(lg)); }
      }
      const ruolo = n.getAttribute('role');
      if ((ruolo === 'group' || ruolo === 'region' || ruolo === 'radiogroup') && n.getAttribute('aria-label')) {
        parti.push(n.getAttribute('aria-label'));
      }
      if (n.tagName === 'FORM' || n.tagName === 'BODY') { break; }
      n = n.parentElement;
    }
    const form = el.form || el.closest('form');
    if (form) {
      const titoli = form.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]');
      if (titoli.length > 1) {
        let ultimo = null;
        for (let i = 0; i < titoli.length; i++) {
          if (titoli[i].compareDocumentPosition(el) & 4) { ultimo = titoli[i]; } else { break; }
        }
        if (ultimo) { parti.push(testo(ultimo)); }
      }
    }
    return norm(parti.join(' | ').slice(0, 200));
  };

  const AUTO = {
    'given-name': 'nome', 'family-name': 'cognome', name: 'nome_completo', email: 'email', tel: 'telefono',
    'tel-national': 'telefono', mobile: 'telefono', 'postal-code': 'cap', 'street-address': 'indirizzo',
    'address-line1': 'indirizzo', 'address-level2': 'citta', 'address-level1': 'provincia', 'country-name': 'nazione',
    country: 'nazione', bday: 'data_nascita', 'bday-day': 'data_nascita:g', 'bday-month': 'data_nascita:m',
    'bday-year': 'data_nascita:a', sex: 'sesso', 'organization-title': 'professione',
  };
  const daAuto = function (el) {
    const a = String(el.getAttribute('autocomplete') || '').toLowerCase().trim().split(/\s+/);
    for (let i = a.length - 1; i >= 0; i--) {
      if (AUTO[a[i]]) { return AUTO[a[i]]; }
    }
    return '';
  };
  const parteData = function (h) {
    const g = has(h, ['giorno', 'gg', 'day', 'dd']);
    const m = has(h, ['mese', 'mm', 'month']);
    const a = has(h, ['anno', 'aaaa', 'yyyy', 'year', 'aa', 'yy']);
    if (g + m + a !== 1) { return ''; }
    return g ? 'g' : (m ? 'm' : 'a');
  };
  const parteDaOpzioni = function (sel) {
    if (sel.tagName !== 'SELECT') { return ''; }
    const t = Array.prototype.map.call(sel.options, function (o) { return norm(o.text); }).filter(Boolean);
    const num = t.filter(function (x) { return /^\d+$/.test(x); });
    if (num.length >= 28 && num.length <= 32 && num.every(function (x) { return Number(x) <= 31; })) { return 'g'; }
    if (num.length >= 20 && num.every(function (x) { return x.length === 4; })) { return 'a'; }
    const mesi = t.filter(function (x) { return F.mesi.some(function (m) { return m[0] === x || m[2] === x; }); });
    if (mesi.length >= 12 || (num.length >= 12 && num.length <= 13)) { return 'm'; }
    return '';
  };

  const visibile = function (el) {
    if (el.disabled || el.readOnly) { return false; }
    if (el.closest('[hidden],[aria-hidden="true"]')) { return false; }
    const vista = el.ownerDocument.defaultView;
    if (el.getClientRects().length && vista.getComputedStyle(el).visibility !== 'hidden') { return true; }
    if (el.type === 'radio') {
      return Array.prototype.some.call(el.labels || [], function (l) { return l.getClientRects().length > 0; });
    }
    if (el.tagName === 'SELECT') {
      const vicini = [el.nextElementSibling, el.parentElement];
      return vicini.some(function (x) {
        return x && /select2|chosen|selectize|choices|bootstrap-select|ts-wrapper/.test(String(x.className || ''));
      });
    }
    return false;
  };
  const vuoto = function (el) {
    if (el.tagName === 'SELECT') {
      const o = el.options[el.selectedIndex];
      if (!o || o.value === '' || o.value === '-1') { return true; }
      const t = norm(o.text);
      return !t || /^(seleziona|scegli|select|choose|nessun|none|scegliere)/.test(t);
    }
    return String(el.value || '').trim() === '';
  };
  const NON_TESTO = /^(hidden|password|file|submit|button|reset|image|checkbox|range|color|search|radio)$/;
  const scrivibile = function (el) {
    if (!el || !el.tagName) { return false; }
    if (el.tagName === 'TEXTAREA') { return !el.disabled && !el.readOnly; }
    if (el.tagName !== 'INPUT') { return false; }
    return !NON_TESTO.test(String(el.type || 'text').toLowerCase()) && !el.disabled && !el.readOnly;
  };

  const imposta = function (el, val) {
    let p = Object.getPrototypeOf(el);
    let d = null;
    while (p && !(d = Object.getOwnPropertyDescriptor(p, 'value'))) { p = Object.getPrototypeOf(p); }
    if (d && d.set) { d.set.call(el, val); } else { el.value = val; }
    const E = el.ownerDocument.defaultView.Event;
    el.dispatchEvent(new E('input', { bubbles: true }));
    el.dispatchEvent(new E('change', { bubbles: true }));
    el.dispatchEvent(new E('blur'));
  };
  const segna = function (el, colore, stile) {
    el.style.outline = '2px ' + (stile || 'solid') + ' ' + colore;
    el.style.outlineOffset = '1px';
    const via = function (e) {
      if (e && !e.isTrusted) { return; }
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.removeEventListener('input', via);
    };
    el.addEventListener('input', via);
  };
  const inserisci = function (el, testoValore, iso) {
    if (el.tagName === 'SELECT') {
      const i = sceltaTra(Array.prototype.map.call(el.options, function (o) { return [o.text, o.value]; }), [norm(testoValore)]);
      if (i < 0) { return false; }
      imposta(el, el.options[i].value);
    } else {
      imposta(el, el.type === 'date' && iso ? iso : testoValore);
    }
    segna(el, '#1f8a4c');
    return true;
  };

  const testoRadio = function (r) {
    let t = '';
    try {
      if (r.labels && r.labels.length) { t = Array.prototype.map.call(r.labels, testoSenzaCampi).join(' '); }
    } catch (e) { /* nessuna etichetta */ }
    if (!t) {
      let s = r.nextSibling;
      while (s && !t) {
        if (s.nodeType === 1 && CONTROLLI.test(s.tagName)) { break; }
        t = s.nodeType === 3 ? s.textContent.trim() : (s.nodeType === 1 ? testo(s) : '');
        s = s.nextSibling;
      }
    }
    return t.slice(0, 60);
  };

  // ---------- Compilazione ----------
  const compila = function () {
    const elementi = [];
    const raccogli = function (r) {
      r.querySelectorAll('input,select,textarea').forEach(function (e) { elementi.push(e); });
      r.querySelectorAll('*').forEach(function (e) {
        if (e.shadowRoot && !e.hasAttribute('data-compilatutto')) { raccogli(e.shadowRoot); }
      });
      r.querySelectorAll('iframe,frame').forEach(function (f) {
        try { if (f.contentDocument) { raccogli(f.contentDocument); } } catch (e) { /* riquadro di un altro sito */ }
      });
    };
    raccogli(radice);

    const usati = new Set();
    const piano = [];
    const daFare = [];
    const gruppi = new Map();
    let ultimaData = null;
    let precedente = null;

    elementi.forEach(function (el) {
      const tipo = String(el.type || '').toLowerCase();
      if (tipo === 'radio') {
        if (el.name && visibile(el)) {
          const chiave = (el.form ? 'f' : 'd') + '|' + el.name;
          if (!gruppi.has(chiave)) { gruppi.set(chiave, []); }
          gruppi.get(chiave).push(el);
        }
        return;
      }
      if (el.tagName === 'INPUT' && NON_TESTO.test(tipo)) { return; }
      if (!visibile(el)) { return; }
      const H = indiziDi(el);
      const h = H.map(function (x) { return x[0]; }).join(' ');
      const auto = daAuto(el).split(':');
      const ctx = contesto(el);
      let a = analizza(H, ctx, auto[0] || null);
      let parte = auto[1] || '';
      if (!a && !auto[0]) {
        if (tipo === 'email') { a = analizza(H, ctx, 'email'); }
        else if (tipo === 'tel') { a = analizza(H, ctx, 'telefono'); }
      }
      if (a && a.salta) { ultimaData = null; precedente = null; return; }
      if (a && DATE.has(a.k) && !parte) { parte = parteData(h) || (el.tagName === 'SELECT' ? parteDaOpzioni(el) : ''); }
      if (!a && ultimaData && (el.tagName === 'SELECT' || (el.maxLength > 0 && el.maxLength <= 4))) {
        const pd = parteData(h) || parteDaOpzioni(el);
        if (pd && !usati.has((ultimaData.r || 'io') + ':' + ultimaData.k + ':' + pd)) { a = { k: ultimaData.k, r: ultimaData.r }; parte = pd; }
      }
      // Etichette brevi che dipendono dal campo precedente: «Via ___ n. ___», «Rilasciato da ___ il ___»
      if (!a && precedente) {
        const solo = function (parole) { return H.some(function (x) { return parole.indexOf(x[0]) >= 0; }); };
        let vk = '';
        if (precedente.k === 'indirizzo' && solo(['n', 'nr', 'num', 'numero', 'n civ'])) { vk = 'civico'; }
        else if (precedente.k === 'dom_indirizzo' && solo(['n', 'nr', 'num', 'numero', 'n civ'])) { vk = 'dom_civico'; }
        else if (precedente.k === 'tipo_documento' && solo(['n', 'nr', 'num', 'numero'])) { vk = 'numero_documento'; }
        else if (solo(['il', 'in data'])) {
          if (/^(luogo_nascita|provincia_nascita|nazione_nascita)$/.test(precedente.k)) { vk = 'data_nascita'; }
          else if (RILASCI[precedente.k]) { vk = RILASCI[precedente.k]; }
        }
        if (vk) {
          const b = analizza(H, ctx, vk);
          if (b && !b.salta) { a = { k: vk, r: precedente.r }; }
        }
      }
      if (!a) {
        if (vuoto(el)) { daFare.push(el); }
        ultimaData = null;
        precedente = null;
        return;
      }
      // «Comune di nascita ___ Prov. ___»: la provincia subito dopo il luogo di nascita è quella di nascita
      if (a.k === 'provincia' && precedente && precedente.k === 'luogo_nascita' && !has(h, ['residenza', 'residente'])) {
        a = { k: 'provincia_nascita', r: precedente.r };
      }
      precedente = a;
      ultimaData = (DATE.has(a.k) && parte) ? a : null;
      const chiave = (a.r || 'io') + ':' + a.k + ':' + parte;
      if (usati.has(chiave) && !has(h, CONFERMA)) { return; }
      usati.add(chiave);
      if (!vuoto(el)) { return; }
      piano.push({ el: el, a: a, h: h, parte: parte });
    });

    // Se il modulo ha un campo a parte per il numero civico, l'indirizzo va senza
    const civiciSeparati = new Set(piano.filter(function (p) { return p.a.k === 'civico' || p.a.k === 'dom_civico'; })
      .map(function (p) { return (p.a.r || 'io') + p.a.k.replace('civico', ''); }));
    const fatti = [];
    piano.forEach(function (p) {
      const el = p.el;
      const unisciCivico = !civiciSeparati.has((p.a.r || 'io') + p.a.k.replace('indirizzo', ''));
      let val = valore(p.a, p.h, el, p.parte, { unisciCivico: unisciCivico });
      if (!val) { daFare.push(el); return; }
      if (el.tagName === 'SELECT') {
        const i = sceltaTra(Array.prototype.map.call(el.options, function (o) { return [o.text, o.value]; }), candidati(p.a, p.parte, val));
        if (i < 0) { daFare.push(el); return; }
        val = el.options[i].value;
      } else {
        if (p.a.k === 'telefono' || p.a.k === 'telefono_fisso' || el.type === 'number') {
          const max = el.maxLength > 0 ? el.maxLength : 0;
          if (el.type === 'number') { val = val.replace(/[^\d]/g, ''); }
          if (max && val.length > max) { val = val.replace(/[\s.\-\/()]/g, ''); }
          if (max && val.length > max) { val = val.replace(/^(\+39|0039)/, ''); }
        }
        if (el.maxLength > 0 && val.length > el.maxLength) { daFare.push(el); return; }
      }
      imposta(el, val);
      segna(el, '#1f8a4c');
      fatti.push(el);
    });

    gruppi.forEach(function (rs) {
      if (rs.some(function (r) { return r.checked; })) { return; }
      const r0 = rs[0];
      const H = [];
      const add = function (t, peso) {
        const n = norm(t);
        if (n && n.length < 120) { H.push([n, peso]); }
      };
      const fs = r0.closest('fieldset');
      if (fs && fs.querySelector('legend')) { add(testo(fs.querySelector('legend')), 3); }
      const rg = r0.closest('[role=radiogroup]');
      if (rg) {
        add(rg.getAttribute('aria-label'), 3);
        const lb = rg.getAttribute('aria-labelledby');
        if (lb) { lb.split(/\s+/).forEach(function (id) { add(testo(r0.ownerDocument.getElementById(id)), 3); }); }
      }
      add(r0.name, 2);
      add(vicino(r0.closest('label') || r0), 2);
      const ctx = fs ? contesto(fs) : contesto(r0);
      const a = riconosci(H, ctx);
      if (!a) { return; }
      const chiave = (a.r || 'io') + ':' + a.k + ':';
      if (usati.has(chiave)) { return; }
      usati.add(chiave);
      const val = valore(a, '', r0, '', {});
      if (!val) { return; }
      const i = sceltaTra(rs.map(function (r) { return [testoRadio(r), r.value]; }), candidati(a, '', val));
      if (i < 0) { return; }
      rs[i].click();
      segna((rs[i].labels && rs[i].labels[0]) || rs[i], '#1f8a4c');
      fatti.push(rs[i]);
    });

    const contenitore = function (e) { return e.form || e.closest('form') || e.ownerDocument; };
    const moduli = new Set(fatti.map(contenitore));
    const restanti = daFare.filter(function (e, i) {
      return daFare.indexOf(e) === i && moduli.has(contenitore(e)) && vuoto(e);
    });
    restanti.forEach(function (e) { segna(e, '#d9a400', 'dashed'); });
    return {
      compilati: fatti.length,
      daCompletare: restanti.length,
      campi: piano.map(function (p) { return [p.el.name || p.el.id || p.el.tagName, (p.a.r ? p.a.r + ':' : '') + p.a.k + (p.parte ? ':' + p.parte : '')]; }),
    };
  };

  let esito = compila();
  if (opz.silenzioso) { return esito; }

  // ---------- Barra e selettore sulla pagina ----------
  const vecchio = DOCUMENTO.querySelector('[data-compilatutto]');
  if (vecchio && typeof vecchio.ctChiudi === 'function') { vecchio.ctChiudi(); } else if (vecchio) { vecchio.remove(); }
  const host = DOCUMENTO.createElement('div');
  host.setAttribute('data-compilatutto', '');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647';
  const ombra = host.attachShadow({ mode: 'open' });
  const stile = DOCUMENTO.createElement('style');
  stile.textContent = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.barra{position:fixed;right:16px;bottom:16px;max-width:min(360px,calc(100vw - 32px));background:#16224d;color:#fff;',
    'border-radius:12px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:14px;line-height:1.4}',
    '.barra b{display:block;font-size:15px;margin-bottom:2px}',
    '.azioni{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}',
    'button{font:inherit;cursor:pointer}',
    '.btn{border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:8px;padding:5px 10px;font-weight:600;font-size:13px}',
    '.btn:hover{background:rgba(255,255,255,.12)}',
    '.menu{position:fixed;width:min(380px,calc(100vw - 16px));max-height:min(360px,60vh);display:flex;flex-direction:column;',
    'background:#fff;color:#161b2e;border:1px solid #aab3c5;border-radius:10px;box-shadow:0 12px 32px rgba(22,27,46,.25);overflow:hidden}',
    '.testa{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #d3d9e4;background:#f3f5f9}',
    '.testa input{flex:1;min-width:0;font:inherit;font-size:14px;padding:7px 9px;border:1px solid #aab3c5;border-radius:6px;color:#161b2e;background:#fff}',
    '.chiudi{border:0;background:none;color:#586078;font-size:20px;line-height:1;padding:2px 6px}',
    '.voci{overflow:auto;flex:1}',
    '.voce{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;width:100%;text-align:left;border:0;border-bottom:1px solid #eef1f6;',
    'background:#fff;color:#161b2e;padding:8px 10px}',
    '.voce:hover,.voce.att{background:#e7ecfb}',
    '.voce .t{font-weight:600;font-size:14px}',
    '.voce .c{grid-column:1;font-size:12px;color:#586078}',
    '.voce .v{grid-row:1/span 2;grid-column:2;align-self:center;font:13px ui-monospace,Consolas,monospace;color:#2742b0;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.vuoto{padding:12px;color:#586078;font-size:13px}',
    '.piede{padding:6px 10px;font-size:12px;color:#586078;border-top:1px solid #d3d9e4;background:#f3f5f9}',
    '@media (max-width:520px){.barra{left:8px;right:8px;bottom:8px;max-width:none}}',
  ].join('');
  ombra.appendChild(stile);
  const crea = function (tag, cls, txt) {
    const e = DOCUMENTO.createElement(tag);
    if (cls) { e.className = cls; }
    if (txt != null) { e.textContent = txt; }
    return e;
  };

  const barra = crea('div', 'barra');
  barra.setAttribute('role', 'status');
  const titoloBarra = crea('b', '', 'Compilatutto · ' + nomeDi(S));
  const rigaEsito = crea('div', '');
  const rigaAiuto = crea('div', '', opz.scelta ? 'Tocca un campo per scegliere un dato dall\'elenco. Controlla tutto prima di inviare.' : 'Controlla tutto prima di inviare.');
  const azioni = crea('div', 'azioni');
  const bRifai = crea('button', 'btn', 'Compila di nuovo');
  const bChiudi = crea('button', 'btn', 'Chiudi');
  bRifai.type = 'button';
  bChiudi.type = 'button';
  azioni.appendChild(bRifai);
  azioni.appendChild(bChiudi);
  barra.appendChild(titoloBarra);
  barra.appendChild(rigaEsito);
  barra.appendChild(rigaAiuto);
  barra.appendChild(azioni);
  ombra.appendChild(barra);
  const scriviEsito = function () {
    rigaEsito.textContent = esito.compilati
      ? esito.compilati + (esito.compilati === 1 ? ' campo compilato' : ' campi compilati') + ' (bordo verde)' +
        (esito.daCompletare ? ', ' + esito.daCompletare + ' da completare (bordo giallo).' : '.')
      : 'Non ho riconosciuto campi da riempire da solo.';
  };
  scriviEsito();
  (DOCUMENTO.body || DOCUMENTO.documentElement).appendChild(host);

  // Selettore: elenco dei dati vicino al campo toccato
  const voci = opz.scelta ? elenco() : [];
  const menu = crea('div', 'menu');
  menu.style.display = 'none';
  const testa = crea('div', 'testa');
  const ricerca = crea('input', '');
  ricerca.type = 'text';
  ricerca.placeholder = 'Cerca un dato: targa, passaporto, Lucia…';
  ricerca.setAttribute('aria-label', 'Cerca un dato');
  ricerca.setAttribute('autocomplete', 'off');
  const bX = crea('button', 'chiudi', '×');
  bX.type = 'button';
  bX.setAttribute('aria-label', 'Chiudi l\'elenco');
  testa.appendChild(ricerca);
  testa.appendChild(bX);
  const listaVoci = crea('div', 'voci');
  listaVoci.setAttribute('role', 'listbox');
  const piede = crea('div', 'piede', 'Scrivi nel campo o qui sopra per cercare · Esc per chiudere');
  menu.appendChild(testa);
  menu.appendChild(listaVoci);
  menu.appendChild(piede);
  ombra.appendChild(menu);

  let bersaglio = null;
  let mostrate = [];
  let attiva = -1;
  let attivo = !!opz.scelta;
  const posiziona = function () {
    if (!bersaglio || menu.style.display === 'none') { return; }
    const r = bersaglio.getBoundingClientRect();
    const vv = DOCUMENTO.defaultView.visualViewport;
    const alto = vv ? vv.height : DOCUMENTO.defaultView.innerHeight;
    const largo = DOCUMENTO.defaultView.innerWidth;
    const w = Math.min(380, largo - 16);
    const h = menu.offsetHeight || 300;
    let top = r.bottom + 4;
    if (top + h > alto && r.top - h - 4 > 0) { top = r.top - h - 4; }
    menu.style.top = Math.max(8, Math.min(top, alto - 60)) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, largo - w - 8)) + 'px';
  };
  const disegnaVoci = function (q) {
    mostrate = cerca(q, voci).slice(0, 60);
    attiva = -1;
    listaVoci.textContent = '';
    if (!mostrate.length) {
      listaVoci.appendChild(crea('div', 'vuoto', voci.length ? 'Nessun dato corrisponde a «' + q + '».' : 'Non ci sono dati salvati.'));
      return;
    }
    mostrate.forEach(function (v, i) {
      const b = crea('button', 'voce');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.appendChild(crea('span', 't', v.titolo));
      b.appendChild(crea('span', 'c', (v.gruppo ? v.gruppo + ' · ' : '') + v.chi));
      b.appendChild(crea('span', 'v', v.valore));
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function () { scegli(i); });
      listaVoci.appendChild(b);
    });
  };
  const evidenzia = function (i) {
    const bs = listaVoci.querySelectorAll('.voce');
    if (!bs.length) { return; }
    attiva = (i + bs.length) % bs.length;
    bs.forEach(function (b, j) { b.classList.toggle('att', j === attiva); });
    bs[attiva].scrollIntoView({ block: 'nearest' });
  };
  const chiudiMenu = function () {
    menu.style.display = 'none';
    bersaglio = null;
  };
  const apriMenu = function (el) {
    bersaglio = el;
    ricerca.value = '';
    disegnaVoci('');
    menu.style.display = 'flex';
    posiziona();
  };
  const scegli = function (i) {
    const v = mostrate[i];
    const el = bersaglio;
    if (!v || !el) { return; }
    inserisci(el, v.valore, v.iso);
    chiudiMenu();
    try { el.focus(); } catch (e) { /* campo non più disponibile */ }
  };
  const dentroRadice = function (el) { return radice === DOCUMENTO || radice.contains(el); };
  const suFocus = function (e) {
    const el = e.target;
    if (!attivo || el === host || !scrivibile(el) || !dentroRadice(el)) { return; }
    apriMenu(el);
  };
  const suInput = function (e) {
    if (!e.isTrusted || e.target !== bersaglio || menu.style.display === 'none') { return; }
    disegnaVoci(bersaglio.value);
    if (!mostrate.length) { menu.style.display = 'none'; }
  };
  const suTasto = function (e) {
    if (!bersaglio || e.target !== bersaglio) { return; }
    if (e.key === 'Escape') { chiudiMenu(); return; }
    if (menu.style.display === 'none') { return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); evidenzia(attiva + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); evidenzia(attiva - 1); }
    else if (e.key === 'Enter' && attiva >= 0) { e.preventDefault(); scegli(attiva); }
  };
  const suClic = function (e) {
    if (e.target === host) { return; }
    if (bersaglio && e.target === bersaglio) { return; }
    if (scrivibile(e.target) && attivo && dentroRadice(e.target)) { apriMenu(e.target); return; }
    chiudiMenu();
  };
  ricerca.addEventListener('input', function () { disegnaVoci(ricerca.value); });
  ricerca.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); evidenzia(attiva + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); evidenzia(attiva - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); scegli(attiva >= 0 ? attiva : 0); }
    else if (e.key === 'Escape') { chiudiMenu(); }
  });
  bX.addEventListener('mousedown', function (e) { e.preventDefault(); });
  bX.addEventListener('click', chiudiMenu);
  const vista = DOCUMENTO.defaultView;
  if (opz.scelta) {
    DOCUMENTO.addEventListener('focusin', suFocus, true);
    DOCUMENTO.addEventListener('input', suInput, true);
    DOCUMENTO.addEventListener('keydown', suTasto, true);
    DOCUMENTO.addEventListener('click', suClic, true);
    vista.addEventListener('scroll', posiziona, true);
    vista.addEventListener('resize', posiziona);
  }
  const chiudiTutto = function () {
    DOCUMENTO.removeEventListener('focusin', suFocus, true);
    DOCUMENTO.removeEventListener('input', suInput, true);
    DOCUMENTO.removeEventListener('keydown', suTasto, true);
    DOCUMENTO.removeEventListener('click', suClic, true);
    vista.removeEventListener('scroll', posiziona, true);
    vista.removeEventListener('resize', posiziona);
    attivo = false;
    host.remove();
  };
  host.ctChiudi = chiudiTutto;
  bChiudi.addEventListener('click', chiudiTutto);
  bRifai.addEventListener('click', function () { esito = compila(); scriviEsito(); });
  esito.chiudi = chiudiTutto;
  return esito;
}
