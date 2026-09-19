# Progetto: chat a due con Claude su chiamata

## Che cos'è

Una chat privata tra due persone in cui Claude interviene **solo quando viene
chiamato** scrivendo `@claude` in un messaggio.

Non è un sito web e non è un'app con backend. È **una singola pagina HTML
pubblicata come Artifact su claude.ai**, che usa le capability del runtime degli
Artifact per archivio condiviso, identità dei partecipanti e chiamata al modello.

File del progetto: `index.html` (o `chat-a-tre.html`). Un solo file, nient'altro.

---

## Vincolo che decide tutto: dove gira il codice

Il codice funziona **soltanto** dentro il visualizzatore di claude.ai, perché
dipende da `window.claude`. Fuori da lì:

- aperto in un browser locale (`file://`, `localhost`, qualsiasi altro host)
  `window.claude` **non esiste affatto**;
- servito dalla piattaforma come pagina top-level, `window.claude` esiste ma
  ogni `use()` risolve `null`.

**Conseguenze operative, da rispettare sempre:**

1. Non esiste test in locale. Aprire il file in un browser mostra una chat
   morta: è il comportamento atteso, non un bug da "riparare".
2. Non proporre mai `npm`, un bundler, un server di sviluppo, un `package.json`,
   React, Vite o simili. Il deliverable è un file HTML che si apre e basta.
3. La verifica si fa **solo ripubblicando l'Artifact e aprendolo su claude.ai**.
   Scrivi codice difensivo in modo che un errore sia visibile nella pagina
   (banner di stato), non solo in console: sul telefono la console non si legge.
4. Ogni modifica deve lasciare la pagina funzionante anche quando una capability
   risolve `null` (degrado, non schermata bianca).

---

## Regole assolute (violarle rompe la pagina in silenzio)

- **Mai** `fetch("https://api.anthropic.com/...")`. In una pagina pubblicata la
  richiesta viene bloccata dalla policy di sicurezza. Per chiedere a Claude si
  usa la capability `sample`, e nient'altro.
- **Mai** leggere `window.claude.db`, `window.claude.sample`, `window.claude.user`.
  Quei membri non esistono. L'unico accesso è `await window.claude.use("nome")`.
- **Mai** usare `localStorage` / `sessionStorage` per i messaggi: sono privati
  del singolo browser, l'altra persona non vedrebbe nulla. Lo stato condiviso sta
  in `db`.
- **Mai** salvare in `db` nomi, email, avatar o colori delle persone: si salva
  **solo l'id** opaco. Nome e avatar si risolvono a ogni render con
  `user.profiles(ids)` — sono diversi per ogni osservatore e invecchiano.
- **Mai** caricare font, immagini, script o CSS da domini esterni. Tutto inline.
- **Mai** aprire una sottoscrizione `onSnapshot` dentro il codice di render:
  si sottoscrive una volta all'avvio, altrimenti la pagina entra in ciclo.

---

## API disponibili (firme verificate — non inventarne altre)

Accesso: `const x = await window.claude.use("db" | "user" | "sample");`
Restituisce `null` quando la capability non è utilizzabile in quella vista.
Si risolve **dopo** il primo giro di script, quindi la pagina deve disegnarsi
prima e accendere le funzioni quando la promessa si risolve.

### db — archivio condiviso, realtime

```js
db.doc("messages/ID")                  // percorso a segmenti PARI = documento
db.collection("messages")              // segmenti DISPARI = collezione
await ref.get()                        // -> {id, exists, data()}
await ref.set(obj)                     // sostituisce l'INTERO documento
await ref.update(obj)                  // fonde, ma richiede che esista
await ref.delete()
db.collection("messages")
  .orderBy("day", "desc").limit(40)
  .onSnapshot(snap => {...}, err => {...})   // -> funzione di unsubscribe
```

- I corpi dei documenti sono oggetti JSON (mai array al primo livello),
  max 256 KiB ciascuno; **massimo 5.000 documenti per artifact**.
