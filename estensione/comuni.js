/*
 * Compilatutto, estensione – parti comuni a finestrella, impostazioni e servizio.
 * I dati cifrati stanno in chrome.storage.local; quelli aperti solo in chrome.storage.session,
 * che resta in memoria, non è leggibile dalle pagine e si svuota alla chiusura del browser o dopo i minuti scelti.
 */
const ESTENSIONE = {
  indirizziApp: ['https://manliograndi-del.github.io/malina/*'],
  appDaAprire: 'https://manliograndi-del.github.io/malina/',
  chiaveCopia: 'compilatutto.cassaforte',
  minuti: 15,
};

// Dati di riferimento per il motore, come li prepara l'app
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

async function minutiScelti() {
  const s = await chrome.storage.local.get('minuti');
  return Number(s.minuti) || ESTENSIONE.minuti;
}
// Dati aperti, oppure null se la cassaforte è chiusa o il tempo è scaduto
async function leggiSessione() {
  const s = await chrome.storage.session.get(['famiglia', 'scade']);
  if (!s.famiglia || !s.scade || Date.now() > s.scade) {
    await chrome.storage.session.clear();
    return null;
  }
  return s;
}
async function apriSessione(famiglia) {
  const scade = Date.now() + (await minutiScelti()) * 60000;
  await chrome.storage.session.set({ famiglia: famiglia, scade: scade });
  await chrome.alarms.create('blocca', { when: scade });
  return scade;
}
async function prolungaSessione() {
  const s = await leggiSessione();
  return s ? apriSessione(s.famiglia) : null;
}
async function bloccaSessione() {
  await chrome.storage.session.clear();
  await chrome.alarms.clear('blocca');
}

// Compila la scheda: il motore gira nel «mondo isolato» dell'estensione, la pagina vede solo i valori inseriti
async function compilaScheda(tabId, soggetto) {
  const s = await leggiSessione();
  if (!s) { return { chiusa: true }; }
  await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['motore.js'] });
  const risultati = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: function (P, F) {
      const e = compilaModulo(P, F, { scelta: true });
      return { compilati: e.compilati, daCompletare: e.daCompletare };
    },
    args: [Object.assign({}, s.famiglia, { soggetto: soggetto || '' }), costruisciF(true)],
  });
  await prolungaSessione();
  if (soggetto) { await chrome.storage.local.set({ ultimaPersona: soggetto }); }
  return risultati[0] && risultati[0].result ? risultati[0].result : { compilati: 0, daCompletare: 0 };
}

function nomePersona(p) {
  const n = [p.d.nome, p.d.cognome].filter(Boolean).join(' ');
  const r = CT.relazioni.find(function (x) { return x.r === p.rel; });
  return n || (r ? r.e : 'Persona');
}
function oraBreve(ms) {
  const d = new Date(ms);
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}
