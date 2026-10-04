/**
 * Energy cost of the catalog's exercises: METs from the 2024 Adult Compendium of Physical
 * Activities (Herrmann et al., J Sport Health Sci 2024;13(1):6–12, doi:10.1016/j.jshs.2023.10.010,
 * pacompendium.com), the ACSM metabolic equations for walking and running.
 * kcal = MET × kg × hours (equivalently MET × 3.5 × kg / 200 per minute).
 *
 * Codes quoted are 2024 Compendium codes. Where no code names the movement, the closest
 * code is used and the source says so. Cross-check: slow body-weight reps measured by
 * indirect calorimetry cost about 0.5 kcal per squat, 0.77 per push-up, 0.13 per heel-raise
 * (Nakagata et al., J Strength Cond Res 2022;36(5):1290–1296) — the app uses MET × time instead.
 */
export interface EnergyEntry {
  /** MET while doing the exercise (moderate effort for the level). */
  met: number;
  /** MET when done hard / fast (level 3 or a hard set), if the Compendium gives it. */
  metVigorous?: number;
  /** Compendium activity code(s) the value comes from, and a few words. */
  source: string;
  /** Seconds one repetition takes at a normal pace (for reps-measured exercises), for time = reps × this. Per side for one-sided exercises. */
  secondsPerRep?: number;
}

const CALISTHENICS =
  '02022 calisthenics moderate 3.8 / 02020 vigorous 7.5 (push-ups, pull-ups, sit-ups)';
const BODYWEIGHT = '02056 body-weight resistance general 3.0 / 02057 high intensity 6.5';
const LIGHT = '02024 calisthenics light 2.8 (crunches, plank) / 02022 moderate 3.8';
const WEIGHTS = '02054 resistance training 8–15 reps 3.5 / 02050 weight lifting vigorous 6.0';
const LOWER_WEIGHTS = '02054 resistance training 8–15 reps 3.5 / 02052 squats, deadlift 5.0';
const ISOLATION = '02054 resistance training, multiple exercises, 8–15 reps 3.5';
const HIIT =
  '02210 high intensity interval moderate 7.0 / 02214 vigorous 11.0 (burpees, mountain climbers, squat jumps)';
const STRETCH = '02101 stretching, mild 2.3';
const YOGA = '02150 yoga, Hatha 2.3';
const FLOW = '02180 yoga, Surya Namaskar 3.5; 02030 calisthenics going up & down from floor 3.5';

