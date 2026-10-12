# Meo & Mao

GitHub Pages: https://giovannipivatoo.github.io/cats/

Ogni push su `main` pubblica automaticamente il sito tramite GitHub Actions.
`node build-pages.mjs` genera `_site/` e collega le API al Worker Cloudflare esistente.
La build autorizza quel backend anche nella Content Security Policy della pagina.
Messaggi e personalizzazioni restano nello stesso database.

Sito Cloudflare: https://meo-mao-plush.meo-mao-plush.workers.dev/

`quattro-zampe.html` è l’unico HTML sorgente, con corpo orizzontale, quattro
zampe a terra, code mobili e bacio adattato alla nuova postura. Busto, collo, testa
e zampe sono un’unica superficie procedurale con pelle e pelo deformati sulla GPU.
La build pubblica lo stesso file anche come `index.html`; il precedente indirizzo
`/quattro-zampe.html` continua ad aprire la stessa scena.
`npm run test:quattro-zampe` verifica il solutore effettivo: appoggi, recupero dopo
lo stiramento di ciascuna zampa, proporzioni estreme, lancio e bacio completo,
oltre alla chiusura e alla connessione della superficie e ai pesi della deformazione.

La scena 3D e l’interfaccia sono in un unico HTML, senza librerie o risorse esterne.
Messaggi e personalizzazioni usano un Worker Cloudflare e D1 condiviso.
L’editor salva automaticamente nome, colori, mantello, proporzioni, tessuto ed espressione
di ciascun gatto. A ogni apertura carica l’ultima configurazione dal database.
Le revisioni evitano che un dispositivo sovrascriva cambiamenti che non ha ancora visto;
in caso di conflitto vengono riapplicati solo i campi modificati nell’editor.
Il browser conserva una copia e le modifiche non ancora inviate per recuperare un
salvataggio interrotto; «Salvato» conferma la risposta del database. Lo sfondo resta locale.
Passando il mouse sui gatti si attivano carezze: occhi socchiusi, testa inclinata,
movimenti morbidi e coda più vivace. La reazione sfuma quando il mouse si ferma;
il tasto C sulla scena offre la stessa interazione da tastiera.
All'ingresso si sceglie Meo o Mao. I messaggi nuovi compaiono in una nuvoletta sopra
il gatto che li ha scritti. «Prossimo» o «Letto» conferma solo il messaggio mostrato;
«Rispondi» apre la conversazione completa.
Le risposte, lo stato di lettura e le bozze sono gestiti dall'interfaccia.
I nuovi messaggi vengono cercati ogni 3 secondi mentre la pagina è visibile,
e subito quando torna la connessione o si riattiva la finestra.
La scelta del gatto è un'identità dichiarata, non un accesso con password.

## Anteprima locale

```sh
npm install
npm run db:local
npm run dev
```

Aprire http://127.0.0.1:8765/index.html. Il database locale resta in `.wrangler/`.
`npm test` controlla messaggi, personalizzazioni, persistenza dopo un riavvio,
ricevute di lettura, modifiche concorrenti e la vera coda di salvataggio dell’editor,
con un database temporaneo. Il test della scena verifica anche reazione e recupero dopo le carezze.
`npm run test:online` verifica entrambe le pagine pubbliche, le caselle online e
i permessi CORS, senza inviare messaggi né modificare le ricevute reali.
GitHub Actions esegue i test prima di pubblicare e il controllo online dopo il deploy.

## Cloudflare

Il progetto usa [Workers con asset statici](https://developers.cloudflare.com/workers/static-assets/)
e [D1](https://developers.cloudflare.com/d1/get-started/).
Il database remoto è già collegato in `wrangler.jsonc`.
Nessuna credenziale viene incorporata nell'HTML.

Per aggiornare il sito dall'account già collegato:

```sh
npm run db:remote
npm run deploy
```

Per installare il progetto in un altro account Cloudflare:

```sh
npx wrangler login
npx wrangler d1 create meo-mao-messages --binding DB --update-config
npm run db:remote
npm run deploy
```

Il comando di creazione aggiunge l'ID del database a `wrangler.jsonc`.
In un altro account, rimuovere prima il precedente `database_id` e sostituirlo con quello nuovo.
La pubblicazione fornisce l'indirizzo HTTPS da aprire su entrambi i dispositivi.
Vengono pubblicati solo `index.html` e `quattro-zampe.html` come asset; database, file di sviluppo e credenziali
non fanno parte dei file serviti. Il database remoto è separato da quello dei test locali.
