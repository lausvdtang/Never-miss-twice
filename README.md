# Never Miss Twice

Een fitness-, voedings- en gewoontetracker voor iemand met ADHD die duurzaam
leaner en atletischer wil worden — zonder afhankelijk te zijn van wilskracht.

De app draait volledig lokaal, werkt offline, vraagt geen account en stuurt geen
enkel gegeven naar een server.

## Geen buildstap

Dit is een statische site: HTML, CSS en native ES-modules. De browser laadt
`app/main.js` rechtstreeks — er wordt niets gecompileerd, gebundeld of
gegenereerd. Wat in de repo staat, is precies wat de browser uitvoert.

```bash
npm start        # of: python3 -m http.server 4173
```

Daarna open je `http://localhost:4173`. Openen via `file://` werkt niet:
ES-modules hebben `http://` of `https://` nodig.

Tests zijn het enige dat Node vraagt, en die staan los van de app zelf:

```bash
npm install      # alleen vitest
npm test         # 98 tests over de kernlogica
```

### GitHub Pages

Zet Pages op **Deploy from a branch**, met de branch die je wilt publiceren en
map **`/ (root)`**. Er is geen workflow of build nodig.

Twee dingen die dit mogelijk maken:

- **Alle paden zijn relatief** (`./app/main.js`, `./styles.css`). De app werkt
  daardoor net zo goed op `https://gebruiker.github.io/Sport-app/` als op een
  eigen domein.
- **Routes lopen via de hash** (`#/training`). Pages kent geen server-side
  rewrites, dus een pad als `/training` zou een 404 geven.

`.nojekyll` staat in de repo zodat Pages de bestanden ongewijzigd serveert.

## Wat de app anders doet

| Principe | Hoe het in de app zit |
| --- | --- |
| **Identity-based habits** | Elke gewoonte heet "Ik ben iemand die…". Bevestigingen en interventies gebruiken die zin, nooit "je moet". |
| **Never miss twice** | Eén gemiste dag breekt je streak niet en levert hooguit een milde opmerking op. Twee op rij is het enige moment waarop de app actief ingrijpt — met een concrete micro-actie. |
| **Omgeving > wilskracht** | Gewoontes hangen aan ankers ("na het avondeten leg ik mijn gymtas klaar"), niet aan kloktijden. Meal prep en noodmaaltijden zijn onderdeel van het systeem. |
| **Two-minute rule** | Elke training en elke gewoonte heeft een minimale versie die volledig meetelt. De "Even geen dag"-knop zet een sessie om in die versie in plaats van hem als gemist te markeren. |
| **Flexibiliteit** | 80/20 als weekbalans, geen dagelijks stoplicht. Alcohol is een budgetregel, geen overtreding. |

Er staat nergens "gefaald", "cheat" of "streak verloren". Een test bewaakt dat
de interventieteksten die woorden ook echt niet bevatten.

---

## 1. Schermenoverzicht (user flow)

Zeven schermen, plus onboarding. De tabbalk toont er vijf; Lichaam en
Instellingen zijn één tap vanaf de plek waar je ze nodig hebt.

```
                        ┌───────────────┐
                        │  Onboarding   │  5 stappen, 1 vraag per scherm
                        └───────┬───────┘
                                ▼
   ┌──────────────────────────────────────────────────────┐
   │                     ◎ VANDAAG                        │
   │  • Never-miss-twice-interventie (max. 1 tegelijk)    │
   │  • Primaire actie: "Start Push A"                    │
   │  • Kcal-ring + eiwitbalk, knoppen + Eten / + Biertje │
   │  • Agenda: groene dagen + stipje op trainingsdagen   │
   │  • Afvinklijst, supplementen, stappen                │
   └───┬───────────┬───────────┬───────────┬──────────────┘
       │           │           │           │
       ▼           ▼           ▼           ▼
  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
  │TRAINING │ │ VOEDING │ │GEWOONTES│ │  WEEK   │
  │ schema  │ │ macro's │ │ streaks │ │check-in │
  │ cardio  │ │  80/20  │ │ ankers  │ │mealprep │
  │historie │ │ logboek │ │als-dan  │ │ lijst   │
  └────┬────┘ └─────────┘ └─────────┘ └────┬────┘
       │                                    │
       ▼                                    ▼
  ┌─────────┐                          ┌─────────┐
  │ SESSIE  │ sets loggen              │ LICHAAM │ 1×/week wegen
  │ (modaal)│ geen tabbalk             │  trend  │ foto's
  └─────────┘                          └─────────┘

                    ⚙︎ → INSTELLINGEN (profiel, fase, export, thema)
```

