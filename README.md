# Compilatutto

Scrivi i tuoi dati una volta sola (nome, codice fiscale, nome del padre, residenza, documento…) e usali per:

- **compilare i moduli su internet** con un pulsante «Compila» tra i preferiti del browser;
- **completare lettere e moduli** che contengono segnaposti come `[NOME PADRE]` o spazi come `nato a ________`;
- **copiare al volo** un dato da incollare in qualsiasi app.

Funziona su **Windows** e **Android** (e anche su Mac, Linux e iPhone): è una pagina web che si installa come un'app.
Ogni persona inserisce i propri dati sul proprio dispositivo, e si possono avere più profili (per esempio genitore e figli).

## Come si usa

### 1. I miei dati
Apri l'app e scrivi i tuoi dati. Il codice fiscale viene controllato e, se vuoi, l'app ricava da lì data di nascita e sesso.
Per un figlio crea un nuovo profilo e scegli «Figlio / alunno»: nei moduli della scuola verranno riempiti i campi dell'alunno e non quelli del genitore.

### 2. Moduli online
- **Computer (Chrome, Edge, Firefox):** mostra la barra dei preferiti (`Ctrl` + `Maiusc` + `B`) e trascina lì il pulsante **Compila**. Sul sito del modulo, clicca **Compila**.
- **Android (Chrome):** tocca «Copia il codice del pulsante», salva una pagina qualsiasi nei preferiti, modificala: nome **Compila**, indirizzo = il codice copiato. Sul modulo scrivi «Compila» nella barra degli indirizzi e tocca il preferito.

I campi riconosciuti diventano verdi, quelli da completare a mano gialli. **Il modulo non viene mai inviato**: controlli e invii tu.
Se cambi i tuoi dati, rifai il pulsante (l'app te lo ricorda).

### 3. Lettere e documenti
Incolla il testo e tocca **Completa**. Riconosce:
- i segnaposti tra parentesi quadre o graffe: `[CODICE FISCALE]`, `{{nome padre}}`;
- gli spazi da riempire tipici delle autocertificazioni: `Il/La sottoscritto/a ______ nato/a a ______ (___) il ______`;
- adatta `nato/a`, `Il/La`, `figlio/a` al sesso del profilo.

Poi puoi copiare il testo (con la formattazione), scaricarlo per Word o stamparlo.

### 4. Copia rapida
Tocca un dato per copiarlo. Serve nelle app che non sono un browser o nei moduli che il pulsante non riconosce.

## Segnaposti standard

Quando chiedi a Claude (o a chiunque) di prepararti una lettera, fagli usare questi segnaposti: Compilatutto li riempie da solo.

| Segnaposto | Dato |
|---|---|
| `[NOME]`, `[COGNOME]`, `[NOME E COGNOME]` | nome e cognome |
| `[SESSO]`, `[DATA DI NASCITA]`, `[LUOGO DI NASCITA]`, `[PROVINCIA DI NASCITA]`, `[STATO DI NASCITA]` | nascita |
| `[CODICE FISCALE]`, `[CITTADINANZA]` | |
| `[NOME PADRE]`, `[COGNOME PADRE]`, `[NOME MADRE]`, `[COGNOME MADRE]` | genitori |
| `[INDIRIZZO]`, `[CIVICO]`, `[CAP]`, `[COMUNE]`, `[PROVINCIA]`, `[NAZIONE]`, `[INDIRIZZO COMPLETO]` | residenza |
| `[TELEFONO]`, `[EMAIL]`, `[PEC]` | contatti |
| `[TIPO DOCUMENTO]`, `[NUMERO DOCUMENTO]`, `[RILASCIATO DA]`, `[DATA RILASCIO]`, `[SCADENZA DOCUMENTO]` | documento |
| `[PROFESSIONE]` | lavoro |
| `[LUOGO]`, `[DATA]`, `[LUOGO E DATA]` | comune di residenza e data di oggi |

Anche i «dati in più» che aggiungi tu (IBAN, targa…) si possono usare: `[IBAN]`.

## Privacy

- I dati restano nel browser del dispositivo (localStorage). L'app non ha un server e non li invia a nessuno.
- Il pulsante «Compila» contiene una copia dei dati: chi usa il tuo browser, o i preferiti sincronizzati, può vederli.
- Il file esportato contiene i tuoi dati: tienilo al sicuro.
- Password e carte di credito non vanno qui: usa il gestore password del browser.

## Limiti

- Su alcuni siti molto protetti il browser può bloccare il pulsante «Compila». In quel caso usa la Copia rapida.
- I menu a tendina «finti» (fatti con riquadri e non con un vero menu) a volte non si riescono a scegliere: restano gialli.
- Le app Android che non sono un browser (per esempio l'app di una banca) non si compilano da sole: usa la Copia rapida.

## Metterla online

L'app è nella cartella [`app/`](app/): sono file statici, basta pubblicarli su un sito con indirizzo `https://`.

**Con GitHub Pages** (già pronto in [`.github/workflows/pubblica-app.yml`](.github/workflows/pubblica-app.yml)):
1. Con un account GitHub gratuito il repository deve essere **pubblico** (Settings → General → Change visibility). Il codice non contiene dati personali.
2. Settings → Pages → Source: **GitHub Actions**.
3. A ogni modifica di `app/` sul ramo `main` l'app viene provata e pubblicata su `https://<utente>.github.io/<repository>/`.

**In alternativa** trascina la cartella `app/` su [Netlify Drop](https://app.netlify.com/drop) o su Cloudflare Pages.

Poi apri l'indirizzo:
- su **Windows** con Edge: menu ⋯ → «App» → «Installa questo sito come app»; con Chrome: l'icona di installazione a destra nella barra degli indirizzi;
- su **Android** con Chrome: menu ⋮ → «Installa app» o «Aggiungi a schermata Home».

Per spostare i dati tra computer e telefono: «Esporta file» su uno, «Importa file» sull'altro.

## Per chi sviluppa

```bash
npm run avvia    # apre l'app su http://localhost:8080
npm install && npm test   # prova automatica in Chromium
```

- [`app/campi.js`](app/campi.js): i dati e le parole con cui i moduli li chiamano. Per insegnare all'app una nuova etichetta basta aggiungerla qui.
- [`app/motore.js`](app/motore.js): riconosce e riempie i campi. Deve restare una funzione autosufficiente perché diventa il codice del pulsante.
- [`app/app.js`](app/app.js): l'interfaccia.
- [`test/moduli/`](test/moduli/): moduli di prova; ogni campo dichiara il valore atteso in `data-atteso`.