- Ultima scrittura vince, niente transazioni: una scrittura per documento alla
  volta, attesa prima della successiva.
- Un documento che non si può leggere appare identico a uno inesistente.

### user — chi sta guardando

```js
const me = await user.me();            // {id, name, avatarUrl, color, isOwner, canEdit}
const ps = await user.profiles([ids]); // {id: {name, avatarUrl, color, isMe}}
```

- `me.id` è un token opaco (`u_...`), valido dentro l'organizzazione proprietaria
  dell'artifact. `name` può essere `""`: usare `nome || "Qualcuno"`.
- `profiles()` va chiamata **dentro il render, ogni render**: è memorizzata in
  cache, richiamarla è corretto e costa nulla.

### sample — chiedere a Claude

```js
const { text, truncated } = await sample(prompt, {
  onText: ev => { /* ev.text = TUTTA la risposta finora, da assegnare */ },
  signal: controller.signal,
  modelTier: "quick" | "default" | "complex"
});
```

- Nessuna memoria tra una chiamata e l'altra: la pagina deve passare nel prompt
  la trascrizione recente, le istruzioni e il formato voluto.
- **Paga chi sta guardando**, con il proprio account Claude, e la prima chiamata
  in ogni sessione chiede il suo consenso. Quindi: solo su gesto esplicito
  (invio di un messaggio con `@claude`), mai in un ciclo o su timer.
- Tempi: da 5 a 60 secondi prima che arrivi il primo testo. Mostrare sempre
  "Sto pensando…" da subito.
- Fallisce con una promessa rifiutata `{code, message, text?}`; `text` è la parte
  di risposta che si può tenere a schermo. Codici da gestire: `not_granted`
  (consenso negato), `rate_limited`, `cancelled`. **Mai** riprovare in ciclo.

### Quanta conversazione vede Claude

`sample` non ha memoria: tutto quello che Claude sa della chat sta nel prompt che
la pagina costruisce al momento della chiamata. Quindi la trascrizione **non è un
dettaglio, è la memoria**. Regole da non rompere:

- si passano gli ultimi `MEMORIA_MSG` messaggi (60), tagliati a
  `MEMORIA_CARATTERI` (12000) partendo dal fondo; l'ultimo messaggio — quello che
  ha chiamato Claude — entra sempre, anche se da solo supera il tetto;
- ogni riga porta data, ora e nome di chi ha parlato, e le risposte di Claude
  rientrano nella trascrizione come `Claude:` (così ricorda cosa ha già detto);
- i nomi vanno risolti con `user.profiles()` **prima** di costruire il prompt:
  se si usa la cache del render, alla prima chiamata della sessione è ancora
  vuota e Claude legge "Partecipante" per entrambi, senza distinguere chi parla.

Il limite più a monte è la sottoscrizione: `limit(40)` documenti, cioè un
documento per giorno e per persona, circa venti giorni di conversazione a due.
Più indietro di così la pagina non carica, quindi Claude non può vederlo.

---

## Modello dei dati (non cambiarlo senza motivo)

Un documento **per giorno e per autore**:

```
messages/2026-09-19__u_abc123
{
  day: "2026-09-19",
  authorId: "u_abc123",
  items: [
    { id: "...", ts: 1758..., kind: "human" | "claude",
      authorId: "u_abc123", text: "..." }
  ]
}
```

Piu' un solo documento di servizio, scritto una volta dal proprietario:

```
config/proprietario   ->   { id: "u_abc123" }
```

Perché così:
- ognuno scrive **solo il proprio documento** → due messaggi simultanei non si
  sovrascrivono mai, senza bisogno di lock;
- un documento per messaggio esaurirebbe il tetto dei 5.000 documenti;
- la risposta di Claude viene salvata (con `kind: "claude"`) nel documento di chi
  l'ha invocato, così la regola "ciascuno scrive solo il proprio" resta valida.

