import { formatNumber, messages, plural } from '@/i18n';
import type { HealthKind } from '../types';

/**
 * The health screen: the phone's numbers, connecting the phone, typing a day in.
 *
 * The connection steps use a little markup HealthPage renders: **bold** for what to tap or choose,
 * `code` for what to type as it is, and {key}, {url}, {energyUrl} for the key, the address button
 * and the energy address. Names in Shortcuts and Health follow the iPhone's language; the LMS
 * Health app is in English, so its buttons stay as it shows them.
 */

const en = {
  title: 'Health and energy',
  subtitleMine: 'Eaten, burned, and the phone’s numbers',
  subtitleTheirs: (name: string) => `${name}’s health`,
  range: {
    label: 'Range',
    14: '2 weeks',
    30: 'Month',
    90: '3 months',
  } as { label: string } & Record<14 | 30 | 90, string>,
  loadFailed: 'Couldn’t load health data',
  tryAgain: 'Try again',
  empty: 'No health data yet',
  emptyHint: 'Connect the phone (below), or type today’s weight or sleep in.',
  kind: {
    steps: 'Steps a day',
    distance: 'Walked and ran',
    activeEnergy: 'Active energy',
    exerciseMinutes: 'Exercise minutes',
    flights: 'Flights climbed',
    restingHeartRate: 'Resting heart rate',
    heartRate: 'Heart rate',
    hrv: 'Heart rate variability',
    sleep: 'Sleep',
    weight: 'Weight',
    bodyFat: 'Body fat',
    vo2max: 'VO2 max',
  } as Record<HealthKind, string>,
  unit: { ms: 'ms', mlKgMin: 'ml/kg/min' },
  flights: (n: number) => plural(n, { one: '# flight', other: '# flights' }),
  /** Under a tile's number. */
  perDayThisWeek: 'a day, this week',
  card: {
    steps: 'Steps',
    sleep: 'Sleep',
    restingHeartRate: 'Resting heart rate',
    weight: 'Weight',
  },
  chart: {
    steps: 'Steps per day',
    sleep: 'Hours asleep per night',
  },
  connect: {
    title: 'Connect the phone',
    lastSync: (when: string) => `Last sync ${when}.`,
    notYet: 'Not connected yet.',
    ios: 'iPhone · Apple Health',
    android: 'Android',
    keyName: { ios: 'Health sync (iPhone)', android: 'Health sync (Android)' },
    copy: 'Copy',
    copied: { key: 'Key copied', url: 'Address copied' },
    copyFailed: 'Couldn’t copy. Select it and copy by hand.',
    makeKey: 'Make a key',
    syncNow: 'Sync now',
    syncHint: 'Opens the LMS Health shortcut: it reads today from Apple Health and comes back here.',
    keyOnce: 'Shown once. It can be revoked in Settings → Claude access.',
    iosIntro:
      'Apple lets only App Store apps ask for Health. A Shortcut on the iPhone does it instead: every evening it reads today’s numbers and sends them here.',
    iosSteps: [
      'A key for the phone: {key}',
      'Shortcuts → **+** → name the shortcut exactly **LMS Health**.',
      'Add **Find Health Samples** (Steps, start date is today) → **Calculate Statistics** (Sum). Repeat for Walking + Running Distance (Sum, km), Active Energy (Sum), Resting Energy (Sum), Resting Heart Rate (Average), Weight (sort latest, limit 1), Sleep (hours, Sum).',
      '**Format Date**: Current Date, custom format `yyyy-MM-dd`.',
      '**Get Contents of URL**: {url}, Method POST, Header `Authorization` = `Bearer` + the key, Request Body JSON: `date`, `steps`, `distanceKm`, `activeEnergy`, `restingEnergy`, `restingHeartRate`, `weight`, `sleepHours`, each set to its result.',
      'To see what you ate in Apple Health too: **Get Contents of URL** {energyUrl} (GET, same header), then **Get Dictionary Value** `eatenKcal`, then **Log Health Sample**: Dietary Energy, that value, today.',
      '**Open URL** {back}, so a sync brings you back here.',
      'Automation → New → **Time of Day** 23:30, Daily, **Run Immediately** → **Run Shortcut**: LMS Health.',
      'Tap **Sync now** above once and allow Health when the iPhone asks. This page shows the day.',
    ],
    androidIntro:
      'Health Connect opens only to installed apps, so a small LMS Health app does it: steps, sleep, heart rate, weight and workouts come here every 3 hours, and what you ate here goes back to Health Connect.',
    download: 'Download LMS Health',
    androidSteps: [
      '{download} (3 MB) on the phone and open it. Android asks to allow installing from the browser once.',
      'A key for the phone: {key}',
      'In the app: paste the key, **Connect Health Connect** and allow what to share (including **access in the background**), then **Sync now**.',
      'Turn on **Sync every 3 hours**. This page shows the days as they come in.',
    ],
  },
  typeIn: {
    title: 'Type in today',
    weight: 'Weight',
    sleep: 'Sleep',
    steps: 'Steps',
    save: 'Save',
    saved: 'Saved for today',
  },
};