**Taps per dagelijkse actie** (doel was ≤3):

| Actie | Taps |
| --- | --- |
| Eten loggen (favoriet) | 3 — `+ Eten` → product → `Toevoegen` |
| Biertje loggen | 2 — `+ Biertje` → preset |
| Supplement afvinken | 1 |
| Gewoonte afvinken | 1 |
| Dag op groen zetten | 1 (ook een dag terug, direct in de agenda) |
| Set afvinken in de sportschool | 1 (gewicht en reps staan al voorgevuld) |
| Hele oefening afvinken | 1 |
| Gewicht invoeren | 1 tik + typen (of +/- ingedrukt houden) |
| Oefening vervangen | 3 — `⋯` → `Vervang` → kiezen |
| Iets anders gedaan loggen | 2 — `Iets anders gedaan` → suggestie |
| Slechte dag redden | 2 — `Even geen dag` → bevestigen |

Tijdens een actieve sessie verdwijnt de tabbalk: één taak per scherm.

### Getallen invoeren

Een gewicht van 0 naar 80 kg met stapjes van 2,5 kg zou 32 losse tikken kosten.
Daarom is elk getal een **echt invoerveld**, geen knop die er pas eentje wordt:

- **Tik erop en typ.** Eén tik opent het toetsenbord (`inputmode="decimal"`,
  dus cijfers met komma op mobiel) en selecteert meteen de hele waarde, zodat
  typen hem vervangt in plaats van aanvult. Enter of ergens anders tikken legt
  hem vast; Escape zet hem terug.
- **Of houd +/- ingedrukt.** Na 420 ms loopt hij door en versnelt tot ~55 ms
  per stap — zo'n 15 stappen in anderhalve seconde.

Met Tab spring je van veld naar veld: gewicht → reps → afvinken → volgende set.
De +/- knoppen staan bewust buiten de tabvolgorde, anders zaten er twee knoppen
tussen elk getal. Er gaat niets verloren, want typen kan alles wat +/- kan.

Drie dingen die daaronder geregeld moesten worden:

- **Tijdens het vasthouden gaat er niets naar de opslag.** Elke schrijfactie
  bouwt het scherm opnieuw op, waardoor de knop onder je vinger verdwijnt
  terwijl de timer doorloopt. De tussenstand staat direct in beeld en wordt bij
  loslaten in één keer vastgelegd.
- **Een tekenbeurt kan zichzelf niet onderbreken.** Het leegmaken van het
  scherm blurt het actieve veld, en die blur legt de getypte waarde vast — wat
  middenin de lopende beurt een nieuwe zou starten. `createScheduler` houdt de
  tweede beurt vast tot de eerste klaar is.
- **De focus blijft staan over een hertekening heen**, inclusief cursorpositie,
  zodat het toetsenbord niet dichtklapt terwijl je typt.

---

## 2. Datamodel

Alles wordt lokaal opgeslagen onder één sleutel in `localStorage`. Datums zijn
lokale dagsleutels (`"2026-08-04"`), niet UTC — anders verspringt "vandaag" 's
avonds.

```
Profile ─────────── naam, gewicht, lengte, fase, eiwit g/kg, lesdagen,
                    voorkeurstijdstip per dagsoort, weegdag, stappendoel
Settings ────────── thema, haptiek, alcoholhint

TRAINING
  WorkoutTemplate ── naam, split, volgorde, minimale versie
    └ TemplateExercise ── sets, repbereik (low/high), keystone-vlag
  WorkoutSession ─── dag, template, status, start/eind
    └ SetLog ──────── oefening, setindex, gewicht, reps, gedaan
  CardioSession ──── dag, type, minuten, afstand
  StepLog ────────── dag, stappen

VOEDING
  FoodPreset ─────── naam, portie, macro's, kwaliteit (basis|vrij), noodmaaltijd
  MealEntry ──────── dag, macro's, porties, kwaliteit
  AlcoholPreset ──── naam, volume, kcal, standaardglazen, abv
  AlcoholEntry ───── dag, aantal, kcal, glazen, uren sinds training
  Supplement ─────── key, dosis, prioriteit, elke-dag-vlag
  SupplementLog ──── dag, ingenomen[]
  MealPrepPlan ───── week
    └ PrepItem ───── naam, component, porties, noodmaaltijd, gedaan

LICHAAM
  WeighIn ────────── dag, gewicht, vet%, spiermassa
  ProgressPhoto ──── dag, blobKey (IndexedDB), koppeling aan meting

GEWOONTES
  Habit ──────────── identiteit, naam, anker, minimale versie,
                     actieve dagen, autoSource
  HabitLog ───────── gewoonte, dag, vol|minimaal
  ImplementationIntention ── als-trigger, dan-actie
  healthyDays ────── lijst dagen die je zelf op groen hebt gezet

WEEK
  WeeklyCheckIn ──── week, haalbare dagen, energie, aanpassing
  WeekPlan ───────── week, split, dag→template-toewijzing
```

