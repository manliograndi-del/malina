/* Compilatutto, estensione – pagina delle impostazioni: collegare i dati, chiusura automatica. */
(function () {
  'use strict';
  const $ = function (s) { return document.querySelector(s); };

  function esito(testo, attenzione) {
    const e = $('#dati-esito');
    e.textContent = testo;
    e.className = 'esito' + (attenzione ? ' attenzione' : '');
  }
  async function disegna() {
    const s = await chrome.storage.local.get(['cassaforte', 'collegata', 'minuti']);
    if (s.cassaforte) {
      const d = new Date(s.collegata || s.cassaforte.modificato);
      $('#dati-stato').textContent = 'Dati collegati il ' + d.toLocaleDateString('it-IT') + ' alle ' + oraBreve(d.getTime()) + ', cifrati.';
      $('#stato').textContent = 'Dati collegati';
      $('#stato').className = 'pillola ok';
    } else {
      $('#dati-stato').textContent = 'Nessun dato collegato.';
      $('#stato').textContent = 'Nessun dato collegato';
      $('#stato').className = 'pillola';
    }
    $('#minuti').value = String(Number(s.minuti) || ESTENSIONE.minuti);
  }
  async function salvaCassaforte(file) {
    Cassaforte.controlla(file);
    await chrome.storage.local.set({ cassaforte: file, collegata: new Date().toISOString() });
    await bloccaSessione();
    await disegna();
  }

  $('#btn-app').addEventListener('click', async function () {
    esito('');
    const schede = await chrome.tabs.query({ url: ESTENSIONE.indirizziApp });
    for (let i = 0; i < schede.length; i++) {
      try {
        const r = await chrome.scripting.executeScript({
          target: { tabId: schede[i].id },
          func: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
          args: [ESTENSIONE.chiaveCopia],
        });
        const testo = r[0] && r[0].result;
        if (testo) {
          await salvaCassaforte(JSON.parse(testo));
          esito('Fatto: ho preso la copia cifrata dei tuoi dati. Ora tocca l\'icona di Compilatutto su un modulo.');
          return;
        }
      } catch (e) { /* provo la scheda successiva */ }
    }
    esito(schede.length
      ? 'Ho trovato l\'app aperta, ma senza dati salvati. Crea la cassaforte nell\'app e riprova.'
      : 'Non trovo l\'app aperta. Tocca «Apri l\'app», apri la cassaforte e poi torna qui.', true);
  });
  $('#btn-apri-app').addEventListener('click', function () { chrome.tabs.create({ url: ESTENSIONE.appDaAprire }); });
  $('#file').addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) { return; }
    const r = new FileReader();
    r.onload = async function () {
      try {
        await salvaCassaforte(JSON.parse(String(r.result || '')));
        esito('Fatto: file collegato. Ora tocca l\'icona di Compilatutto su un modulo.');
      } catch (x) {
        esito('Questo file non è una cassaforte di Compilatutto.', true);
      }
    };
    r.readAsText(f);
  });
  $('#minuti').addEventListener('change', async function () {
    await chrome.storage.local.set({ minuti: Number($('#minuti').value) });
    await prolungaSessione();
  });
  $('#btn-scollega').addEventListener('click', async function () {
    await chrome.storage.local.remove(['cassaforte', 'collegata', 'ultimaPersona']);
    await bloccaSessione();
    await disegna();
    esito('Dati scollegati dall\'estensione.');
  });
  chrome.commands.getAll(function (cs) {
    const c = (cs || []).find(function (x) { return x.name === 'compila'; });
    if (c && c.shortcut) { $('#scorciatoia').textContent = c.shortcut.replace('Shift', 'Maiusc'); }
  });
  disegna();
})();
