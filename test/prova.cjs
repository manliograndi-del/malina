/*
 * Prova automatica di Compilatutto.
 * Apre l'app in Chromium, crea il pulsante «Compila» e lo usa sui moduli di test/moduli,
 * poi completa le lettere di esempio. Avvio: npm test
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const ADULTO = {
  id: 'p-adulto', n: 'Mario', t: 'adulto',
  d: {
    nome: 'Mario', cognome: 'Rossi', sesso: 'M', data_nascita: '1980-03-12', luogo_nascita: 'Roma',
    provincia_nascita: 'RM', codice_fiscale: 'RSSMRA80C12H501E', cittadinanza: 'Italiana', nome_padre: 'Giuseppe',
    nome_madre: 'Anna', cognome_madre: 'Bianchi', indirizzo: 'Via Appia Nuova', civico: '12', cap: '00183',
    citta: 'Roma', provincia: 'Roma', nazione: 'Italia', telefono: '+39 333 1234567', email: 'mario.rossi@example.com',
    tipo_documento: "Carta d'identità elettronica", numero_documento: 'CA12345AB', rilasciato_da: 'Comune di Roma',
    data_rilascio: '2021-05-04', scadenza_documento: '2032-03-12', professione: 'Impiegato',
  },
  x: [{ e: 'IBAN', v: 'IT60X0542811101000000123456', p: 'iban, conto corrente' }],
};
const MINORE = {
  id: 'p-minore', n: 'Luca', t: 'minore',
  d: { nome: 'Luca', cognome: 'Rossi', sesso: 'M', codice_fiscale: 'RSSLCU15E20H501Q', luogo_nascita: 'Roma', nome_padre: 'Mario' },
  x: [],
};

function server() {
  return new Promise(function (ok) {
    const s = http.createServer(function (req, res) {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(RADICE, url.endsWith('/') ? url + 'index.html' : url);
      if (!file.startsWith(RADICE) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
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

(async function () {
  const s = await server();
  const base = 'http://127.0.0.1:' + s.address().port;
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage();
  const problemi = [];
  page.on('pageerror', function (e) { problemi.push(e.message); });

  // Profili nell'app e codice del pulsante per ciascuno
  await page.goto(base + '/app/index.html');
  await page.evaluate(function (st) { localStorage.setItem('compilatutto.v1', JSON.stringify(st)); },
    { profili: [ADULTO, MINORE], attivo: ADULTO.id, scheda: 'siti' });
  await page.reload();
  const codice = {};
  for (const p of [ADULTO, MINORE]) {
    await page.selectOption('#sel-profilo', p.id);
    const href = await page.getAttribute('#segnalibro', 'href');
    codice[p.t] = decodeURIComponent(href.replace(/^javascript:/, ''));
  }
  console.log('Pulsante «Compila»: ' + Math.round(codice.adulto.length / 1024) + ' KB di codice');

  const esegui = async function (file, tipo) {
    await page.goto(base + '/test/moduli/' + file);
    await page.evaluate(codice[tipo]);
    return page.evaluate(function (attr) {
      return Array.prototype.map.call(document.querySelectorAll('[' + attr + ']'), function (e) {
        const nome = e.name || e.id;
        if (e.type === 'radio') { return [nome + '=' + e.value, e.checked ? 'si' : 'no', e.getAttribute(attr), null]; }
        return [nome, e.value, e.getAttribute(attr), e.dataset.visto === undefined ? null : e.dataset.visto];
      });
    }, tipo === 'minore' ? 'data-minore' : (file === 'scuola.html' ? 'data-adulto' : 'data-atteso'));
  };

  const casi = [['moderno.html', 'adulto'], ['tabella.html', 'adulto'], ['relazioni.html', 'adulto'],
    ['inglese.html', 'adulto'], ['scuola.html', 'adulto'], ['scuola.html', 'minore']];
  for (const c of casi) {
    console.log('Modulo ' + c[0] + ' con profilo ' + c[1]);
    const righe = await esegui(c[0], c[1]);
    righe.forEach(function (r) {
      controlla(r[0], r[1], r[2]);
      if (c[0] === 'moderno.html' && r[2] && r[3] !== null) { controlla(r[0] + ' (evento input)', r[3], r[1]); }
    });
  }

  // Modulo di prova dentro l'app
  console.log('Modulo di prova nell\'app');
  await page.goto(base + '/app/index.html#siti');
  await page.selectOption('#sel-profilo', ADULTO.id);
  await page.click('#btn-prova');
  const prova = await page.evaluate(function () {
    const f = document.getElementById('modulo-prova');
    const v = {};
    Array.prototype.forEach.call(f.elements, function (e) { if (e.name && e.type !== 'radio') { v[e.name] = e.value; } });
    v.sesso = (f.querySelector('input[name=sesso]:checked') || {}).value || '';
    return v;
  });
  const attesoProva = { cognome: 'Rossi', nome: 'Mario', cf: 'RSSMRA80C12H501E', nascita: '12/03/1980', luogo_nasc: 'Roma',
    prov_nasc: 'RM', sesso: 'M', res_via: 'Via Appia Nuova', res_civ: '12', res_cap: '00183', res_comune: 'Roma',
    padre_nome: 'Giuseppe', padre_cognome: 'Rossi', cell: '+39 333 1234567', mail: 'mario.rossi@example.com',
    mail2: 'mario.rossi@example.com', coniuge: '' };
  Object.keys(attesoProva).forEach(function (k) { controlla('prova ' + k, prova[k], attesoProva[k]); });

  // Lettere
  const oggi = await page.evaluate(function () {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  });
  const lettera = async function (bottone) {
    await page.click('#tab-doc');
    await page.click(bottone);
    await page.click('#btn-completa');
    return page.evaluate(function () {
      return {
        testo: document.getElementById('documento').innerText.replace(/\n+/g, '\n').trim(),
        manca: Array.prototype.map.call(document.querySelectorAll('#documento .ct-manca'), function (s) { return s.textContent; }),
      };
    });
  };
  console.log('Autocertificazione');
  const auto = await lettera('#btn-es-auto');
  [
    'Il sottoscritto Mario Rossi nato a Roma (RM) il 12/03/1980, codice fiscale RSSMRA80C12H501E, residente a Roma (RM) in via Appia Nuova n. 12,',
    'di essere figlio di Giuseppe Rossi e di Anna Bianchi.',
    'Roma, ' + oggi,
    'Il dichiarante',
  ].forEach(function (riga) { controlla('riga «' + riga.slice(0, 40) + '…»', auto.testo.indexOf(riga) >= 0, true); });
  controlla('da completare', auto.manca.join(','), '[Firma]');
  if (errori) { console.log(auto.testo); }

  console.log('Lettera');
  const let1 = await lettera('#btn-es-lettera');
  [
    'Il sottoscritto Mario Rossi, nato a Roma (RM) il 12/03/1980, codice fiscale RSSMRA80C12H501E, residente in Via Appia Nuova, 12, 00183 Roma (RM),',
    'Per comunicazioni: tel. +39 333 1234567, e-mail mario.rossi@example.com.',
    'Roma, ' + oggi,
  ].forEach(function (riga) { controlla('riga «' + riga.slice(0, 40) + '…»', let1.testo.indexOf(riga) >= 0, true); });
  controlla('da completare', let1.manca.join(','), '[Comune destinatario]');
  if (errori) { console.log(let1.testo); }

  // Segnaposti standard
  console.log('Segnaposti standard');
  const seg = await page.evaluate(function () {
    const F = Object.assign({}, CT, { prov: CT.province });
    const A = compilaModulo({ d: {} }, F, { api: true, doc: true });
    return CT.campi.filter(function (c) { return c.seg; }).map(function (c) { return [c.seg, A.riconosci(c.seg), c.k]; });
  });
  seg.forEach(function (r) { controlla('[' + r[0] + ']', r[1], r[2]); });
  const extra = await page.evaluate(function (p) {
    const F = Object.assign({}, CT, { prov: CT.province });
    const A = compilaModulo(p, F, { api: true, doc: true });
    return [A.riconosci('IBAN'), A.valore(A.riconosci('IBAN'), 'IBAN'), A.riconosci('nome padre'), A.valore('cognome_padre', '')];
  }, ADULTO);
  controlla('[IBAN]', extra[0] + ' ' + extra[1], 'x0 IT60X0542811101000000123456');
  controlla('{{nome padre}}', extra[2], 'nome_padre');
  controlla('cognome del padre vuoto', extra[3], 'Rossi');

  problemi.forEach(function (m) { errori++; console.log('  ✗ errore JavaScript: ' + m); });
  await browser.close();
  s.close();
  console.log(errori ? '\n' + errori + ' controlli non riusciti.' : '\nTutti i controlli sono riusciti.');
  process.exit(errori ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
