import { messages, plural } from '@/i18n';

/** Apple Health on the health screen: through the LMS app for iPhone, or where to get it. */

const en = {
  getApp: 'Apple Health connects through the free LMS app for iPhone. To set it up once:',
  steps: [
    'On a Windows PC, install iTunes and iCloud from apple.com (not the Microsoft Store), then AltServer from altstore.io.',
    'Plug the iPhone in by cable and tap Trust. In the tray, AltServer → Install AltStore → your iPhone, and sign in with your Apple ID.',
    'On the iPhone: Settings → General → VPN & Device Management → trust your Apple ID. Then Settings → Privacy & Security → Developer Mode → on, and restart.',
    'Download LMS.ipa below on the iPhone, open AltStore → My Apps → +, and pick it.',
    'Open LMS, sign in, come back to this page and tap Connect Apple Health.',
  ],
  download: 'Download LMS for iPhone',
  altstore: 'AltStore',
  refresh: 'AltStore renews the app every 7 days on its own while the iPhone is on the same Wi-Fi as the PC with AltServer.',
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
  getApp: 'Sănătatea Apple se conectează prin aplicația LMS gratuită pentru iPhone. O configurezi o singură dată:',
  steps: [
    'Pe un PC cu Windows, instalează iTunes și iCloud de pe apple.com (nu din Microsoft Store), apoi AltServer de pe altstore.io.',
    'Conectează iPhone-ul prin cablu și apasă Ai încredere. Din bara de sistem, AltServer → Install AltStore → iPhone-ul tău, și intră cu Apple ID-ul.',
    'Pe iPhone: Configurări → General → VPN și gestionare dispozitiv → ai încredere în Apple ID-ul tău. Apoi Configurări → Confidențialitate și securitate → Mod dezvoltator → activat, și repornește.',
    'Descarcă LMS.ipa de mai jos pe iPhone, deschide AltStore → My Apps → + și alege-l.',
    'Deschide LMS, autentifică-te, revino pe pagina asta și apasă Conectează Sănătatea.',
  ],
  download: 'Descarcă LMS pentru iPhone',
  altstore: 'AltStore',
  refresh: 'AltStore reînnoiește aplicația singur la fiecare 7 zile, cât timp iPhone-ul e pe același Wi-Fi cu PC-ul cu AltServer.',
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
  getApp: '«Здоровье» подключается через бесплатное приложение LMS для iPhone. Настройка один раз:',
  steps: [
    'На ПК с Windows установите iTunes и iCloud с apple.com (не из Microsoft Store), затем AltServer с altstore.io.',
    'Подключите iPhone кабелем и нажмите «Доверять». В трее: AltServer → Install AltStore → ваш iPhone, войдите со своим Apple ID.',
    'На iPhone: Настройки → Основные → VPN и управление устройством → доверьте своему Apple ID. Затем Настройки → Конфиденциальность и безопасность → Режим разработчика → вкл., и перезагрузите.',
    'Скачайте LMS.ipa ниже на iPhone, откройте AltStore → My Apps → + и выберите его.',
    'Откройте LMS, войдите, вернитесь на эту страницу и нажмите «Подключить Здоровье».',
  ],
  download: 'Скачать LMS для iPhone',
  altstore: 'AltStore',
  refresh: 'AltStore сам продлевает приложение каждые 7 дней, пока iPhone в той же сети Wi-Fi, что и ПК с AltServer.',
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
