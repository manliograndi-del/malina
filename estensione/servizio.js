/* Compilatutto, estensione – servizio in background: menu col tasto destro, scorciatoia, chiusura automatica. */
importScripts('campi.js', 'comuni.js');

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({ id: 'compila', title: 'Compila con Compilatutto', contexts: ['page', 'editable', 'frame'] });
});

chrome.alarms.onAlarm.addListener(function (a) {
  if (a.name === 'blocca') { bloccaSessione(); }
});

// Dal menu o dalla scorciatoia: se la cassaforte è aperta compila, altrimenti apre la finestrella per la password
async function daComando(tab) {
  if (!tab || !tab.id) { return; }
  const s = await leggiSessione();
  if (!s) {
    try { await chrome.action.openPopup(); } catch (e) {
      await chrome.action.setBadgeText({ text: '!', tabId: tab.id });
      await chrome.action.setBadgeBackgroundColor({ color: '#b42318' });
    }
    return;
  }
  const u = await chrome.storage.local.get('ultimaPersona');
  try { await compilaScheda(tab.id, u.ultimaPersona); } catch (e) { /* pagina che il browser non lascia compilare */ }
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'compila') { daComando(tab); }
});
chrome.commands.onCommand.addListener(function (comando, tab) {
  if (comando === 'compila') { daComando(tab); }
});
