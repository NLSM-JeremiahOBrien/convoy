/* ============================================================
   Historical data — Liberty ships, destroyers, U-boats, aces
   ============================================================ */

// 25 Liberty ships, all real names from the WWII Liberty fleet.
export const LIBERTY_SHIP_NAMES = [
  'JEREMIAH O\'BRIEN',
  'JOHN W. BROWN',
  'PATRICK HENRY',
  'STEPHEN HOPKINS',
  'BOOKER T. WASHINGTON',
  'ROBERT E. PEARY',
  'JOSHUA HENDY',
  'WILLIAM TILGHMAN',
  'JOHN ADAMS',
  'PAUL REVERE',
  'JAMES OTIS',
  'BENJAMIN FRANKLIN',
  'THOMAS PAINE',
  'NATHAN HALE',
  'SAM HOUSTON',
  'DAVY CROCKETT',
  'JOHN HANCOCK',
  'JIM BRIDGER',
  'WILLIAM FLOYD',
  'ROGER SHERMAN',
  'SAMUEL ADAMS',
  'CASPAR WISTAR',
  'JOHN SEDGWICK',
  'HENRY KNOX',
  'MOLLY PITCHER',
];

// Destroyer names — historic Fletcher / Gleaves / Benson class names.
export const DESTROYER_NAMES = [
  'USS FLETCHER',
  'USS O\'BANNON',
  'USS NICHOLAS',
  'USS TAYLOR',
];

// Player colors (max 4 players).
export const PLAYER_COLORS = [
  { name: 'BLUE',   hex: 0x4488ff, css: '#4488ff' },
  { name: 'RED',    hex: 0xff5555, css: '#ff5555' },
  { name: 'GREEN',  hex: 0x55cc55, css: '#55cc55' },
  { name: 'GOLD',   hex: 0xffcc44, css: '#ffcc44' },
];

export type AceCommander = {
  name: string;
  rank: string;
  uboat: string;
  body: string;
  attackBonus: number;   // +1 to attack rolls
  evadeBonus: number;    // +1 to evasion
};

// Real WWII U-boat aces. Facts simplified but factual.
export const ACE_COMMANDERS: AceCommander[] = [
  {
    name: 'OTTO KRETSCHMER',
    rank: 'Kapitänleutnant · "Tonnage King"',
    uboat: 'U-99',
    body:
      'Otto Kretschmer was the top-scoring U-boat ace of WWII, sinking 47 Allied ships totaling ' +
      '274,000 tons. He pioneered the dangerous tactic of attacking on the surface AT NIGHT from ' +
      'INSIDE the convoy formation, where escorts couldn\'t see him. The Royal Navy finally caught ' +
      'U-99 in March 1941. Kretschmer survived the war as a POW and later commanded NATO submarines. ' +
      'Watch for surprise night surface attacks — this commander shoots accurately.',
    attackBonus: 1,
    evadeBonus: 1,
  },
  {
    name: 'GÜNTHER PRIEN',
    rank: 'Kapitänleutnant · "The Bull of Scapa Flow"',
    uboat: 'U-47',
    body:
      'Günther Prien became a German national hero in October 1939 when he sneaked U-47 INTO the ' +
      'Royal Navy\'s anchorage at Scapa Flow and sank the battleship HMS Royal Oak — killing 833 ' +
      'British sailors. He sank 30 Allied ships before U-47 was lost with all hands in March 1941, ' +
      'probably depth-charged by the destroyer HMS Wolverine. Bold. Aggressive. Hard to surprise.',
    attackBonus: 1,
    evadeBonus: 0,
  },
  {
    name: 'JOACHIM SCHEPKE',
    rank: 'Korvettenkapitän · The Showman',
    uboat: 'U-100',
    body:
      'Schepke was famous in Germany for his good looks and showmanship — and for sinking 37 ' +
      'Allied ships. He commanded U-100 in the same wolfpack as Kretschmer and Prien. On the night ' +
      'of March 17, 1941, the British destroyer HMS Vanoc became the first warship to detect a ' +
      'U-boat by RADAR — then rammed U-100, killing Schepke. The Battle of the Atlantic turned ' +
      'that night. He\'s fast and aggressive on the surface.',
    attackBonus: 0,
    evadeBonus: 1,
  },
  {
    name: 'WOLFGANG LÜTH',
    rank: 'Korvettenkapitän · The Patient Hunter',
    uboat: 'U-181',
    body:
      'Wolfgang Lüth sank 46 Allied ships on long patrols deep into the Indian Ocean and South ' +
      'Atlantic — the second-highest score of the war. Famously patient: he would stalk a target ' +
      'for days. He survived the war but was killed days after V-E Day when a German sentry ' +
      'mistakenly shot him in the dark. This commander hides patiently — sonar may miss him.',
    attackBonus: 0,
    evadeBonus: 2,
  },
  {
    name: 'ERICH TOPP',
    rank: 'Kapitänleutnant · "The Red Devil"',
    uboat: 'U-552',
    body:
      'Erich Topp sank 35 Allied ships including the USS Reuben James in October 1941 — the first ' +
      'US warship sunk in WWII, even before Pearl Harbor. He survived the war, wrote his memoirs, ' +
      'and later served in the post-war West German navy. He hates American destroyers.',
    attackBonus: 1,
    evadeBonus: 0,
  },
];

// Game constants — tuned for fun, not perfect realism.
export const GAME_CONFIG = {
  CONVOY_SIZE: 25,
  CONVOY_COLS: 5,
  CONVOY_ROWS: 5,
  CONVOY_SPACING: 22,
  TURNS_QUICK: 7,
  TURNS_FULL: 14,
  VICTORY_RATIO: 0.6,           // 60% of convoy must survive
  UBOATS_QUICK: 10,
  UBOATS_FULL: 16,
  ACE_CHANCE: 0.25,             // 25% chance any given U-boat is an ace
  DESTROYER_HULL: 100,
  DEPTH_CHARGES_PER_PLAYER: 12,
  SONAR_COOLDOWN: 0,            // turns (0 = no cooldown between pings)
  SONAR_PINGS_PER_TURN: 5,      // pings allowed per turn per destroyer
  DECK_GUN_COOLDOWN: 0,
  SONAR_RANGE: 60,              // world units
  DEPTH_CHARGE_RANGE: 50,
  DECK_GUN_RANGE: 90,
  CONVOY_SPEED: 6,              // forward movement per turn
  UBOAT_SPEED_SUBMERGED: 3,
  UBOAT_SPEED_SURFACED: 7,
  WORLD_LENGTH: 600,            // total distance to Liverpool
};