Il render raccoglie gli `items` di tutti i documenti, deduplica per `id` e ordina
per `ts`.

---

## Accesso delle persone

Le due persone hanno **due account Claude distinti** (scelta dell'utente, dopo
aver valutato e scartato l'account condiviso: chi entra con le credenziali
altrui vede tutto l'account, non solo questa pagina).

- L'altra persona deve avere l'artifact condiviso con il livello **"può
  interagire"** / Editor o superiore. Con "può visualizzare" legge ma le
  scritture vengono rifiutate con `invalid_argument`.
- Chi arriva da fuori organizzazione conta come sola lettura.
- Quando una scrittura viene rifiutata, la pagina deve dirlo in chiaro e passare
  in sola lettura, non ritentare.

### Le richieste a Claude risultano sempre del proprietario

Richiesta esplicita dell'utente: *«voglio che la richiesta di intervento risulti
sempre inviata da me, a prescindere da chi la fa»*. Quindi:

- il proprietario scrive il proprio id in `config/proprietario` la prima volta
  che apre la pagina (`me.isOwner`); gli altri lo leggono all'avvio;
- nel prompt c'e' sempre la riga "chi ti chiede di intervenire e' <proprietario>,
  anche quando a premere il pulsante e' stata l'altra persona", e Claude rivolge
  a lui la risposta;
- sotto al nome di Claude, nella bolla, si legge "su richiesta di <proprietario>";
- il pulsante "sull'ultimo messaggio" guarda **sempre dal punto di vista del
  proprietario**: "l'altro" e' la persona che non possiede la chat, chiunque
  prema.

**Il costo non si sposta con l'intestazione**: la capability `sample` la paga
sempre chi sta guardando la pagina in quel momento, con il proprio account.
L'intestazione della richiesta e' una cosa, il conto e' un'altra.

**Decisione presa (non rimetterla in discussione da soli).** Esiste un modo per
far pagare davvero al proprietario anche le richieste dell'altra persona: il suo
pulsante non chiama Claude ma deposita una richiesta in `db`; la pagina del
proprietario la vede, chiama `sample` con il proprio account e scrive la
risposta. Funziona, ma le risposte arrivano solo **quando la pagina del
proprietario e' aperta**. L'utente lo sa, e ha scelto di **non** farlo per ora:
va bene che l'altra persona usi il proprio account. Da costruire solo se lo
chiede.

**L'altra persona deve avere un account Claude**: senza, le sue scritture
vengono rifiutate e la chat sarebbe muta da parte sua. E' gratuito e non e' un
abbonamento — detto cosi', perche' l'utente temeva di doverle far pagare
qualcosa.

## Come si lavora su questo progetto

1. Claude Code modifica il file HTML.
2. La pubblicazione dell'Artifact con le sue capability si fa dall'interfaccia di
   chat di claude.ai oppure, quando lo strumento Artifact è disponibile, da
   Claude Code stesso.
3. L'Artifact pubblicato di questo progetto è:
   `https://claude.ai/artifact/WTGSLpHGFTT5aCHwDqyoKy`
   Ripubblicare sempre su quell'indirizzo, così il link già mandato alle persone
   continua a funzionare. Un indirizzo nuovo significa una chat vuota e separata,
   con i messaggi vecchi irraggiungibili.
4. Le capability dichiarate alla pubblicazione sono:
   `{ db: {}, sample: {}, user: { scopes: ["profile"] } }`.
   Se il codice inizia a usarne una nuova, **va detto esplicitamente** perché va
   dichiarata al momento della pubblicazione, altrimenti risolverà `null`.

---

## Stile del codice

- JavaScript classico, nessun framework, nessuna dipendenza.
- Tutto in un file: HTML, CSS e JS inline.
- CSS con variabili su `:root`, `env(safe-area-inset-*)` per i bordi dello
  schermo del telefono, `height: 100%` (mai `100vh`).
- **Tema unico chiaro, per scelta dell'utente**: niente blocco
  `prefers-color-scheme: dark`. La pagina lo dichiara con `color-scheme: light`
  (nel CSS e nel `<meta>`), altrimenti di notte il telefono scurirebbe da solo
  la casella di scrittura e la barra di scorrimento.
- Sullo sfondo c'e' un cuore spezzato rosso in SVG inline: le due meta'
  condividono la stessa linea di frattura, per questo combaciano quando si
  ricompongono. Batte a ogni messaggio scritto da una persona (non per la
  cronologia che si carica all'apertura, non per le risposte di Claude). E'
  decorazione inerte: sta sotto a tutto con `pointer-events:none` e non deve
  mai poter rompere la chat.
- **Scorrimento e disegno** (l'utente ha segnalato l'elenco poco reattivo):
  - il cuore sta su un livello grafico suo (`transform:translateZ(0)`,
    `will-change`, `contain:paint`), altrimenti un disegno grande e fisso
    dietro a bolle semitrasparenti viene ridipinto a ogni frame;
  - le righe fuori schermo non si disegnano (`content-visibility:auto`);
  - **non si ridisegna l'elenco se non e' cambiato niente** (confronto di una
    firma), e soprattutto **mai l'elenco intero a ogni pezzo di risposta di
    Claude**: si riscrive solo la bolla che sta crescendo. Misurato su 200
    messaggi: 12.500 bolle ricostruite contro 400, e da 9 fotogrammi lenti a
    nessuno;
  - si segue la conversazione verso il fondo **solo se si era gia' in fondo**:
    prima ogni pezzo di risposta riportava a forza in fondo e non si riusciva
    a leggere indietro mentre Claude scriveva.
- La pagina non si blocca mai mentre Claude risponde: durante l'attesa (5-60
  secondi) restano spenti solo i pulsanti che farebbero partire una seconda
  domanda, mai "Invia". Spegnere "Invia" era un difetto vero, segnalato
  dall'utente come "l'interfaccia si blocca".
- Le bolle dei messaggi sono semitrasparenti perche' il cuore si veda anche
  sotto ai messaggi. **Toccando quelle trasparenze va rimisurato il contrasto
  del testo**: il bianco sulla bolla blu e' il punto fragile (con il primo
  tentativo era sceso a 4,5 scarso, sotto la soglia leggibile; il blu e' stato
  scurito apposta).

