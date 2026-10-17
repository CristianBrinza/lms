import { messages } from '@/i18n';

/** The words of TagsInput and ExercisePicker. */

const en = {
  tags: {
    remove: (name: string) => `Remove ${name}`,
    add: (label: string) => `Add to ${label.toLowerCase()}`,
  },
  picker: {
    title: 'Add an exercise',
    find: 'Find an exercise',
    placeholder: 'Name or muscle',
    kind: 'Kind',
    all: 'All',
    homeOnly: 'Only what I can do at home',
    inWorkout: 'In the workout · ',
    needsEquipment: ' · needs equipment',
    empty: 'Nothing matches. Turn off “only at home” to see everything.',
  },
};

const ro: typeof en = {
  tags: {
    remove: (name) => `Scoate ${name}`,
    add: (label) => `Adaugă la „${label}”`,
  },
  picker: {
    title: 'Adaugă un exercițiu',
    find: 'Caută un exercițiu',
    placeholder: 'Denumire sau mușchi',
    kind: 'Tip',
    all: 'Toate',
    homeOnly: 'Doar ce pot face acasă',
    inWorkout: 'În antrenament · ',
    needsEquipment: ' · necesită echipament',
    empty: 'Nimic nu se potrivește. Dezactivează „doar acasă” ca să vezi tot.',
  },
};

const ru: typeof en = {
  tags: {
    remove: (name) => `Убрать: ${name}`,
    add: (label) => `Добавить в «${label}»`,
  },
  picker: {
    title: 'Добавить упражнение',
    find: 'Найти упражнение',
    placeholder: 'Название или мышца',
    kind: 'Тип',
    all: 'Все',
    homeOnly: 'Только то, что можно дома',
    inWorkout: 'В тренировке · ',
    needsEquipment: ' · нужен инвентарь',
    empty: 'Ничего не найдено. Отключите «только дома», чтобы увидеть всё.',
  },
};

export const usePickersT = messages({ en, ro, ru });