export const EXERCISE_ENERGY: Record<string, EnergyEntry> = {
  // Push
  'push-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 2.5 },
  'knee-push-up': { met: 3.0, metVigorous: 6.5, source: BODYWEIGHT, secondsPerRep: 2.5 },
  'incline-push-up': { met: 3.0, metVigorous: 6.5, source: BODYWEIGHT, secondsPerRep: 2.5 },
  'decline-push-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3 },
  'diamond-push-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3 },
  'pike-push-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3 },
  'chair-dip': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 2.5 },
  // Pull
  'pull-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3.5 },
  'chin-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3.5 },
  'negative-pull-up': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 6 },
  'dead-hang': { met: 2.8, metVigorous: 3.8, source: `${LIGHT}; isometric hold, no own code` },
  'hanging-knee-raise': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3 },
  'inverted-row': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 3 },
  superman: {
    met: 3.5,
    metVigorous: 3.8,
    source: '02030 calisthenics, back exercises 3.5 / 02022 moderate 3.8',
    secondsPerRep: 3,
  },
  // Legs
  squat: {
    met: 3.8,
    metVigorous: 6.5,
    source:
      '02022 calisthenics moderate 3.8 (02344 sit-to-stand 18–24/min 4.0) / 02057 body weight high intensity 6.5',
    secondsPerRep: 3,
  },
  'jump-squat': { met: 7.0, metVigorous: 11.0, source: HIIT, secondsPerRep: 2 },
  lunge: {
    met: 3.8,
    metVigorous: 6.5,
    source: '02022 calisthenics moderate (lunges) 3.8 / 02057 body weight high intensity 6.5',
    secondsPerRep: 3,
  },
  'reverse-lunge': {
    met: 3.8,
    metVigorous: 6.5,
    source: '02022 calisthenics moderate (lunges) 3.8 / 02057 body weight high intensity 6.5',
    secondsPerRep: 3,
  },
  'bulgarian-split-squat': {
    met: 5.0,
    metVigorous: 6.5,
    source: '02052 resistance training, squats 5.0 / 02057 body weight high intensity 6.5',
    secondsPerRep: 3.5,
  },
  'step-up': {
    met: 5.5,
    metVigorous: 9.0,
    source: '02001 step, 4-inch 5.5 / 02003 step, 10–12 inch 9.0',
    secondsPerRep: 3,
  },
  'wall-sit': { met: 2.8, metVigorous: 3.8, source: `${LIGHT}; isometric hold, no own code` },
  'glute-bridge': {
    met: 3.0,
    metVigorous: 3.8,
    source: '02056 body-weight resistance general 3.0 / 02022 moderate 3.8',
    secondsPerRep: 3,
  },
  'single-leg-bridge': {
    met: 3.0,
    metVigorous: 3.8,
    source: '02056 body-weight resistance general 3.0 / 02022 moderate 3.8',
    secondsPerRep: 3,
  },
  'hip-thrust': { met: 3.5, metVigorous: 5.0, source: LOWER_WEIGHTS, secondsPerRep: 3 },
  'calf-raise': { met: 2.8, metVigorous: 3.8, source: LIGHT, secondsPerRep: 2 },
  'goblet-squat': { met: 3.5, metVigorous: 5.0, source: LOWER_WEIGHTS, secondsPerRep: 3 },
  'romanian-deadlift': { met: 3.5, metVigorous: 5.0, source: LOWER_WEIGHTS, secondsPerRep: 3.5 },
  'kettlebell-swing': {
    met: 9.8,
    source: '02058 kettle bell swings 9.8 (measured)',
    secondsPerRep: 2,
  },
  thruster: {
    met: 5.0,
    metVigorous: 6.0,
    source: '02052 squats, explosive 5.0 / 02050 weight lifting vigorous 6.0',
    secondsPerRep: 3,
  },
  // Arms, shoulders, back, chest with weights
  'biceps-curl': { met: 3.5, source: ISOLATION, secondsPerRep: 3 },
  'hammer-curl': { met: 3.5, source: ISOLATION, secondsPerRep: 3 },
  'shoulder-press': { met: 3.5, metVigorous: 6.0, source: WEIGHTS, secondsPerRep: 3 },
  'lateral-raise': { met: 3.5, source: ISOLATION, secondsPerRep: 3 },
  'dumbbell-row': { met: 3.5, metVigorous: 6.0, source: WEIGHTS, secondsPerRep: 3 },
  'bent-over-row': { met: 3.5, metVigorous: 6.0, source: WEIGHTS, secondsPerRep: 3 },
  'floor-press': { met: 3.5, metVigorous: 6.0, source: WEIGHTS, secondsPerRep: 3 },
  'bench-press': { met: 3.5, metVigorous: 6.0, source: WEIGHTS, secondsPerRep: 3 },
  'chest-fly': { met: 3.5, source: ISOLATION, secondsPerRep: 3 },
  'triceps-extension': { met: 3.5, source: ISOLATION, secondsPerRep: 3 },
  shrug: { met: 3.5, source: ISOLATION, secondsPerRep: 2.5 },
  'band-pull-apart': {
    met: 2.8,
    source: '02024 light effort 2.8; no own code, a light band',
    secondsPerRep: 2.5,
  },
  'band-row': { met: 3.5, source: ISOLATION, secondsPerRep: 2.5 },
  'farmer-carry': {
    met: 4.5,
    metVigorous: 6.5,
    source: '17018 carrying 15–155 lb, slow pace 4.5 / 17019 carrying 50–150 lb, moderate pace 6.5',
  },
  'turkish-get-up': {
    met: 3.5,
    metVigorous: 6.0,
    source: '02030 going up & down from floor 3.5 / 02050 weight lifting vigorous 6.0',
    secondsPerRep: 25,
  },
  'hand-grip': {
    met: 2.0,
    source: 'no Compendium code; set near 02116 arm ergometer 15 W 2.0',
    secondsPerRep: 1.5,
  },
  // Core
  plank: { met: 2.8, metVigorous: 3.8, source: LIGHT },
  'side-plank': { met: 2.8, metVigorous: 3.8, source: LIGHT },
  crunch: { met: 2.8, metVigorous: 3.8, source: LIGHT, secondsPerRep: 2 },
  'bicycle-crunch': { met: 2.8, metVigorous: 3.8, source: LIGHT, secondsPerRep: 2 },
  'leg-raise': { met: 2.8, metVigorous: 3.8, source: LIGHT, secondsPerRep: 3 },
  'russian-twist': { met: 2.8, metVigorous: 3.8, source: LIGHT, secondsPerRep: 1.5 },
  'dead-bug': {
    met: 2.8,
    metVigorous: 3.5,
    source: '02024 calisthenics light 2.8 / 02030 back exercises 3.5',
    secondsPerRep: 3,
  },
  'bird-dog': {
    met: 2.8,
    metVigorous: 3.5,
    source: '02024 calisthenics light 2.8 / 02030 back exercises 3.5',
    secondsPerRep: 4,
  },
  'hollow-hold': { met: 2.8, metVigorous: 3.8, source: LIGHT },
  'ab-wheel': { met: 3.8, metVigorous: 7.5, source: CALISTHENICS, secondsPerRep: 4 },
  'bear-crawl': { met: 3.8, metVigorous: 7.5, source: `${CALISTHENICS}; no own code` },
  // Cardio at home
  'mountain-climber': { met: 7.0, metVigorous: 11.0, source: HIIT },
  'jumping-jacks': { met: 7.5, source: '02020 calisthenics vigorous (jumping jacks) 7.5' },
  'high-knees': {
    met: 7.0,
    metVigorous: 11.0,
    source: `${HIIT}; 12025 jogging in place 4.8 is the floor`,
  },
  burpee: {
    met: 7.5,
    metVigorous: 11.0,
    source: '02020 calisthenics vigorous (burpees) 7.5 / 02214 HIIT vigorous (burpees) 11.0',
    secondsPerRep: 4.5,
  },
  'skater-jump': { met: 7.0, metVigorous: 11.0, source: HIIT },
  'march-in-place': {
    met: 3.5,
    metVigorous: 4.8,
    source:
      'no own code; between 09036 stepping in place 2.0 and 17088 marching 4.5 / 12025 jogging in place 4.8',
  },
  'shadow-boxing': {
    met: 5.8,
    metVigorous: 9.3,
    source: '15110 boxing, punching bag 5.8 / 15125 simulated boxing round, exercise 9.3',
  },
  'jump-rope': {
    met: 11.0,
    metVigorous: 12.3,
    source:
      '02068 rope skipping, general 11.0 (15552 slow <100/min 8.3) / 15550 fast 120–160/min 12.3',
  },
  // Distance cardio: when distance and time are known, the app uses walkingMet / runningMet instead.
  run: {
    met: 9.3,
    metVigorous: 11.8,
    source:
      '12050 running 6 mph (10 min/mile) 9.3 / 12080 7.5 mph 11.8; ACSM running equation when distance and time are known',
  },
  'intervals-run': {
    met: 10.5,
    metVigorous: 12.5,
    source:
      '12060 running 6.7 mph 10.5 / 12100 8.6 mph 12.5 (the fast bouts); ACSM running equation when distance and time are known',
  },
  walk: {
    met: 3.8,
    metVigorous: 4.8,
    source:
      '17190 walking 2.8–3.4 mph 3.8 / 17200 3.5–3.9 mph brisk 4.8; ACSM walking equation when distance and time are known',
  },
  'incline-walk': {
    met: 7.0,
    metVigorous: 8.8,
    source:
      '17035 uphill 6–10% grade 7.0 / 17036 11–20% grade 8.8; ACSM walking equation with grade when speed is known',
  },
  cycling: {
    met: 6.0,
    metVigorous: 8.0,
    source: '01220 stationary bike 90–100 W 6.0 (01200 general 6.8) / 01228 126–150 W 8.0',
  },
  rowing: {
    met: 5.0,
    metVigorous: 7.5,
    source: '02071 rowing ergometer <100 W moderate 5.0 / 02072 100–149 W vigorous 7.5',
  },
  'stair-climb': {
    met: 6.8,
    metVigorous: 9.3,
    source: '17131 stair climbing, general 6.8 (17133 slow 4.5) / 17134 fast 9.3',
  },
  // Mobility and stretching
  'arm-circles': { met: 2.3, source: STRETCH },
  'hip-circles': { met: 2.3, source: STRETCH },
  'cat-cow': { met: 2.3, source: YOGA },
  inchworm: { met: 3.5, source: FLOW, secondsPerRep: 8 },
  'worlds-greatest-stretch': { met: 3.5, source: FLOW, secondsPerRep: 10 },
  'downward-dog': { met: 2.3, source: YOGA },
  cobra: { met: 2.3, source: YOGA },
  'childs-pose': { met: 2.3, source: YOGA },
  'hamstring-stretch': { met: 2.3, source: STRETCH },
  'hip-flexor-stretch': { met: 2.3, source: STRETCH },
  'quad-stretch': { met: 2.3, source: STRETCH },
  'chest-stretch': { met: 2.3, source: STRETCH },
  'foam-rolling': { met: 2.3, source: `no own code; treated as ${STRETCH}` },
};

