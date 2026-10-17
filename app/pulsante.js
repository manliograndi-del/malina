// Compilatutto: il pulsante «Compila» nei preferiti.
// Chiede la password sulla pagina del modulo, decifra i dati, fa scegliere la persona e avvia il motore.
// Come motore.js deve restare autosufficiente: diventa parte del codice del preferito.
//
// B   dati cifrati { v, r: ripetizioni, s: sale, i: iv, d: dati } (base64)
// F   dati di riferimento (vedi campi.js)
// M   la funzione compilaModulo
function avviaCompilatutto(B, F, M) {
  const doc = document;
  const vecchio = doc.querySelector('[data-compilatutto-sblocco]');
  if (vecchio) { vecchio.remove(); }
  const host = doc.createElement('div');
  host.setAttribute('data-compilatutto-sblocco', '');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647';
  const ombra = host.attachShadow({ mode: 'open' });
  const stile = doc.createElement('style');
  stile.textContent = [
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.sfondo{position:fixed;inset:0;background:rgba(14,18,32,.55);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.scheda{width:100%;max-width:380px;background:#fff;color:#161b2e;border-radius:14px;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35);display:grid;gap:12px}',
    'h2{margin:0;font-size:18px;color:#2742b0}',
    'p{margin:0;font-size:14px;line-height:1.45;color:#3a4256}',
    'input{font:inherit;font-size:16px;width:100%;padding:10px 12px;border:1px solid #aab3c5;border-radius:8px;color:#161b2e;background:#fff}',
    'input:focus{outline:2px solid #2742b0;border-color:#2742b0}',
    '.nascosta{-webkit-text-security:disc}',
    '.errore{color:#b42318;font-size:13px;min-height:1em}',
    '.azioni{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}',
    'button{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border-radius:8px;padding:9px 14px;border:1px solid #aab3c5;background:#fff;color:#161b2e}',
    '.primario{background:#2742b0;border-color:#2742b0;color:#fff}',
    'button:disabled{opacity:.6;cursor:wait}',
    '.persone{display:grid;gap:8px}',
    '.persona{text-align:left;display:grid;gap:2px;padding:10px 12px}',
    '.persona span{font-weight:400;font-size:13px;color:#586078}',
  ].join('');
  ombra.appendChild(stile);
  const crea = function (tag, cls, txt) {
    const e = doc.createElement(tag);
    if (cls) { e.className = cls; }
    if (txt != null) { e.textContent = txt; }
    return e;
  };
  const sfondo = crea('div', 'sfondo');
  const scheda = crea('div', 'scheda');
  scheda.setAttribute('role', 'dialog');
  scheda.setAttribute('aria-label', 'Compilatutto');
  sfondo.appendChild(scheda);
  ombra.appendChild(sfondo);
  const chiudi = function () { host.remove(); };
  const svuota = function () { scheda.textContent = ''; };
  sfondo.addEventListener('keydown', function (e) { if (e.key === 'Escape') { chiudi(); } });

  // Il campo password non è di tipo «password» quando si può evitarlo:
  // così il browser non propone di salvare la password di Compilatutto sul sito che stai compilando.
  const senzaGestore = !!(window.CSS && CSS.supports && CSS.supports('-webkit-text-security', 'disc'));
  const daB64 = function (s) {
    const b = atob(s);
    const u = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) { u[i] = b.charCodeAt(i); }
    return u;
  };
  const nomeDi = function (p) {
    const n = [p.d.nome, p.d.cognome].filter(Boolean).join(' ');
    const r = (F.relazioni || []).find(function (x) { return x.r === p.rel; });
    return { nome: n || (r ? r.e : 'Persona'), rel: r ? r.e : '' };
  };

  const avvia = function (P, soggetto, figlio) {
    chiudi();
    M(Object.assign({}, P, { soggetto: soggetto, figlio: figlio }), F, { scelta: true });
  };
  const sceltaFiglio = function (P, soggetto) {
    const figli = P.persone.filter(function (p) { return p.rel === 'figlio'; });
    svuota();
    scheda.appendChild(crea('h2', '', 'Quale figlio?'));
    scheda.appendChild(crea('p', '', 'Se il modulo chiede i dati di un figlio o di un alunno, quale uso?'));
    const box = crea('div', 'persone');
    figli.forEach(function (f) {
      const n = nomeDi(f);
      const b = crea('button', 'persona', n.nome);
      b.type = 'button';
      b.addEventListener('click', function () { avvia(P, soggetto, f.id); });
      box.appendChild(b);
    });
    scheda.appendChild(box);
    box.querySelector('button').focus();
  };
  const sceltaPersona = function (P) {
    const ps = (P.persone || []).slice().sort(function (a, b) { return (a.rel === 'io' ? 0 : 1) - (b.rel === 'io' ? 0 : 1); });
    if (ps.length <= 1) { avvia(P, ps[0] ? ps[0].id : '', ''); return; }
    svuota();
    scheda.appendChild(crea('h2', '', 'Per chi compili questo modulo?'));
    scheda.appendChild(crea('p', '', 'Scegli chi presenta la domanda. I dati del coniuge, dei figli e dei genitori li prendo dalle loro schede.'));
    const box = crea('div', 'persone');
    ps.forEach(function (p) {
      const n = nomeDi(p);
      const b = crea('button', 'persona');
      b.type = 'button';
      b.appendChild(doc.createTextNode(n.nome));
      b.appendChild(crea('span', '', n.rel));
      b.addEventListener('click', function () {
        const figli = ps.filter(function (x) { return x.rel === 'figlio'; });
        if (p.rel !== 'figlio' && figli.length > 1) { sceltaFiglio(P, p.id); } else { avvia(P, p.id, ''); }
      });
      box.appendChild(b);
    });
    scheda.appendChild(box);
    const az = crea('div', 'azioni');
    const annulla = crea('button', '', 'Annulla');
    annulla.type = 'button';
    annulla.addEventListener('click', chiudi);
    az.appendChild(annulla);
    scheda.appendChild(az);
    box.querySelector('button').focus();
  };

  scheda.appendChild(crea('h2', '', 'Compilatutto'));
  if (!window.crypto || !window.crypto.subtle) {
    scheda.appendChild(crea('p', '', 'Questa pagina non è protetta (l\'indirizzo inizia con http://): per sicurezza qui il pulsante non apre i tuoi dati. Usa «Cerca e copia» nell\'app.'));
    const az0 = crea('div', 'azioni');
    const ok0 = crea('button', 'primario', 'Ho capito');
    ok0.type = 'button';
    ok0.addEventListener('click', chiudi);
    az0.appendChild(ok0);
    scheda.appendChild(az0);
    (doc.body || doc.documentElement).appendChild(host);
    ok0.focus();
    return;
  }
  scheda.appendChild(crea('p', '', 'Scrivi la password di Compilatutto per usare i tuoi dati su questa pagina. Il modulo non verrà inviato.'));
  const pw = crea('input', senzaGestore ? 'nascosta' : '');
  pw.type = senzaGestore ? 'text' : 'password';
  pw.setAttribute('autocomplete', 'off');
  pw.setAttribute('autocapitalize', 'off');
  pw.setAttribute('spellcheck', 'false');
  pw.setAttribute('aria-label', 'Password di Compilatutto');
  pw.name = 'ct-' + Math.random().toString(36).slice(2);
  const errore = crea('div', 'errore');
  errore.setAttribute('role', 'alert');
  const az = crea('div', 'azioni');
  const annulla = crea('button', '', 'Annulla');
  const apri = crea('button', 'primario', 'Sblocca');
  annulla.type = 'button';
  apri.type = 'button';
  az.appendChild(annulla);
  az.appendChild(apri);
  scheda.appendChild(pw);
  scheda.appendChild(errore);
  scheda.appendChild(az);
  (doc.body || doc.documentElement).appendChild(host);
  pw.focus();

  const sblocca = async function () {
    if (!pw.value) { errore.textContent = 'Scrivi la password.'; return; }
    apri.disabled = true;
    apri.textContent = 'Sblocco…';
    errore.textContent = '';
    let P = null;
    try {
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw.value.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
      const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: daB64(B.s), iterations: B.r }, base,
        { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daB64(B.i) }, k, daB64(B.d));
      P = JSON.parse(new TextDecoder().decode(chiaro));
    } catch (e) {
      apri.disabled = false;
      apri.textContent = 'Sblocca';
      errore.textContent = 'Password sbagliata. Riprova.';
      pw.select();
      return;
    }
    pw.value = '';
    sceltaPersona(P);
  };
  apri.addEventListener('click', sblocca);
  annulla.addEventListener('click', chiudi);
  pw.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); sblocca(); }
  });
}