const ro: typeof en = {
  title: 'Sănătate și energie',
  subtitleMine: 'Mâncat, ars și cifrele de pe telefon',
  subtitleTheirs: (name) => `Sănătatea: ${name}`,
  range: {
    label: 'Perioadă',
    14: '2 săptămâni',
    30: 'Lună',
    90: '3 luni',
  },
  loadFailed: 'Datele de sănătate nu s-au încărcat',
  tryAgain: 'Încearcă din nou',
  empty: 'Încă nu sunt date de sănătate',
  emptyHint: 'Conectează telefonul (mai jos) sau scrie greutatea ori somnul de azi.',
  kind: {
    steps: 'Pași pe zi',
    distance: 'Mers și alergat',
    activeEnergy: 'Energie activă',
    exerciseMinutes: 'Minute de antrenament',
    flights: 'Etaje urcate',
    restingHeartRate: 'Puls în repaus',
    heartRate: 'Puls',
    hrv: 'Variabilitatea pulsului',
    sleep: 'Somn',
    weight: 'Greutate',
    bodyFat: 'Grăsime corporală',
    vo2max: 'VO2 max',
  },
  unit: { ms: 'ms', mlKgMin: 'ml/kg/min' },
  flights: (n) => plural(n, { one: '# etaj', few: '# etaje', other: '# de etaje' }),
  perDayThisWeek: 'pe zi, săptămâna asta',
  card: {
    steps: 'Pași',
    sleep: 'Somn',
    restingHeartRate: 'Puls în repaus',
    weight: 'Greutate',
  },
  chart: {
    steps: 'Pași pe zi',
    sleep: 'Ore de somn pe noapte',
  },
  connect: {
    title: 'Conectează telefonul',
    lastSync: (when) => `Ultima sincronizare: ${when}.`,
    notYet: 'Încă nu e conectat.',
    ios: 'iPhone · Sănătate',
    android: 'Android',
    keyName: { ios: 'Sincronizare sănătate (iPhone)', android: 'Sincronizare sănătate (Android)' },
    copy: 'Copiază',
    copied: { key: 'Cheia e copiată', url: 'Adresa e copiată' },
    copyFailed: 'N-am putut copia. Selecteaz-o și copiaz-o de mână.',
    makeKey: 'Creează o cheie',
    syncNow: 'Sincronizează acum',
    syncHint: 'Deschide comanda rapidă LMS Health: citește ziua din Sănătate și revine aici.',
    keyOnce: 'Se arată o singură dată. Poate fi revocată în Setări → Acces Claude.',
    iosIntro:
      'Apple dă voie doar aplicațiilor din App Store să ceară acces la Sănătate. Așa că o face o comandă rapidă pe iPhone: în fiecare seară citește cifrele zilei și le trimite aici.',
    iosSteps: [
      'O cheie pentru telefon: {key}',
      'Comenzi rapide → **+** → numește comanda exact **LMS Health**.',
      'Adaugă **Găsește mostre Sănătate** (Pași, data de început e azi) → **Calculează statistici** (Sumă). Repetă pentru Distanță mers + alergare (Sumă, km), Energie activă (Sumă), Energie în repaus (Sumă), Puls în repaus (Medie), Greutate (cele mai recente, limită 1), Somn (ore, Sumă).',
      '**Formatează data**: Data curentă, format personalizat `yyyy-MM-dd`.',
      '**Obține conținutul URL-ului**: {url}, Metodă POST, Antet `Authorization` = `Bearer` + cheia, Corp cerere JSON: `date`, `steps`, `distanceKm`, `activeEnergy`, `restingEnergy`, `restingHeartRate`, `weight`, `sleepHours`, fiecare cu rezultatul lui.',
      'Ca să vezi și în Sănătate ce ai mâncat: **Obține conținutul URL-ului** {energyUrl} (GET, același antet), apoi **Obține valoarea din dicționar** `eatenKcal`, apoi **Înregistrează mostră Sănătate**: Energie din alimentație, valoarea asta, azi.',
      '**Deschide URL-ul** {back}, ca să revii aici după sincronizare.',
      'Automatizare → Nouă → **Ora din zi** 23:30, Zilnic, **Rulează imediat** → **Rulează comanda rapidă**: LMS Health.',
      'Apasă o dată **Sincronizează acum** de mai sus și permite accesul la Sănătate când întreabă iPhone-ul. Pagina asta arată ziua.',
    ],
    androidIntro:
      'Health Connect se deschide doar aplicațiilor instalate, așa că o face o mică aplicație, LMS Health: pașii, somnul, pulsul, greutatea și antrenamentele vin aici la fiecare 3 ore, iar ce ai mâncat aici ajunge înapoi în Health Connect.',
    download: 'Descarcă LMS Health',
    androidSteps: [
      '{download} (3 MB) pe telefon și deschide-o. Android cere o dată voie să instalezi din browser.',
      'O cheie pentru telefon: {key}',
      'În aplicație: lipește cheia, apasă **Connect Health Connect** și permite ce se partajează (inclusiv **accesul în fundal**), apoi **Sync now**.',
      'Pornește **Sync every 3 hours**. Pagina asta arată zilele pe măsură ce vin.',
    ],
  },
  typeIn: {
    title: 'Scrie ziua de azi',
    weight: 'Greutate',
    sleep: 'Somn',
    steps: 'Pași',
    save: 'Salvează',
    saved: 'Salvat pentru azi',
  },
};

