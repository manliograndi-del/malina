/*
 * Prova automatica dell'estensione Compilatutto per Chrome ed Edge.
 * Carica l'estensione in Chromium, prende i dati cifrati dall'app, apre con la password una volta sola
 * e compila due moduli di fila senza chiedere di nuovo la password. Avvio: npm test
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const RADICE = path.join(__dirname, '..');
const TIPI = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PASSWORD = 'gatto-rosso-sul-tetto-1987';
const FAMIGLIA = {
  persone: [
    { id: 'p-io', rel: 'io', d: { nome: 'Mario', cognome: 'Rossi', sesso: 'M', codice_fiscale: 'RSSMRA80C12H501E', data_nascita: '1980-03-12',
      luogo_nascita: 'Roma', email: 'mario.rossi@example.com', telefono: '+39 333 1234567', citta: 'Roma' }, x: [] },
    { id: 'p-lu', rel: 'coniuge', d: { nome: 'Lucia', cognome: 'Verdi', sesso: 'F', codice_fiscale: 'VRDLCU82A41H501X' }, x: [] },
  ],
  veicoli: [{ id: 'v-1', prop: 'p-io', d: { targa: 'AB123CD' } }],
};

let errori = 0;
function controlla(nome, ottenuto, atteso) {
  if (ottenuto === atteso) { return; }
  errori++;
  console.log('  ✗ ' + nome + ': ottenuto ' + JSON.stringify(ottenuto) + ', atteso ' + JSON.stringify(atteso));
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

(async function () {
  // Le copie dei file dell'app devono essere uguali agli originali (npm run estensione le aggiorna)
  ['campi.js', 'motore.js', 'cassaforte.js'].forEach(function (f) {
    const uguali = fs.readFileSync(path.join(RADICE, 'app', f), 'utf8') === fs.readFileSync(path.join(RADICE, 'estensione', f), 'utf8');
    controlla('estensione/' + f + ' uguale ad app/' + f + ' (npm run estensione)', uguali, true);
  });

  const s = await server();
  const base = 'http://127.0.0.1:' + s.address().port;

  // Copia dell'estensione per la prova: l'app gira qui in locale e i permessi valgono anche senza clic dell'utente
  const cartella = fs.mkdtempSync(path.join(os.tmpdir(), 'compilatutto-estensione-'));
  fs.cpSync(path.join(RADICE, 'estensione'), cartella, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(cartella, 'manifest.json'), 'utf8'));
  man.host_permissions = ['<all_urls>'];
  fs.writeFileSync(path.join(cartella, 'manifest.json'), JSON.stringify(man));
  const comuni = path.join(cartella, 'comuni.js');
  fs.writeFileSync(comuni, fs.readFileSync(comuni, 'utf8').replace("indirizziApp: ['https://manliograndi-del.github.io/malina/*']", "indirizziApp: ['" + base + "/app/*']"));

  const profilo = fs.mkdtempSync(path.join(os.tmpdir(), 'compilatutto-profilo-'));
  const ctx = await chromium.launchPersistentContext(profilo, {
    channel: 'chromium',
    headless: true,
    args: ['--disable-extensions-except=' + cartella, '--load-extension=' + cartella],
  });
  const problemi = [];
  let sw = ctx.serviceWorkers()[0];
  if (!sw) { sw = await ctx.waitForEvent('serviceworker'); }
  const id = sw.url().split('/')[2];
  const pagina = async function (url) {
    const p = await ctx.newPage();
    p.on('pageerror', function (e) { problemi.push(url + ': ' + e.message); });
    await p.goto(url);
    return p;
  };

  // 1. L'app ha la cassaforte cifrata nella sua memoria
  console.log('Dati dall\'app');
  const app = await pagina(base + '/app/index.html');
  await app.evaluate(async function (a) {
    const c = await Cassaforte.crea(a.pw, { versione: 2, persone: a.famiglia.persone, veicoli: a.famiglia.veicoli, impostazioni: { blocco: 10 } });
    localStorage.setItem('compilatutto.cassaforte', JSON.stringify(c.file));
  }, { pw: PASSWORD, famiglia: FAMIGLIA });
  const imp = await pagina('chrome-extension://' + id + '/impostazioni.html');
  await imp.getByRole('button', { name: 'Prendi i dati dall\'app' }).click();
  await imp.getByText('Fatto:').waitFor({ timeout: 5000 });
  const salvato = await imp.evaluate(async function () { return JSON.stringify(await chrome.storage.local.get('cassaforte')); });
  controlla('nell\'estensione solo dati cifrati', /Rossi|Mario|AB123CD/.test(salvato), false);

  // 2. Password una volta sola, poi due pagine di fila
  console.log('Password e compilazione');
  const modulo = await pagina(base + '/test/moduli/moderno.html');
  const pop = await pagina('chrome-extension://' + id + '/popup.html');
  await pop.fill('#pw', 'password-sbagliata-1');
  await pop.click('#btn-apri');
  await pop.getByText('Password sbagliata').waitFor({ timeout: 15000 });
  await pop.fill('#pw', PASSWORD);
  await pop.click('#btn-apri');
  await pop.locator('#btn-compila').waitFor({ state: 'visible', timeout: 15000 });
  const compila = function (url) {
    return pop.evaluate(async function (u) {
      const t = await chrome.tabs.query({ url: u });
      return compilaScheda(t[0].id, 'p-io');
    }, url);
  };
  const r1 = await compila(base + '/test/moduli/moderno.html');
  controlla('prima pagina: campi compilati', r1.compilati > 5, true);
  const v1 = await modulo.evaluate(function () {
    return [document.querySelector('#a1').value, document.querySelector('#a3').value, document.querySelector('#c5').value, document.querySelector('#c10').value];
  });
  controlla('prima pagina: nome, codice fiscale, coniuge, targa', v1.join('|'), 'Mario|RSSMRA80C12H501E|VRDLCU82A41H501X|AB123CD');
  controlla('la pagina non vede i dati aperti', await modulo.evaluate(function () { return typeof compilaModulo; }), 'undefined');

  await modulo.goto(base + '/test/moduli/relazioni.html');
  const r2 = await compila(base + '/test/moduli/relazioni.html');
  controlla('seconda pagina senza password', r2.chiusa, undefined);
  const v2 = await modulo.evaluate(function () { return [document.querySelector('#r1').value, document.querySelector('[name=cn]').value]; });
  controlla('seconda pagina: richiedente e coniuge', v2.join('|'), 'Mario|Lucia');

  // 3. Elenco dei dati sulla pagina, toccando un campo
  await modulo.goto(base + '/test/moduli/moderno.html');
  await compila(base + '/test/moduli/moderno.html');
  await modulo.click('#c7');
  await modulo.keyboard.type('targa');
  await modulo.keyboard.press('ArrowDown');
  await modulo.keyboard.press('Enter');
  controlla('elenco dei dati: targa nel campo Note', await modulo.inputValue('#c7'), 'AB123CD');

  // 4. Chiusura
  console.log('Chiusura');
  await pop.click('#btn-blocca');
  const r3 = await compila(base + '/test/moduli/moderno.html');
  controlla('dopo la chiusura serve di nuovo la password', r3.chiusa, true);
  controlla('memoria svuotata', await pop.evaluate(async function () { return JSON.stringify(await chrome.storage.session.get(null)); }), '{}');

  problemi.forEach(function (m) { errori++; console.log('  ✗ errore JavaScript: ' + m); });
  await ctx.close();
  s.close();
  fs.rmSync(cartella, { recursive: true, force: true });
  fs.rmSync(profilo, { recursive: true, force: true });
  console.log(errori ? '\n' + errori + ' controlli non riusciti.' : '\nEstensione: tutti i controlli sono riusciti.');
  process.exit(errori ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
