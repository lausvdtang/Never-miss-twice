/**
 * Ingebouwde kennisbasis.
 *
 * Alle trainings-, voedings-, alcohol- en supplementcijfers hier komen uit de
 * kennisbasis van de app-specificatie (§8). Ze zijn niet zelf verzonnen en
 * horen niet aangepast te worden zonder bronvermelding. Uitzonderingen zijn
 * expliciet gemarkeerd met STARTWAARDE.
 */

let seq = 0;
const uid = (prefix) => `${prefix}_${(seq++).toString(36)}`;

function ex(name, sets, repRange, opts = {}) {
  const [lo, hi] = repRange.includes('-')
    ? repRange.split('-').map((n) => parseInt(n, 10))
    : [parseInt(repRange, 10), parseInt(repRange, 10)];
  return { id: uid('ex'), name, sets, repRange, repLow: lo, repHigh: hi, ...opts };
}

/* --------------------------------------------------- 6-daags Push/Pull/Legs */

const PUSH_A = [
  ex('Bench press', 3, '6-8', { isKeystone: true }),
  ex('Incline dumbbell press', 3, '8-10'),
  ex('Overhead press', 3, '8-10'),
  ex('Lateral raises', 3, '12-15'),
  ex('Triceps pushdown', 3, '10-12'),
  ex('Overhead triceps extension', 2, '12'),
];

const PULL_A = [
  ex('Pull-ups / lat pulldown', 3, '8-10', { isKeystone: true }),
  ex('Barbell row', 3, '8-10'),
  ex('Face pulls', 3, '15'),
  ex('Rear delt fly', 3, '15'),
  ex('Barbell curl', 3, '10'),
  ex('Hammer curl', 2, '12'),
];

const LEGS_A = [
  ex('Squat', 3, '6-8', { isKeystone: true }),
  ex('Romanian deadlift', 3, '8-10'),
  ex('Leg press', 3, '12'),
  ex('Leg curl', 3, '12'),
  ex('Calf raises', 4, '12-15'),
  ex('Hanging knee raises', 3, '12'),
];

const PUSH_B = [
  ex('Incline barbell press', 3, '8', { isKeystone: true }),
  ex('Dumbbell shoulder press', 3, '8-10'),
  ex('Dips', 3, '8-10'),
  ex('Cable fly', 3, '12'),
  ex('Lateral raises', 3, '15'),
  ex('Triceps', 3, '12'),
];

const PULL_B = [
  ex('Deadlift (of rack pulls)', 3, '5', { isKeystone: true }),
  ex('Seated cable row', 3, '10'),
  ex('Lat pulldown', 3, '10'),
  ex('Face pulls', 3, '15'),
  ex('Incline dumbbell curl', 3, '12'),
  ex('Cable crunch', 3, '12'),
];

const LEGS_B = [
  ex('Front / goblet squat', 3, '10', { isKeystone: true }),
  ex('Bulgarian split squat', 3, '10', { note: 'per been' }),
  ex('Leg extension', 3, '15'),
  ex('Leg curl', 3, '12'),
  ex('Calf raises', 4, '15'),
  ex('Plank / side plank', 3, '30', { note: 'seconden' }),
];

/* ------------------------------- 4-daags Upper/Lower (elke spiergroep 2×/wk) */

const UPPER_A = [
  ex('Bench press', 3, '6-8', { isKeystone: true }),
  ex('Barbell row', 3, '8-10'),
  ex('Overhead press', 3, '8-10'),
  ex('Lat pulldown', 3, '10'),
  ex('Lateral raises', 3, '12-15'),
  ex('Barbell curl', 3, '10'),
];

const LOWER_A = [
  ex('Squat', 3, '6-8', { isKeystone: true }),
  ex('Romanian deadlift', 3, '8-10'),
  ex('Leg press', 3, '12'),
  ex('Leg curl', 3, '12'),
  ex('Calf raises', 4, '12-15'),
  ex('Hanging knee raises', 3, '12'),
];

