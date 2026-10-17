import { messages } from '@/i18n';

/** The equipment editor, the "Add equipment" sheet and the pieces editor (bands, grips). */

const en = {
  // EquipmentSheet
  equipment: 'Equipment',
  saved: (name: string) => `${name} saved`,
  removed: (name: string | undefined) => `${name ?? 'It'} removed`,
  save: 'Save',
  name: 'Name',
  howMany: 'How many',
  none: 'None',
  countHint: '0 when it’s away for a while: lent out, at the cottage.',
  awayHint: 'Not at home right now: exercises that need it are left out.',
  twoOfEach: 'Two of each weight',
  pairHint: 'A pair of each, one per hand',
  oneHint: 'One of each weight',
  weights: 'Weights',
  weightsOwned: 'Weights owned',
  removeWhat: (what: string) => `Remove ${what}`,
  noWeights: 'No weights yet.',
  addWeightsLabel: 'Add weights, kg',
  addWeightsPlaceholder: 'Add kg: 6 or 2 4 8',
  add: 'Add',
  addWhat: (what: string) => `Add ${what}`,
  commonWeights: 'Common weights',
  note: 'Note',
  optional: 'Optional',
  picture: 'Picture',
  removeFromHome: 'Remove from home',
  confirmTitle: (name: string | undefined) => `Remove ${name ?? 'this'}?`,
  confirmText: 'Exercises that need it stop being suggested. Adding it again brings them back.',
  remove: 'Remove',

  // AddEquipmentSheet
  addTitle: 'Add equipment',
  addDescription: 'Tap what’s at home.',
  added: (name: string) => `${name} added`,
  askWeights: 'Which weights are there?',
  askBands: 'Which bands, how strong?',
  askGrips: 'Which grips does it have?',
  atHomeOpen: (name: string) => `${name}: at home. Open`,
  atHome: 'At home',
  somethingElse: 'Something else',
  whatIsIt: 'What is it',
  whatIsItPlaceholder: 'Sandbag, balance board…',

  // PiecesEditor
  pieces: {
    bands: {
      title: 'Bands',
      hint: 'Each band with its resistance: choosing one in a set counts it as the weight.',
      name: 'Colour or name',
    },
    grips: {
      title: 'Grips and positions',
      hint: 'What this one allows: picked for each set of pull-ups, rows, hangs.',
      name: 'Wide grip, parallel handles…',
    },
    parts: {
      title: 'Parts and settings',
      hint: 'Anything chosen per set: levels, attachments, positions.',
      name: 'Name',
    },
  },
};

const ro: typeof en = {
  equipment: 'Echipament',
  saved: (name) => `${name}: salvat`,
  removed: (name) => (name ? `${name}: scos de pe listă` : 'Scos de pe listă'),
  save: 'Salvează',
  name: 'Denumire',
  howMany: 'Câte bucăți',
  none: 'Niciuna',
  countHint: '0 cât lipsește o vreme: împrumutat, la vilă.',
  awayHint: 'Acum nu e acasă: exercițiile care au nevoie de el nu se propun.',
  twoOfEach: 'Câte două din fiecare greutate',
  pairHint: 'O pereche din fiecare, una pentru fiecare mână',
  oneHint: 'Câte una din fiecare greutate',
  weights: 'Greutăți',
  weightsOwned: 'Greutățile de acasă',
  removeWhat: (what) => `Scoate ${what}`,
  noWeights: 'Încă nicio greutate.',
  addWeightsLabel: 'Adaugă greutăți, kg',
  addWeightsPlaceholder: 'Adaugă kg: 6 sau 2 4 8',
  add: 'Adaugă',
  addWhat: (what) => `Adaugă ${what}`,
  commonWeights: 'Greutăți obișnuite',
  note: 'Notă',
  optional: 'Opțional',
  picture: 'Imagine',
  removeFromHome: 'Scoate din listă',
  confirmTitle: (name) => (name ? `Scoți ${name}?` : 'Scoți acest echipament?'),
  confirmText: 'Exercițiile care au nevoie de el nu se mai propun. Dacă îl adaugi din nou, revin.',
  remove: 'Scoate',

  addTitle: 'Adaugă echipament',
  addDescription: 'Atinge ce ai acasă.',
  added: (name) => `${name}: adăugat`,
  askWeights: 'Ce greutăți ai?',
  askBands: 'Ce benzi, cât de tari?',
  askGrips: 'Ce prize are?',
  atHomeOpen: (name) => `${name}: e acasă. Deschide`,
  atHome: 'Acasă',
  somethingElse: 'Altceva',
  whatIsIt: 'Ce este',
  whatIsItPlaceholder: 'Sac cu nisip, placă de echilibru…',

  pieces: {
    bands: {
      title: 'Benzi',
      hint: 'Fiecare bandă cu rezistența ei: aleasă într-o serie, contează ca greutate.',
      name: 'Culoare sau denumire',
    },
    grips: {
      title: 'Prize și poziții',
      hint: 'Ce permite: se alege la fiecare serie de tracțiuni, ramat, atârnări.',
      name: 'Priză largă, mânere paralele…',
    },
    parts: {
      title: 'Piese și reglaje',
      hint: 'Ce se alege la fiecare serie: niveluri, accesorii, poziții.',
      name: 'Denumire',
    },
  },
};

