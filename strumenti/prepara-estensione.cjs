/*
 * Copia nell'estensione le parti dell'app che usa anche lei (dati, motore, cifratura).
 * Avvio: npm run estensione. Le prove controllano che le copie siano uguali agli originali.
 */
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..');
const CONDIVISI = ['campi.js', 'motore.js', 'cassaforte.js'];

CONDIVISI.forEach(function (f) {
  fs.copyFileSync(path.join(RADICE, 'app', f), path.join(RADICE, 'estensione', f));
  console.log('Copiato app/' + f + ' → estensione/' + f);
});

module.exports = { CONDIVISI: CONDIVISI };
