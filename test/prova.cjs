/*
 * Prova automatica di Compilatutto (versione 2).
 * Prova in Chromium le parti dell'app una per una: il motore sui moduli di test/moduli, il pulsante «Compila»
 * con la password e l'elenco dei dati, la cassaforte cifrata, gli spazi delle lettere, i PDF e infine l'app intera
 * (creazione della cassaforte, dati della versione 1, blocco e sblocco).
 * Avvio: npm test
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PASSWORD = 'gatto-rosso-sul-tetto-1987';

const FAMIGLIA = {
  persone: [
    {
      id: 'p-io', rel: 'io',
      d: {
        nome: 'Mario', cognome: 'Rossi', sesso: 'M', data_nascita: '1980-03-12', luogo_nascita: 'Roma',
        provincia_nascita: 'RM', codice_fiscale: 'RSSMRA80C12H501E', cittadinanza: 'Italiana', stato_civile: 'Coniugato/a',
        nome_padre: 'Giuseppe', nome_madre: 'Anna', cognome_madre: 'Bianchi', indirizzo: 'Via Appia Nuova', civico: '12',
        cap: '00183', citta: 'Roma', provincia: 'Roma', nazione: 'Italia', telefono: '+39 333 1234567',
        email: 'mario.rossi@example.com', ci_tipo: "Carta d'identità elettronica", ci_numero: 'CA12345AB', ci_comune: 'Roma',
        ci_data_rilascio: '2021-05-04', ci_scadenza: '2032-03-12', passaporto_numero: 'YA1234567',
        passaporto_scadenza: '2030-01-15', professione: 'Impiegato', iban: 'IT60X0542811101000000123456',
      },
      x: [{ e: 'Tessera della biblioteca', v: 'B-998', p: 'biblioteca' }],
    },
    { id: 'p-lu', rel: 'coniuge', d: { nome: 'Lucia', cognome: 'Verdi', sesso: 'F', codice_fiscale: 'VRDLCU82A41H501X', data_nascita: '1982-01-01' }, x: [] },
    { id: 'p-lc', rel: 'figlio', d: { nome: 'Luca', cognome: 'Rossi', sesso: 'M', codice_fiscale: 'RSSLCU15E20H501Q', luogo_nascita: 'Roma', classe: '3' }, x: [] },
  ],
  veicoli: [{ id: 'v-1', prop: 'p-io', d: { targa: 'AB123CD', marca: 'Fiat', modello: 'Panda', immatricolazione: '2019-06-01' } }],
};

// Dati di riferimento per il motore, come li prepara l'app (va eseguita nella pagina, dove c'è CT)
function costruisciF(perPulsante) {
  const C = CT;
  const campo = function (c) { return { k: c.k, e: c.e, g: c.g, tipo: c.tipo, sin: c.sin, escl: c.escl, org: c.org, doc: c.doc, calc: c.calc }; };
  return {
    campi: C.campi.filter(function (c) { return !perPulsante || !c.doc; }).map(campo),
    campiVeicolo: C.campiVeicolo.map(campo),
    gruppi: C.gruppi.map(function (g) { return { g: g.g, titolo: g.titolo }; }),
    gruppiVeicolo: C.gruppiVeicolo.map(function (g) { return { g: g.g, titolo: g.titolo }; }),
    relazioni: C.relazioni, documenti: C.documenti, documentoPrincipale: C.documentoPrincipale,
    domicilio: C.domicilio, ruoli: C.ruoli, veicolo: C.veicolo,
    spazi: perPulsante ? [] : C.spazi, altriDoc: perPulsante ? [] : C.altriDoc,
    stop: C.stop, salta: C.salta, org: C.org, conferma: C.conferma, mesi: C.mesi, prov: C.province,
  };
}

function server() {
  return new Promise(function (ok) {
    const s = http.createServer(function (req, res) {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(RADICE, url.endsWith('/') ? url + 'index.html' : url);
      if (!file.startsWith(RADICE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TIPI[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    s.listen(0, '127.0.0.1', function () { ok(s); });
  });
}

let errori = 0;
function controlla(nome, ottenuto, atteso) {
  if (ottenuto === atteso) { return; }
  errori++;
  console.log('  ✗ ' + nome + ': ottenuto ' + JSON.stringify(ottenuto) + ', atteso ' + JSON.stringify(atteso));
}
function leggiAttesi(attr) {
  return Array.prototype.map.call(document.querySelectorAll('[' + attr + ']'), function (e) {
    const nome = e.name || e.id;
    if (e.type === 'radio') { return [nome + '=' + e.value, e.checked ? 'si' : 'no', e.getAttribute(attr), null]; }
    return [nome, e.value, e.getAttribute(attr), e.dataset.visto === undefined ? null : e.dataset.visto];
  });
}

(async function () {
  const s = await server();
  const base = 'http://127.0.0.1:' + s.address().port;
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage();
  const problemi = [];
  page.on('pageerror', function (e) { problemi.push(e.message); });

  const iniettaApp = async function () {
    for (const f of ['campi.js', 'motore.js']) { await page.addScriptTag({ url: base + '/app/' + f }); }
    await page.addScriptTag({ content: 'window.costruisciF = ' + costruisciF.toString() + ';' });
  };

  // 1. Motore sui moduli di esempio
  const casi = [['moderno.html', 'p-io', 'data-atteso'], ['tabella.html', 'p-io', 'data-atteso'], ['relazioni.html', 'p-io', 'data-atteso'],
    ['inglese.html', 'p-io', 'data-atteso'], ['scuola.html', 'p-io', 'data-io'], ['scuola.html', 'p-lc', 'data-figlio']];
  for (const c of casi) {
    console.log('Modulo ' + c[0] + ' compilato per ' + c[1]);
    await page.goto(base + '/test/moduli/' + c[0]);
    await iniettaApp();
    await page.evaluate(function (a) {
      compilaModulo(Object.assign({ soggetto: a.soggetto }, a.famiglia), costruisciF(true), { silenzioso: true });
    }, { famiglia: FAMIGLIA, soggetto: c[1] });
    const righe = await page.evaluate(leggiAttesi, c[2]);
    righe.forEach(function (r) {
      controlla(r[0], r[1], r[2]);
      if (c[0] === 'moderno.html' && r[2] && r[3] !== null) { controlla(r[0] + ' (evento input)', r[3], r[1]); }
    });
  }

  // 2. Cassaforte cifrata
  console.log('Cassaforte cifrata');
  await page.goto(base + '/test/banco.html');
  await page.addScriptTag({ content: 'window.costruisciF = ' + costruisciF.toString() + ';' });
  const cf = await page.evaluate(async function (a) {
    const c = await Cassaforte.crea(a.pw, a.famiglia);
    const testo = JSON.stringify(c.file);
    let sbagliata = '';
    try { await Cassaforte.apri(c.file, 'altra-password-123', 'password'); } catch (e) { sbagliata = e.message; }
    const giusta = await Cassaforte.apri(c.file, a.pw, 'password');
    const rec = await Cassaforte.apri(c.file, c.codice.toLowerCase().replace(/-/g, ' '), 'recupero');
    const nuovo = await Cassaforte.cambiaPassword(c.file, giusta.chiaveDati, 'nuova-password-2026');
    let vecchia = '';
    try { await Cassaforte.apri(nuovo, a.pw, 'password'); } catch (e) { vecchia = e.message; }
    const conNuova = await Cassaforte.apri(nuovo, 'nuova-password-2026', 'password');
    const aggiornato = await Cassaforte.aggiorna(nuovo, conNuova.chiaveDati, Object.assign({}, conNuova.dati, { prova: 1 }));
    const riletto = await Cassaforte.apri(aggiornato, 'nuova-password-2026', 'password');
    const recDopo = await Cassaforte.apri(aggiornato, c.codice, 'recupero');
    return {
      inChiaro: /Rossi|Mario|AB123CD|RSSMRA/.test(testo), sbagliata: sbagliata, nome: giusta.dati.persone[0].d.nome,
      recupero: rec.dati.persone[1].d.nome, vecchia: vecchia, nuova: conNuova.dati.persone[2].d.nome, prova: riletto.dati.prova,
      ivNuovo: aggiornato.contenuto.iv !== c.file.contenuto.iv, recDopo: recDopo.dati.persone[0].d.cognome,
      codice: /^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/.test(c.codice),
    };
  }, { famiglia: FAMIGLIA, pw: PASSWORD });
  controlla('nessun dato in chiaro nel file', cf.inChiaro, false);
  controlla('password sbagliata rifiutata', cf.sbagliata, 'sbagliata');
  controlla('apertura con la password', cf.nome, 'Mario');
  controlla('apertura con il codice di recupero', cf.recupero, 'Lucia');
  controlla('vecchia password rifiutata', cf.vecchia, 'sbagliata');
  controlla('nuova password', cf.nuova, 'Luca');
  controlla('salvataggio', cf.prova, 1);
  controlla('vettore nuovo a ogni salvataggio', cf.ivNuovo, true);
  controlla('codice di recupero valido dopo il cambio', cf.recDopo, 'Rossi');
  controlla('forma del codice di recupero', cf.codice, true);

  // 3. Pulsante «Compila»: dati cifrati, password sulla pagina, scelta della persona, elenco dei dati
  console.log('Pulsante «Compila»');
  const pulsante = await page.evaluate(async function (a) {
    const B = await Cassaforte.cifraPerPulsante(a.pw, a.famiglia);
    const src = function (fn) {
      return fn.toString().split('\n').filter(function (r) { return !/^\s*\/\//.test(r); })
        .map(function (r) { return r.trim(); }).filter(Boolean).join('\n');
    };
    const codice = '(function(){var M=' + src(compilaModulo) + ';(' + src(avviaCompilatutto) + ')(' +
      JSON.stringify(B) + ',' + JSON.stringify(costruisciF(true)) + ',M);})();void 0';
    const url = 'javascript:' + encodeURIComponent(codice);
    return { codice: codice, kb: Math.round(url.length / 1024), inChiaro: /Rossi|Mario|AB123CD/.test(JSON.stringify(B)), ritorno: decodeURIComponent(url.slice(11)) === codice };
  }, { famiglia: FAMIGLIA, pw: PASSWORD });
  console.log('  codice del pulsante: ' + pulsante.kb + ' KB');
  controlla('nessun dato in chiaro nel pulsante', pulsante.inChiaro, false);
  controlla('codice integro dopo la codifica', pulsante.ritorno, true);

  await page.goto(base + '/test/moduli/moderno.html');
  await page.evaluate(pulsante.codice);
  const campoPw = page.getByLabel('Password di Compilatutto');
  await campoPw.fill('password-sbagliata-1');
  await page.getByRole('button', { name: 'Sblocca' }).click();
  await page.getByText('Password sbagliata').waitFor({ timeout: 15000 });
  await campoPw.fill(PASSWORD);
  await page.getByRole('button', { name: 'Sblocca' }).click();
  await page.getByRole('button', { name: /Mario Rossi/ }).click({ timeout: 15000 });
  await page.getByText(/campi compilati/).waitFor({ timeout: 5000 });
  const dopoPulsante = await page.evaluate(leggiAttesi, 'data-atteso');
  dopoPulsante.forEach(function (r) { if (r[0] !== 'note') { controlla('pulsante ' + r[0], r[1], r[2]); } });
  // Elenco dei dati: si tocca un campo vuoto, si scrive «targa», si sceglie la voce
  await page.click('#c7');
  await page.getByPlaceholder(/Cerca un dato/).waitFor({ timeout: 3000 });
  await page.keyboard.type('targa');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  controlla('elenco dei dati: targa nel campo Note', await page.inputValue('#c7'), 'AB123CD');
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  controlla('chiusura della barra', await page.evaluate(function () { return !!document.querySelector('[data-compilatutto]'); }), false);

  // 4. Lettere: segnaposti e spazi da riempire
  console.log('Lettere e segnaposti');
  await page.goto(base + '/test/banco.html');
  await page.addScriptTag({ content: 'window.costruisciF = ' + costruisciF.toString() + ';' });
  const lettere = await page.evaluate(function (fam) {
    const A = compilaModulo(Object.assign({ soggetto: 'p-io' }, fam), costruisciF(false), { api: true, doc: true });
    const seg = [];
    CT.campi.concat(CT.campiVeicolo).forEach(function (c) {
      if (!c.seg) { return; }
      const a = A.riconosci(c.seg);
      seg.push([c.seg, a ? a.k : null, c.k]);
    });
    const famiglia = {};
    [['NOME PADRE', 'Giuseppe'], ['COGNOME PADRE', 'Rossi'], ['NOME MADRE', 'Anna'], ['COGNOME MADRE', 'Bianchi'],
      ['NOME CONIUGE', 'Lucia'], ['CODICE FISCALE CONIUGE', 'VRDLCU82A41H501X'], ['NOME FIGLIO', 'Luca'],
      ['CLASSE ALUNNO', '3'], ['NUMERO PASSAPORTO', 'YA1234567'], ['SCADENZA PASSAPORTO', '15/01/2030'], ['TARGA', 'AB123CD'],
      ['Tessera della biblioteca', 'B-998'], ['Nome destinatario', '']].forEach(function (x) {
      const a = A.riconosci(x[0]);
      famiglia[x[0]] = [a ? A.valore(a, x[0]) : '', x[1]];
    });
    const testo = 'Il/La sottoscritto/a ______ nato/a a ______ (___) il ______, codice fiscale ______, residente a ______ (___) ' +
      'in via ______ n. ___, di essere figlio/a di ______ e di ______, coniugato/a con ______, proprietario del veicolo targato ______.';
    const re = /_{3,}/g;
    let m;
    let ultimo = 0;
    let prec = null;
    let out = '';
    while ((m = re.exec(testo))) {
      const prima = testo.slice(ultimo, m.index);
      const a = A.spazio(prima, prec);
      out += prima + (a ? A.valore(a, prima, { unisciCivico: false }) : '[?]');
      prec = a;
      ultimo = m.index + m[0].length;
    }
    return { seg: seg, famiglia: famiglia, auto: out + testo.slice(ultimo) };
  }, FAMIGLIA);
  lettere.seg.forEach(function (r) { controlla('[' + r[0] + ']', r[1], r[2]); });
  Object.keys(lettere.famiglia).forEach(function (k) { controlla('[' + k + ']', lettere.famiglia[k][0], lettere.famiglia[k][1]); });
  controlla('autocertificazione', lettere.auto, 'Il/La sottoscritto/a Mario Rossi nato/a a Roma (RM) il 12/03/1980, codice fiscale RSSMRA80C12H501E, ' +
    'residente a Roma (RM) in via Appia Nuova n. 12, di essere figlio/a di Giuseppe Rossi e di Anna Bianchi, coniugato/a con Lucia Verdi, ' +
    'proprietario del veicolo targato AB123CD.');

  // 5. PDF compilabile creato al momento
  console.log('Modulo PDF');
  const p = await page.evaluate(async function (fam) {
    const L = PDFLib;
    const doc = await L.PDFDocument.create();
    const pg = doc.addPage([595, 842]);
    const form = doc.getForm();
    let y = 780;
    const testo = function (nome, descr) {
      const f = form.createTextField(nome);
      if (descr) { f.acroField.dict.set(L.PDFName.of('TU'), L.PDFHexString.fromText(descr)); }
      f.addToPage(pg, { x: 200, y: y, width: 250, height: 18 });
      y -= 30;
    };
    testo('topmostSubform[0].Page1[0].Cognome[0]');
    testo('Nome');
    testo('Testo3', 'Codice fiscale del richiedente');
    testo('DataNascita');
    testo('Testo5', 'Nome e cognome del coniuge');
    testo('Targa');
    testo('Testo7');
    form.createCheckBox('Sesso_M').addToPage(pg, { x: 200, y: y, width: 12, height: 12 });
    form.createCheckBox('Sesso_F').addToPage(pg, { x: 230, y: y, width: 12, height: 12 });
    y -= 30;
    const menu = form.createDropdown('Provincia');
    menu.addOptions(['MI', 'RM', 'TO']);
    menu.addToPage(pg, { x: 200, y: y, width: 80, height: 18 });
    const aperto = await ModuliPdf.apri(await doc.save());
    const A = compilaModulo(Object.assign({ soggetto: 'p-io' }, fam), costruisciF(false), { api: true });
    const valori = ModuliPdf.proponi(aperto.campi, A).map(function (x) { return x.valore; });
    const fatto = await ModuliPdf.compila(aperto.doc, aperto.campi, valori);
    const fm = (await L.PDFDocument.load(fatto.byte)).getForm();
    const t = function (n) { return fm.getTextField(n).getText() || ''; };
    return {
      campi: aperto.campi.length, cognome: t('topmostSubform[0].Page1[0].Cognome[0]'), nome: t('Nome'), cf: t('Testo3'),
      nascita: t('DataNascita'), coniuge: t('Testo5'), targa: t('Targa'), vuoto: t('Testo7'),
      m: fm.getCheckBox('Sesso_M').isChecked(), f: fm.getCheckBox('Sesso_F').isChecked(),
      prov: fm.getDropdown('Provincia').getSelected().join(','), problemi: fatto.problemi.join(','),
    };
  }, FAMIGLIA);
  const attesoPdf = { campi: 10, cognome: 'Rossi', nome: 'Mario', cf: 'RSSMRA80C12H501E', nascita: '12/03/1980', coniuge: 'Lucia Verdi',
    targa: 'AB123CD', vuoto: '', m: true, f: false, prov: 'RM', problemi: '' };
  Object.keys(attesoPdf).forEach(function (k) { controlla('pdf ' + k, p[k], attesoPdf[k]); });

  // 6. L'app: dati della versione 1 spostati nella cassaforte, scheda Famiglia, blocco e sblocco
  console.log('App');
  await page.goto(base + '/app/index.html');
  await page.evaluate(function () {
    localStorage.clear();
    localStorage.setItem('compilatutto.v1', JSON.stringify({ profili: [{ id: 'a', n: 'Mario', t: 'adulto',
      d: { nome: 'Mario', cognome: 'Rossi', tipo_documento: 'Passaporto', numero_documento: 'YA1234567' }, x: [] }], attivo: 'a' }));
  });
  await page.reload();
  await page.locator('#avviso-migrazione').waitFor();
  await page.fill('#crea-pw', PASSWORD);
  await page.fill('#crea-pw2', PASSWORD);
  await page.check('#crea-capito');
  await page.click('#btn-crea');
  await page.locator('#codice-recupero').waitFor({ timeout: 15000 });
  await page.check('#codice-salvato');
  await page.click('#btn-codice-fatto');
  controlla('app: nome spostato dalla versione 1', await page.inputValue('#f-nome'), 'Mario');
  controlla('app: passaporto spostato dalla versione 1', await page.inputValue('#f-passaporto_numero'), 'YA1234567');
  await page.fill('#f-codice_fiscale', 'RSSMRA80C12H501E');
  await page.getByRole('button', { name: 'Ricava data di nascita e sesso' }).click();
  controlla('app: data di nascita dal codice fiscale', await page.inputValue('#f-data_nascita'), '1980-03-12');
  await page.selectOption('#nuova-persona', 'coniuge');
  await page.click('#btn-nuova-persona');
  await page.fill('#f-nome', 'Lucia');
  await page.fill('#f-cognome', 'Verdi');
  await page.waitForTimeout(800);
  const salvati = await page.evaluate(function () {
    return { v1: localStorage.getItem('compilatutto.v1'), copia: localStorage.getItem('compilatutto.cassaforte') || '' };
  });
  controlla('app: dati della versione 1 cancellati', salvati.v1, null);
  controlla('app: copia nel browser cifrata', /Rossi|Lucia|RSSMRA|YA1234567/.test(salvati.copia) || !salvati.copia, false);
  await page.click('#tab-lettere');
  await page.click('#btn-completa');
  controlla('app: lettera completata', /Il sottoscritto Mario Rossi nato a/.test(await page.textContent('#documento')), true);
  await page.click('#btn-blocca');
  await page.locator('#schermo-sblocco').waitFor();
  controlla('app: nessun dato sulla pagina chiusa', await page.evaluate(function () { return /Rossi|Verdi|RSSMRA|YA1234567/.test(document.body.innerHTML); }), false);
  await page.fill('#sblocca-pw', 'password-sbagliata-1');
  await page.click('#btn-sblocca');
  await page.getByText('Password sbagliata. Riprova.').waitFor({ timeout: 15000 });
  await page.reload();
  await page.fill('#sblocca-pw', PASSWORD);
  await page.click('#btn-sblocca');
  await page.locator('#schermo-app').waitFor({ timeout: 15000 });
  controlla('app: famiglia riaperta', await page.textContent('#lista-persone'), 'MRMario RossiIoLVLucia VerdiMarito o moglie');
  await page.evaluate(function () { localStorage.clear(); });

  problemi.forEach(function (m) { errori++; console.log('  ✗ errore JavaScript: ' + m); });
  await browser.close();
  s.close();
  console.log(errori ? '\n' + errori + ' controlli non riusciti.' : '\nTutti i controlli sono riusciti.');
  process.exit(errori ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