const ru: typeof en = {
  equipment: 'Инвентарь',
  saved: (name) => `${name}: сохранено`,
  removed: (name) => (name ? `${name}: убрано из списка` : 'Убрано из списка'),
  save: 'Сохранить',
  name: 'Название',
  howMany: 'Сколько штук',
  none: 'Нет',
  countHint: '0, если его пока нет: одолжили, на даче.',
  awayHint: 'Сейчас нет дома: упражнения с ним не предлагаются.',
  twoOfEach: 'По два каждого веса',
  pairHint: 'Пара каждого веса, по одному на руку',
  oneHint: 'По одному каждого веса',
  weights: 'Веса',
  weightsOwned: 'Веса дома',
  removeWhat: (what) => `Убрать ${what}`,
  noWeights: 'Весов пока нет.',
  addWeightsLabel: 'Добавить веса, кг',
  addWeightsPlaceholder: 'Добавить кг: 6 или 2 4 8',
  add: 'Добавить',
  addWhat: (what) => `Добавить ${what}`,
  commonWeights: 'Обычные веса',
  note: 'Заметка',
  optional: 'Необязательно',
  picture: 'Картинка',
  removeFromHome: 'Убрать из списка',
  confirmTitle: (name) => (name ? `Убрать «${name}»?` : 'Убрать этот инвентарь?'),
  confirmText:
    'Упражнения с ним больше не будут предлагаться. Если добавить его снова, они вернутся.',
  remove: 'Убрать',

  addTitle: 'Добавить инвентарь',
  addDescription: 'Нажмите на то, что есть дома.',
  added: (name) => `${name}: добавлено`,
  askWeights: 'Какие есть веса?',
  askBands: 'Какие резинки, какой силы?',
  askGrips: 'Какие у него хваты?',
  atHomeOpen: (name) => `${name}: есть дома. Открыть`,
  atHome: 'Есть дома',
  somethingElse: 'Что-то другое',
  whatIsIt: 'Что это',
  whatIsItPlaceholder: 'Мешок с песком, балансборд…',

  pieces: {
    bands: {
      title: 'Резинки',
      hint: 'Каждая резинка со своим сопротивлением: выбранная в подходе, считается весом.',
      name: 'Цвет или название',
    },
    grips: {
      title: 'Хваты и положения',
      hint: 'Что он позволяет: выбирается в каждом подходе подтягиваний, тяг, висов.',
      name: 'Широкий хват, параллельные ручки…',
    },
    parts: {
      title: 'Части и настройки',
      hint: 'Что выбирается в каждом подходе: уровни, насадки, положения.',
      name: 'Название',
    },
  },
};

/** A plain lookup (safe in helpers); useEquipmentT is the same, named for components. */
export const equipmentT = messages({ en, ro, ru });
export const useEquipmentT = equipmentT;
