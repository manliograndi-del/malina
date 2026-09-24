# malina

## Siti dei musei di Abbonamento Musei

`musei_link.xlsx` contiene il sito ufficiale di ogni museo del circuito Abbonamento Musei
(Piemonte, Valle d'Aosta, Lombardia) e l'esito della verifica del link.
Il foglio "Da controllare" raccoglie le voci BLOCCATO, DUBBIO, NON FUNZIONA e "nessun sito trovato".

Programmi usati (cartella `script/`), nell'ordine:

1. `fase1_scarica_schede.py` legge l'elenco da abbonamentomusei.it/ricerca-musei e scarica le schede
   (una richiesta ogni 1,5 secondi).
2. `fase1_estrai_link.py` prende il link "Sito web" dalla sezione Contatti di ogni scheda; per le schede
   senza link usa `siti_da_ricerca.json` (siti trovati con una ricerca web).
3. `fase2_verifica_siti.py` apre ogni sito, riprova quelli che non rispondono e ricontrolla i casi incerti
   con un browser vero (Chromium).
4. `crea_excel.py` produce il file Excel.
