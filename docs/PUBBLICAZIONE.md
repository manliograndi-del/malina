# Pubblicare l'estensione

Testi e immagini pronti da copiare nel Chrome Web Store (e, uguali, in Microsoft Edge Add-ons, che è gratuito).

## File da caricare

- **Pacchetto**: zip del contenuto della cartella [`estensione/`](../estensione/) (il file `manifest.json` deve stare nella radice dello zip). Il sito lo pubblica come `compilatutto-estensione.zip`.
- **Icona 128×128**: [`estensione-negozio/icona-128.png`](../estensione-negozio/icona-128.png)
- **Schermate 1280×800**: [`schermata-1.png`](../estensione-negozio/schermata-1.png), [`schermata-2.png`](../estensione-negozio/schermata-2.png), [`schermata-3.png`](../estensione-negozio/schermata-3.png)
- **Riquadro promozionale piccolo 440×280**: [`riquadro-440x280.png`](../estensione-negozio/riquadro-440x280.png)
- **Norme sulla privacy**: https://manliograndi-del.github.io/malina/privacy.html

## Scheda del negozio

**Nome**
Compilatutto

**Descrizione breve** (massimo 132 caratteri)
Compila i moduli sui siti con i dati della tua famiglia. Password una volta sola, dati cifrati che restano sul tuo computer.

**Categoria**: Produttività (Strumenti) · **Lingua**: italiano

**Descrizione**

> Compilatutto riempie per te i moduli sui siti: Comune, INPS, scuola, assicurazioni, negozi online.
>
> • Scrivi la password una volta: vale per tutte le pagine del modulo, poi l'estensione si richiude da sola.
> • Tocca l'icona, premi Alt+Maiusc+K o usa il tasto destro → «Compila con Compilatutto».
> • Riconosce le etichette dei moduli italiani: codice fiscale, «nato a … il …», residenza e domicilio, documento di riconoscimento, paternità e maternità.
> • Compila anche le sezioni dei familiari con la persona giusta: coniuge, figli, alunno, padre e madre. Lascia vuoti i campi di persone che non fanno parte della famiglia.
> • Carta d'identità, passaporto, patente, tessera sanitaria, permesso di soggiorno, IBAN, veicoli.
> • Per un campo rimasto vuoto: toccalo, scrivi «targa» o «passaporto» e scegli il dato dall'elenco.
> • Non invia mai il modulo: i campi compilati diventano verdi, quelli da completare gialli, e controlli tu.
>
> Privacy: i dati restano sul tuo computer, cifrati con la tua password (AES-GCM 256). Nessun server, nessun account, nessuna statistica. I dati si scrivono nell'app gratuita Compilatutto (https://manliograndi-del.github.io/malina/), che li salva cifrati; l'estensione ne prende solo la copia cifrata.

## Scheda «Privacy» del negozio

**Scopo unico**
Riempire i campi dei moduli web con i dati personali e familiari che l'utente ha salvato, cifrati, nell'app Compilatutto.

**Giustificazione dei permessi**

| Permesso | Perché serve |
|---|---|
| `activeTab` | Accedere al modulo della scheda aperta solo quando l'utente tocca l'icona, usa la scorciatoia o il menu col tasto destro. |
| `scripting` | Scrivere i dati nei campi del modulo e mostrare l'elenco dei dati quando l'utente tocca un campo. |
| `storage` | Tenere la copia cifrata dei dati (`storage.local`) e i dati aperti solo in memoria fino alla chiusura automatica (`storage.session`). |
| `contextMenus` | La voce «Compila con Compilatutto» del tasto destro. |
| `alarms` | Richiudere i dati dopo i minuti scelti dall'utente. |
| `https://manliograndi-del.github.io/*` | Leggere, quando l'utente lo chiede, la copia cifrata dei dati dall'app Compilatutto. |

**Codice remoto**: no, tutto il codice è nel pacchetto.

**Uso dei dati**: l'estensione tratta informazioni che identificano la persona (nome, indirizzo, documenti), dati finanziari (IBAN) e sanitari (medico di famiglia, gruppo sanguigno) solo sul dispositivo; non li trasmette agli autori né a terzi. Spunta le tre dichiarazioni: non vendo i dati a terzi; non li uso per scopi diversi dallo scopo unico; non li uso per valutare l'affidabilità creditizia.
