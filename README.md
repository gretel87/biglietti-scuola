# Festa Terza Media 2026

## Pubblicazione su Netlify

Attualmente su Netlify è stato caricato solo `index.html`: quel deploy pubblica la pagina statica, ma non include le Netlify Functions né il backend. Non basta sostituire il file HTML o trascinarlo di nuovo nella pagina dei deploy manuali. Per attivare la persistenza occorre pubblicare il progetto completo da questa cartella.

Il sito rimane pubblico. Le API dei biglietti richiedono un codice organizzatori; il segreto non va inserito in `index.html` o salvato nel repository.

### Prima configurazione

1. Apri in Netlify il progetto che serve già il sito e vai in **Project configuration > Environment variables**.
2. Aggiungi `ORGANIZER_PASSWORD` con un codice casuale lungo. Rendilo disponibile al contesto **Production** e alle **Functions** (oppure a tutti gli scope, se la UI non permette di scegliere gli scope).
3. Salva la variabile prima del deploy. Le modifiche alle variabili d’ambiente hanno effetto solo dopo un nuovo deploy.

Netlify Blobs conserva i biglietti tra i deploy, in un archivio nella regione UE di Francoforte.

### Metodo consigliato: Netlify CLI

Serve Node.js 18.14 o superiore. Apri PowerShell nella cartella completa del progetto, non in una cartella contenente solo `index.html`:

```powershell
Set-Location "$HOME\Downloads\progetto-francesca"
npm install
npx netlify login
npx netlify deploy
```

Al primo deploy, accedi a Netlify e seleziona il progetto già esistente che oggi pubblica l’HTML. Il comando crea un deploy di anteprima: apri l’URL indicato, inserisci il codice organizzatori e verifica che la pagina si carichi e consenta di emettere un biglietto.

Se l’anteprima è corretta, pubblica sul dominio principale:

```powershell
npx netlify deploy --prod
```

Per aggiornamenti successivi, ripeti `npm install` se sono cambiate le dipendenze, poi `npx netlify deploy --prod`.

### Alternativa: deploy automatico con Git

Se vuoi che Netlify pubblichi automaticamente a ogni modifica, carica **tutti** i file del progetto in un repository Git, quindi in Netlify scegli **Add new project > Import an existing project** e collega quel repository. Mantieni come directory base la radice del progetto: `netlify.toml` imposta già la directory pubblicata e quella delle Functions.

Non creare un repository contenente solo `index.html`: devono esserci anche `netlify.toml`, `netlify/functions/tickets.mjs`, `package.json` e `package-lock.json`.

### Primo accesso e dati esistenti

Al primo accesso gli organizzatori inseriscono il codice; il browser lo conserva solo nella sessione corrente. Se l’archivio Blobs è vuoto e quel browser ha dati nel vecchio `localStorage`, la pagina chiede se importarli. Controlla prima quei dati: la vecchia versione poteva contenere record dimostrativi. L’importazione riguarda solo il browser da cui viene confermata.

Per una verifica rapida, apri `/api/tickets` sul dominio Netlify: senza il codice la risposta deve essere `401`. La pagina applicativa richiede il codice e poi mostra i biglietti condivisi.

## Sviluppo locale

```powershell
npm install
$env:ORGANIZER_PASSWORD = "un-codice-locale"
npm run dev
```

Netlify Dev usa uno store Blobs locale separato dai dati di produzione. Il deploy di produzione, invece, usa lo store persistente del progetto Netlify.