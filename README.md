# Never Miss Twice

Een fitness-, voedings- en gewoontetracker voor iemand met ADHD die duurzaam
leaner en atletischer wil worden — zonder afhankelijk te zijn van wilskracht.

De app draait volledig lokaal, werkt offline, vraagt geen account en stuurt geen
enkel gegeven naar een server.

```bash
npm install
npm run dev      # ontwikkelserver
npm test         # 73 tests over de kernlogica
npm run build    # productiebundel in dist/
```

---

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
| Set afvinken in de sportschool | 1 (gewicht en reps staan al voorgevuld) |
| Hele oefening afvinken | 1 |
| Slechte dag redden | 2 — `Even geen dag` → bevestigen |

Tijdens een actieve sessie verdwijnt de tabbalk: één taak per scherm.

---

## 2. Datamodel

Alle entiteiten staan in [`src/lib/types.ts`](src/lib/types.ts). Datums zijn
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
- Sessie loggen met +/- steppers en progressive-overload-voorstellen
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
[`src/data/presets.ts`](src/data/presets.ts) met een verwijzing naar de
paragraaf uit de specificatie waar ze vandaan komen. Ze zijn niet zelf bedacht.

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

React 18 + TypeScript + Vite. Geen state-bibliotheek, geen router, geen
UI-framework: een store van ~40 regels op `useSyncExternalStore`, hash-routing,
en CSS-variabelen voor de twee thema's. De hele bundel is ~77 kB gzipped.

Waarom die keuze: prioriteit lag bij snelheid van interactie en betrouwbaarheid.
Minder afhankelijkheden betekent minder dat stuk kan tijdens het loggen van een
set met slecht bereik in de sportschool.

**Opslag.** Alles staat in `localStorage` onder één sleutel; voortgangsfoto's
in IndexedDB omdat ze niet in de quota van `localStorage` passen. De service
worker cachet de app-shell, dus de app start en logt zonder verbinding.

**Data eruit krijgen.** CSV per onderdeel of als één bestand, een printbaar
overzicht (de browser maakt de PDF, zodat er niets het apparaat verlaat), en een
volledige JSON-back-up die je weer kunt terugzetten.

### Tests

73 tests over de logica die fout kán gaan:

- `habits.test.ts` — streaks, veerkracht bij één misser, de omslag naar
  interventie bij twee, en een test die schuldgevoel-taal uitsluit
- `nutrition.test.ts` — macroberekening, fase-offsets, 80/20-balans, en de
  alcoholpresets tegen de kennisbasis
- `training.test.ts` — progressive overload, schemakeuze, en de controle dat
  elk schema elke spiergroep ≥2× per week traint
- `body.test.ts` — de 1×-per-week-grens, voortschrijdend gemiddelde en de
  coachingdrempels
- `store.test.ts` — dat elke wijziging een nieuwe root-referentie oplevert