Twee ontwerpkeuzes die het gebruik merkbaar veranderen:

- **Streaks worden niet opgeslagen, maar afgeleid.** Ze zijn een functie van de
  logs, dus er is geen teller die corrupt kan raken of "kwijt" kan gaan.
- **`autoSource` scheelt taps.** De gewoontes Training, Eiwitdoel,
  Supplementen en Stappen vinken zichzelf af zodra de onderliggende module dat
  aantoont. Je logt nooit twee keer hetzelfde.

---

## 3. MVP-scope

**Fase 1 — gebouwd, dit is wat er nu draait**

- Onboarding, profiel en macrodoelen (recomp / lean bulk / cut)
- Volledig 6-daags PPL met automatische afschaling naar 5, 4 of 3 dagen
- Sessie loggen: getallen zijn invoervelden waar je direct in typt, +/- houdt
  je ingedrukt voor bijstellen, en progressive-overload-voorstellen staan al
  ingevuld
- Sessie ter plekke aanpassen: oefening vervangen, toevoegen, weghalen, set
  erbij — plus "iets anders gedaan" voor alles buiten het schema
- Voortgang per training: volume per sessie als staafgrafiek met
  procentuele verandering, en per oefening het verloop van je werkgewicht
- Agenda op het beginscherm: dagen op groen zetten (ook terugwerkend), met
  een stipje op de dagen waarop je getraind hebt
- "Even geen dag"-knop en minimale versies
- Cardio los van het krachtschema, inclusief interference-waarschuwing
- Eten loggen met presets, zelf toevoegen, 80/20-weekbalans
- Alcoholpresets met automatische verrekening en zachte hersteltip
- Supplementenchecklist, stappen
- Wegen met harde 1×-per-week-grens, trend met voortschrijdend gemiddelde,
  coachingdrempels, lokale voortgangsfoto's
- Gewoontes met ankers, veerkrachtige streaks, never-miss-twice-interventies
- Als-dan-regels, weekcheck-in, meal prep-planner met boodschappenlijst
- Donker/licht, offline (PWA, installeerbaar), CSV/PDF-export, JSON-back-up

**Fase 2 — de volgende logische stap**

- Echte notificaties (Web Push / lokale notificaties) op basis van de ankers,
  inclusief de avondherinnering om de gymtas klaar te leggen
- K-BODY-weegschaal uitlezen via Bluetooth in plaats van overtypen
- Stappen uit Health Connect / Apple Health
- Barcode scannen voor voedingsproducten
- Oefeningen zelf toevoegen en templates aanpassen in de app
- Rusttimer tussen sets

**Fase 3 — pas als de rest blijft plakken**

- End-to-end versleutelde sync tussen apparaten (optioneel, nooit verplicht)
- Deload-detectie en automatische volumeaanpassing bij stagnatie
- Langetermijnrapportage (kwartaal-/jaartrends, PR-overzicht)
- Export naar een coach of fysio

---

## Kennisbasis

Alle trainings-, voedings-, alcohol- en supplementcijfers staan in
[`app/presets.js`](app/presets.js) met een verwijzing naar de paragraaf uit de
specificatie waar ze vandaan komen. Ze zijn niet zelf bedacht.

Twee uitzonderingen staan expliciet gemarkeerd met `STARTWAARDE`, omdat de
kennisbasis daar geen cijfer voor geeft:

