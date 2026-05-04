# Car Wash Simulator 2D/2.5D Poki Redesign

## Summary
Riprogettare `Sparkle Wash` come un car wash simulator 2D/2.5D piu leggibile, guidato e soddisfacente. La direzione scelta e: mantenere Phaser e il formato browser/Poki, introdurre un arrivo auto rapido come inizio sessione, usare solo cash in-game per upgrade e progressione, e trasformare il feedback in parte centrale del gioco.

Fonte di ispirazione esterna: [PowerWash Simulator Vehicles](https://powerwash-simulator.fandom.com/wiki/Vehicles), da usare per struttura dei job, varieta veicoli, categorie Land/Water/Air e obiettivi tipo "pulisci prima X", senza copiare asset o contenuti.

## Step 1: Analisi GDD E Nuovo Target
- Creare `plan.md` alla root con una sezione "Current Problems" basata sul gioco attuale: feedback strumenti confuso, wrong-tool warning troppo generico, pulizia poco tattile, veicoli ancora poco riconoscibili, meta-progression debole.
- Definire la nuova fantasy: "il cliente arriva nel tuo autolavaggio, ti affida un veicolo sporco, scegli strumenti corretti, guadagni cash, migliori garage e attrezzatura".
- Stabilire i pillar di design:
  - chiarezza: il giocatore capisce sempre che sporco vede e cosa usare
  - soddisfazione: ogni passata da feedback visivo, sonoro e numerico
  - progressione: ogni job paga cash e sblocca upgrade concreti
  - varieta: veicoli e sporchi cambiano il modo di pulire
  - ritmo Poki: job brevi, ingresso rapido, result screen forte

## Step 2: Meta-Flusso Di Sessione
- Sostituire il boot diretto statico con un "garage arrival flow" rapido:
  - fade in sul garage
  - auto entra da fuori schermo con easing, piccola frenata/squash
  - conducente appare in fumetto con una frase breve tipo "Clean my ride!"
  - preview dello sporco e hint dello strumento consigliato
  - player puo iniziare subito a pulire
- Aggiungere una struttura job-based:
  - `JobIntro`: veicolo, cliente, sporchi presenti, pagamento base, bonus
  - `Cleaning`: pulizia vera e propria
  - `JobComplete`: score, cash earned, parti pulite, bonus, upgrade suggerito
  - `GarageUpgrade`: compra o migliora strumenti/ambiente, poi next job
- Mantenere tempi corti: intro massimo 2 secondi skippabile con click/tap.

## Step 3: Sistema Sporco E Strumenti
- Rendere esplicita la matrice sporco/strumento:
  - Dust: Fan o Sponge, pulizia larga e veloce
  - Mud: Foam/Shampoo prima, poi Jet o Hot
  - Oil: Degreaser/Hot o Jet focalizzato
  - Rust: Rust Remover + Jet, pulizia lenta e precisa
- Aggiungere feedback contestuale:
  - se strumento corretto: bordo verde breve, particelle pulite, suono pieno, progress boost visibile
  - se strumento sbagliato: sporco si muove poco, suono smorzato, tooltip "Mud needs Foam first"
  - se zona quasi pulita: sparkle/ping e label "Door clean", "Wheel clean", "Window clean"
- Introdurre parti del veicolo:
  - hood, roof, windows, wheels, bumper, side panels
  - ogni parte ha percentuale e puo dare cash bonus quando completata
- Trasformare `dirtLayers` da semplice numero a vera logica per tipo/livello di sporco, con piu passate o pre-trattamento richiesto.

## Step 4: Game Feel E Juice
- Animare ingresso veicolo:
  - slide-in, shadow dinamica, leggera rotazione/frenata, camera follow/settle
  - clacson leggero o suono ruote
- Aggiungere conducente/cliente:
  - portrait o busto in fumetto
  - 2-3 frasi per world/job
  - reazioni rapide: "Nice!", "Still muddy!", "That wheel is filthy!"
- Differenziare strumenti visivamente:
  - Fan: cono ampio con spray semi-trasparente, goccioline larghe
  - Jet: linea stretta intensa, impatto forte, micro splash
  - Hot: vapore, alone caldo, particelle morbide
  - Foam/Shampoo: schiuma persistente che prepara lo sporco
  - Sponge: movimento a contatto, strisciate e bolle
- Aggiungere feedback di completamento:
  - camera punch leggero
  - sparkle burst sulle parti pulite
  - progress bar che pulsa a 25/50/75/100
  - "clean streak" se il giocatore usa lo strumento giusto per piu celle consecutive
- Limitare l'HUD persistente e usare prompt transienti per non coprire il veicolo.

## Step 5: Progressione, Cash E Unlockables
- Introdurre cash in-game come valuta primaria:
  - ogni job paga `basePay`
  - bonus per tempo, efficienza, strumento corretto, parti completate, bonus zones
  - niente acquisti real-money
- Aggiungere upgrade acquistabili:
  - Pressure: aumenta layer reduction
  - Spray Width: aumenta radius per strumenti larghi
  - Precision: migliora Jet e zone strette
  - Soap Quality: migliora Foam/Shampoo
  - Heat Level: migliora Hot contro mud/oil
  - Cash Bonus: piccola percentuale extra a fine job
- Aggiungere shop/garage dopo il result:
  - mostra cash attuale
  - 2-3 upgrade raccomandati
  - pulsante "Buy" se abbastanza cash
  - pulsante "Next Job" sempre disponibile
- Rewarded ads opzionali:
  - raddoppia cash del job o concede upgrade temporaneo
  - non deve bloccare progressione base.

## Step 6: Ambiente E World Structure
- Evolvere lo sfondo in un garage/officina leggibile:
  - pavimento bagnato, drenaggio, pareti, scaffali, tubo acqua, luci
  - parallax leggero e ombre sotto veicolo
- Progressione ambiente:
  - Garage 1: piccolo autolavaggio rurale
  - Garage 2: ranch/mud bay con idropulitrice migliore
  - Garage 3: officina oil/degreaser
  - Garage 4: junkyard/rust restoration
- Upgrade cosmetici ambiente:
  - luci migliori
  - pavimento nuovo
  - insegna
  - scaffale prodotti
  - compressore/idropulitrice premium
- Ogni ambiente deve comunicare il tipo di sporco dominante.

## Step 7: Veicoli E Job List
- Usare PowerWash come reference strutturale: varieta di job, categorie, veicoli riconoscibili, challenge opzionali.
- Adattare a 20-30 job brevi:
  - Land: compact car, van, vintage car, pickup, SUV, bus, fire truck, monster truck
  - Utility: tractor, drill/engine block, trailer, garage parts
  - Fun/advanced: dirt bike, golf cart, buggy, RV
  - Later optional expansion: boat/helicopter/plane solo se asset e prospettiva reggono
- Ogni vehicle asset deve avere:
  - clean PNG
  - dirt mask authoring
  - part map
  - bounds/mask metadata
  - entry animation origin
  - preview icon
- Non aggiungere nuovi job senza asset riconoscibili e maschere pulibili testate.

## Step 8: Pipeline Asset Non Placeholder
- Creare una manifest asset-driven invece di generare placeholder in `PreloadScene`.
- Asset folders:
  - `public/assets/vehicles/`
  - `public/assets/vehicles/masks/`
  - `public/assets/vehicles/parts/`
  - `public/assets/characters/`
  - `public/assets/environments/`
  - `public/assets/tools/`
  - `public/assets/fx/`
  - `public/assets/audio/`
- Per ogni nuovo veicolo:
  - generare o disegnare un clean top-down/2.5D sprite su trasparenza
  - creare dirt masks separate per dust/mud/oil/rust
  - creare part mask per hood/windows/wheels/etc.
  - normalizzare dimensioni e pivot
  - validare in game con screenshot prima di sostituire il placeholder
- Per personaggi/clienti:
  - 4 archetipi iniziali con portrait e fumetti
  - evitare dialoghi lunghi, massimo una riga
- Per FX:
  - sprite/texture per spray, steam, foam, droplets, sparkle, dirt chunks
  - effetti diversi per ogni strumento
- Per audio:
  - loop spray per ogni strumento principale
  - clear tick per cluster
  - wrong-tool dull scrape
  - part-complete ping
  - job-complete sting
  - garage ambient loop leggero

## Step 9: Architettura Di Implementazione
- Estrarre logica gameplay da `GameScene` verso sistemi piu chiari:
  - `JobSystem`: job corrente, reward, vehicle metadata
  - `DirtSystem`: layers, masks, part completion, tool effectiveness
  - `EconomySystem`: cash, upgrade prices, reward calculation
  - `UpgradeSystem`: tool stats finali da base + upgrade
  - `FeedbackSystem`: messaggi contestuali e hint
- Estendere save data:
  - `cash`
  - `ownedUpgrades`
  - `garageLevel`
  - `completedJobs`
  - `partStars` opzionale
- Estendere debug bridge:
  - job state
  - current dirt under pointer
  - recommended tool
  - cash
  - upgrades
  - current customer bubble
  - active feedback message
- Mantenere Phaser come renderer e input layer; la logica pulizia deve diventare testabile senza dipendere da sprite/tween.

## Step 10: Roadmap Di Implementazione
1. Scrivere `plan.md` con questo redesign e accettazione.
2. Creare `JobSystem`, `EconomySystem`, `UpgradeSystem` e nuove save keys.
3. Implementare garage arrival flow con auto che entra e fumetto cliente.
4. Rifare tutorial/hint: dirty scanner + recommended tool per ogni sporco.
5. Aggiungere Foam/Shampoo o Sponge come nuovo strumento preparatorio.
6. Implementare part maps e completion per parti veicolo.
7. Aggiungere cash reward e upgrade shop post-result.
8. Migliorare FX per strumenti, inclusi foam/steam/spray separati.
9. Sostituire asset placeholder rimanenti con pipeline reale.
10. Playtest, tuning e iterazione su pacing/fun.

## Test Plan
- Static:
  - `npm run typecheck`
  - `npm run build`
- Playwright/game-playtest:
  - fresh boot mostra garage arrival e auto animata
  - fumetto cliente appare e scompare senza bloccare input
  - ogni dirt type suggerisce lo strumento corretto
  - wrong-tool feedback e chiaro e non frustrante
  - strumenti diversi producono effetti visivi/audio distinti
  - completare una parte veicolo da ping, cash e stato debug coerente
  - result screen mostra cash earned e upgrade consigliati
  - comprare upgrade cambia davvero le statistiche nel job successivo
  - veicoli nuovi sono riconoscibili sotto lo sporco
  - mobile viewport non taglia HUD, shop o fumetti
- Acceptance:
  - un nuovo giocatore capisce cosa usare entro 5 secondi
  - il primo job non finisce con una sola passata
  - ogni passata corretta produce feedback visibile/sonoro
  - il giocatore ha un motivo chiaro per fare "next job"

## Assumptions
- Direzione confermata: 2D/2.5D Poki in Phaser, non simulatore 3D completo.
- Economia confermata: cash in-game, niente IAP real-money.
- Flow confermato: arrivo auto rapido nel garage, non menu pesante prima del gameplay.
- PowerWash e riferimento di struttura e varieta, non fonte da copiare.
- Il piano privilegia chiarezza e game feel prima di aggiungere piu contenuti.