### Suono del battito

Generato dalla pagina con l'API audio del browser — un tonfo morbido e un
fruscio filtrato — perche' il progetto vieta di caricare file da domini
esterni. Da sapere:

- **niente toni sovrapposti al tonfo**: un'ottava sopra rende il battito
  udibile ma suona elettronico, e l'utente l'ha bocciata ("troppo meccanico").
  A portare il volume dev'essere il **fruscio**, che non ha carattere tonale
  ed e' proprio la voce dell'ecografia;

- **le frequenze non devono scendere sotto i 150 Hz**: l'altoparlante di un
  telefono li' non riproduce quasi niente. La prima versione scendeva a 32 Hz
  ed era giusta in teoria ma quasi muta in mano (l'utente ha segnalato "il
  suono e' basso" a volume alzato). Misurando l'energia sopra i 150 Hz, il
  rimedio vero e' stato alzare le frequenze, non il volume;
- l'uscita passa da un compressore: oltre `1.3/0.85` di forza il battito
  comincia a gracchiare, misurato contando i campioni tagliati;

- **il cuore batte solo per i messaggi che le due persone si mandano fra
  loro**: quelli che contengono `@claude` lo lasciano fermo e spezzato, senza
  suono e senza animazione. Scelta dell'utente: il cuore e' loro, non della
  conversazione con Claude;
- **il timbro e' stato scelto dall'utente all'ascolto**, dopo che quattro
  versioni costruite "a tavolino" erano state bocciate come meccaniche. Il
  metodo che ha funzionato: generare le varianti in file audio e fargliele
  sentire, invece di descriverle. La versione scelta e' la piu' **ovattata**:
  niente toni, niente colpo secco, solo rumore rallentato e tagliato molto in
  basso (lowpass a 285/235 Hz che scende ancora mentre il battito si spegne),
  come il cuore sentito attraverso il liquido. **E' il sibilo sopra i 300 Hz a
  far sembrare il suono una macchina**: chi lo ritocca non lo riapra;
- l'array `BATTITI` in JavaScript e i picchi dei keyframes `batti` nel CSS
  descrivono gli stessi istanti: **se si cambia uno, va cambiato l'altro**,
  altrimenti suono e disegno si sfasano;
- i browser non fanno partire l'audio prima che la persona abbia toccato la
  pagina: si prepara al primo tocco (`preparaAudio`). Chi apre la chat e resta
  fermo non sente il primo messaggio in arrivo, ed e' inevitabile;
- c'e' un tasto in alto per silenziare; la scelta sta in `localStorage`, che qui
  e' lecito perche' e' una preferenza del singolo, non un messaggio.

### Pulsanti per chiedere un parere

Oltre a `@claude` scritto nel messaggio, tre pulsanti su una sola riga chiedono
a Claude un parere — **Ultimo** (l'ultimo messaggio dell'altra persona),
**Ultimi tre scambi**, **Conversazione** (tutta quella che la pagina tiene
sott'occhio). Il tasto accanto alla casella porta scritto `@claude` e lo
inserisce all'inizio del messaggio: prima era un simbolo e non si capiva ne'
a cosa servisse ne' se avesse fatto qualcosa.

Quando un pulsante non ha nulla da commentare lo dice **in fondo, sopra ai
pulsanti stessi**: l'avviso in cima alla pagina non si vedeva e i pulsanti
sembravano rotti.
Uno scambio e' tutto quello che una persona scrive di fila prima che risponda
l'altra: tre messaggi consecutivi della stessa persona sono un solo scambio, e
le risposte di Claude non contano. Tutte le strade passano da `chiediAClaude()`:
cambia solo il compito e la fetta di conversazione, mai il modo di chiamare.
- Testo inserito dalle persone sempre con `textContent`, mai `innerHTML`.
- L'utente non programma: commenti in italiano, spiegazioni in linguaggio
  naturale, e quando proponi una modifica dì prima **cosa cambia per chi usa la
  pagina**, poi il codice.

---

## Messaggi vocali: scartati, e non per motivi tecnici

Tecnicamente si potrebbero fare (registrazione dal microfono, file nel magazzino
allegati della pagina, che accetta webm e mp4 fino a 20 MB). **Sono stati
scartati dall'utente per una ragione di sostanza: Claude legge solo testo, quindi
i vocali sarebbero buchi muti nella conversazione** e i tre pulsanti del parere
non avrebbero nulla da commentare. Il senso della chat e' che il terzo
partecipante legga tutto.

Restano due ostacoli pratici, se un giorno se ne riparlasse: non si sa se il
permesso del microfono arrivi dentro la pagina pubblicata, e dichiarare la
capability `assets` rende la pagina riservata all'organizzazione del
proprietario — con il rischio di chiudere fuori l'altra persona, che ha un
account suo. In quel caso si prova su una **copia** della pagina, mai su questa.

L'alternativa che va gia' bene oggi: il tasto del microfono sulla tastiera del
telefono. Si parla, arriva come testo, e Claude lo legge.

---

## Se un giorno si passa a un'app vera (fuori da claude.ai)

Cambia tutto tranne il modello dei dati e il prompt:
`db` → un database vero; `user` → un sistema di login; `sample` → chiamata
all'API con una chiave di Console e credito proprio, fatta **da un server**, mai
dal browser (una chiave nel browser è pubblica). Servono hosting e deploy.
Non iniziare questa conversione senza che l'utente l'abbia chiesta espressamente.