/** MET while resting between sets (standing/sitting quietly, Compendium 07xxx). 07040 standing quietly 1.3; 07021 sitting quietly 1.0. */
export const REST_MET = 1.3;

/** Default METs by category for the household's own exercises. */
export const CATEGORY_MET: Record<'strength' | 'cardio' | 'core' | 'mobility' | 'stretch', number> =
  {
    strength: 3.5, // 02054 resistance training, 8–15 reps
    cardio: 5.0, // 02035 circuit training, moderate effort
    core: 2.8, // 02024 calisthenics, light (crunches, plank)
    mobility: 2.5, // 02140 exercise video, yoga/stretching, light
    stretch: 2.3, // 02101 stretching, mild
  };

/**
 * ACSM walking equation: VO2 (ml/kg/min) = 0.1·S + 1.8·S·G + 3.5, S in m/min, G grade as a fraction.
 * Most accurate at 50–100 m/min. Downhill grades are treated as level (the equation is for uphill).
 */
export function walkingMet(metresPerMinute: number, grade = 0): number {
  return (0.1 * metresPerMinute + 1.8 * metresPerMinute * Math.max(0, grade) + 3.5) / 3.5;
}

/** ACSM running equation: VO2 = 0.2·S + 0.9·S·G + 3.5. Most accurate above 134 m/min (8 km/h). */
export function runningMet(metresPerMinute: number, grade = 0): number {
  return (0.2 * metresPerMinute + 0.9 * metresPerMinute * Math.max(0, grade) + 3.5) / 3.5;
}
