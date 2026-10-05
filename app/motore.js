// Compilatutto: il motore che riconosce i campi di un modulo e li riempie con i dati del profilo.
// La funzione deve restare autosufficiente, perché l'app la trasforma in testo per creare il segnalibro «Compila».
// Regole per chi la modifica: niente variabili esterne, commenti solo su righe proprie, punto e virgola sempre.
//
// P   profilo { n: nome profilo, t: 'adulto' | 'minore', d: { chiave: valore }, x: [{ e, v, p }] }
// F   dati di riferimento (vedi campi.js)
// opz { radice, doc, api, silenzioso }
function compilaModulo(P, F, opz) {
  opz = opz || {};
  P = P || {};
  const D = P.d || {};
  const EXTRA = (P.x || []).filter(function (x) { return x && x.v; });
  const STOP = new Set(F.stop);

  const norm = function (s) {
    let t = String(s == null ? '' : s).replace(/([a-zà-ú])([A-Z])/g, '$1 $2');
    t = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/(\d+)/g, ' $1 ').replace(/[^a-z0-9]+/g, ' ');
    return t.split(' ').filter(function (w) { return w && !STOP.has(w); }).join(' ');
  };
  const lista = function (a) { return (a || []).map(norm).filter(Boolean); };
  const has = function (h, parole) {
    const s = ' ' + h + ' ';
    for (let i = 0; i < parole.length; i++) {
      if (s.indexOf(' ' + parole[i] + ' ') >= 0) { return true; }
    }
    return false;
  };

  const SALTA = lista(F.salta);
  const ORG = lista(F.org);
  const PADRE = lista(F.padre);
  const MADRE = lista(F.madre);
  const CONFERMA = lista(F.conferma);
  const ALTRI = lista((P.t === 'minore' ? F.altriMinore : F.altriAdulto).concat(opz.doc ? (F.altriDoc || []) : []));

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
  const CAMPI = F.campi.filter(function (c) { return opz.doc || !c.doc; }).map(function (c) {
    return { k: c.k, rel: c.rel || '', sin: prepara(c.sin), escl: lista(c.escl) };
  });
  EXTRA.forEach(function (x, i) {
    const frasi = [x.e].concat(String(x.p || '').split(','));
    CAMPI.push({ k: 'x' + i, rel: '', sin: prepara(frasi), escl: [] });
  });

  // Riconosce il dato a partire dai testi che descrivono un campo.
  // indizi: [[testo normalizzato, peso]]; ctx: testo della sezione (legenda, titolo).
  const escluso = function (indizi, ctx) {
    const tutto = indizi.map(function (h) { return h[0]; }).join(' | ');
    return has(tutto, SALTA) || has(tutto, ORG) || has(tutto, ALTRI) || !!(ctx && (has(ctx, ORG) || has(ctx, ALTRI)));
  };
  const riconosci = function (indizi, ctx, forzato) {
    if (escluso(indizi, ctx)) { return null; }
    const tutto = indizi.map(function (h) { return h[0]; }).join(' | ');
    const rel = has(tutto, PADRE) ? 'padre' : (has(tutto, MADRE) ? 'madre' : '');
    const relCtx = ctx ? (has(ctx, PADRE) ? 'padre' : (has(ctx, MADRE) ? 'madre' : '')) : '';
    let k = forzato || null;
    if (!k) {
      let meglio = 0;
      CAMPI.forEach(function (c) {
        if (rel && c.rel !== rel) { return; }
        let p = 0;
        indizi.forEach(function (h) {
          if (!h[0] || has(h[0], c.escl)) { return; }
          const s = ' ' + h[0] + ' ';
          c.sin.forEach(function (sn) {
            if (s.indexOf(' ' + sn[0] + ' ') >= 0) {
              const v = (sn[1] + (h[0] === sn[0] ? 0.5 : 0)) * h[1];
              if (v > p) { p = v; }
            }
          });
        });
        if (p > meglio) { meglio = p; k = c.k; }
      });
    }
    if (k && relCtx && !rel) {
      if (k === 'nome') { k = 'nome_' + relCtx; }
      else if (k === 'cognome') { k = 'cognome_' + relCtx; }
      else if (k === 'nome_completo') { k = 'nome_completo_' + relCtx; }
      else { k = null; }
    }
    return k;
  };

  // Valori
  const v = function (k) {
    if (k.charAt(0) === 'x' && /^x\d+$/.test(k)) {
      const x = EXTRA[Number(k.slice(1))];
      return x ? String(x.v).trim() : '';
    }
    return String(D[k] == null ? '' : D[k]).trim();
  };
  const unisci = function (parti, sep) { return parti.filter(Boolean).join(sep); };
  const due = function (n) { return (n < 10 ? '0' : '') + n; };
  const oggiIso = function () {
    const d = new Date();
    return d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate());
  };
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
  const fmtData = function (iso, el, h, parte) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) { return iso || ''; }
    const a = m[1];
    const me = m[2];
    const g = m[3];
    if (parte === 'g') { return g; }
    if (parte === 'm') { return me; }
    if (parte === 'a') { return a; }
    if (el && el.type === 'date') { return iso; }
    const ph = el ? String(el.getAttribute('placeholder') || '').toLowerCase() : '';
    let r = /(gg|dd)\s*([\/.\-])\s*(mm)\s*[\/.\-]\s*(aaaa|yyyy|aa|yy)/.exec(ph);
    if (r) { return g + r[2] + me + r[2] + (r[4].length === 2 ? a.slice(2) : a); }
    r = /(aaaa|yyyy)\s*([\/.\-])\s*(mm)/.exec(ph);
    if (r) { return a + r[2] + me + r[2] + g; }
    if (el && el.maxLength === 8) { return g + me + a; }
    return g + '/' + me + '/' + a;
  };
  const indirizzoConCivico = function () { return unisci([v('indirizzo'), v('civico')], ', '); };

  // Valore di un dato per un certo campo. h = testo normalizzato che descrive il campo.
  const valore = function (k, h, el, parte, info) {
    info = info || {};
    h = h || '';
    let r = '';
    if (k === 'nome_completo') {
      const s = ' ' + h + ' ';
      const ic = s.indexOf(' cognome ');
      const inn = s.indexOf(' nome ');
      r = (ic >= 0 && (inn < 0 || ic < inn)) ? unisci([v('cognome'), v('nome')], ' ') : unisci([v('nome'), v('cognome')], ' ');
    } else if (k === 'cognome_padre') {
      r = v('cognome_padre') || (v('nome_padre') ? v('cognome') : '');
    } else if (k === 'nome_completo_padre') {
      r = v('nome_padre') ? unisci([v('nome_padre'), v('cognome_padre') || v('cognome')], ' ') : '';
    } else if (k === 'nome_completo_madre') {
      r = v('nome_madre') ? unisci([v('nome_madre'), v('cognome_madre')], ' ') : '';
    } else if (k === 'indirizzo') {
      r = (info.unisciCivico || has(h, ['civico', 'civ'])) ? indirizzoConCivico() : v('indirizzo');
      if (opz.doc) {
        const ult = h.split(' ').pop();
        if (/^(via|viale|piazza|piazzale|corso|largo|vicolo|strada|contrada|localita|frazione)$/.test(ult)) {
          r = r.replace(new RegExp('^' + ult + '\\s+', 'i'), '');
        }
      }
    } else if (k === 'indirizzo_completo') {
      const p = sigla(v('provincia'));
      const luogo = unisci([v('cap'), v('citta')], ' ') + (p ? ' (' + p + ')' : '');
      r = unisci([indirizzoConCivico(), luogo.trim()], ', ');
    } else if (k === 'luogo_data_nascita') {
      const p = sigla(v('provincia_nascita'));
      r = unisci([v('luogo_nascita') + (p ? ' (' + p + ')' : ''), fmtData(v('data_nascita'))], ', ');
    } else if (k === 'luogo') {
      r = v('citta');
    } else if (k === 'oggi') {
      r = fmtData(oggiIso());
    } else if (k === 'luogo_data') {
      r = unisci([v('citta'), fmtData(oggiIso())], ', ');
    } else if (k === 'data_nascita' || k === 'data_rilascio' || k === 'scadenza_documento') {
      r = fmtData(v(k), el, h, parte);
    } else if (k === 'provincia' || k === 'provincia_nascita') {
      r = sigla(v(k)) || v(k);
    } else if (k === 'codice_fiscale') {
      r = v(k).toUpperCase().replace(/\s+/g, '');
    } else if (k === 'sesso') {
      r = v(k).toUpperCase().charAt(0);
    } else {
      r = v(k);
    }
    return r;
  };

  // Spazi vuoti nelle lettere: «nato a ______ il ______».
  const SPAZI = (F.spazi || []).map(function (s) { return [norm(s[0]), s[1]]; }).filter(function (s) { return s[0]; });
  const spazio = function (prima, prec) {
    const t = norm(String(prima || '').slice(-80));
    const tok = t ? t.split(' ') : [];
    let k = null;
    let lun = 0;
    SPAZI.forEach(function (s) {
      const ft = s[0].split(' ');
      if (ft.length > tok.length || ft.length <= lun) { return; }
      for (let i = 1; i <= ft.length; i++) {
        if (tok[tok.length - i] !== ft[ft.length - i]) { return; }
      }
      k = s[1];
      lun = ft.length;
    });
    // «Il coniuge nato a ___» riguarda un'altra persona; «figlio/a di ___» invece parla di chi scrive
    if (k) {
      const prima3 = tok.slice(Math.max(0, tok.length - lun - 3), tok.length - lun);
      const daGuardare = /_(padre|madre)$/.test(k) ? prima3 : prima3.concat(tok.slice(tok.length - lun));
      const fin = daGuardare.join(' ');
      if (fin && (has(fin, ALTRI) || has(fin, ORG))) { return null; }
    }
    if (k === '@n') { k = prec === 'indirizzo' ? 'civico' : (prec === 'tipo_documento' ? 'numero_documento' : null); }
    else if (k === '@il') {
      k = /^(luogo_nascita|provincia_nascita|nazione_nascita)$/.test(prec) ? 'data_nascita' : (prec === 'rilasciato_da' ? 'data_rilascio' : null);
    }
    else if (k === '@prov') { k = /nascita/.test(prec || '') ? 'provincia_nascita' : 'provincia'; }
    if (!k && !tok.length) {
      if (prec === 'luogo_nascita') { k = 'provincia_nascita'; }
      else if (prec === 'citta') { k = 'provincia'; }
      else if (prec === 'indirizzo') { k = 'civico'; }
      else if (/_padre$/.test(prec || '')) { k = 'nome_completo_madre'; }
    }
    if (!k && tok.length) { k = riconosci([[tok.slice(-6).join(' '), 2]], ''); }
    return k;
  };

  if (opz.api) {
    return {
      norm: norm,
      riconosci: function (testo, ctx) { return riconosci([[norm(testo), 3]], ctx ? norm(ctx) : ''); },
      valore: function (k, testo, info) { return valore(k, norm(testo || ''), null, '', info); },
      spazio: spazio,
      sigla: sigla,
    };
  }

  // ---------- Da qui in poi lavora sulla pagina ----------
  const radice = opz.radice || document;
  const testo = function (n) { return n ? String(n.textContent || '').replace(/\s+/g, ' ').trim() : ''; };
  const testoSenzaCampi = function (n) {
    const c = n.cloneNode(true);
    c.querySelectorAll('input,select,textarea,option,script,style').forEach(function (x) { x.remove(); });
    return testo(c);
  };
  const CONTROLLI = /^(INPUT|SELECT|TEXTAREA|BUTTON)$/;
  const testoPrima = function (cont, el) {
    const doc = el.ownerDocument;
    const w = doc.createTreeWalker(cont, 5, {
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
  const DATE = /^(data_nascita|data_rilascio|scadenza_documento)$/;
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
    const via = function () {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.removeEventListener('input', via);
    };
    el.addEventListener('input', via);
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
      if (ct.every(function (t) { return ot.indexOf(t) >= 0; }) && ot.length <= ct.length + 2) {
        meglio = Math.max(meglio, 60 - pen);
      } else if (o.length >= 3 && ot.every(function (t) { return ct.indexOf(t) >= 0; })) {
        meglio = Math.max(meglio, 40 - pen);
      } else {
        let q = 0;
        while (q < o.length && q < c.length && o.charAt(q) === c.charAt(q)) { q++; }
        if (q >= 5 && q >= 0.7 * Math.min(o.length, c.length)) { meglio = Math.max(meglio, 30 - pen); }
      }
    });
    return meglio;
  };
  const candidati = function (k, parte, val) {
    const c = [];
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v(k) || '');
    if (DATE.test(k) && iso && parte) {
      if (parte === 'g') { c.push(String(Number(iso[3])), iso[3]); }
      if (parte === 'a') { c.push(iso[1], iso[1].slice(2)); }
      if (parte === 'm') {
        const m = Number(iso[2]);
        c.push(String(m), iso[2]);
        F.mesi[m - 1].forEach(function (x) { c.push(x); });
      }
    } else if (k === 'sesso') {
      const s = v('sesso').toUpperCase().charAt(0);
      if (s === 'M') { c.push('m', 'maschio', 'maschile', 'uomo', 'male', 'man', 'maschi'); }
      if (s === 'F') { c.push('f', 'femmina', 'femminile', 'donna', 'female', 'woman', 'femmine'); }
    } else if (k === 'provincia' || k === 'provincia_nascita') {
      const sg = sigla(v(k));
      if (sg) { c.push(sg.toLowerCase(), norm(F.prov[sg]), norm(F.prov[sg] + ' ' + sg), norm(sg + ' ' + F.prov[sg])); }
      else { c.push(norm(v(k))); }
    } else {
      c.push(norm(val));
      if (/^(nazione|nazione_nascita|cittadinanza)$/.test(k) && /^itali/.test(norm(val))) {
        c.push('italia', 'italiana', 'italiano', 'italy', 'italian', 'it', 'ita');
      }
    }
    return c.map(function (x) { return norm(x); }).filter(Boolean);
  };
  const scegliOpzione = function (sel, cand) {
    let meglio = 0;
    let scelta = -1;
    Array.prototype.forEach.call(sel.options, function (o, i) {
      if (o.disabled) { return; }
      const p = Math.max(simile(norm(o.text), cand), simile(norm(o.value), cand));
      if (p > meglio) { meglio = p; scelta = i; }
    });
    return meglio >= 30 ? scelta : -1;
  };

  // Raccolta dei campi: pagina, riquadri della stessa origine, componenti con shadow DOM
  const elementi = [];
  const raccogli = function (r) {
    r.querySelectorAll('input,select,textarea').forEach(function (e) { elementi.push(e); });
    r.querySelectorAll('*').forEach(function (e) { if (e.shadowRoot) { raccogli(e.shadowRoot); } });
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
  let precedente = '';

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
    let k = riconosci(H, ctx, auto[0]);
    let parte = auto[1] || '';
    if (!k && !auto[0]) {
      if (tipo === 'email' && !has(h, SALTA)) { k = riconosci(H, ctx, 'email'); }
      else if (tipo === 'tel') { k = riconosci(H, ctx, 'telefono'); }
    }
    if (k && DATE.test(k) && !parte) { parte = parteData(h) || (el.tagName === 'SELECT' ? parteDaOpzioni(el) : ''); }
    if (!k && ultimaData && (el.tagName === 'SELECT' || (el.maxLength > 0 && el.maxLength <= 4))) {
      const pd = parteData(h) || parteDaOpzioni(el);
      if (pd && !usati.has(ultimaData + ':' + pd)) { k = ultimaData; parte = pd; }
    }
    // Etichette brevi che dipendono dal campo precedente: «Via ___ n. ___», «Rilasciato da ___ il ___»
    if (!k && precedente) {
      const solo = function (parole) { return H.some(function (x) { return parole.indexOf(x[0]) >= 0; }); };
      let vicinoK = '';
      if (precedente === 'indirizzo' && solo(['n', 'nr', 'num', 'numero', 'n civ'])) { vicinoK = 'civico'; }
      else if (precedente === 'tipo_documento' && solo(['n', 'nr', 'num', 'numero'])) { vicinoK = 'numero_documento'; }
      else if (solo(['il', 'in data'])) {
        if (/^(luogo_nascita|provincia_nascita|nazione_nascita)$/.test(precedente)) { vicinoK = 'data_nascita'; }
        else if (precedente === 'rilasciato_da') { vicinoK = 'data_rilascio'; }
      }
      if (vicinoK) { k = riconosci(H, ctx, vicinoK); }
    }
    if (!k) {
      if (vuoto(el) && !escluso(H, ctx)) { daFare.push(el); }
      ultimaData = null;
      precedente = '';
      return;
    }
    // «Comune di nascita ___ Prov. ___»: la provincia subito dopo il luogo di nascita è quella di nascita
    if (k === 'provincia' && precedente === 'luogo_nascita' && !has(h, ['residenza', 'residente'])) { k = 'provincia_nascita'; }
    precedente = k;
    ultimaData = (DATE.test(k) && parte) ? k : null;
    const chiave = k + (parte ? ':' + parte : '');
    const conferma = has(h, CONFERMA);
    if (usati.has(chiave) && !conferma) { return; }
    usati.add(chiave);
    if (!vuoto(el)) { return; }
    piano.push({ el: el, k: k, h: h, parte: parte });
  });

  const unisciCivico = !piano.some(function (p) { return p.k === 'civico'; });
  const fatti = [];
  piano.forEach(function (p) {
    const el = p.el;
    let val = valore(p.k, p.h, el, p.parte, { unisciCivico: unisciCivico });
    if (!val) { daFare.push(el); return; }
    if (el.tagName === 'SELECT') {
      const i = scegliOpzione(el, candidati(p.k, p.parte, val));
      if (i < 0) { daFare.push(el); return; }
      val = el.options[i].value;
    } else {
      if (p.k === 'telefono' || el.type === 'number') {
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

  // Pulsanti di scelta (es. sesso M / F)
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
    return norm(t.slice(0, 60));
  };
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
    const k = riconosci(H, '');
    if (!k) { return; }
    if (usati.has(k)) { return; }
    usati.add(k);
    const val = valore(k, '', r0, '', {});
    if (!val) { return; }
    const cand = candidati(k, '', val);
    let meglio = 0;
    let scelto = null;
    rs.forEach(function (r) {
      const p = Math.max(simile(testoRadio(r), cand), simile(norm(r.value), cand));
      if (p > meglio) { meglio = p; scelto = r; }
    });
    if (!scelto || meglio < 30) { return; }
    scelto.click();
    const segnato = (scelto.labels && scelto.labels[0]) || scelto;
    segna(segnato, '#1f8a4c');
    fatti.push(scelto);
  });

  // Campi rimasti vuoti nei moduli in cui abbiamo scritto qualcosa
  const contenitore = function (e) { return e.form || e.closest('form') || e.ownerDocument; };
  const moduli = new Set(fatti.map(contenitore));
  const restanti = daFare.filter(function (e, i) {
    return daFare.indexOf(e) === i && moduli.has(contenitore(e)) && vuoto(e);
  });
  restanti.forEach(function (e) { segna(e, '#d9a400', 'dashed'); });

  const esito = {
    compilati: fatti.length,
    daCompletare: restanti.length,
    campi: piano.map(function (p) { return [p.el.name || p.el.id || p.el.tagName, p.k + (p.parte ? ':' + p.parte : '')]; }),
  };

  if (!opz.silenzioso) {
    const doc = radice.ownerDocument || radice;
    const righe = fatti.length ? [
      'Compilatutto' + (P.n ? ' · ' + P.n : ''),
      fatti.length + (fatti.length === 1 ? ' campo compilato' : ' campi compilati') + ' (bordo verde).',
    ].concat(restanti.length ? [restanti.length + (restanti.length === 1 ? ' campo da completare' : ' campi da completare') + ' a mano (bordo giallo).'] : [])
      .concat(['Controlla tutto prima di inviare.']) : [
      'Compilatutto',
      'Non ho riconosciuto campi da riempire in questa pagina.',
      'Puoi usare «Copia rapida» nell\'app e incollare i dati a mano.',
    ];
    const box = doc.createElement('div');
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;left:auto;max-width:min(340px,calc(100vw - 32px));' +
      'background:#16224d;color:#fff;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:14px 16px;' +
      'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);cursor:pointer;text-align:left';
    righe.forEach(function (r, i) {
      const p = doc.createElement('div');
      p.textContent = r;
      if (i === 0) { p.style.fontWeight = '700'; p.style.marginBottom = '4px'; }
      box.appendChild(p);
    });
    box.addEventListener('click', function () { box.remove(); });
    (doc.body || doc.documentElement).appendChild(box);
    setTimeout(function () { box.remove(); }, 9000);
  }
  return esito;
}