- de kcal van alcoholvrij bier (verschilt sterk per merk, aanpasbaar);
- de startlijst met voedingsmiddelen (de kennisbasis geeft formules, geen
  productendatabank — alles is aanpasbaar en uitbreidbaar).

De onderhoudscalorieën komen uit Mifflin-St Jeor × activiteitsfactor, met een
handmatige override in de instellingen; de kennisbasis geeft wel de
fase-offsets, maar geen basisformule.

De app raadt bewust géén BCAA's, vetverbranders of testosteron-boosters aan.

---

## Techniek

Geen framework, geen bundler, geen buildstap. De hele app is ~4.000 regels
JavaScript verdeeld over losse ES-modules:

```
index.html          laadt app/main.js als <script type="module">
styles.css          CSS-variabelen voor donker en licht
sw.js               service worker (offline)
app/
  main.js           routering, hertekenen, service worker
  dom.js            el() / svg(), hertekenen met scroll- en focusbehoud
  ui.js             kaarten, steppers, ringen, vensters, toasts
  nav.js            hash-routing
  store.js          state + localStorage + IndexedDB voor foto's
  date.js           dagsleutels, ISO-weken, Nederlandse notatie
  presets.js        de kennisbasis
  nutrition.js      macro's, fase-offsets, 80/20
  training.js       progressive overload, schemakeuze
  progress.js       volume per sessie, verloop per oefening
  habits.js         streaks en never-miss-twice
  body.js           weeglimiet, trend, coachingdrempels
  selectors.js      afgeleide gegevens over modules heen
  export.js         CSV, printbaar rapport, back-up
  screens/          negen schermen, elk een functie die DOM teruggeeft
```

**Hertekenen.** Een scherm is een functie die een DOM-element teruggeeft. Bij
een wijziging in de store wordt het scherm opnieuw opgebouwd, met behoud van de
scrollpositie — wie een set afvinkt halverwege een lange oefeningenlijst, wil
niet terug naar boven. Tekstvelden werken hun eigen waarde bij zonder
hertekening, zodat de focus tijdens het typen nooit wegspringt.

**Opslag.** Alles in `localStorage` onder één sleutel; voortgangsfoto's in
IndexedDB omdat ze niet in de quota van `localStorage` passen.

**Offline.** De service worker cachet de app-shell met
stale-while-revalidate: je krijgt meteen de gecachete versie en de nieuwe wordt
op de achtergrond opgehaald. Omdat er geen buildstap is, zit er geen hash in de
bestandsnamen — cache-first zou een update dus nooit binnenhalen.

**Data eruit krijgen.** CSV per onderdeel of als één bestand, een printbaar
overzicht (de browser maakt de PDF, zodat er niets het apparaat verlaat), en een
volledige JSON-back-up die je weer kunt terugzetten.

**Grafieken.** De staven lopen vanaf nul, zoals het hoort — maar daardoor zie
je een stijging van 8% nauwelijks aan de hoogtes. De procentuele verandering
staat er daarom als getal naast: die beantwoordt "doe ik steeds meer?" zonder
de grafiek scheef te trekken. Volume telt alleen het gewicht dat je extra
tilt, dus een sessie met puur lichaamsgewicht komt op nul uit; dat meldt de
app expliciet in plaats van "100% minder" te tonen.

### Tests

98 tests over de logica die fout kán gaan. Ze draaien op dezelfde modules die de
browser laadt — er is geen aparte bouw voor tests:

- `habits.test.js` — streaks, veerkracht bij één misser, de omslag naar
  interventie bij twee, en een test die schuldgevoel-taal uitsluit
- `nutrition.test.js` — macroberekening, fase-offsets, 80/20-balans, en de
  alcoholpresets tegen de kennisbasis
- `training.test.js` — progressive overload, schemakeuze, en de controle dat
  elk schema elke spiergroep ≥2× per week traint
- `body.test.js` — de 1×-per-week-grens, voortschrijdend gemiddelde en de
  coachingdrempels
- `progress.test.js` — volume per schema, verloop per oefening, en dat een
  lichaamsgewicht-sessie geen "100% minder" oplevert
- `scheduler.test.js` — dat een hertekening die zichzelf uitlokt netjes
  achteraan aansluit in plaats van de lopende beurt te onderbreken
- `store.test.js` — dat elke wijziging een nieuwe root-referentie oplevert
