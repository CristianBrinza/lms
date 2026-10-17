import { messages } from '@/i18n';

/**
 * The energy panel's words: eaten against the target, what the day burned and where that number
 * comes from, protein / fat / carbs, the week's balance. The target's reason (`target.why`) and
 * the insights come from the server already written.
 */

const en = {
  heading: 'Energy',
  eatenToday: 'Eaten today',
  target: (kcal: string) => `Target ${kcal}`,
  eatenOfTarget: 'Eaten of target',
  over: (kcal: string) => `${kcal} over`,
  left: (kcal: string) => `${kcal} left`,
  burned: {
    resting: 'At rest',
    active: 'Moving',
    training: 'Training',
  },
  source: {
    phone: 'Rest and moving from the phone; training from the sets logged here.',
    estimate:
      'Rest by Mifflin–St Jeor, moving by your usual day, training by the Compendium of Physical Activities.',
  },
  measured: (kcal: string) => ` Measured from meals and weight: ${kcal} a day.`,
  noProfile: 'Rest energy is a rough guess until the profile has height, birth date and sex.',
  addThem: 'Add them',
  macro: { protein: 'Protein', fat: 'Fat', carbs: 'Carbs' },
  gram: 'g',
  week: 'This week',
  eaten: 'eaten',
  burnedLegend: 'burned',
  weekLabel: 'Eaten and burned each day',
  dayLabel: (day: string, eaten: string | null, burned: string) =>
    `${day}: eaten ${eaten ?? 'not logged'}, burned ${burned}`,
};

const ro: typeof en = {
  heading: 'Energie',
  eatenToday: 'Mâncat azi',
  target: (kcal) => `Țintă ${kcal}`,
  eatenOfTarget: 'Mâncat din țintă',
  over: (kcal) => `Peste țintă cu ${kcal}`,
  left: (kcal) => `Mai rămân ${kcal}`,
  burned: {
    resting: 'În repaus',
    active: 'Mișcare',
    training: 'Antrenament',
  },
  source: {
    phone: 'Repausul și mișcarea vin de la telefon; antrenamentul din seriile notate aici.',
    estimate:
      'Repausul după Mifflin–St Jeor, mișcarea după ziua ta obișnuită, antrenamentul după Compendiul activităților fizice.',
  },
  measured: (kcal) => ` Măsurat din mese și greutate: ${kcal} pe zi.`,
  noProfile:
    'Energia în repaus e doar aproximativă până când profilul are înălțimea, data nașterii și sexul.',
  addThem: 'Completează-le',
  macro: { protein: 'Proteine', fat: 'Grăsimi', carbs: 'Glucide' },
  gram: 'g',
  week: 'Săptămâna asta',
  eaten: 'mâncat',
  burnedLegend: 'ars',
  weekLabel: 'Mâncat și ars în fiecare zi',
  dayLabel: (day, eaten, burned) => `${day}: mâncat ${eaten ?? 'nenotat'}, ars ${burned}`,
};

const ru: typeof en = {
  heading: 'Энергия',
  eatenToday: 'Съедено сегодня',
  target: (kcal) => `Цель ${kcal}`,
  eatenOfTarget: 'Съедено от цели',
  over: (kcal) => `Сверх цели ${kcal}`,
  left: (kcal) => `Осталось ${kcal}`,
  burned: {
    resting: 'В покое',
    active: 'Движение',
    training: 'Тренировки',
  },
  source: {
    phone: 'Покой и движение — с телефона; тренировки — по подходам, записанным здесь.',
    estimate:
      'Покой — по формуле Миффлина — Сан Жеора, движение — по вашему обычному дню, тренировки — по Компендиуму физических активностей.',
  },
  measured: (kcal) => ` По еде и весу выходит ${kcal} в день.`,
  noProfile: 'Энергия в покое — грубая оценка, пока в профиле нет роста, даты рождения и пола.',
  addThem: 'Добавить',
  macro: { protein: 'Белки', fat: 'Жиры', carbs: 'Углеводы' },
  gram: 'г',
  week: 'Эта неделя',
  eaten: 'съедено',
  burnedLegend: 'сожжено',
  weekLabel: 'Съедено и сожжено по дням',
  dayLabel: (day, eaten, burned) => `${day}: съедено ${eaten ?? 'не записано'}, сожжено ${burned}`,
};

export const energyT = messages({ en, ro, ru });
export const useEnergyT = energyT;
