import { messages } from '@/i18n';

/** The few words the shared helpers say themselves: failed requests, "never", devices. */
const en = {
  errors: {
    generic: 'Something went wrong. Try again.',
    offline: 'You seem to be offline. Check the connection and try again.',
    unreachable: 'LMS can’t be reached right now. Try again in a minute.',
  },
  never: 'Never',
  justNow: 'Just now',
  device: 'Device',
  windowsPc: 'Windows PC',
  photo: { notImage: 'Pick a photo', unreadable: 'That photo couldn’t be read' },
};

const ro: typeof en = {
  errors: {
    generic: 'Ceva n-a mers. Încearcă din nou.',
    offline: 'Se pare că nu ai internet. Verifică conexiunea și încearcă din nou.',
    unreachable: 'LMS nu răspunde acum. Încearcă peste un minut.',
  },
  never: 'Niciodată',
  justNow: 'Chiar acum',
  device: 'Dispozitiv',
  windowsPc: 'PC cu Windows',
  photo: { notImage: 'Alege o poză', unreadable: 'Poza nu poate fi citită' },
};

const ru: typeof en = {
  errors: {
    generic: 'Что-то пошло не так. Попробуйте ещё раз.',
    offline: 'Похоже, нет интернета. Проверьте подключение и попробуйте ещё раз.',
    unreachable: 'LMS сейчас недоступен. Попробуйте через минуту.',
  },
  never: 'Никогда',
  justNow: 'Только что',
  device: 'Устройство',
  windowsPc: 'ПК с Windows',
  photo: { notImage: 'Выберите фото', unreadable: 'Не удалось прочитать это фото' },
};

/** A plain lookup (not a hook): these helpers run outside components too. */
export const libT = messages({ en, ro, ru });