const UPPER_B = [
  ex('Incline barbell press', 3, '8', { isKeystone: true }),
  ex('Seated cable row', 3, '10'),
  ex('Dumbbell shoulder press', 3, '8-10'),
  ex('Pull-ups / lat pulldown', 3, '8-10'),
  ex('Face pulls', 3, '15'),
  ex('Triceps pushdown', 3, '10-12'),
];

const LOWER_B = [
  ex('Front / goblet squat', 3, '10', { isKeystone: true }),
  ex('Bulgarian split squat', 3, '10', { note: 'per been' }),
  ex('Leg extension', 3, '15'),
  ex('Leg curl', 3, '12'),
  ex('Calf raises', 4, '15'),
  ex('Cable crunch', 3, '12'),
];

/* --- 3-daags Full Body: elke sessie squat/hinge + duw + trek + core (§8.2) --- */

const FULL_A = [
  ex('Squat', 3, '6-8', { isKeystone: true }),
  ex('Bench press', 3, '6-8'),
  ex('Barbell row', 3, '8-10'),
  ex('Overhead press', 3, '8-10'),
  ex('Hanging knee raises', 3, '12'),
];

const FULL_B = [
  ex('Deadlift (of rack pulls)', 3, '5', { isKeystone: true }),
  ex('Incline dumbbell press', 3, '8-10'),
  ex('Pull-ups / lat pulldown', 3, '8-10'),
  ex('Leg press', 3, '12'),
  ex('Plank / side plank', 3, '30', { note: 'seconden' }),
];

const FULL_C = [
  ex('Romanian deadlift', 3, '8-10', { isKeystone: true }),
  ex('Dumbbell shoulder press', 3, '8-10'),
  ex('Seated cable row', 3, '10'),
  ex('Bulgarian split squat', 3, '10', { note: 'per been' }),
  ex('Cable crunch', 3, '12'),
];

/** "Bad day"-versie uit §8.2: 1 oefening, 5 minuten — telt altijd als voltooid. */
export const MINIMAL_VERSION_TEXT = '1 oefening, 5 minuten — telt als voltooid.';

export function buildTemplates() {
  const mk = (name, split, order, exercises) => ({
    id: `tpl_${split}_${order}`,
    name,
    split,
    order,
    exercises,
    minimalVersion: MINIMAL_VERSION_TEXT,
  });

  return [
    mk('Push A', 'ppl6', 1, PUSH_A),
    mk('Pull A', 'ppl6', 2, PULL_A),
    mk('Legs A', 'ppl6', 3, LEGS_A),
    mk('Push B', 'ppl6', 4, PUSH_B),
    mk('Pull B', 'ppl6', 5, PULL_B),
    mk('Legs B', 'ppl6', 6, LEGS_B),

    mk('Upper A', 'upperlower5', 1, UPPER_A),
    mk('Lower A', 'upperlower5', 2, LOWER_A),
    mk('Upper B', 'upperlower5', 3, UPPER_B),
    mk('Lower B', 'upperlower5', 4, LOWER_B),
    mk('Full Body C', 'upperlower5', 5, FULL_C),

    mk('Upper A', 'upperlower4', 1, UPPER_A),
    mk('Lower A', 'upperlower4', 2, LOWER_A),
    mk('Upper B', 'upperlower4', 3, UPPER_B),
    mk('Lower B', 'upperlower4', 4, LOWER_B),

    mk('Full Body A', 'fullbody3', 1, FULL_A),
    mk('Full Body B', 'fullbody3', 2, FULL_B),
    mk('Full Body C', 'fullbody3', 3, FULL_C),
  ];
}

/**
 * Alle oefeningen die in de schema's voorkomen, plus een paar gangbare
 * alternatieven. Gebruikt om een oefening te vervangen of toe te voegen als de
 * sportschool vol is of iets niet lekker ligt.
 */
