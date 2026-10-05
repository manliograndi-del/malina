# Note per Claude

Questo repository contiene **Compilatutto** (cartella `app/`), un'app web che compila moduli online e lettere con i dati personali dell'utente.

## Quando prepari lettere, moduli o autocertificazioni per l'utente

Usa sempre i segnaposti standard tra parentesi quadre, così Compilatutto li riempie da solo:

`[NOME]` `[COGNOME]` `[NOME E COGNOME]` `[SESSO]` `[DATA DI NASCITA]` `[LUOGO DI NASCITA]` `[PROVINCIA DI NASCITA]`
`[STATO DI NASCITA]` `[CODICE FISCALE]` `[CITTADINANZA]` `[NOME PADRE]` `[COGNOME PADRE]` `[NOME MADRE]` `[COGNOME MADRE]`
`[INDIRIZZO]` `[CIVICO]` `[CAP]` `[COMUNE]` `[PROVINCIA]` `[NAZIONE]` `[INDIRIZZO COMPLETO]` `[TELEFONO]` `[EMAIL]` `[PEC]`
`[TIPO DOCUMENTO]` `[NUMERO DOCUMENTO]` `[RILASCIATO DA]` `[DATA RILASCIO]` `[SCADENZA DOCUMENTO]` `[PROFESSIONE]`
`[LUOGO]` `[DATA]` `[LUOGO E DATA]`

- Per dati di altre persone (destinatario, coniuge, ufficio) scrivi segnaposti espliciti come `[Nome destinatario]`: l'app li lascia in giallo da completare a mano.
- Per la firma usa `[Firma]`.
- Va bene anche lo stile delle autocertificazioni con gli spazi: `Il/La sottoscritto/a ________ nato/a a ________ (___) il ________`.

## Sviluppo

- `npm test` prova l'app in Chromium (serve Playwright). Ogni modifica a `app/campi.js` o `app/motore.js` va provata.
- `app/motore.js` diventa il codice del pulsante «Compila»: niente variabili esterne, commenti solo su righe proprie, punto e virgola sempre.
- Testi dell'interfaccia in italiano. Nessuna risorsa esterna (font, script, statistiche): i dati non devono uscire dal dispositivo.
