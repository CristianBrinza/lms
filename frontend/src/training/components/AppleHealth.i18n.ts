import { messages, plural } from '@/i18n';

/** Apple Health on the health screen: through the LMS app for iPhone, or where to get it. */

const en = {
  getApp:
    'Apple Health connects through the LMS app for iPhone. Open this page in the app and tap Connect Apple Health.',
  intro:
    'Steps, sleep, heart rate, weight and workouts come here from Apple Health, and what you eat here goes back to it as dietary energy.',
  connect: 'Connect Apple Health',
  connectHint: 'The iPhone asks what to share. Allow all of it for the full picture.',
  connected: 'Connected. LMS syncs when you open it and in the background.',
  syncing: 'Syncing…',
  syncNow: 'Sync now',
  synced: 'Synced with Apple Health',
  sent: (days: number, workouts: number) =>
    `Last sync sent ${plural(days, { one: '# day', other: '# days' })} and ${plural(workouts, { one: '# workout', other: '# workouts' })}.`,
  manage: 'To change what LMS reads: Settings → Health → Data Access & Devices → LMS.',
  error: {
    notSignedIn: 'Sign in again, then try once more.',
    signedOut: 'The app’s access ended. Tap Sync now to link it again.',
    healthUnavailable: 'Apple Health isn’t available on this device.',
    network: 'Couldn’t reach LMS. It tries again on its own.',
    server: 'LMS couldn’t take the data. It tries again on its own.',
    health: 'Apple Health didn’t answer. Try again in a moment.',
    other: 'Something went wrong. Try again.',
  } as Record<string, string> & { other: string },
};

const ro: typeof en = {
  getApp:
    'Sănătatea Apple se conectează prin aplicația LMS pentru iPhone. Deschide pagina asta în aplicație și apasă Conectează Sănătatea.',
  intro:
    'Pașii, somnul, pulsul, greutatea și antrenamentele vin aici din Sănătate, iar ce mănânci aici ajunge înapoi ca energie din alimentație.',
  connect: 'Conectează Sănătatea',
  connectHint: 'iPhone-ul întreabă ce să împartă. Permite tot, pentru imaginea completă.',
  connected: 'Conectat. LMS sincronizează când îl deschizi și în fundal.',
  syncing: 'Se sincronizează…',
  syncNow: 'Sincronizează acum',
  synced: 'Sincronizat cu Sănătatea',
  sent: (days, workouts) =>
    `Ultima sincronizare a trimis ${plural(days, { one: '# zi', few: '# zile', other: '# de zile' })} și ${plural(workouts, { one: '# antrenament', few: '# antrenamente', other: '# de antrenamente' })}.`,
  manage:
    'Ca să schimbi ce citește LMS: Configurări → Sănătate → Acces la date și dispozitive → LMS.',
  error: {
    notSignedIn: 'Autentifică-te din nou, apoi mai încearcă o dată.',
    signedOut: 'Accesul aplicației s-a încheiat. Apasă Sincronizează acum ca s-o legi din nou.',
    healthUnavailable: 'Sănătatea nu e disponibilă pe acest dispozitiv.',
    network: 'LMS nu răspunde. Aplicația reîncearcă singură.',
    server: 'LMS n-a putut primi datele. Aplicația reîncearcă singură.',
    health: 'Sănătatea n-a răspuns. Mai încearcă peste un moment.',
    other: 'Ceva n-a mers. Încearcă din nou.',
  },
};

const ru: typeof en = {
  getApp:
    '«Здоровье» подключается через приложение LMS для iPhone. Откройте эту страницу в приложении и нажмите «Подключить Здоровье».',
  intro:
    'Шаги, сон, пульс, вес и тренировки приходят сюда из «Здоровья», а съеденное здесь уходит туда как энергия из еды.',
  connect: 'Подключить Здоровье',
  connectHint: 'iPhone спросит, чем делиться. Разрешите всё, чтобы картина была полной.',
  connected: 'Подключено. LMS синхронизирует при открытии и в фоне.',
  syncing: 'Синхронизация…',
  syncNow: 'Синхронизировать сейчас',
  synced: 'Синхронизировано со «Здоровьем»',
  sent: (days, workouts) =>
    `Последняя синхронизация отправила ${plural(days, { one: '# день', few: '# дня', many: '# дней', other: '# дня' })} и ${plural(workouts, { one: '# тренировку', few: '# тренировки', many: '# тренировок', other: '# тренировки' })}.`,
  manage:
    'Чтобы изменить, что читает LMS: Настройки → Здоровье → Доступ к данным и устройства → LMS.',
  error: {
    notSignedIn: 'Войдите снова и попробуйте ещё раз.',
    signedOut:
      'Доступ приложения закончился. Нажмите «Синхронизировать сейчас», чтобы связать снова.',
    healthUnavailable: '«Здоровье» недоступно на этом устройстве.',
    network: 'LMS не отвечает. Приложение попробует снова само.',
    server: 'LMS не смог принять данные. Приложение попробует снова само.',
    health: '«Здоровье» не ответило. Попробуйте через минуту.',
    other: 'Что-то пошло не так. Попробуйте снова.',
  },
};

export const useAppleHealthT = messages({ en, ro, ru });