export function exerciseLibrary() {
  const seen = new Map();
  for (const template of buildTemplates()) {
    for (const e of template.exercises) {
      if (!seen.has(e.name)) {
        seen.set(e.name, { name: e.name, sets: e.sets, repRange: e.repRange });
      }
    }
  }

  // Veelgebruikte vervangers die niet in de standaardschema's zitten.
  const extras = [
    { name: 'Machine chest press', sets: 3, repRange: '8-10' },
    { name: 'Push-ups', sets: 3, repRange: '12-15' },
    { name: 'Chest-supported row', sets: 3, repRange: '10' },
    { name: 'Single-arm dumbbell row', sets: 3, repRange: '10' },
    { name: 'Hack squat', sets: 3, repRange: '8-10' },
    { name: 'Lunges', sets: 3, repRange: '10' },
    { name: 'Hip thrust', sets: 3, repRange: '10' },
    { name: 'Machine shoulder press', sets: 3, repRange: '10' },
    { name: 'Cable lateral raise', sets: 3, repRange: '15' },
    { name: 'Rope curl', sets: 3, repRange: '12' },
    { name: 'Skull crushers', sets: 3, repRange: '12' },
    { name: 'Ab wheel', sets: 3, repRange: '10' },
    { name: 'Roeimachine', sets: 1, repRange: '10' },
  ];
  for (const e of extras) if (!seen.has(e.name)) seen.set(e.name, e);

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const SPLIT_LABELS = {
  ppl6: '6-daags Push/Pull/Legs',
  upperlower5: '5-daags Upper/Lower + Full Body',
  upperlower4: '4-daags Upper/Lower',
  fullbody3: '3-daags Full Body',
};

/**
 * Welk schema hoort bij hoeveel haalbare dagen?
 * §8.1: de enige harde regel is elke spiergroep ≥2× per week. Frequentie
 * verder kiezen op wat je volhoudt, niet op een "optimaal" getal.
 */
export function splitForDays(days) {
  if (days >= 6) return 'ppl6';
  if (days === 5) return 'upperlower5';
  if (days === 4) return 'upperlower4';
  return 'fullbody3';
}

/** Op welke weekdagen komen de sessies te staan? */
export function defaultDayAssignment(days) {
  switch (days) {
    case 6:
      return [1, 2, 3, 4, 5, 6]; // zo = rust of actief herstel (§8.2)
    case 5:
      return [1, 2, 4, 5, 6];
    case 4:
      return [1, 2, 4, 6];
    default:
      return [1, 3, 5]; // Full Body op ma/wo/vr (§8.2)
  }
}

/* ------------------------------------------------- Alcohol-databank (§8.4) */

/** 1 Nederlands standaardglas = ~10 g pure alcohol = ~71 kcal (bij bier 250 ml). */
export const KCAL_PER_STANDARD_GLASS = 71;

export const ALCOHOL_PRESETS = [
  {
    id: 'alc_pils_flesje',
    name: 'Pils — flesje',
    volumeMl: 330,
    kcal: 135, // §8.4: ~40 kcal/100 ml → ~130-140 kcal per flesje
    standardGlasses: 1.3, // 330 ml / 250 ml per standaardglas
    abv: 5,
  },
  {
    id: 'alc_pils_vaasje',
    name: 'Pils — vaasje',
    volumeMl: 250,
    kcal: 102, // §8.4: vaasje ~100-105 kcal
    standardGlasses: 1,
    abv: 5,
  },
  {
    id: 'alc_speciaal',
    name: 'Speciaalbier / IPA',
    volumeMl: 330,
    kcal: 231, // §8.4: 6-8% → ~60-80 kcal/100 ml, hier 70 kcal/100 ml
    standardGlasses: 2, // §8.4: 330 ml speciaalbier telt vaak al als ~2 standaardglazen
    abv: 7,
  },
  {
    id: 'alc_tripel',
    name: 'Tripel',
    volumeMl: 330,
    kcal: 251, // §8.4: tripel ~76 kcal/100 ml
    standardGlasses: 2,
    abv: 8,
  },
  {
    id: 'alc_af',
    name: 'Alcoholvrij bier',
    volumeMl: 330,
    kcal: 70, // STARTWAARDE — verschilt sterk per merk, aanpasbaar in de app
    standardGlasses: 0,
    abv: 0,
  },
];

/** §8.4: zachte hint bij loggen <3-6 uur na een sessie. Geen verbod. */
export const ALCOHOL_RECOVERY_WINDOW_HOURS = 6;

/* ------------------------------------------------------ Supplementen (§8.5) */

export const DEFAULT_SUPPLEMENTS = [
  {
    key: 'creatine',
    name: 'Creatine monohydraat',
    dose: '3-5 g',
    priority: 1,
    everyDay: true,
    enabled: true,
    hint: 'Elke dag, ook op rustdagen. Geen laadfase nodig.',
  },
  {
    key: 'eiwitpoeder',
    name: 'Eiwitpoeder',
    dose: '1 schep',
    priority: 2,
    everyDay: false,
    enabled: true,
    hint: 'Hulpmiddel om je eiwitdoel te halen, geen vereiste.',
  },
  {
    key: 'vitamined',
    name: 'Vitamine D',
    dose: '10-25 mcg',
    priority: 3,
    everyDay: true,
    enabled: true,
    hint: 'Vooral relevant in de Nederlandse winter.',
  },
  {
    key: 'cafeine',
    name: 'Cafeïne',
    dose: 'pre-workout',
    priority: 4,
    everyDay: false,
    enabled: true,
    hint: 'Voor focus en energie. Niet te laat op de dag — dat kost slaap.',
  },
  {
    key: 'omega3',
    name: 'Omega-3',
    dose: 'optioneel',
    priority: 5,
    everyDay: false,
    enabled: false,
    hint: 'Optioneel, lagere prioriteit.',
  },
];

/** §8.5: expliciet géén meerwaarde — de app raadt deze niet aan. */
export const NOT_RECOMMENDED = ['BCAA’s', 'Vetverbranders', 'Testosteron-boosters'];

/* ---------------------------------------------------- Voeding: startlijst */

/**
 * STARTWAARDEN. De kennisbasis geeft formules, geen productendatabank; dit is
 * een kleine startlijst met gangbare porties die de gebruiker vrij kan
 * aanpassen en uitbreiden. `quality` volgt de 80/20-regel uit §8.3:
 * 'basis' = onbewerkt/voedzaam (de 80%), 'vrij' = vrij te besteden (de 20%).
 */
export const DEFAULT_FOOD_PRESETS = [
  { id: 'f_kip', name: 'Kipfilet', portion: '150 g', kcal: 248, proteinG: 46, carbsG: 0, fatG: 6, quality: 'basis', favorite: true },
  { id: 'f_kwark', name: 'Magere kwark', portion: '250 g', kcal: 148, proteinG: 25, carbsG: 10, fatG: 0, quality: 'basis', favorite: true },
  { id: 'f_eieren', name: 'Eieren', portion: '3 stuks', kcal: 234, proteinG: 19, carbsG: 1, fatG: 17, quality: 'basis', favorite: true },
  { id: 'f_shake', name: 'Eiwitshake', portion: '1 schep', kcal: 120, proteinG: 24, carbsG: 3, fatG: 2, quality: 'basis', favorite: true },
  { id: 'f_zalm', name: 'Zalm', portion: '150 g', kcal: 309, proteinG: 31, carbsG: 0, fatG: 20, quality: 'basis' },
  { id: 'f_tonijn', name: 'Tonijn in water', portion: '1 blik (145 g)', kcal: 155, proteinG: 34, carbsG: 0, fatG: 2, quality: 'basis' },
  { id: 'f_rundergehakt', name: 'Mager rundergehakt', portion: '150 g', kcal: 268, proteinG: 30, carbsG: 0, fatG: 16, quality: 'basis' },
  { id: 'f_tofu', name: 'Tofu', portion: '150 g', kcal: 172, proteinG: 18, carbsG: 3, fatG: 10, quality: 'basis' },
  { id: 'f_rijst', name: 'Rijst (gekookt)', portion: '200 g', kcal: 260, proteinG: 5, carbsG: 56, fatG: 1, quality: 'basis', favorite: true },
  { id: 'f_aardappel', name: 'Aardappelen', portion: '250 g', kcal: 218, proteinG: 5, carbsG: 48, fatG: 0, quality: 'basis' },
  { id: 'f_pasta', name: 'Volkoren pasta (gekookt)', portion: '200 g', kcal: 262, proteinG: 10, carbsG: 50, fatG: 2, quality: 'basis' },
  { id: 'f_havermout', name: 'Havermout', portion: '80 g droog', kcal: 303, proteinG: 11, carbsG: 50, fatG: 6, quality: 'basis', favorite: true },
  { id: 'f_brood', name: 'Volkorenbrood', portion: '2 sneden', kcal: 186, proteinG: 8, carbsG: 32, fatG: 2, quality: 'basis' },
  { id: 'f_groente', name: 'Groente (gemengd)', portion: '200 g', kcal: 60, proteinG: 4, carbsG: 8, fatG: 1, quality: 'basis', favorite: true },
  { id: 'f_banaan', name: 'Banaan', portion: '1 stuk', kcal: 105, proteinG: 1, carbsG: 27, fatG: 0, quality: 'basis' },
  { id: 'f_olijfolie', name: 'Olijfolie', portion: '1 el', kcal: 119, proteinG: 0, carbsG: 0, fatG: 14, quality: 'basis' },
  { id: 'f_noten', name: 'Ongezouten noten', portion: '30 g', kcal: 180, proteinG: 6, carbsG: 5, fatG: 16, quality: 'basis' },
  { id: 'f_pindakaas', name: 'Pindakaas', portion: '1 el', kcal: 94, proteinG: 4, carbsG: 3, fatG: 8, quality: 'basis' },
  // Vrij te besteden (de 20%) — geen verboden voedingsmiddelen, alleen een budget.
  { id: 'f_chocola', name: 'Chocolade', portion: '2 blokjes', kcal: 110, proteinG: 1, carbsG: 12, fatG: 7, quality: 'vrij' },
  { id: 'f_chips', name: 'Chips', portion: 'handje (30 g)', kcal: 160, proteinG: 2, carbsG: 15, fatG: 10, quality: 'vrij' },
  { id: 'f_friet', name: 'Patat', portion: 'kleine portie', kcal: 380, proteinG: 5, carbsG: 46, fatG: 19, quality: 'vrij' },
  { id: 'f_pizza', name: 'Pizza', portion: '2 punten', kcal: 570, proteinG: 24, carbsG: 66, fatG: 22, quality: 'vrij' },
  // Noodmaaltijden — moeten altijd klaarstaan voor slechte dagen.
  { id: 'f_nood_kwark', name: 'Kwark + noten (nood)', portion: '1 bak', kcal: 328, proteinG: 31, carbsG: 15, fatG: 16, quality: 'basis', emergency: true, favorite: true },
  { id: 'f_nood_diepvries', name: 'Diepvriesmaaltijd (nood)', portion: '1 portie', kcal: 450, proteinG: 30, carbsG: 45, fatG: 15, quality: 'basis', emergency: true },
  { id: 'f_nood_wraps', name: 'Wrap met kip (nood)', portion: '2 wraps', kcal: 480, proteinG: 38, carbsG: 45, fatG: 14, quality: 'basis', emergency: true },
];

/* -------------------------------------------- Meal prep: basisformule (§3B) */

export const PREP_FORMULA = [
  {
    component: 'eiwit',
    label: 'Eiwitbron',
    suggestions: ['Kipfilet', 'Rundergehakt', 'Zalm', 'Tofu', 'Eieren', 'Kikkererwten'],
  },
  {
    component: 'koolhydraat',
    label: 'Koolhydraatbron',
    suggestions: ['Rijst', 'Aardappelen', 'Volkoren pasta', 'Couscous', 'Zoete aardappel'],
  },
  {
    component: 'groente',
    label: 'Groente',
    suggestions: ['Broccoli', 'Paprika', 'Sperziebonen', 'Courgette', 'Spinazie', 'Wortel'],
  },
  {
    component: 'smaakmaker',
    label: 'Smaakmaker',
    suggestions: ['Kerrie', 'Sojasaus', 'Pesto', 'Tomatensaus', 'Paprikapoeder', 'Knoflook'],
  },
];

/* ----------------------------------------------------- Gewoontes (§3D, §8.7) */

export function buildDefaultHabits(now) {
  const base = { archived: false, createdAt: now, activeDays: [] };
  return [
    {
      ...base,
      id: 'hab_training',
      identity: 'Ik ben iemand die traint',
      name: 'Training',
      anchor: 'Op mijn trainingsdagen',
      minimalVersion: 'Naar de sportschool rijden telt al.',
      icon: '🏋️',
      autoSource: 'training',
    },
    {
      ...base,
      id: 'hab_eiwit',
      identity: 'Ik ben iemand die genoeg eiwit eet',
      name: 'Eiwitdoel',
      anchor: 'Bij elke maaltijd',
      minimalVersion: 'Eén eiwitshake telt.',
      icon: '🍗',
      autoSource: 'eiwit',
    },
    {
      ...base,
      id: 'hab_supp',
      identity: 'Ik ben iemand die zijn creatine neemt',
      name: 'Supplementen',
      anchor: 'Na het tandenpoetsen',
      minimalVersion: 'Alleen creatine telt ook.',
      icon: '💊',
      autoSource: 'supplementen',
    },
    {
      ...base,
      id: 'hab_stappen',
      identity: 'Ik ben iemand die elke dag beweegt',
      name: 'Stappen',
      anchor: 'Na het avondeten een blokje om',
      minimalVersion: '10 minuten wandelen telt.',
      icon: '👟',
      autoSource: 'stappen',
    },
    {
      ...base,
      id: 'hab_tas',
      identity: 'Ik ben iemand die zich voorbereidt',
      name: 'Gymtas klaar',
      anchor: 'Na het avondeten leg ik mijn gymtas klaar',
      minimalVersion: 'Alleen je schoenen bij de deur telt.',
      icon: '🎒',
      autoSource: null,
    },
  ];
}

/** §3D: voorbeelden voor de implementation-intentions-generator. */
export const INTENTION_TEMPLATES = [
  { trigger: 'Als het regent', action: 'dan doe ik 15 min bodyweight thuis' },
  { trigger: 'Als ik na school te moe ben', action: 'dan doe ik de 5-minutenversie' },
  { trigger: 'Als er geen eten klaarstaat', action: 'dan pak ik mijn noodmaaltijd' },
  { trigger: 'Als ik voor 9 uur wakker ben', action: 'dan train ik voor het werk' },
  { trigger: 'Als ik 2 dagen heb gemist', action: 'dan plan ik vanavond de kleinste versie' },
  { trigger: 'Als ik trek heb in snacks', action: 'dan drink ik eerst een glas water en wacht ik 10 min' },
];

/** §8.2: stappen als basis, hardlopen 2-3× per week 20-30 min. */
export const CARDIO_GUIDANCE = {
  stepGoalMin: 8000,
  stepGoalMax: 10000,
  runsPerWeekMin: 2,
  runsPerWeekMax: 3,
  runMinutesMin: 20,
  runMinutesMax: 30,
  interferenceWarning:
    'Niet vlak vóór je krachttraining hardlopen. Liever erna, of op een aparte dag.',
};

/** §8.1 / §8.6: doelen voor zichtbare buikspieren. */
export const BODY_FAT_TARGET = { min: 10, max: 12 };

/** §8.6: drempels voor coachingtips. */
export const TREND_THRESHOLDS = {
  fastLossPctPerWeek: 1,
  stallWeeks: 3,
  stallBumpKcal: [100, 150],
};

/** §8.7: geruststellende cijfers voor de onboarding — geen druk. */
export const HABIT_FORMATION = {
  averageDays: 66,
  rangeLow: 18,
  rangeHigh: 254,
  adhdMonthsLow: 3,
  adhdMonthsHigh: 5,
};
