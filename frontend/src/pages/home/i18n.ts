import { messages, plural } from '@/i18n';

type PartOfDay = 'morning' | 'afternoon' | 'evening';

/** Home: the greeting and the "For you" sheet (the paydays have their own words). */
export const useHomeT = messages({
  en: {
    hi: (name: string) => `Hi, ${name}!`,
    good: {
      morning: 'Good morning.',
      afternoon: 'Good afternoon.',
      evening: 'Good evening.',
    } as Record<PartOfDay, string>,
    whatsNext: 'What’s next?',
    custom: 'Custom',
    forYou: 'For you',
    profileTitle: 'Your profile and password',
    since: (admin: boolean, since: string) => `${admin ? 'Admin' : 'Member'} since ${since}`,
    devicesTitle: 'Devices and updates',
    devicesDetail: 'Where you’re signed in',
    peopleTitle: 'People and access',
    loading: 'Loading…',
    canSignIn: (count: number) =>
      `${plural(count, { one: '# can sign in', other: '# can sign in' })} · add a person`,
  },
  ro: {
    hi: (name: string) => `Salut, ${name}!`,
    good: { morning: 'Bună dimineața.', afternoon: 'Bună ziua.', evening: 'Bună seara.' },
    whatsNext: 'Ce urmează?',
    custom: 'Personalizat',
    forYou: 'Pentru tine',
    profileTitle: 'Profilul și parola ta',
    since: (admin: boolean, since: string) => `${admin ? 'Administrator' : 'Membru'} din ${since}`,
    devicesTitle: 'Dispozitive și actualizări',
    devicesDetail: 'Unde ești conectat',
    peopleTitle: 'Oameni și acces',
    loading: 'Se încarcă…',
    canSignIn: (count: number) =>
      `${plural(count, { one: '# poate intra', few: '# pot intra', other: '# pot intra' })} · adaugă pe cineva`,
  },
  ru: {
    hi: (name: string) => `Привет, ${name}!`,
    good: { morning: 'Доброе утро.', afternoon: 'Добрый день.', evening: 'Добрый вечер.' },
    whatsNext: 'Что дальше?',
    custom: 'Своё',
    forYou: 'Для вас',
    profileTitle: 'Ваш профиль и пароль',
    since: (admin: boolean, since: string) => `${admin ? 'Администратор' : 'Участник'} с ${since}`,
    devicesTitle: 'Устройства и обновления',
    devicesDetail: 'Где выполнен вход',
    peopleTitle: 'Люди и доступ',
    loading: 'Загрузка…',
    canSignIn: (count: number) =>
      `${plural(count, { one: '# может войти', few: '# могут войти', many: '# могут войти', other: '# могут войти' })} · добавить человека`,
  },
});
