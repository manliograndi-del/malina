/*
 * Compilatutto – cassaforte cifrata.
 *
 * I dati sono cifrati con AES-GCM (256 bit) usando una chiave dati casuale.
 * La chiave dati è a sua volta cifrata due volte: con la password e con il codice di recupero
 * (chiavi ricavate con PBKDF2-SHA256). Nulla esce dal dispositivo: il file resta sul computer
 * e una copia, sempre cifrata, resta nel browser.
 */
const Cassaforte = (function () {
  'use strict';

  const FORMATO = 'compilatutto-cassaforte';
  const RIP_PASSWORD = 600000;
  const RIP_CODICE = 100000;
  const CHIAVE_COPIA = 'compilatutto.cassaforte';
  const NOME_FILE = 'famiglia.compilatutto';
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const inCornice = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  const disponibile = !!(window.crypto && window.crypto.subtle);
  const fileSupportati = !inCornice && typeof window.showSaveFilePicker === 'function';

  function b64(buf) {
    const u = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) { s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); }
    return btoa(s);
  }
  function daB64(s) {
    const b = atob(s);
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) { u[i] = b.charCodeAt(i); }
    return u;
  }
  function casuale(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function adesso() { return new Date().toISOString(); }

  async function chiaveDa(segreto, sale, ripetizioni) {
    const base = await crypto.subtle.importKey('raw', enc.encode(String(segreto).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: ripetizioni }, base,
      { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']);
  }
  async function chiudi(chiaveDati, segreto, tipo, ripetizioni) {
    const sale = casuale(16);
    const iv = casuale(12);
    const k = await chiaveDa(segreto, sale, ripetizioni);
    const avvolta = await crypto.subtle.wrapKey('raw', chiaveDati, k, { name: 'AES-GCM', iv: iv });
    return { tipo: tipo, kdf: 'PBKDF2-SHA256', ripetizioni: ripetizioni, sale: b64(sale), iv: b64(iv), chiave: b64(avvolta) };
  }
  async function apriChiave(slot, segreto) {
    const k = await chiaveDa(segreto, daB64(slot.sale), slot.ripetizioni);
    return crypto.subtle.unwrapKey('raw', daB64(slot.chiave), k, { name: 'AES-GCM', iv: daB64(slot.iv) },
      { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }
  async function cifra(chiaveDati, dati) {
    const iv = casuale(12);
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, chiaveDati, enc.encode(JSON.stringify(dati)));
    return { iv: b64(iv), dati: b64(c) };
  }
  async function decifra(chiaveDati, contenuto) {
    const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(contenuto.iv) }, chiaveDati, daB64(contenuto.dati));
    return JSON.parse(dec.decode(p));
  }

  // Codice di recupero: 32 caratteri (160 bit) in gruppi da 4, senza lettere che si confondono
  const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function nuovoCodice() {
    const b = casuale(20);
    let bit = 0;
    let val = 0;
    let out = '';
    for (let i = 0; i < b.length; i++) {
      val = ((val << 8) | b[i]) & 0xffff;
      bit += 8;
      while (bit >= 5) {
        out += ALFABETO.charAt((val >>> (bit - 5)) & 31);
        bit -= 5;
      }
    }
    return out.match(/.{4}/g).join('-');
  }
  function normalizzaCodice(c) {
    return String(c || '').toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
  }

  function controlla(file) {
    if (!file || file.formato !== FORMATO || !Array.isArray(file.chiavi) || !file.contenuto) {
      throw new Error('formato');
    }
  }

  async function crea(password, dati) {
    const chiaveDati = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const codice = nuovoCodice();
    const ora = adesso();
    const file = {
      formato: FORMATO, versione: 2, creato: ora, modificato: ora,
      chiavi: [
        await chiudi(chiaveDati, password, 'password', RIP_PASSWORD),
        await chiudi(chiaveDati, normalizzaCodice(codice), 'recupero', RIP_CODICE),
      ],
      contenuto: await cifra(chiaveDati, dati),
    };
    return { file: file, chiaveDati: chiaveDati, codice: codice };
  }
  // tipo: 'password' oppure 'recupero'. Lancia Error('sbagliata') se il segreto non è giusto.
  async function apri(file, segreto, tipo) {
    controlla(file);
    const slot = file.chiavi.find(function (s) { return s.tipo === (tipo || 'password'); });
    if (!slot) { throw new Error('formato'); }
    let chiaveDati;
    try {
      chiaveDati = await apriChiave(slot, tipo === 'recupero' ? normalizzaCodice(segreto) : segreto);
    } catch (e) {
      throw new Error('sbagliata');
    }
    return { chiaveDati: chiaveDati, dati: await decifra(chiaveDati, file.contenuto) };
  }
  async function aggiorna(file, chiaveDati, dati) {
    return Object.assign({}, file, { modificato: adesso(), contenuto: await cifra(chiaveDati, dati) });
  }
  async function cambiaPassword(file, chiaveDati, nuova) {
    const slot = await chiudi(chiaveDati, nuova, 'password', RIP_PASSWORD);
    return Object.assign({}, file, { modificato: adesso(), chiavi: file.chiavi.filter(function (s) { return s.tipo !== 'password'; }).concat([slot]) });
  }
  async function rinnovaCodice(file, chiaveDati) {
    const codice = nuovoCodice();
    const slot = await chiudi(chiaveDati, normalizzaCodice(codice), 'recupero', RIP_CODICE);
    const nuovo = Object.assign({}, file, { modificato: adesso(), chiavi: file.chiavi.filter(function (s) { return s.tipo !== 'recupero'; }).concat([slot]) });
    return { file: nuovo, codice: codice };
  }
  async function verificaPassword(file, password) {
    try { await apriChiave(file.chiavi.find(function (s) { return s.tipo === 'password'; }), password); return true; } catch (e) { return false; }
  }

  // Dati per il pulsante «Compila»: cifrati con una chiave ricavata dalla password
  async function cifraPerPulsante(password, dati) {
    const sale = casuale(16);
    const iv = casuale(12);
    const k = await chiaveDa(password, sale, RIP_PASSWORD);
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(dati)));
    return { v: 2, r: RIP_PASSWORD, s: b64(sale), i: b64(iv), d: b64(c) };
  }

  // Copia cifrata nel browser
  function leggiCopia() {
    try {
      const s = localStorage.getItem(CHIAVE_COPIA);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function scriviCopia(file) {
    try { localStorage.setItem(CHIAVE_COPIA, JSON.stringify(file)); return true; } catch (e) { return false; }
  }
  function cancellaCopia() {
    try { localStorage.removeItem(CHIAVE_COPIA); } catch (e) { /* niente da cancellare */ }
  }

  // File sul computer (Chrome ed Edge): il collegamento al file resta in IndexedDB
  function db() {
    return new Promise(function (ok, ko) {
      const r = indexedDB.open('compilatutto', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('varie'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }
  async function idb(azione, valore) {
    const d = await db();
    return new Promise(function (ok, ko) {
      const t = d.transaction('varie', azione === 'leggi' ? 'readonly' : 'readwrite');
      const s = t.objectStore('varie');
      const r = azione === 'leggi' ? s.get('file') : (azione === 'scrivi' ? s.put(valore, 'file') : s.delete('file'));
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }
  async function fileCollegato() {
    if (!fileSupportati) { return null; }
    try { return (await idb('leggi')) || null; } catch (e) { return null; }
  }
  async function scollegaFile() { try { await idb('cancella'); } catch (e) { /* già scollegato */ } }
  async function permesso(handle, chiedi) {
    const o = { mode: 'readwrite' };
    try {
      if ((await handle.queryPermission(o)) === 'granted') { return true; }
      if (!chiedi) { return false; }
      return (await handle.requestPermission(o)) === 'granted';
    } catch (e) { return false; }
  }
  function testoFile(file) { return JSON.stringify(file, null, 1); }
  async function scriviFile(handle, file) {
    const w = await handle.createWritable();
    await w.write(testoFile(file));
    await w.close();
  }
  async function leggiFile(handle) {
    const f = await handle.getFile();
    return JSON.parse(await f.text());
  }
  async function scegliDoveSalvare() {
    const h = await window.showSaveFilePicker({
      suggestedName: NOME_FILE,
      types: [{ description: 'Cassaforte Compilatutto', accept: { 'application/json': ['.compilatutto'] } }],
    });
    await idb('scrivi', h);
    return h;
  }
  async function scegliDaAprire() {
    const hs = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Cassaforte Compilatutto', accept: { 'application/json': ['.compilatutto', '.json'] } }],
    });
    await idb('scrivi', hs[0]);
    return hs[0];
  }

  return {
    disponibile: disponibile,
    fileSupportati: fileSupportati,
    NOME_FILE: NOME_FILE,
    crea: crea,
    apri: apri,
    aggiorna: aggiorna,
    cambiaPassword: cambiaPassword,
    rinnovaCodice: rinnovaCodice,
    verificaPassword: verificaPassword,
    cifraPerPulsante: cifraPerPulsante,
    controlla: controlla,
    leggiCopia: leggiCopia,
    scriviCopia: scriviCopia,
    cancellaCopia: cancellaCopia,
    fileCollegato: fileCollegato,
    scollegaFile: scollegaFile,
    permesso: permesso,
    scriviFile: scriviFile,
    leggiFile: leggiFile,
    testoFile: testoFile,
    scegliDoveSalvare: scegliDoveSalvare,
    scegliDaAprire: scegliDaAprire,
  };
})();
