/* Compilatutto, estensione – finestrella dell'icona. */
(function () {
  'use strict';
  const $ = function (s) { return document.querySelector(s); };

  async function schedaAttiva() {
    const t = await chrome.tabs.query({ active: true, currentWindow: true });
    return t[0] || null;
  }
  function mostra(id) {
    ['vuoto', 'chiuso', 'aperto'].forEach(function (s) { $('#' + s).hidden = s !== id; });
    $('#stato').textContent = id === 'aperto' ? 'Aperta' : 'Chiusa';
    $('#stato').className = 'pillola' + (id === 'aperto' ? ' ok' : '');
  }
  async function disegna() {
    const locale = await chrome.storage.local.get(['cassaforte', 'ultimaPersona']);
    if (!locale.cassaforte) { mostra('vuoto'); return; }
    const s = await leggiSessione();
    if (!s) {
      mostra('chiuso');
      $('#pw').focus();
      return;
    }
    const sel = $('#persona');
    sel.textContent = '';
    const ordine = { io: 0, coniuge: 1, figlio: 2, padre: 3, madre: 4, altro: 5 };
    s.famiglia.persone.slice().sort(function (a, b) { return (a.rel in ordine ? ordine[a.rel] : 9) - (b.rel in ordine ? ordine[b.rel] : 9); }).forEach(function (p) {
      const r = CT.relazioni.find(function (x) { return x.r === p.rel; });
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = nomePersona(p) + (p.rel !== 'io' && r ? ' (' + r.e.toLowerCase() + ')' : '');
      sel.appendChild(o);
    });
    if (locale.ultimaPersona && s.famiglia.persone.some(function (p) { return p.id === locale.ultimaPersona; })) { sel.value = locale.ultimaPersona; }
    $('#scadenza').textContent = 'Si chiude da sola alle ' + oraBreve(s.scade) + ' (ogni compilazione sposta l\'orario più avanti).';
    mostra('aperto');
  }

  $('#chiuso').addEventListener('submit', async function (e) {
    e.preventDefault();
    const pw = $('#pw').value;
    if (!pw) { $('#errore').textContent = 'Scrivi la password.'; return; }
    const b = $('#btn-apri');
    b.disabled = true;
    b.textContent = 'Apro…';
    $('#errore').textContent = '';
    try {
      const { cassaforte } = await chrome.storage.local.get('cassaforte');
      const r = await Cassaforte.apri(cassaforte, pw, 'password');
      $('#pw').value = '';
      await apriSessione({ persone: r.dati.persone || [], veicoli: r.dati.veicoli || [] });
      await disegna();
    } catch (x) {
      $('#errore').textContent = x && x.message === 'sbagliata' ? 'Password sbagliata. Riprova.' : 'I dati collegati non si aprono: collegali di nuovo dalle impostazioni.';
      $('#pw').select();
    } finally {
      b.disabled = false;
      b.textContent = 'Apri';
    }
  });

  $('#btn-compila').addEventListener('click', async function () {
    const esito = $('#esito');
    esito.className = 'esito';
    esito.textContent = 'Compilo…';
    const t = await schedaAttiva();
    if (!t) { esito.textContent = ''; return; }
    try {
      const r = await compilaScheda(t.id, $('#persona').value);
      if (r.chiusa) { await disegna(); return; }
      esito.textContent = r.compilati + (r.compilati === 1 ? ' campo compilato' : ' campi compilati') +
        (r.daCompletare ? ', ' + r.daCompletare + ' da completare (in giallo).' : '.');
      if (!r.compilati) { esito.className = 'esito attenzione'; esito.textContent = 'Non ho trovato campi da riempire: tocca un campo sulla pagina per scegliere il dato dall\'elenco.'; }
      const s = await leggiSessione();
      if (s) { $('#scadenza').textContent = 'Si chiude da sola alle ' + oraBreve(s.scade) + '.'; }
    } catch (x) {
      esito.className = 'esito attenzione';
      esito.textContent = 'Su questa pagina il browser non lascia compilare (pagine interne del browser o del negozio delle estensioni).';
    }
  });

  $('#btn-blocca').addEventListener('click', async function () { await bloccaSessione(); await disegna(); });
  $('#btn-collega').addEventListener('click', function () { chrome.runtime.openOptionsPage(); window.close(); });
  $('#btn-impostazioni').addEventListener('click', function () { chrome.runtime.openOptionsPage(); window.close(); });

  chrome.commands.getAll(function (cs) {
    const c = (cs || []).find(function (x) { return x.name === 'compila'; });
    if (c && c.shortcut) { $('#scorciatoia').textContent = c.shortcut.replace('Shift', 'Maiusc'); }
  });
  schedaAttiva().then(function (t) { if (t) { chrome.action.setBadgeText({ text: '', tabId: t.id }); } });
  disegna();
})();