const ru: typeof en = {
  title: 'Здоровье и энергия',
  subtitleMine: 'Съедено, сожжено и данные с телефона',
  subtitleTheirs: (name) => `Здоровье: ${name}`,
  range: {
    label: 'Период',
    14: '2 недели',
    30: 'Месяц',
    90: '3 месяца',
  },
  loadFailed: 'Не удалось загрузить данные о здоровье',
  tryAgain: 'Попробовать снова',
  empty: 'Данных о здоровье пока нет',
  emptyHint: 'Подключите телефон (ниже) или введите сегодняшний вес или сон.',
  kind: {
    steps: 'Шагов в день',
    distance: 'Ходьба и бег',
    activeEnergy: 'Активная энергия',
    exerciseMinutes: 'Минуты тренировки',
    flights: 'Пройдено этажей',
    restingHeartRate: 'Пульс в покое',
    heartRate: 'Пульс',
    hrv: 'Вариабельность пульса',
    sleep: 'Сон',
    weight: 'Вес',
    bodyFat: 'Процент жира',
    vo2max: 'VO2 max',
  },
  unit: { ms: 'мс', mlKgMin: 'мл/кг/мин' },
  flights: (n) => plural(n, { one: '# этаж', few: '# этажа', many: '# этажей', other: '# этажа' }),
  perDayThisWeek: 'в день, эта неделя',
  card: {
    steps: 'Шаги',
    sleep: 'Сон',
    restingHeartRate: 'Пульс в покое',
    weight: 'Вес',
  },
  chart: {
    steps: 'Шаги по дням',
    sleep: 'Часы сна по ночам',
  },
  connect: {
    title: 'Подключение телефона',
    lastSync: (when) => `Последняя синхронизация: ${when}.`,
    notYet: 'Пока не подключён.',
    ios: 'iPhone · Здоровье',
    android: 'Android',
    keyName: {
      ios: 'Синхронизация здоровья (iPhone)',
      android: 'Синхронизация здоровья (Android)',
    },
    copy: 'Копировать',
    copied: { key: 'Ключ скопирован', url: 'Адрес скопирован' },
    copyFailed: 'Не удалось скопировать. Выделите и скопируйте вручную.',
    makeKey: 'Создать ключ',
    syncNow: 'Синхронизировать сейчас',
    syncHint: 'Открывает быструю команду LMS Health: она читает день из «Здоровья» и возвращается сюда.',
    keyOnce: 'Показывается один раз. Отозвать его можно в Настройки → Доступ Claude.',
    iosIntro:
      'Apple разрешает запрашивать доступ к «Здоровью» только приложениям из App Store. Поэтому это делает быстрая команда на iPhone: каждый вечер она читает данные за день и отправляет их сюда.',
    iosSteps: [
      'Ключ для телефона: {key}',
      'Команды → **+** → назовите команду точно **LMS Health**.',
      'Добавьте **Найти образцы Здоровья** (Шаги, дата начала — сегодня) → **Вычислить статистику** (Сумма). Повторите для Ходьба + бег (Сумма, км), Активная энергия (Сумма), Энергия покоя (Сумма), Пульс в покое (Среднее), Вес (сортировка по последним, лимит 1), Сон (часы, Сумма).',
      '**Форматировать дату**: Текущая дата, свой формат `yyyy-MM-dd`.',
      '**Получить содержимое URL**: {url}, Метод POST, Заголовок `Authorization` = `Bearer` + ключ, Тело запроса JSON: `date`, `steps`, `distanceKm`, `activeEnergy`, `restingEnergy`, `restingHeartRate`, `weight`, `sleepHours`, каждому — свой результат.',
      'Чтобы видеть съеденное и в «Здоровье»: **Получить содержимое URL** {energyUrl} (GET, тот же заголовок), затем **Получить значение из словаря** `eatenKcal`, затем **Записать образец Здоровья**: Энергия из еды, это значение, сегодня.',
      '**Открыть URL** {back}, чтобы после синхронизации вернуться сюда.',
      'Автоматизация → Новая → **Время суток** 23:30, Ежедневно, **Запускать сразу** → **Запустить быструю команду**: LMS Health.',
      'Один раз нажмите **Синхронизировать сейчас** выше и разрешите доступ к «Здоровью», когда iPhone спросит. Эта страница покажет день.',
    ],
    androidIntro:
      'Health Connect открыт только установленным приложениям, поэтому это делает небольшое приложение LMS Health: шаги, сон, пульс, вес и тренировки приходят сюда каждые 3 часа, а съеденное здесь уходит обратно в Health Connect.',
    download: 'Скачайте LMS Health',
    androidSteps: [
      '{download} (3 МБ) на телефон и откройте. Android один раз попросит разрешить установку из браузера.',
      'Ключ для телефона: {key}',
      'В приложении: вставьте ключ, нажмите **Connect Health Connect** и разрешите доступ (включая **доступ в фоне**), затем **Sync now**.',
      'Включите **Sync every 3 hours**. Эта страница покажет дни по мере поступления.',
    ],
  },
  typeIn: {
    title: 'Ввести за сегодня',
    weight: 'Вес',
    sleep: 'Сон',
    steps: 'Шаги',
    save: 'Сохранить',
    saved: 'Сохранено за сегодня',
  },
};

export const healthT = messages({ en, ro, ru });
export const useHealthT = healthT;

/** A count in the current language with a decimal or two where it needs them. */
export const decimal = (value: number, digits = 1) =>
  formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
