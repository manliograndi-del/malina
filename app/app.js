/* Compilatutto – interfaccia dell'app (versione 2).
 * Collega le schermate di index.html alla cassaforte cifrata, al motore, al pulsante «Compila» e ai PDF.
 * I dati in chiaro esistono solo in memoria mentre la cassaforte è aperta: salvati sono sempre cifrati. */
(function () {
  'use strict';

  const V1 = 'compilatutto.v1';
  const SCARICATO = 'compilatutto.scaricato';
  const MIN_PW = 10;
  const SCHEDE = ['famiglia', 'siti', 'pdf', 'lettere', 'cerca', 'guida', 'sicurezza'];
  const UNICI = ['io', 'coniuge', 'padre', 'madre'];
  const inCornice = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- Dati di riferimento per il motore (come costruisciF in test/prova.cjs) ----------
  function costruisciF(perPulsante) {
    const campo = function (c) { return { k: c.k, e: c.e, g: c.g, tipo: c.tipo, sin: c.sin, escl: c.escl, org: c.org, doc: c.doc, calc: c.calc }; };
    return {
      campi: CT.campi.filter(function (c) { return !perPulsante || !c.doc; }).map(campo),
      campiVeicolo: CT.campiVeicolo.map(campo),
      gruppi: CT.gruppi.map(function (g) { return { g: g.g, titolo: g.titolo }; }),
      gruppiVeicolo: CT.gruppiVeicolo.map(function (g) { return { g: g.g, titolo: g.titolo }; }),
      relazioni: CT.relazioni, documenti: CT.documenti, documentoPrincipale: CT.documentoPrincipale,
      domicilio: CT.domicilio, ruoli: CT.ruoli, veicolo: CT.veicolo,
      spazi: perPulsante ? [] : CT.spazi, altriDoc: perPulsante ? [] : CT.altriDoc,
      stop: CT.stop, salta: CT.salta, org: CT.org, conferma: CT.conferma, mesi: CT.mesi, prov: CT.province,
    };
  }
  const F_APP = costruisciF(false);
  const F_PULSANTE = costruisciF(true);
  const A0 = compilaModulo({ persone: [], veicoli: [] }, F_APP, { api: true });
  const REL = {};
  CT.relazioni.forEach(function (r) { REL[r.r] = r; });

  // ---------- Stato (tutto in memoria) ----------
  let file = null;
  let chiave = null;
  let fam = null;
  let handle = null;
  let fonte = null;
  let selezione = null;
  let ultimoUso = Date.now();
  let minutiUltimi = 10;
  let statoFile = { nelBrowser: false, nelFile: false, daRicollegare: false };
  let dopoCodice = 'app';
  let urlPulsante = '';
  let esitoProva = null;
  let pdf = null;
  let cercaDati = null;
  let filtroCerca = '';
  const lettera = { originale: null, completato: null };

  // ---------- Utilità ----------
  function crea(tag, cls, testo) {
    const e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (testo != null) { e.textContent = testo; }
    return e;
  }
  function nuovoId(prefisso) { return prefisso + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function due(n) { return String(n).padStart(2, '0'); }
  function oraBreve(d) { return d.getHours() + ':' + due(d.getMinutes()); }
  function dataOra(iso) {
    const d = new Date(iso);
    if (isNaN(d)) { return ''; }
    return due(d.getDate()) + '/' + due(d.getMonth() + 1) + '/' + d.getFullYear() + ' alle ' + oraBreve(d);
  }
  function dataIt(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
  }
  function impronta(o) {
    const s = JSON.stringify(o);
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return String(h);
  }
  let timerAvviso = null;
  function avvisa(testo) {
    const a = $('#avviso');
    a.textContent = testo;
    a.hidden = false;
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { a.hidden = true; }, 3600);
  }
  function copia(testo, messaggio) {
    const riserva = function () {
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
      navigator.clipboard.writeText(testo).then(function () { avvisa(messaggio); }, riserva);
    } else {
      riserva();
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
  // Pulsante occupato durante un'operazione lunga (la password richiede qualche istante)
  async function occupato(btn, testo, fn) {
    const prima = btn.textContent;
    btn.disabled = true;
    btn.textContent = testo;
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = prima; }
  }
  // Pulsanti pericolosi: il primo tocco chiede conferma, il secondo esegue
  function conConferma(btn, testoConferma, azione) {
    let timer = null;
    const prima = btn.textContent;
    const ripristina = function () { clearTimeout(timer); btn.classList.remove('conferma'); btn.textContent = prima; };
    btn.addEventListener('click', function () {
      if (!btn.classList.contains('conferma')) {
        btn.classList.add('conferma');
        btn.textContent = testoConferma;
        timer = setTimeout(ripristina, 4000);
        return;
      }
      ripristina();
      azione();
    });
  }
  function selectCon(opzioni, valore) {
    const s = document.createElement('select');
    opzioni.forEach(function (o) {
      const op = document.createElement('option');
      op.value = o[0];
      op.textContent = o[1];
      if (o[2]) { op.disabled = true; }
      s.appendChild(op);
    });
    s.value = valore == null ? '' : valore;
    return s;
  }

  // ---------- Famiglia ----------
  function nuovaPersona(rel) { return { id: nuovoId('p'), rel: rel, d: {}, x: [] }; }
  function nuovaFamiglia() { return { versione: 2, persone: [nuovaPersona('io')], veicoli: [], impostazioni: { blocco: 10 } }; }
  function oggetto(o) { return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
  // Rimette in forma i dati letti dalla cassaforte
  function sistema(dati) {
    const f = oggetto(dati);
    f.versione = 2;
    f.persone = (Array.isArray(f.persone) ? f.persone : []).filter(function (p) { return p && typeof p === 'object'; });
    f.persone.forEach(function (p) {
      if (!p.id) { p.id = nuovoId('p'); }
      if (!REL[p.rel]) { p.rel = 'altro'; }
      p.d = oggetto(p.d);
      p.x = (Array.isArray(p.x) ? p.x : []).filter(function (x) { return x && typeof x === 'object'; });
    });
    if (!f.persone.length) { f.persone.push(nuovaPersona('io')); }
    f.veicoli = (Array.isArray(f.veicoli) ? f.veicoli : []).filter(function (v) { return v && typeof v === 'object'; });
    f.veicoli.forEach(function (v) {
      if (!v.id) { v.id = nuovoId('v'); }
      v.prop = typeof v.prop === 'string' ? v.prop : '';
      v.d = oggetto(v.d);
    });
    f.impostazioni = Object.assign({ blocco: 10 }, oggetto(f.impostazioni));
    return f;
  }
  function persona(id) { return fam.persone.find(function (p) { return p.id === id; }) || null; }
  function veicolo(id) { return fam.veicoli.find(function (v) { return v.id === id; }) || null; }
  function io() { return fam.persone.find(function (p) { return p.rel === 'io'; }) || fam.persone[0]; }
  function pulito(o) {
    const d = {};
    Object.keys(o || {}).forEach(function (k) {
      const v = String(o[k] == null ? '' : o[k]).trim();
      if (v) { d[k] = v; }
    });
    return d;
  }
  function vuota(p) { return !Object.keys(pulito(p.d)).length && !p.x.some(function (x) { return String(x.v || '').trim(); }); }
  function datiPuliti() {
    return {
      persone: fam.persone.map(function (p) {
        return {
          id: p.id, rel: p.rel, d: pulito(p.d),
          x: p.x.filter(function (x) { return String(x.e || '').trim() && String(x.v || '').trim(); })
            .map(function (x) { return { e: String(x.e).trim(), v: String(x.v).trim(), p: String(x.p || '').trim() }; }),
        };
      }),
      veicoli: fam.veicoli.map(function (v) { return { id: v.id, prop: v.prop || '', d: pulito(v.d) }; }),
    };
  }
  // Valore dei menu «Compila per»: «persona» oppure «persona|figlio»
  function leggiScelta(v) {
    const s = String(v || '').split('|');
    return { soggetto: s[0] || io().id, figlio: s[1] || '' };
  }
  function api(doc, scelta) {
    const s = leggiScelta(scelta);
    return compilaModulo(Object.assign({ soggetto: s.soggetto, figlio: s.figlio }, datiPuliti()), F_APP, { api: true, doc: !!doc });
  }
  function ruoloDi(p) {
    const sx = String(p.d.sesso || '').toUpperCase();
    if (p.rel === 'coniuge' && sx) { return sx === 'F' ? 'Moglie' : 'Marito'; }
    if (p.rel === 'figlio' && sx) { return sx === 'F' ? 'Figlia' : 'Figlio'; }
    return REL[p.rel] ? REL[p.rel].e : 'Persona';
  }
  function nomePersona(p) {
    return [p.d.nome, p.d.cognome].map(function (t) { return String(t || '').trim(); }).filter(Boolean).join(' ') || ruoloDi(p);
  }
  function nomeVeicolo(v) {
    return [v.d.marca, v.d.modello].map(function (t) { return String(t || '').trim(); }).filter(Boolean).join(' ') ||
      String(v.d.targa || '').trim() || 'Veicolo';
  }
  function iniziali(p) {
    const n = String(p.d.nome || '').trim();
    const c = String(p.d.cognome || '').trim();
    return ((n.charAt(0) + c.charAt(0)) || ruoloDi(p).charAt(0)).toUpperCase();
  }

  // ---------- Dati della versione 1 (in chiaro nel browser) ----------
  function leggiV1() {
    try {
      const s = JSON.parse(localStorage.getItem(V1));
      if (s && Array.isArray(s.profili) && s.profili.some(function (p) { return p && p.d && Object.keys(pulito(p.d)).length; })) { return s; }
    } catch (e) { /* niente dati vecchi */ }
    return null;
  }
  function cancellaV1() { try { localStorage.removeItem(V1); } catch (e) { /* già cancellati */ } }
  // Un profilo della versione 1 diventa una persona: il primo adulto sono «io», i minori sono figli
  function daV1(s) {
    const profili = s.profili.filter(function (p) { return p && p.d; });
    const primo = profili.find(function (p) { return p.t !== 'minore'; });
    return profili.map(function (p) {
      const d = {};
      Object.keys(p.d).forEach(function (k) { if (typeof p.d[k] === 'string' && p.d[k].trim()) { d[k] = p.d[k].trim(); } });
      // Nella versione 1 c'era un solo documento: va nella scheda del documento giusto
      const t = d.tipo_documento || '';
      const quale = /passaport/i.test(t) ? 'passaporto' : (/patente/i.test(t) ? 'patente' : 'ci');
      const mappa = CT.documenti[quale].campi;
      Object.keys(mappa).forEach(function (k) {
        if (d[k]) { d[mappa[k]] = d[k]; }
        delete d[k];
      });
      if (quale === 'ci') {
        if (d.ci_comune) { d.ci_comune = d.ci_comune.replace(/^comune\s+di\s+/i, ''); }
        if (/cartace/i.test(t)) { d.ci_tipo = "Carta d'identità cartacea"; } else if (/elettronic|cie/i.test(t)) { d.ci_tipo = "Carta d'identità elettronica"; }
      }
      delete d.tipo_documento;
      return {
        id: nuovoId('p'), rel: p === primo ? 'io' : (p.t === 'minore' ? 'figlio' : 'altro'), d: d,
        x: (Array.isArray(p.x) ? p.x : []).filter(function (x) { return x && x.v; })
          .map(function (x) { return { e: String(x.e || ''), v: String(x.v || ''), p: String(x.p || '') }; }),
      };
    });
  }
  function unisciPersone(f, nuove) {
    nuove.forEach(function (p) {
      const gia = UNICI.indexOf(p.rel) >= 0 ? f.persone.find(function (q) { return q.rel === p.rel; }) : null;
      if (gia && vuota(gia)) { gia.d = p.d; gia.x = p.x; return; }
      if (gia) { p.rel = 'altro'; }
      f.persone.push(p);
    });
  }

  // ---------- Salvataggio cifrato ----------
  let timerSalva = null;
  let sporco = false;
  let catena = Promise.resolve();
  function statoSalvataggio(cls, testo) {
    const s = $('#stato-salvataggio');
    s.className = 'pillola ' + cls;
    s.textContent = testo;
  }
  // Le operazioni sulla cassaforte vanno in fila, così due salvataggi non si accavallano
  function inCoda(fn) {
    catena = catena.then(fn).catch(function (e) {
      console.error(e);
      statoSalvataggio('no', 'Errore nel salvataggio');
    });
    return catena;
  }
  function modificato() {
    if (!fam) { return; }
    sporco = true;
    statoSalvataggio('info', 'Salvo…');
    clearTimeout(timerSalva);
    timerSalva = setTimeout(salvaOra, 400);
  }
  function salvaOra() {
    clearTimeout(timerSalva);
    if (!sporco || !chiave) { return catena; }
    sporco = false;
    const k = chiave;
    const dati = fam;
    return inCoda(async function () {
      file = await Cassaforte.aggiorna(file, k, dati);
      await persisti();
    });
  }
  async function persisti() {
    const nelBrowser = Cassaforte.scriviCopia(file);
    let nelFile = false;
    let daRicollegare = false;
    if (handle) {
      if (await Cassaforte.permesso(handle, false)) {
        try { await Cassaforte.scriviFile(handle, file); nelFile = true; } catch (e) { daRicollegare = true; }
      } else {
        daRicollegare = true;
      }
    }
    statoFile = { nelBrowser: nelBrowser, nelFile: nelFile, daRicollegare: daRicollegare };
    const quando = oraBreve(new Date());
    if (nelFile) { statoSalvataggio('ok', 'Salvato nel file alle ' + quando); }
    else if (nelBrowser && daRicollegare) { statoSalvataggio('manca', 'Salvato nel browser · file da ricollegare'); }
    else if (nelBrowser) { statoSalvataggio('ok', 'Salvato nel browser alle ' + quando); }
    else { statoSalvataggio('no', 'Non salvato: scarica il file in «Sicurezza»'); }
    if (fam) { aggiornaStatoFile(); }
  }

  // ---------- Chiusura automatica ----------
  function minutiBlocco() { return Number(fam && fam.impostazioni.blocco) || 10; }
  function controllaBlocco() {
    if (fam && Date.now() - ultimoUso > minutiBlocco() * 60000) { blocca('auto'); }
  }
  ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { ultimoUso = Date.now(); }, { capture: true, passive: true });
  });
  setInterval(controllaBlocco, 10000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { salvaOra(); } else { controllaBlocco(); }
  });
  window.addEventListener('pagehide', function () { salvaOra(); });

  // ---------- Schermate ----------
  function mostra(id) {
    ['schermo-avvio', 'schermo-codice', 'schermo-sblocco', 'schermo-app'].forEach(function (s) { $('#' + s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function mostraAvvio() {
    $('#form-crea').reset();
    $('#crea-errore').textContent = '';
    forzaPassword('');
    const v1 = leggiV1();
    const av = $('#avviso-migrazione');
    if (!Cassaforte.disponibile) {
      av.className = 'riquadro attenzione';
      av.textContent = 'Per proteggere i dati Compilatutto va aperto da un indirizzo sicuro, che inizia con https://. Da qui non posso cifrare nulla.';
      av.hidden = false;
      $('#btn-crea').disabled = true;
      $$('[data-apri-file]').forEach(function (b) { b.disabled = true; });
    } else if (v1) {
      const n = v1.profili.length;
      av.className = 'riquadro info';
      av.textContent = 'Ho trovato i dati della versione precedente (' + (n === 1 ? '1 profilo' : n + ' profili') +
        '), salvati in questo browser senza cifratura. Scegli una password: li sposto nella cassaforte cifrata e cancello la copia in chiaro.';
      av.hidden = false;
    } else {
      av.hidden = true;
    }
    mostra('schermo-avvio');
    if (Cassaforte.disponibile) { $('#crea-pw').focus(); }
  }
  function mostraSblocco(motivo) {
    const f = fonte || {};
    const parti = [];
    if (motivo === 'auto') { parti.push('Si è chiusa da sola dopo ' + minutiUltimi + ' minuti senza uso.'); }
    if (f.letto) {
      parti.push('File «' + (f.nome || Cassaforte.NOME_FILE) + '»' + (f.file && f.file.modificato ? ', modificato il ' + dataOra(f.file.modificato) : '') + '.');
      const c = Cassaforte.leggiCopia();
      if (c && f.file && c.creato !== f.file.creato) { parti.push('Aprendolo, sostituisci i dati salvati in questo browser.'); }
    } else if (f.file) {
      parti.push('Dati cifrati in questo browser, salvati il ' + dataOra(f.file.modificato) + (f.handle ? ' e nel file «' + f.handle.name + '»' : '') + '.');
    } else if (f.handle) {
      parti.push('File «' + f.handle.name + '» sul computer: il browser ti chiederà il permesso di aprirlo.');
    }
    $('#sblocco-file').textContent = parti.join(' ');
    $('#sblocca-pw').value = '';
    $('#sblocca-errore').textContent = '';
    $('#form-recupero').reset();
    $('#rec-errore').textContent = '';
    $('#recupero').open = false;
    mostra('schermo-sblocco');
    $('#sblocca-pw').focus();
  }

  // ---------- Password ----------
  function livelloPassword(pw) {
    if (pw.length < MIN_PW) { return 0; }
    if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|password|qwertyuiop)/i.test(pw)) { return 0; }
    let l = 1;
    if (pw.length >= 14) { l++; }
    if (pw.length >= 20) { l++; }
    if (/[a-z]/i.test(pw) && /\d/.test(pw) && /[^a-z0-9]/i.test(pw)) { l++; }
    return Math.min(l, 4);
  }
  function forzaPassword(pw) {
    const l = pw ? livelloPassword(pw) : 0;
    const barra = $('#forza-barra');
    barra.style.width = (pw ? Math.max(l, 0.4) * 25 : 0) + '%';
    barra.dataset.livello = String(l);
    $('#forza-testo').textContent = !pw || pw.length < MIN_PW
      ? 'Almeno ' + MIN_PW + ' caratteri.' + (pw ? ' Ne mancano ' + (MIN_PW - pw.length) + '.' : '')
      : ['Troppo facile da indovinare.', 'Accettabile: più è lunga, meglio è.', 'Buona.', 'Molto buona.', 'Ottima.'][l];
  }
  function erroreNuovaPassword(pw, pw2) {
    if (pw.length < MIN_PW) { return 'La password deve avere almeno ' + MIN_PW + ' caratteri.'; }
    if (livelloPassword(pw) === 0) { return 'Questa password è troppo facile da indovinare: scegline un\'altra.'; }
    if (pw !== pw2) { return 'Le due password non sono uguali.'; }
    return '';
  }

  // ---------- Avvio, creazione e sblocco ----------
  async function creaCassaforte(e) {
    e.preventDefault();
    const pw = $('#crea-pw').value;
    const err = $('#crea-errore');
    err.textContent = erroreNuovaPassword(pw, $('#crea-pw2').value);
    if (!err.textContent && !$('#crea-capito').checked) { err.textContent = 'Spunta la casella per confermare che hai capito.'; }
    if (err.textContent) { return; }
    await occupato($('#btn-crea'), 'Creo la cassaforte…', async function () {
      const nuova = nuovaFamiglia();
      const v1 = leggiV1();
      if (v1) {
        unisciPersone(nuova, daV1(v1));
        nuova.impostazioni.daV1 = true;
      }
      const r = await Cassaforte.crea(pw, nuova);
      file = r.file;
      chiave = r.chiaveDati;
      fam = nuova;
      handle = null;
      await inCoda(persisti);
      if (v1 && statoFile.nelBrowser) { cancellaV1(); }
      $('#form-crea').reset();
      forzaPassword('');
      mostraCodice(r.codice, 'app');
    });
  }
  function mostraCodice(codice, dopo) {
    dopoCodice = dopo;
    $('#codice-recupero').textContent = codice;
    $('#codice-salvato').checked = false;
    $('#btn-codice-fatto').disabled = true;
    mostra('schermo-codice');
  }
  function codiceFatto() {
    $('#codice-recupero').textContent = '';
    $('#codice-salvato').checked = false;
    if (dopoCodice === 'sicurezza') {
      mostra('schermo-app');
      apriScheda('sicurezza');
      avvisa('Nuovo codice di recupero attivo. Quello vecchio non funziona più.');
    } else {
      entraApp();
      avvisa('Cassaforte creata. In «Sicurezza» puoi salvarla anche in un file sul computer.');
    }
  }
  // Quale cassaforte aprire: la copia nel browser o il file collegato, se è più recente
  async function scegliFonte() {
    const f = fonte || {};
    let scelto = f.file || null;
    if (f.handle && !f.letto && await Cassaforte.permesso(f.handle, true)) {
      try {
        const g = await Cassaforte.leggiFile(f.handle);
        Cassaforte.controlla(g);
        if (!scelto || scelto.creato !== g.creato || String(g.modificato) > String(scelto.modificato)) { scelto = g; }
      } catch (e) { /* file spostato o illeggibile: resta la copia nel browser */ }
    }
    return scelto;
  }
  async function entra(f, k, dati) {
    const da = fonte || {};
    file = f;
    chiave = k;
    fam = sistema(dati);
    if (da.letto || da.handle) { handle = da.handle || null; }
    if (da.daInput) {
      handle = null;
      await Cassaforte.scollegaFile();
    }
    fonte = null;
    const v1 = leggiV1();
    if (v1) {
      unisciPersone(fam, daV1(v1));
      fam.impostazioni.daV1 = true;
      sporco = true;
      await salvaOra();
      if (statoFile.nelBrowser) { cancellaV1(); }
      avvisa('Ho spostato nella cassaforte i dati della versione precedente e cancellato la copia in chiaro.');
    } else {
      await inCoda(persisti);
    }
    entraApp();
  }
  function messaggioApertura(e, tipo) {
    if (e && e.message === 'sbagliata') {
      return tipo === 'recupero' ? 'Il codice di recupero non è giusto. Controlla di averlo scritto bene.' : 'Password sbagliata. Riprova.';
    }
    if (e && e.message === 'formato') { return 'Questo file non è una cassaforte di Compilatutto.'; }
    if (e && e.message === 'nessuno') { return 'Non trovo i dati: tocca «Apri un altro file» e scegli famiglia.compilatutto.'; }
    return 'Non riesco ad aprire i dati. Riprova.';
  }
  async function sblocca(e) {
    e.preventDefault();
    const pw = $('#sblocca-pw').value;
    const err = $('#sblocca-errore');
    if (!pw) { err.textContent = 'Scrivi la password.'; return; }
    err.textContent = '';
    await occupato($('#btn-sblocca'), 'Apro…', async function () {
      try {
        const f = await scegliFonte();
        if (!f) { throw new Error('nessuno'); }
        const r = await Cassaforte.apri(f, pw, 'password');
        $('#sblocca-pw').value = '';
        await entra(f, r.chiaveDati, r.dati);
      } catch (x) {
        err.textContent = messaggioApertura(x, 'password');
        $('#sblocca-pw').select();
      }
    });
  }
  async function recupera(e) {
    e.preventDefault();
    const err = $('#rec-errore');
    const pw = $('#rec-pw').value;
    err.textContent = $('#rec-codice').value.trim() ? erroreNuovaPassword(pw, $('#rec-pw2').value) : 'Scrivi il codice di recupero.';
    if (err.textContent) { return; }
    const btn = $('#form-recupero button[type=submit]');
    await occupato(btn, 'Controllo il codice…', async function () {
      try {
        const f = await scegliFonte();
        if (!f) { throw new Error('nessuno'); }
        const r = await Cassaforte.apri(f, $('#rec-codice').value, 'recupero');
        const nuovo = await Cassaforte.cambiaPassword(f, r.chiaveDati, pw);
        $('#form-recupero').reset();
        await entra(nuovo, r.chiaveDati, r.dati);
        avvisa('Nuova password impostata. Il codice di recupero resta lo stesso.');
      } catch (x) {
        err.textContent = messaggioApertura(x, 'recupero');
      }
    });
  }
  // «Apri il file»: con Chrome ed Edge il file resta collegato e si aggiorna da solo
  async function apriFile() {
    if (!Cassaforte.fileSupportati) { $('#file-cassaforte').click(); return; }
    let h;
    try { h = await Cassaforte.scegliDaAprire(); } catch (e) {
      if (e && e.name !== 'AbortError') { avvisa('Non riesco ad aprire il file.'); }
      return;
    }
    let f;
    try {
      f = await Cassaforte.leggiFile(h);
      Cassaforte.controlla(f);
    } catch (e) { avvisa('Questo file non è una cassaforte di Compilatutto.'); return; }
    await preparaApertura({ file: f, handle: h, letto: true, nome: h.name });
  }
  function fileScelto(e) {
    const scelto = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!scelto) { return; }
    const r = new FileReader();
    r.onload = function () {
      let f;
      try {
        f = JSON.parse(String(r.result || ''));
        Cassaforte.controlla(f);
      } catch (x) { avvisa('Questo file non è una cassaforte di Compilatutto.'); return; }
      preparaApertura({ file: f, handle: null, letto: true, daInput: true, nome: scelto.name });
    };
    r.readAsText(scelto);
  }
  async function preparaApertura(f) {
    if (fam) { await blocca(); }
    fonte = f;
    mostraSblocco('file');
  }

  async function blocca(motivo) {
    if (!fam) { return; }
    minutiUltimi = minutiBlocco();
    await salvaOra();
    await catena;
    chiudiProva();
    chiudiSelettore();
    fam = null;
    chiave = null;
    selezione = null;
    pdf = null;
    cercaDati = null;
    urlPulsante = '';
    lettera.originale = null;
    lettera.completato = null;
    svuotaInterfaccia();
    fonte = { file: file, handle: handle };
    mostraSblocco(motivo);
  }
  // Toglie dalla pagina tutto ciò che mostra dati in chiaro
  function svuotaInterfaccia() {
    ['#lista-persone', '#lista-veicoli', '#editor', '#cerca-risultati', '#cerca-filtri', '#pdf-righe', '#pdf-riepilogo',
      '#riepilogo-doc', '#documento', '#selettore-voci', '#codice-recupero', '#pdf-stato', '#pdf-esito'].forEach(function (s) { $(s).textContent = ''; });
    $$('.sel-persona').forEach(function (s) { s.textContent = ''; });
    $$('input[type=password]').forEach(function (i) { i.value = ''; });
    $('#pdf-campi').hidden = true;
    $('#cerca-testo').value = '';
    $('#segnalibro').href = '#';
    $('#pulsante-pronto').hidden = true;
    $('#pulsante-errore').textContent = '';
    $('#avviso').hidden = true;
  }

  function entraApp() {
    ultimoUso = Date.now();
    selezione = { tipo: 'persona', id: io().id };
    filtroCerca = '';
    disegnaFamiglia();
    riempiSelPersone();
    aggiornaAvvisiPulsante();
    aggiornaStatoFile();
    $('#blocco-minuti').value = String(minutiBlocco());
    if (!$('#documento').innerHTML.trim()) { $('#documento').innerHTML = ES_AUTO; }
    mostra('schermo-app');
    const h = String(location.hash || '').replace('#', '');
    apriScheda(SCHEDE.indexOf(h) >= 0 ? h : 'famiglia');
  }

  // ---------- Schede ----------
  function apriScheda(nome) {
    if (SCHEDE.indexOf(nome) < 0) { nome = 'famiglia'; }
    $$('.schede button').forEach(function (b) {
      const sel = b.dataset.scheda === nome;
      b.setAttribute('aria-selected', sel ? 'true' : 'false');
      b.tabIndex = sel || (nome === 'sicurezza' && b.dataset.scheda === 'famiglia') ? 0 : -1;
    });
    SCHEDE.forEach(function (s) { $('#sez-' + s).hidden = s !== nome; });
    $('#btn-sicurezza').setAttribute('aria-pressed', nome === 'sicurezza' ? 'true' : 'false');
    try { history.replaceState(null, '', '#' + nome); } catch (e) { /* anteprima senza indirizzo */ }
    if (nome === 'siti' || nome === 'pdf' || nome === 'lettere') { riempiSelPersone(); }
    if (nome === 'siti') { aggiornaAvvisiPulsante(); }
    if (nome === 'cerca') { preparaCerca(); }
    if (nome === 'sicurezza') { aggiornaStatoFile(); }
  }

  // ---------- Famiglia: elenco ----------
  function disegnaFamiglia() {
    if (!selezione || (selezione.tipo === 'persona' ? !persona(selezione.id) : !veicolo(selezione.id))) {
      selezione = { tipo: 'persona', id: io().id };
    }
    disegnaListe();
    riempiNuovaPersona();
    disegnaEditor();
  }
  function voceLista(sigla, nome, ruolo, attiva, veic, azione) {
    const b = crea('button', 'scheda-persona');
    b.type = 'button';
    b.appendChild(crea('span', 'iniziali' + (veic ? ' veicolo' : ''), sigla));
    b.appendChild(crea('span', 'nome', nome));
    b.appendChild(crea('span', 'ruolo', ruolo));
    if (attiva) { b.setAttribute('aria-current', 'true'); }
    b.addEventListener('click', azione);
    return b;
  }
  function disegnaListe() {
    const lp = $('#lista-persone');
    lp.textContent = '';
    fam.persone.forEach(function (p) {
      lp.appendChild(voceLista(iniziali(p), nomePersona(p), ruoloDi(p), selezione.tipo === 'persona' && selezione.id === p.id, false,
        function () { seleziona('persona', p.id); }));
    });
    const lv = $('#lista-veicoli');
    lv.textContent = '';
    fam.veicoli.forEach(function (v) {
      const prop = v.prop && persona(v.prop);
      const sigla = String(v.d.targa || v.d.marca || 'V').replace(/\s+/g, '').slice(0, 2).toUpperCase();
      lv.appendChild(voceLista(sigla, nomeVeicolo(v), [v.d.targa, prop ? nomePersona(prop) : ''].filter(Boolean).join(' · ') || 'Veicolo',
        selezione.tipo === 'veicolo' && selezione.id === v.id, true, function () { seleziona('veicolo', v.id); }));
    });
    if (!fam.veicoli.length) { lv.appendChild(crea('p', 'nota', 'Nessun veicolo.')); }
  }
  function riempiNuovaPersona() {
    const s = $('#nuova-persona');
    s.textContent = '';
    let primo = '';
    CT.relazioni.forEach(function (r) {
      const preso = UNICI.indexOf(r.r) >= 0 && fam.persone.some(function (p) { return p.rel === r.r; });
      if (r.r === 'io' && preso) { return; }
      const o = document.createElement('option');
      o.value = r.r;
      o.textContent = r.e + (preso ? ' (c\'è già)' : '');
      o.disabled = preso;
      if (!preso && !primo) { primo = r.r; }
      s.appendChild(o);
    });
    s.value = primo;
  }
  function seleziona(tipo, id) {
    selezione = { tipo: tipo, id: id };
    disegnaListe();
    disegnaEditor();
    if (window.innerWidth <= 820) { $('#editor').scrollIntoView({ block: 'start' }); }
  }
  function aggiungiPersona() {
    const rel = $('#nuova-persona').value;
    if (!rel) { return; }
    if (UNICI.indexOf(rel) >= 0 && fam.persone.some(function (p) { return p.rel === rel; })) { avvisa('Questa persona c\'è già.'); return; }
    const p = nuovaPersona(rel);
    const me = fam.persone.find(function (q) { return q.rel === 'io'; });
    // Chi vive in casa di solito ha la stessa residenza: la copio, si può sempre cambiare
    if (me && (rel === 'coniuge' || rel === 'figlio')) {
      const copiati = ['indirizzo', 'civico', 'cap', 'citta', 'provincia', 'nazione'].filter(function (k) { return String(me.d[k] || '').trim(); });
      copiati.forEach(function (k) { p.d[k] = me.d[k]; });
      if (rel === 'figlio' && me.d.cognome && me.d.sesso !== 'F') { p.d.cognome = me.d.cognome; }
      if (copiati.length) { avvisa('Ho copiato la residenza da ' + nomePersona(me) + ': cambiala se è diversa.'); }
    }
    fam.persone.push(p);
    modificato();
    selezione = { tipo: 'persona', id: p.id };
    disegnaFamiglia();
    $('#f-nome').focus();
  }
  function aggiungiVeicolo() {
    const v = { id: nuovoId('v'), prop: io().id, d: {} };
    fam.veicoli.push(v);
    modificato();
    selezione = { tipo: 'veicolo', id: v.id };
    disegnaFamiglia();
    $('#f-targa').focus();
  }

  // ---------- Famiglia: scheda della persona o del veicolo ----------
  function disegnaEditor() {
    const ed = $('#editor');
    ed.textContent = '';
    if (selezione.tipo === 'veicolo') { editorVeicolo(ed, veicolo(selezione.id)); } else { editorPersona(ed, persona(selezione.id)); }
  }
  function aggiornaTitoli() {
    const h = $('#editor-titolo');
    if (!h) { return; }
    if (selezione.tipo === 'veicolo') {
      h.textContent = nomeVeicolo(veicolo(selezione.id));
    } else {
      const p = persona(selezione.id);
      h.textContent = nomePersona(p);
      $('#editor-ruolo').textContent = ruoloDi(p);
    }
    disegnaListe();
  }
  function testaEditor(ruolo, titolo) {
    const testa = crea('div', 'editor-testa');
    const t = crea('div', '');
    const r = crea('span', 'etichetta', ruolo);
    r.id = 'editor-ruolo';
    const h = crea('h2', '', titolo);
    h.id = 'editor-titolo';
    t.appendChild(r);
    t.appendChild(h);
    testa.appendChild(t);
    return testa;
  }
  function campoScelta(id, etichetta, sel) {
    const c = crea('div', 'campo');
    const l = crea('label', 'etichetta', etichetta);
    l.htmlFor = id;
    sel.id = id;
    c.appendChild(l);
    c.appendChild(sel);
    return c;
  }
  function editorPersona(ed, p) {
    const testa = testaEditor(ruoloDi(p), nomePersona(p));
    const rel = selectCon(CT.relazioni.filter(function (r) { return r.r !== 'io' || p.rel === 'io'; }).map(function (r) {
      const preso = UNICI.indexOf(r.r) >= 0 && fam.persone.some(function (q) { return q.rel === r.r && q.id !== p.id; });
      return [r.r, r.e, preso];
    }), p.rel);
    rel.disabled = p.rel === 'io';
    rel.addEventListener('change', function () {
      p.rel = rel.value;
      modificato();
      aggiornaTitoli();
      riempiNuovaPersona();
    });
    testa.appendChild(campoScelta('ed-rel', 'Chi è', rel));
    ed.appendChild(testa);
    if (p.rel === 'io' && vuota(p)) {
      ed.appendChild(crea('p', 'riquadro info', 'Comincia dai tuoi dati: nome, cognome e codice fiscale. Poi aggiungi le altre persone della famiglia con «Aggiungi» e i veicoli. Tutto si salva da solo, cifrato.'));
    }
    CT.gruppi.forEach(function (g) {
      ed.appendChild(gruppoCampi(g, CT.campi.filter(function (c) { return c.g === g.g; }), p.d, p));
    });
    ed.appendChild(gruppoAltri(p));
    if (p.rel !== 'io') {
      const az = crea('div', 'azioni');
      const via = crea('button', 'btn btn-pericolo', 'Togli dalla famiglia');
      via.type = 'button';
      conConferma(via, 'Tocca di nuovo per togliere ' + nomePersona(p), function () {
        fam.persone = fam.persone.filter(function (q) { return q.id !== p.id; });
        fam.veicoli.forEach(function (v) { if (v.prop === p.id) { v.prop = ''; } });
        modificato();
        selezione = null;
        disegnaFamiglia();
        avvisa(nomePersona(p) + ' non è più nella famiglia.');
      });
      az.appendChild(via);
      ed.appendChild(az);
    }
    aggiornaCF(p);
  }
  function editorVeicolo(ed, v) {
    const testa = testaEditor('Veicolo', nomeVeicolo(v));
    const prop = selectCon([['', '— nessuno —']].concat(fam.persone.map(function (p) { return [p.id, nomePersona(p)]; })), v.prop);
    prop.addEventListener('change', function () {
      v.prop = prop.value;
      modificato();
      disegnaListe();
    });
    testa.appendChild(campoScelta('ed-prop', 'Proprietario', prop));
    ed.appendChild(testa);
    CT.gruppiVeicolo.forEach(function (g) {
      ed.appendChild(gruppoCampi(g, CT.campiVeicolo.filter(function (c) { return c.g === g.g; }), v.d, null));
    });
    const az = crea('div', 'azioni');
    const via = crea('button', 'btn btn-pericolo', 'Togli questo veicolo');
    via.type = 'button';
    conConferma(via, 'Tocca di nuovo per togliere ' + nomeVeicolo(v), function () {
      fam.veicoli = fam.veicoli.filter(function (w) { return w.id !== v.id; });
      modificato();
      selezione = null;
      disegnaFamiglia();
      avvisa('Veicolo tolto.');
    });
    az.appendChild(via);
    ed.appendChild(az);
  }
  function gruppoCampi(g, campi, d, p) {
    const det = crea('details', 'gruppo');
    const pieni = function () { return campi.filter(function (c) { return String(d[c.k] || '').trim(); }).length; };
    det.open = !g.chiuso || pieni() > 0 || (g.g === 'scuola' && p && p.rel === 'figlio');
    const sum = crea('summary', '', g.titolo);
    const conta = crea('span', 'conta');
    const contaggio = function () { const n = pieni(); conta.textContent = n ? n + ' di ' + campi.length : ''; };
    contaggio();
    sum.appendChild(conta);
    det.appendChild(sum);
    const dentro = crea('div', 'dentro');
    if (g.nota) { dentro.appendChild(crea('p', 'nota-gruppo', g.nota)); }
    const gr = crea('div', 'griglia');
    campi.forEach(function (c) {
      gr.appendChild(campoInput(c, d, function () {
        contaggio();
        if (/^(nome|cognome|sesso|targa|marca|modello)$/.test(c.k)) { aggiornaTitoli(); }
        if (p && /^(codice_fiscale|data_nascita|sesso|nome|cognome)$/.test(c.k)) { aggiornaCF(p); }
      }));
    });
    dentro.appendChild(gr);
    det.appendChild(dentro);
    return det;
  }
  function campoInput(c, d, cambiato) {
    const id = 'f-' + c.k;
    const wrap = crea('div', 'campo' + (c.tipo === 'cf' ? ' campo-cf' : ''));
    const lab = crea('label', 'etichetta', c.e);
    lab.htmlFor = id;
    wrap.appendChild(lab);
    let inp;
    if (c.tipo === 'sesso') {
      inp = selectCon([['', '—'], ['M', 'M – maschio'], ['F', 'F – femmina']], d[c.k]);
    } else if (c.tipo === 'scelta') {
      inp = selectCon([['', '—']].concat(c.scelte.map(function (s) { return [s, s]; })), d[c.k]);
      // un valore scritto prima a mano resta tra le voci
      if (d[c.k] && c.scelte.indexOf(d[c.k]) < 0) {
        const o = crea('option', '', d[c.k]);
        o.value = d[c.k];
        inp.appendChild(o);
        inp.value = d[c.k];
      }
    } else {
      inp = document.createElement('input');
      inp.type = c.tipo === 'data' ? 'date' : (c.tipo === 'email' ? 'email' : (c.tipo === 'tel' ? 'tel' : 'text'));
      if (c.es) { inp.placeholder = c.es; }
      if (c.tipo === 'prov') { inp.setAttribute('list', 'lista-province'); inp.maxLength = 40; }
      if (c.tipo === 'cap') { inp.inputMode = 'numeric'; inp.maxLength = 5; }
      if (c.tipo === 'cf') { inp.maxLength = 16; inp.setAttribute('autocapitalize', 'characters'); }
      inp.spellcheck = false;
      inp.value = d[c.k] || '';
    }
    inp.id = id;
    inp.name = 'ct-' + c.k;
    inp.autocomplete = 'off';
    inp.addEventListener('input', function () {
      d[c.k] = c.tipo === 'cf' ? inp.value.toUpperCase() : inp.value;
      modificato();
      cambiato();
    });
    inp.addEventListener('change', function () {
      let v = inp.value;
      if (c.tipo === 'prov') { v = A0.sigla(v) || v.trim(); }
      if (/^(targa|telaio|iban|bic|codice_fiscale)$/.test(c.k)) { v = v.toUpperCase().replace(/\s+/g, ''); }
      if (v !== inp.value) {
        inp.value = v;
        d[c.k] = v;
        modificato();
        cambiato();
      }
    });
    wrap.appendChild(inp);
    if (c.tipo === 'cf') {
      const e = crea('div', 'esito-cf');
      e.id = 'esito-cf';
      e.setAttribute('aria-live', 'polite');
      wrap.appendChild(e);
    }
    return wrap;
  }
  function gruppoAltri(p) {
    const det = crea('details', 'gruppo');
    det.open = p.x.length > 0;
    const sum = crea('summary', '', 'Altri dati');
    const conta = crea('span', 'conta', p.x.length ? String(p.x.length) : '');
    sum.appendChild(conta);
    det.appendChild(sum);
    const dentro = crea('div', 'dentro');
    dentro.appendChild(crea('p', 'nota-gruppo', 'Quello che non trovi sopra: tessera della biblioteca, codice cliente, matricola… Le parole chiave aiutano a riconoscere il dato nei moduli.'));
    const righe = crea('div', 'pila');
    const disegna = function () {
      righe.textContent = '';
      conta.textContent = p.x.length ? String(p.x.length) : '';
      p.x.forEach(function (x, i) {
        const riga = crea('div', 'extra-riga');
        [['e', 'Nome del dato', 'Es. Tessera biblioteca'], ['v', 'Valore', 'Es. B-998'], ['p', 'Parole chiave (separate da virgola)', 'Es. biblioteca, tessera']].forEach(function (f) {
          const c = crea('div', 'campo');
          const l = crea('label', 'etichetta', f[1]);
          l.htmlFor = 'x-' + i + '-' + f[0];
          const inp = document.createElement('input');
          inp.id = 'x-' + i + '-' + f[0];
          inp.placeholder = f[2];
          inp.autocomplete = 'off';
          inp.spellcheck = false;
          inp.value = x[f[0]] || '';
          inp.addEventListener('input', function () { x[f[0]] = inp.value; modificato(); });
          c.appendChild(l);
          c.appendChild(inp);
          riga.appendChild(c);
        });
        const del = crea('button', 'btn btn-piccolo btn-pericolo', 'Togli');
        del.type = 'button';
        del.setAttribute('aria-label', 'Togli ' + (x.e || 'questo dato'));
        del.addEventListener('click', function () { p.x.splice(i, 1); modificato(); disegna(); });
        riga.appendChild(del);
        righe.appendChild(riga);
      });
    };
    disegna();
    dentro.appendChild(righe);
    const piu = crea('button', 'btn btn-piccolo', '+ Aggiungi un dato');
    piu.type = 'button';
    piu.addEventListener('click', function () {
      p.x.push({ e: '', v: '', p: '' });
      modificato();
      disegna();
      $('#x-' + (p.x.length - 1) + '-e').focus();
    });
    const az = crea('div', 'azioni');
    az.appendChild(piu);
    dentro.appendChild(az);
    det.appendChild(dentro);
    return det;
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
    return { ok: true, cf: cf, sesso: sesso, iso: anno + '-' + due(mese) + '-' + due(gg) };
  }
  // Le prime sei lettere: tre dal cognome e tre dal nome
  function lettereCF(testo, nome) {
    const t = String(testo || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
    const cons = t.replace(/[AEIOU]/g, '');
    if (nome && cons.length >= 4) { return cons.charAt(0) + cons.charAt(2) + cons.charAt(3); }
    return (cons + t.replace(/[^AEIOU]/g, '') + 'XXX').slice(0, 3);
  }
  function aggiornaCF(p) {
    const box = $('#esito-cf');
    if (!box) { return; }
    const r = controllaCF(p.d.codice_fiscale);
    box.textContent = '';
    box.className = 'esito-cf';
    if (!r) { return; }
    if (!r.ok) { box.className = 'esito-cf no'; box.textContent = r.msg; return; }
    const problemi = [];
    if ((p.d.data_nascita && p.d.data_nascita !== r.iso) || (p.d.sesso && p.d.sesso !== r.sesso)) {
      problemi.push('indica ' + (r.sesso === 'F' ? 'nata' : 'nato') + ' il ' + dataIt(r.iso) + ' (' + r.sesso + '), diverso da quello che hai scritto');
    }
    if (String(p.d.nome || '').trim() && String(p.d.cognome || '').trim()) {
      const attese = lettereCF(p.d.cognome, false) + lettereCF(p.d.nome, true);
      if (attese !== r.cf.slice(0, 6)) { problemi.push('le prime lettere non corrispondono a nome e cognome (mi aspetto ' + attese + ')'); }
    }
    box.className = 'esito-cf ' + (problemi.length ? 'no' : 'ok');
    box.appendChild(crea('span', '', problemi.length ? 'Codice valido, ma ' + problemi.join(' e ') + ': controlla.' : 'Codice valido.'));
    if (!p.d.data_nascita || !p.d.sesso) {
      const b = crea('button', 'btn btn-piccolo', 'Ricava data di nascita e sesso');
      b.type = 'button';
      b.addEventListener('click', function () {
        if (!p.d.data_nascita) { p.d.data_nascita = r.iso; }
        if (!p.d.sesso) { p.d.sesso = r.sesso; }
        modificato();
        disegnaEditor();
        disegnaListe();
      });
      box.appendChild(b);
    }
  }

  // ---------- Menu «Compila per» ----------
  function riempiSelPersone() {
    const figli = fam.persone.filter(function (p) { return p.rel === 'figlio'; });
    const ordinate = [io()].concat(fam.persone.filter(function (p) { return p !== io(); }));
    const opzioni = [];
    ordinate.forEach(function (p) {
      const chi = nomePersona(p) + (p.rel === 'io' ? '' : ' · ' + ruoloDi(p).toLowerCase());
      if ((p.rel === 'io' || p.rel === 'coniuge') && figli.length > 1) {
        figli.forEach(function (f) { opzioni.push([p.id + '|' + f.id, chi + ', per ' + nomePersona(f)]); });
      } else {
        opzioni.push([p.id, chi]);
      }
    });
    $$('.sel-persona').forEach(function (s) {
      const prima = s.value;
      s.textContent = '';
      opzioni.forEach(function (o) {
        const op = document.createElement('option');
        op.value = o[0];
        op.textContent = o[1];
        s.appendChild(op);
      });
      if (opzioni.some(function (o) { return o[0] === prima; })) { s.value = prima; }
    });
  }

  // ---------- Siti web: pulsante «Compila» ----------
  function sorgente(fn) {
    return fn.toString().split('\n').filter(function (r) { return !/^\s*\/\//.test(r); })
      .map(function (r) { return r.trim(); }).filter(Boolean).join('\n');
  }
  function aggiornaAvvisiPulsante() {
    if (!fam) { return; }
    const imp = fam.impostazioni;
    $('#avviso-vecchio-pulsante').hidden = !imp.daV1;
    $('#avviso-pulsante-vecchio').hidden = !imp.pulsante || imp.pulsante === impronta(datiPuliti());
  }
  async function creaPulsante(e) {
    e.preventDefault();
    const pw = $('#pulsante-pw').value;
    const err = $('#pulsante-errore');
    err.textContent = '';
    if (!pw) { err.textContent = 'Scrivi la password di Compilatutto.'; return; }
    await occupato($('#btn-crea-pulsante'), 'Creo il pulsante…', async function () {
      if (!(await Cassaforte.verificaPassword(file, pw))) {
        err.textContent = 'Password sbagliata. Serve quella con cui apri Compilatutto.';
        $('#pulsante-pw').select();
        return;
      }
      const dati = datiPuliti();
      const B = await Cassaforte.cifraPerPulsante(pw, dati);
      $('#pulsante-pw').value = '';
      if (!fam) { return; }
      const codice = '(function(){var M=' + sorgente(compilaModulo) + ';(' + sorgente(avviaCompilatutto) + ')(' +
        JSON.stringify(B) + ',' + JSON.stringify(F_PULSANTE) + ',M);})();void 0';
      urlPulsante = 'javascript:' + encodeURIComponent(codice);
      $('#segnalibro').href = urlPulsante;
      $('#pulsante-pronto').hidden = false;
      fam.impostazioni.pulsante = impronta(dati);
      fam.impostazioni.daV1 = false;
      modificato();
      aggiornaAvvisiPulsante();
      avvisa('Pulsante pronto: trascinalo nella barra dei preferiti.');
    });
  }

  // ---------- Siti web: modulo di prova ----------
  function preparaModuloProva() {
    const sel = $('#mp-prov');
    const vuota = crea('option', '', '— scegli —');
    vuota.value = '';
    sel.appendChild(vuota);
    Object.keys(CT.province).sort(function (a, b) { return CT.province[a].localeCompare(CT.province[b], 'it'); }).forEach(function (s) {
      const o = crea('option', '', CT.province[s] + ' (' + s + ')');
      o.value = s;
      sel.appendChild(o);
    });
  }
  function chiudiProva() {
    if (esitoProva && typeof esitoProva.chiudi === 'function') { esitoProva.chiudi(); }
    esitoProva = null;
  }
  function svuotaProva() {
    chiudiProva();
    const f = $('#modulo-prova');
    f.reset();
    $$('input,select,label', f).forEach(function (e) { e.style.outline = ''; e.style.outlineOffset = ''; });
    $('#esito-prova').textContent = '';
  }
  function provaCompilazione() {
    svuotaProva();
    const dati = datiPuliti();
    if (!dati.persone.some(function (p) { return Object.keys(p.d).length; })) { avvisa('Scrivi prima qualche dato nella scheda Famiglia.'); return; }
    const s = leggiScelta($('#prova-persona').value);
    esitoProva = compilaModulo(Object.assign({ soggetto: s.soggetto, figlio: s.figlio }, dati), F_PULSANTE, { radice: $('#modulo-prova'), scelta: true });
    $('#esito-prova').textContent = esitoProva.compilati + ' campi compilati, ' + esitoProva.daCompletare + ' da completare.';
  }

  // ---------- Selettore dati (campi dei PDF) ----------
  let sel = null;
  function rigaVoce(v, azione, fn) {
    const b = crea('button', 'riga-copia');
    b.type = 'button';
    b.appendChild(crea('span', 'titolo', v.titolo));
    b.appendChild(crea('span', 'chi', (v.gruppo && v.gruppo !== v.titolo ? v.gruppo + ' · ' : '') + v.chi));
    b.appendChild(crea('span', 'valore', v.valore));
    b.appendChild(crea('span', 'azione', azione));
    b.addEventListener('click', fn);
    return b;
  }
  function apriSelettore(scelta, da, fn) {
    const A = api(false, scelta);
    sel = { A: A, voci: A.elenco(), da: da, fn: fn, mostrate: [] };
    $('#selettore-cerca').value = '';
    disegnaSelettore('');
    $('#selettore').hidden = false;
    $('#selettore-cerca').focus();
  }
  function disegnaSelettore(q) {
    const box = $('#selettore-voci');
    box.textContent = '';
    sel.mostrate = sel.A.cerca(q, sel.voci).slice(0, 80);
    if (!sel.mostrate.length) {
      box.appendChild(crea('p', 'vuoto', sel.voci.length ? 'Nessun dato corrisponde a «' + q + '».' : 'Non ci sono ancora dati: scrivili nella scheda Famiglia.'));
      return;
    }
    sel.mostrate.forEach(function (v) { box.appendChild(rigaVoce(v, 'Scegli', function () { sceltaSelettore(v); })); });
  }
  function sceltaSelettore(v) {
    const fn = sel && sel.fn;
    chiudiSelettore(true);
    if (fn) { fn(v); }
  }
  function chiudiSelettore(senzaFuoco) {
    if (!sel) { return; }
    const da = sel.da;
    sel = null;
    $('#selettore').hidden = true;
    $('#selettore-voci').textContent = '';
    if (!senzaFuoco && da && document.contains(da)) { da.focus(); }
  }

  // ---------- PDF ----------
  function statoPdf(testo) { $('#pdf-stato').textContent = testo; }
  async function apriPdf(f) {
    if (!f || !fam) { return; }
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { statoPdf('«' + f.name + '» non è un PDF.'); return; }
    statoPdf('Apro «' + f.name + '»…');
    $('#pdf-campi').hidden = true;
    pdf = null;
    let r;
    try { r = await ModuliPdf.apri(await f.arrayBuffer()); } catch (e) {
      statoPdf('Non riesco a caricare la parte dell\'app che legge i PDF. Ricarica la pagina e riprova.');
      return;
    }
    if (!fam) { return; }
    if (r.errore === 'protetto') { statoPdf('Il PDF è protetto da password: aprilo con Acrobat Reader, oppure chiedi una versione senza protezione.'); return; }
    if (r.errore) { statoPdf('Non riesco a leggere «' + f.name + '»: forse il file è rovinato.'); return; }
    if (!r.campi.length) {
      statoPdf('«' + f.name + '» non ha campi da compilare' + (r.xfa
        ? ': è un modulo XFA, che si apre solo con Adobe Acrobat Reader.'
        : '. Guarda qui sotto come scriverci sopra.'));
      return;
    }
    pdf = { nome: f.name, doc: r.doc, campi: r.campi, xfa: r.xfa, righe: [] };
    statoPdf('«' + f.name + '»: ' + (r.pagine === 1 ? '1 pagina' : r.pagine + ' pagine') + ', ' + r.campi.length + ' campi. Controlla i valori e poi salva.');
    proponiPdf();
  }
  function proponiPdf() {
    if (!pdf) { return; }
    const A = api(false, $('#pdf-persona').value);
    pdf.righe = ModuliPdf.proponi(pdf.campi, A).map(function (x) {
      return { a: x.a, valore: x.valore, etichetta: x.a ? A.etichetta(x.a) : '' };
    });
    disegnaPdf();
  }
  function disegnaPdf() {
    $('#pdf-titolo').textContent = pdf.nome;
    const box = $('#pdf-righe');
    box.textContent = '';
    pdf.campi.forEach(function (c, i) { box.appendChild(rigaPdf(c, pdf.righe[i])); });
    riepilogoPdf();
    $('#pdf-esito').textContent = '';
    $('#pdf-campi').hidden = false;
  }
  function rigaPdf(c, r) {
    const riga = crea('div', 'riga-pdf');
    const titolo = c.descr || c.breve || c.nome;
    const nome = crea('div', 'nome-campo', titolo);
    if (titolo !== c.nome) { nome.appendChild(crea('small', '', c.nome)); }
    riga.appendChild(nome);
    if (c.solaLettura) {
      riga.appendChild(crea('span', 'nota', 'Sola lettura'));
      riga.appendChild(crea('span', ''));
      return riga;
    }
    if (c.tipo === 'spunta') {
      riga.appendChild(crea('span', 'nota', r.etichetta || '—'));
      const lab = crea('label', 'spunta');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!r.valore;
      cb.addEventListener('change', function () { r.valore = cb.checked; riepilogoPdf(); });
      lab.appendChild(cb);
      lab.appendChild(crea('span', '', 'Spunta'));
      riga.appendChild(lab);
      return riga;
    }
    const b = crea('button', 'btn btn-piccolo scegli' + (r.etichetta ? '' : ' vuoto-dato'), r.etichetta || 'Scegli un dato');
    b.type = 'button';
    b.setAttribute('aria-label', 'Scegli il dato per ' + titolo);
    b.addEventListener('click', function () {
      apriSelettore($('#pdf-persona').value, b, function (v) {
        if (!v) {
          r.a = null;
          r.etichetta = '';
          r.valore = '';
        } else {
          r.etichetta = v.titolo + ' · ' + v.chi;
          if (c.tipo === 'testo') {
            r.valore = v.valore;
          } else {
            const j = A0.opzioneValore(v.valore, c.opzioni);
            if (j < 0) { avvisa('Nessuna voce del menu corrisponde a «' + v.valore + '».'); }
            r.valore = j >= 0 ? c.opzioni[j] : '';
          }
        }
        const nuova = rigaPdf(c, r);
        riga.replaceWith(nuova);
        riepilogoPdf();
        nuova.querySelector('.scegli').focus();
      });
    });
    riga.appendChild(b);
    let ctrl;
    if (c.tipo === 'testo') {
      ctrl = document.createElement('input');
      ctrl.value = r.valore || '';
      ctrl.autocomplete = 'off';
      if (c.max) { ctrl.maxLength = c.max; }
      ctrl.addEventListener('input', function () { r.valore = ctrl.value; riepilogoPdf(); });
    } else {
      ctrl = selectCon([['', '—']].concat(c.opzioni.map(function (o) { return [o, o]; })), r.valore || '');
      ctrl.addEventListener('change', function () { r.valore = ctrl.value; riepilogoPdf(); });
    }
    ctrl.setAttribute('aria-label', 'Valore di ' + titolo);
    riga.appendChild(ctrl);
    return riga;
  }
  function riepilogoPdf() {
    const box = $('#pdf-riepilogo');
    box.textContent = '';
    let pieni = 0;
    let vuoti = 0;
    pdf.campi.forEach(function (c, i) {
      if (c.solaLettura) { return; }
      if (pdf.righe[i].valore) { pieni++; } else if (c.tipo !== 'spunta') { vuoti++; }
    });
    if (pieni) { box.appendChild(crea('span', 'pillola ok', pieni + (pieni === 1 ? ' compilato' : ' compilati'))); }
    if (vuoti) { box.appendChild(crea('span', 'pillola manca', vuoti + (vuoti === 1 ? ' vuoto' : ' vuoti'))); }
    if (pdf.xfa) { box.appendChild(crea('span', 'pillola info', 'Modulo anche in formato XFA: salvo la versione che si apre con tutti i lettori')); }
  }
  async function salvaPdf() {
    if (!pdf) { return; }
    const p = pdf;
    await occupato($('#btn-salva-pdf'), 'Preparo il PDF…', async function () {
      let r;
      try { r = await ModuliPdf.compila(p.doc, p.campi, p.righe.map(function (x) { return x.valore; })); } catch (e) {
        $('#pdf-esito').textContent = 'Non sono riuscito a creare il PDF compilato.';
        return;
      }
      scarica(p.nome.replace(/\.pdf$/i, '') + '-compilato.pdf', 'application/pdf', r.byte);
      $('#pdf-esito').textContent = r.problemi.length
        ? 'PDF salvato tra i download. Non ho potuto scrivere: ' + r.problemi.join(', ') + ' (testo troppo lungo o campo particolare).'
        : 'PDF compilato salvato tra i download.';
    });
  }

  // ---------- Lettere e documenti ----------
  const ES_AUTO = [
    '<p style="text-align:center"><strong>DICHIARAZIONE SOSTITUTIVA DI CERTIFICAZIONE</strong><br>(art. 46 D.P.R. 28 dicembre 2000, n. 445)</p>',
    '<p>Il/La sottoscritto/a ______________________ nato/a a ________________ (____) il ____________, codice fiscale ____________________, residente a ________________ (____) in via ________________________ n. ______,</p>',
    '<p>consapevole delle sanzioni penali previste dall\'art. 76 del D.P.R. 445/2000 per le dichiarazioni false,</p>',
    '<p style="text-align:center"><strong>DICHIARA</strong></p>',
    '<p>di essere figlio/a di ____________________ e di ____________________;<br>di essere coniugato/a con ____________________.</p>',
    '<p>[LUOGO], [DATA]</p>',
    '<p style="text-align:right">Il/La dichiarante<br>[Firma]</p>',
  ].join('');
  const ES_LETTERA = [
    '<p>Spett.le Ufficio Anagrafe<br>Comune di [Comune destinatario]</p>',
    '<p><strong>Oggetto: richiesta di certificato di residenza</strong></p>',
    '<p>Il/La sottoscritto/a [NOME E COGNOME], nato/a a [LUOGO DI NASCITA] ([PROVINCIA DI NASCITA]) il [DATA DI NASCITA], codice fiscale [CODICE FISCALE], residente in [INDIRIZZO COMPLETO],</p>',
    '<p>chiede il rilascio del certificato di residenza in carta semplice.</p>',
    '<p>Per comunicazioni: tel. [TELEFONO], e-mail [EMAIL].</p>',
    '<p>[LUOGO E DATA]</p>',
    '<p style="text-align:right">[NOME E COGNOME]</p>',
  ].join('');
  function mettiEsempio(html) {
    $('#documento').innerHTML = html;
    $('#riepilogo-doc').textContent = '';
    lettera.originale = null;
    lettera.completato = null;
  }

  const BLOCCHI = 'p,div,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre,tr';
  function completaDocumento() {
    const box = $('#documento');
    const scelta = $('#lettera-persona').value;
    const A = api(true, scelta);
    const scrive = persona(leggiScelta(scelta).soggetto) || io();

    // Si riparte dal testo di prima dell'ultimo «Completa»: così si può cambiare chi scrive
    if (lettera.originale !== null && box.innerHTML === lettera.completato) {
      box.innerHTML = lettera.originale;
    } else {
      $$('.ct-valore,.ct-manca', box).forEach(function (s) { s.replaceWith(document.createTextNode(s.dataset.orig || s.textContent)); });
      box.normalize();
    }
    lettera.originale = box.innerHTML;

    const RE = /\[([^\[\]\n]{1,60})\]|\{\{\s*([^{}\n]{1,60}?)\s*\}\}|(_{3,}|\.{4,}|…{2,})/g;
    const trovati = [];
    const w = document.createTreeWalker(box, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let blocco = null;
    let prec = null;
    let coda = '';
    let n = w.nextNode();
    while (n) {
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') { prec = null; coda = ''; }
        n = w.nextNode();
        continue;
      }
      const b = (n.parentElement && n.parentElement.closest(BLOCCHI)) || box;
      const bb = box.contains(b) ? b : box;
      if (bb !== blocco) { blocco = bb; prec = null; coda = ''; }
      const t = n.nodeValue;
      RE.lastIndex = 0;
      let m;
      let ultimo = 0;
      while ((m = RE.exec(t))) {
        const prima = coda + t.slice(ultimo, m.index);
        const interno = m[1] || m[2] || '';
        let a = null;
        let descr = '';
        if (m[3]) {
          a = A.spazio(prima, prec);
          descr = prima;
        } else {
          if (!/[a-zà-ú]/i.test(interno)) { continue; }
          a = A.riconosci(interno);
          descr = interno;
        }
        trovati.push({ nodo: n, da: m.index, a: m.index + m[0].length, dato: a, orig: m[0], descr: descr });
        prec = a;
        coda = '';
        ultimo = m.index + m[0].length;
      }
      coda = (coda + t.slice(ultimo)).slice(-120);
      n = w.nextNode();
    }

    const unisciCivico = !trovati.some(function (f) { return f.dato && f.dato.k === 'civico'; });
    let inseriti = 0;
    let mancanti = 0;
    for (let i = trovati.length - 1; i >= 0; i--) {
      const f = trovati[i];
      const val = f.dato ? A.valore(f.dato, f.descr, { unisciCivico: unisciCivico }) : '';
      f.nodo.splitText(f.a);
      const mezzo = f.nodo.splitText(f.da);
      const s = document.createElement('span');
      s.dataset.orig = f.orig;
      if (val) {
        s.className = 'ct-valore';
        s.title = A.etichetta(f.dato);
        s.textContent = val;
        inseriti++;
      } else {
        s.className = 'ct-manca';
        s.title = f.dato ? 'Manca «' + A.etichetta(f.dato) + '»: aggiungilo nella scheda Famiglia' : 'Da completare a mano';
        s.textContent = f.orig;
        mancanti++;
      }
      mezzo.replaceWith(s);
    }
    const sesso = String(scrive.d.sesso || '').toUpperCase();
    const adattate = $('#adatta-genere').checked ? adattaGenere(box, sesso) : 0;
    lettera.completato = box.innerHTML;
    mostraRiepilogo(inseriti, mancanti, adattate, trovati.length, sesso);
  }
  function adattaGenere(box, sesso) {
    if (sesso !== 'M' && sesso !== 'F') { return 0; }
    const f = sesso === 'F';
    let conta = 0;
    const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentElement.closest('.ct-valore,.ct-manca') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; },
    });
    const nodi = [];
    let n = w.nextNode();
    while (n) { nodi.push(n); n = w.nextNode(); }
    nodi.forEach(function (nd) {
      const prima = nd.nodeValue;
      let t = prima.replace(/\b([Ii])l\s?\/\s?([Ll])a\b/g, function (x, i) { conta++; return f ? (i === 'I' ? 'La' : 'la') : (i === 'I' ? 'Il' : 'il'); });
      t = t.replace(/\b([A-Za-zÀ-ÿ]+)o\s?\/\s?a\b/g, function (x, radice) { conta++; return radice + (f ? 'a' : 'o'); });
      t = t.replace(/\b(celibe)\s?\/\s?(nubile)\b/gi, function (x, c, nb) { conta++; return f ? nb : c; });
      if (t !== prima) { nd.nodeValue = t; }
    });
    return conta;
  }
  function mostraRiepilogo(ins, manc, adatt, tot, sesso) {
    const r = $('#riepilogo-doc');
    r.textContent = '';
    const pill = function (cls, testo) { r.appendChild(crea('span', 'pillola ' + cls, testo)); };
    if (!tot) { pill('info', 'Non ho trovato segnaposti [ ] né spazi ____ da riempire.'); return; }
    if (ins) { pill('ok', ins + (ins === 1 ? ' dato inserito' : ' dati inseriti')); }
    if (manc) { pill('manca', manc + ' da completare (in giallo)'); }
    if (adatt) { pill('info', adatt + (adatt === 1 ? ' parola adattata' : ' parole adattate') + ' al ' + (sesso === 'F' ? 'femminile' : 'maschile')); }
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
    const voci = CT.campi.concat(CT.campiVeicolo).filter(function (c) { return c.seg; }).map(function (c) { return [c.seg, c.e]; })
      .concat([['NOME CONIUGE', 'Nome del coniuge'], ['CODICE FISCALE CONIUGE', 'Codice fiscale del coniuge'], ['NOME FIGLIO', 'Nome del figlio'],
        ['DATA DI NASCITA FIGLIO', 'Data di nascita del figlio'], ['NOME PADRE', 'Nome del padre'], ['NOME MADRE', 'Nome della madre'], ['Firma', 'Resta da firmare']]);
    voci.forEach(function (v) {
      const b = crea('button', '', '[' + v[0] + ']');
      b.type = 'button';
      b.title = v[1];
      b.addEventListener('click', function () { copia('[' + v[0] + ']', 'Copiato [' + v[0] + ']'); });
      box.appendChild(b);
    });
  }

  // ---------- Cerca e copia ----------
  function preparaCerca() {
    const A = api(false);
    cercaDati = { A: A, voci: A.elenco() };
    const box = $('#cerca-filtri');
    box.textContent = '';
    const filtri = [['', 'Tutti']].concat(fam.persone.filter(function (p) { return !vuota(p); }).map(function (p) { return [p.id, nomePersona(p)]; }));
    if (fam.veicoli.some(function (v) { return Object.keys(pulito(v.d)).length; })) { filtri.push(['veicoli', 'Veicoli']); }
    if (!filtri.some(function (f) { return f[0] === filtroCerca; })) { filtroCerca = ''; }
    filtri.forEach(function (f) {
      const b = crea('button', '', f[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', f[0] === filtroCerca ? 'true' : 'false');
      b.addEventListener('click', function () {
        filtroCerca = f[0];
        $$('button', box).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        disegnaCerca();
      });
      box.appendChild(b);
    });
    disegnaCerca();
  }
  function disegnaCerca() {
    if (!cercaDati) { return; }
    const q = $('#cerca-testo').value;
    const box = $('#cerca-risultati');
    box.textContent = '';
    const trovate = cercaDati.A.cerca(q, cercaDati.voci).filter(function (v) {
      return !filtroCerca || (filtroCerca === 'veicoli' ? !!v.vid : v.pid === filtroCerca);
    });
    if (!trovate.length) {
      box.appendChild(crea('p', 'vuoto', cercaDati.voci.length ? 'Nessun dato corrisponde a «' + q + '».'
        : 'Qui compariranno i dati della famiglia, pronti da copiare. Scrivili prima nella scheda Famiglia.'));
      return;
    }
    trovate.slice(0, 100).forEach(function (v) {
      box.appendChild(rigaVoce(v, 'Copia', function () { copia(v.valore, 'Copiato: ' + v.titolo + ' · ' + v.chi.split(' · ')[0]); }));
    });
  }

  // ---------- Sicurezza ----------
  function aggiornaStatoFile() {
    if (!fam) { return; }
    const p = $('#file-stato');
    const b = $('#btn-salva-file');
    b.hidden = !Cassaforte.fileSupportati;
    if (handle && statoFile.daRicollegare) {
      p.textContent = 'Il file «' + handle.name + '» è collegato, ma il browser chiede di nuovo il permesso di scriverci: tocca «Ricollega il file». Intanto i dati sono salvati, cifrati, in questo browser.';
      b.textContent = 'Ricollega il file';
    } else if (handle) {
      p.textContent = 'I dati si salvano da soli, cifrati, nel file «' + handle.name + '» e in questo browser.';
      b.textContent = 'Salva in un altro file';
    } else if (Cassaforte.fileSupportati) {
      p.textContent = 'Per ora i dati sono solo in questo browser, cifrati. Salvali anche in un file sul computer: se il browser viene ripulito li ritrovi lì, e puoi portarli su un altro dispositivo.';
      b.textContent = 'Salva in un file sul computer';
    } else {
      let quando = '';
      try { quando = localStorage.getItem(SCARICATO) || ''; } catch (e) { quando = ''; }
      p.textContent = 'I dati sono cifrati in questo browser, che però non sa aggiornare un file da solo. Dopo le modifiche importanti scarica una copia cifrata e conservala.' +
        (quando ? ' Ultima copia scaricata il ' + dataOra(quando) + '.' : ' Non hai ancora scaricato nessuna copia.');
    }
  }
  async function salvaFile() {
    if (handle && statoFile.daRicollegare) {
      if (await Cassaforte.permesso(handle, true)) {
        await salvaOra();
        await inCoda(persisti);
        avvisa('File ricollegato: lo aggiorno di nuovo a ogni modifica.');
      }
      return;
    }
    let h;
    try { h = await Cassaforte.scegliDoveSalvare(); } catch (e) {
      if (e && e.name !== 'AbortError') { avvisa('Non sono riuscito a creare il file.'); }
      return;
    }
    handle = h;
    await salvaOra();
    await inCoda(persisti);
    avvisa(statoFile.nelFile ? 'Salvato in «' + h.name + '»: da ora lo aggiorno a ogni modifica.' : 'Non sono riuscito a scrivere nel file.');
  }
  async function scaricaFile() {
    await salvaOra();
    scarica(Cassaforte.NOME_FILE, 'application/json', Cassaforte.testoFile(file));
    try { localStorage.setItem(SCARICATO, new Date().toISOString()); } catch (e) { /* solo un promemoria */ }
    aggiornaStatoFile();
    avvisa('Copia cifrata scaricata: si apre solo con la tua password.');
  }
  async function cambiaPassword(e) {
    e.preventDefault();
    const err = $('#cambia-errore');
    const nuova = $('#cambia-nuova').value;
    err.textContent = $('#cambia-vecchia').value ? erroreNuovaPassword(nuova, $('#cambia-nuova2').value) : 'Scrivi la password attuale.';
    if (err.textContent) { return; }
    await occupato($('#form-cambia button[type=submit]'), 'Cambio la password…', async function () {
      if (!(await Cassaforte.verificaPassword(file, $('#cambia-vecchia').value))) { err.textContent = 'La password attuale non è giusta.'; return; }
      await salvaOra();
      const k = chiave;
      await inCoda(async function () {
        file = await Cassaforte.cambiaPassword(file, k, nuova);
        await persisti();
      });
      $('#form-cambia').reset();
      avvisa('Password cambiata. Il pulsante «Compila» nei preferiti usa ancora quella vecchia: crealo di nuovo.');
    });
  }
  async function nuovoCodice(e) {
    e.preventDefault();
    const err = $('#codice-errore');
    const pw = $('#codice-pw').value;
    err.textContent = pw ? '' : 'Scrivi la password.';
    if (!pw) { return; }
    await occupato($('#form-nuovo-codice button[type=submit]'), 'Creo il codice…', async function () {
      if (!(await Cassaforte.verificaPassword(file, pw))) { err.textContent = 'Password sbagliata.'; return; }
      await salvaOra();
      const k = chiave;
      let codice = '';
      await inCoda(async function () {
        const r = await Cassaforte.rinnovaCodice(file, k);
        file = r.file;
        codice = r.codice;
        await persisti();
      });
      $('#codice-pw').value = '';
      if (codice) { mostraCodice(codice, 'sicurezza'); }
    });
  }
  async function cancellaTutto() {
    clearTimeout(timerSalva);
    sporco = false;
    await catena;
    chiudiProva();
    chiudiSelettore();
    Cassaforte.cancellaCopia();
    await Cassaforte.scollegaFile();
    cancellaV1();
    fam = null;
    chiave = null;
    file = null;
    handle = null;
    fonte = null;
    pdf = null;
    svuotaInterfaccia();
    mostraAvvio();
    avvisa('Dati cancellati da questo browser.');
  }

  // ---------- Collegamenti ----------
  function preparaListe() {
    const lp = document.createElement('datalist');
    lp.id = 'lista-province';
    Object.keys(CT.province).forEach(function (s) {
      const o = document.createElement('option');
      o.value = s;
      o.label = CT.province[s];
      lp.appendChild(o);
    });
    document.body.appendChild(lp);
  }
  function collega() {
    // Avvio e sblocco
    $('#form-crea').addEventListener('submit', creaCassaforte);
    $('#crea-pw').addEventListener('input', function (e) { forzaPassword(e.target.value); });
    $('#btn-copia-codice-rec').addEventListener('click', function () { copia($('#codice-recupero').textContent, 'Codice copiato. Scrivilo anche su un foglio.'); });
    $('#codice-salvato').addEventListener('change', function (e) { $('#btn-codice-fatto').disabled = !e.target.checked; });
    $('#btn-codice-fatto').addEventListener('click', codiceFatto);
    $('#form-sblocca').addEventListener('submit', sblocca);
    $('#form-recupero').addEventListener('submit', recupera);
    $$('[data-apri-file]').forEach(function (b) { b.addEventListener('click', apriFile); });
    $('#file-cassaforte').addEventListener('change', fileScelto);

    // Testata e schede
    $('#btn-blocca').addEventListener('click', function () { blocca('blocca'); });
    $('#btn-sicurezza').addEventListener('click', function () { apriScheda('sicurezza'); });
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
    window.addEventListener('hashchange', function () {
      const h = String(location.hash || '').replace('#', '');
      if (fam && SCHEDE.indexOf(h) >= 0) { apriScheda(h); }
    });

    // Famiglia
    $('#btn-nuova-persona').addEventListener('click', aggiungiPersona);
    $('#btn-nuovo-veicolo').addEventListener('click', aggiungiVeicolo);

    // Siti web
    $('#form-pulsante').addEventListener('submit', creaPulsante);
    const seg = $('#segnalibro');
    seg.addEventListener('click', function (e) {
      e.preventDefault();
      avvisa('Trascina il pulsante nella barra dei preferiti (non cliccarlo qui).');
    });
    $('#btn-copia-pulsante').addEventListener('click', function () {
      if (urlPulsante) { copia(urlPulsante, 'Codice copiato: incollalo come indirizzo del preferito.'); }
    });
    $('#btn-prova').addEventListener('click', provaCompilazione);
    $('#btn-svuota-prova').addEventListener('click', svuotaProva);
    $('#modulo-prova').addEventListener('submit', function (e) {
      e.preventDefault();
      $('#esito-prova').textContent = 'È un modulo di prova: non viene inviato nulla.';
    });

    // PDF
    $('#file-pdf').addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      apriPdf(f);
    });
    const zona = $('#zona-pdf');
    zona.addEventListener('dragover', function (e) { e.preventDefault(); zona.classList.add('sopra'); });
    zona.addEventListener('dragleave', function () { zona.classList.remove('sopra'); });
    zona.addEventListener('drop', function (e) {
      e.preventDefault();
      zona.classList.remove('sopra');
      apriPdf(e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    $('#pdf-persona').addEventListener('change', proponiPdf);
    $('#btn-salva-pdf').addEventListener('click', salvaPdf);

    // Selettore
    $('#selettore-cerca').addEventListener('input', function (e) { if (sel) { disegnaSelettore(e.target.value); } });
    $('#selettore-cerca').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && sel && sel.mostrate.length) { e.preventDefault(); sceltaSelettore(sel.mostrate[0]); }
    });
    $('#selettore-chiudi').addEventListener('click', function () { chiudiSelettore(); });
    $('#selettore-vuoto').addEventListener('click', function () {
      const fn = sel && sel.fn;
      chiudiSelettore(true);
      if (fn) { fn(null); }
    });
    $('#selettore').addEventListener('click', function (e) { if (e.target === e.currentTarget) { chiudiSelettore(); } });
    $('#selettore').addEventListener('keydown', function (e) { if (e.key === 'Escape') { chiudiSelettore(); } });

    // Lettere
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
    $('#btn-es-auto').addEventListener('click', function () { mettiEsempio(ES_AUTO); });
    $('#btn-es-lettera').addEventListener('click', function () { mettiEsempio(ES_LETTERA); });
    $('#btn-svuota-doc').addEventListener('click', function () { mettiEsempio(''); });

    // Cerca e copia
    $('#cerca-testo').addEventListener('input', disegnaCerca);

    // Sicurezza
    $('#btn-salva-file').addEventListener('click', salvaFile);
    $('#btn-scarica-file').addEventListener('click', scaricaFile);
    $('#form-cambia').addEventListener('submit', cambiaPassword);
    $('#form-nuovo-codice').addEventListener('submit', nuovoCodice);
    $('#blocco-minuti').addEventListener('change', function (e) {
      fam.impostazioni.blocco = Number(e.target.value) || 10;
      modificato();
    });
    conConferma($('#btn-cancella-tutto'), 'Tocca di nuovo: senza un file salvato i dati andranno persi', cancellaTutto);

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
  async function avvio() {
    if (inCornice) {
      // In un'anteprima incorniciata stampa e download non funzionano
      $('#btn-stampa').hidden = true;
      $('#btn-word').hidden = true;
    }
    preparaListe();
    preparaModuloProva();
    disegnaSegnaposti();
    collega();
    if (!Cassaforte.disponibile) { mostraAvvio(); return; }
    handle = await Cassaforte.fileCollegato();
    const c = Cassaforte.leggiCopia();
    if (c || handle) {
      fonte = { file: c, handle: handle };
      mostraSblocco();
    } else {
      mostraAvvio();
    }
  }
  avvio();

  if ('serviceWorker' in navigator && !inCornice && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* senza lavoro offline l'app funziona comunque */ });
  }
})();
