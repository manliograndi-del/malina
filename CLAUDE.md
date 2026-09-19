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

---

## Modello dei dati (non cambiarlo senza motivo)

Un documento **per giorno e per autore**:

```
messages/2026-09-19__u_abc123
{
  day: "2026-09-19",
  authorId: "u_abc123",
  items: [
    { id: "...", ts: 1758... , kind: "human" | "claude", authorId: "u_abc123", text: "..." }
  ]
}
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

- L'altra persona deve avere l'artifact condiviso con il livello **"può
  interagire"** o superiore. Con "può visualizzare" legge ma le scritture vengono
  rifiutate con `invalid_argument`.
- Chi arriva da fuori organizzazione conta come sola lettura.
- Quando una scrittura viene rifiutata, la pagina deve dirlo in chiaro e passare
  in sola lettura, non ritentare.

---

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
- CSS con variabili su `:root`, tema chiaro e scuro, `env(safe-area-inset-*)`
  per i bordi dello schermo del telefono, `height: 100%` (mai `100vh`).
- Testo inserito dalle persone sempre con `textContent`, mai `innerHTML`.
- L'utente non programma: commenti in italiano, spiegazioni in linguaggio
  naturale, e quando proponi una modifica dì prima **cosa cambia per chi usa la
  pagina**, poi il codice.

---

## Se un giorno si passa a un'app vera (fuori da claude.ai)

Cambia tutto tranne il modello dei dati e il prompt:
`db` → un database vero; `user` → un sistema di login; `sample` → chiamata
all'API con una chiave di Console e credito proprio, fatta **da un server**, mai
dal browser (una chiave nel browser è pubblica). Servono hosting e deploy.
Non iniziare questa conversione senza che l'utente l'abbia chiesta espressamente.
