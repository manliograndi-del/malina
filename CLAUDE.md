# Note per Claude

Questo repository contiene **Compilatutto** (cartella `app/`), un'app web che compila moduli online, PDF e lettere con i dati di una famiglia, cifrati e salvati solo sul dispositivo. L'impostazione è in [`docs/ARCHITETTURA.md`](docs/ARCHITETTURA.md).

## Stato dei lavori (versione 2)

Pronte e provate (`npm test`): `campi.js`, `motore.js`, `cassaforte.js`, `pulsante.js`, `moduli-pdf.js`, `lib/pdf-lib.min.js`, `index.html`, `stile.css` e `app.js`, che collega le schermate alle altre parti:

- avvio: crea la cassaforte, mostra il codice di recupero, sblocco con password o codice, apertura di un file; i dati in chiaro della versione 1 (`localStorage['compilatutto.v1']`) vanno nella cassaforte e poi vengono cancellati;
- salvataggio cifrato a ogni modifica (copia nel browser e file sul computer se collegato), chiusura automatica dopo i minuti scelti;
- Famiglia, Siti web (pulsante cifrato e modulo di prova), PDF, Lettere, Cerca e copia, Sicurezza.

I dati per il motore si preparano con `costruisciF` (uguale in `app.js` e `test/prova.cjs`).

## Quando prepari lettere, moduli o autocertificazioni per l'utente

Usa i segnaposti tra parentesi quadre, così Compilatutto li riempie da solo:

`[NOME]` `[COGNOME]` `[NOME E COGNOME]` `[SESSO]` `[DATA DI NASCITA]` `[LUOGO DI NASCITA]` `[PROVINCIA DI NASCITA]`
`[STATO DI NASCITA]` `[CODICE FISCALE]` `[CITTADINANZA]` `[STATO CIVILE]` `[NOME PADRE]` `[COGNOME PADRE]` `[NOME MADRE]` `[COGNOME MADRE]`
`[INDIRIZZO]` `[CIVICO]` `[CAP]` `[COMUNE]` `[PROVINCIA]` `[NAZIONE]` `[INDIRIZZO COMPLETO]` `[TELEFONO]` `[TELEFONO FISSO]` `[EMAIL]` `[PEC]`
`[TIPO DOCUMENTO]` `[NUMERO DOCUMENTO]` `[RILASCIATO DA]` `[DATA RILASCIO]` `[SCADENZA DOCUMENTO]`
`[NUMERO CARTA IDENTITA]` `[NUMERO PASSAPORTO]` `[SCADENZA PASSAPORTO]` `[NUMERO PATENTE]` `[NUMERO TESSERA SANITARIA]`
`[PROFESSIONE]` `[DATORE DI LAVORO]` `[TITOLO DI STUDIO]` `[IBAN]` `[TARGA]` `[MARCA]` `[MODELLO]` `[TELAIO]` `[LUOGO]` `[DATA]` `[LUOGO E DATA]`

- Per le altre persone della famiglia aggiungi chi è: `[NOME CONIUGE]`, `[CODICE FISCALE CONIUGE]`, `[NOME FIGLIO]`, `[DATA DI NASCITA FIGLIO]`.
- Per persone fuori dalla famiglia (destinatario, ufficio, delegato) scrivi segnaposti espliciti come `[Nome destinatario]`: l'app li lascia in giallo da completare a mano.
- Per la firma usa `[Firma]`.
- Va bene anche lo stile delle autocertificazioni con gli spazi: `Il/La sottoscritto/a ________ nato/a a ________ (___) il ________`.

## Sviluppo

- `npm test` prova in Chromium (serve Playwright) motore, pulsante, cassaforte, lettere e PDF. Ogni modifica a `campi.js` o `motore.js` va provata.
- `app/motore.js` e `app/pulsante.js` diventano il codice del pulsante «Compila»: niente variabili esterne, commenti solo su righe proprie, punto e virgola sempre.
- Testi dell'interfaccia in italiano. Nessuna risorsa esterna (font, script, statistiche): i dati non devono uscire dal dispositivo.
- I dati personali non vanno mai salvati in chiaro: né nel browser, né nel pulsante, né nel repository.
