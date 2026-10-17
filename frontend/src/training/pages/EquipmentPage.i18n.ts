import { messages, plural } from '@/i18n';

/** "What's at home": the equipment list. */

const en = {
  title: 'What’s at home',
  things: (n: number) => plural(n, { one: '# thing', other: '# things' }),
  away: (n: number) => `${n} away`,
  nothingYet: 'Nothing added yet',
  addEquipment: 'Add equipment',
  loadFailed: 'Couldn’t load the equipment',
  tryAgain: 'Try again',
  /** "Your home lets you do [12 of 40] exercises" */
  summary: {
    before: 'Your home lets you do',
    count: (possible: number, all: number) => `${possible} of ${all}`,
    after: (all: number): string => (all === 1 ? 'exercise' : 'exercises'),
  },
  pairs: 'Pairs',
  oneOfEach: 'One of each',
  atHome: 'At home',
  emptyTitle: 'What do you train with?',
  emptyBare: (n: number) =>
    `${plural(n, { one: '# exercise needs', other: '# exercises need' })} no equipment. Add what you have to unlock more.`,
  emptyText: 'Add what you have to unlock more exercises.',
};

const ro: typeof en = {
  title: 'Ce ai acasă',
  things: (n) => plural(n, { one: '# obiect', few: '# obiecte', other: '# de obiecte' }),
  away: (n) => plural(n, { one: '# lipsește', other: '# lipsesc' }),
  nothingYet: 'Încă nimic adăugat',
  addEquipment: 'Adaugă echipament',
  loadFailed: 'Nu s-a încărcat echipamentul',
  tryAgain: 'Încearcă din nou',
  summary: {
    before: 'Acasă poți face',
    count: (possible, all) => `${possible} din ${all}`,
    after: (all) => plural(all, { one: 'exercițiu', few: 'exerciții', other: 'de exerciții' }),
  },
  pairs: 'Perechi',
  oneOfEach: 'Câte una',
  atHome: 'Acasă',
  emptyTitle: 'Cu ce te antrenezi?',
  emptyBare: (n) =>
    `${plural(n, {
      one: '# exercițiu nu cere',
      few: '# exerciții nu cer',
      other: '# de exerciții nu cer',
    })} echipament. Adaugă ce ai ca să deblochezi mai multe.`,
  emptyText: 'Adaugă ce ai ca să deblochezi mai multe exerciții.',
};

const ru: typeof en = {
  title: 'Что есть дома',
  things: (n) =>
    plural(n, { one: '# предмет', few: '# предмета', many: '# предметов', other: '# предмета' }),
  away: (n) => `${n} не дома`,
  nothingYet: 'Пока ничего не добавлено',
  addEquipment: 'Добавить инвентарь',
  loadFailed: 'Не удалось загрузить инвентарь',
  tryAgain: 'Повторить',
  summary: {
    before: 'Дома можно делать',
    count: (possible, all) => `${possible} из ${all}`,
    // "из 21 упражнения", "из 40 упражнений"
    after: (all) => plural(all, { one: 'упражнения', other: 'упражнений' }),
  },
  pairs: 'Парами',
  oneOfEach: 'По одному',
  atHome: 'Есть дома',
  emptyTitle: 'С чем вы тренируетесь?',
  emptyBare: (n) =>
    `${plural(n, {
      one: '# упражнению',
      few: '# упражнениям',
      many: '# упражнениям',
      other: '# упражнениям',
    })} не нужен инвентарь. Добавьте то, что есть, чтобы открыть больше.`,
  emptyText: 'Добавьте то, что есть, чтобы открыть больше упражнений.',
};

export const useEquipmentPageT = messages({ en, ro, ru });
