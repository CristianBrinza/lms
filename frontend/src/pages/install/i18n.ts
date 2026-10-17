import { messages } from '@/i18n';

type Device = 'iphone' | 'android' | 'computer';

/**
 * The install guide. The quoted button names are the phone's own, as Safari and Chrome show them
 * in that language, so the steps match what people see; the drawings use the same words.
 */
export const useInstallT = messages({
  en: {
    installedToast: 'LMS is installed',
    openFromHome: 'Open it from your Home Screen or app list.',
    linkCopied: 'Link copied',
    copyFailed: 'Couldn’t copy. Press and hold the address bar instead.',
    titleInstalled: ['LMS is on', ' this device.'] as [string, string],
    titleAdd: ['Add LMS to', ' your Home Screen.'] as [string, string],
    intro:
      'The app opens full screen with one tap, like any app. No store, nothing to download, always up to date.',
    perksLabel: 'What the app gives you',
    perks: [
      'Opens in one tap',
      'Full screen, no browser bars',
      'Stays signed in',
      'Updates by itself',
    ],
    guideBelow: {
      iphone: 'See the guide for iPhone below',
      android: 'See the guide for Android below',
      computer: 'See the guide for your computer below',
    } as Record<Device, string>,
    continueHere: 'Continue here',
    sheetTitle: {
      iphone: 'On your iPhone',
      android: 'On your Android phone',
      computer: 'On a computer',
    } as Record<Device, string>,
    inApp: (app: string | null) =>
      `You’re inside ${app ? `${app}’s` : 'this app’s'} built-in browser, which can’t add apps. Open this page in Safari or Chrome: tap ⋯ and choose “Open in browser”, or copy the link.`,
    copyLink: 'Copy link',
    iosSteps: [
      'In Safari, tap ⋯ at the bottom right.',
      'Tap “Share”.',
      'Scroll down and tap “Add to Home Screen” (under “View More” on some iPhones).',
      'Leave “Open as Web App” on and tap “Add”.',
      'Open LMS from your Home Screen, like any app.',
    ],
    iosAlts: [
      'Safari’s bottom bar with the ⋯ button circled at the right.',
      'Safari’s ⋯ menu with “Share” circled.',
      'The share sheet with “Add to Home Screen” circled.',
      'The “Add to Home Screen” screen with “Open as Web App” on and “Add” circled.',
      'The LMS icon on the Home Screen, circled.',
    ],
    iosNotes: [
      'Is the Share button right in Safari’s toolbar (iOS 18 or earlier, or an iPad)? Tap it and carry on from step 3.',
      'Chrome on iPhone: tap Share on the right of the address bar, then “Add to Home Screen” and “Add”.',
    ],
    androidSteps: [
      'In Chrome, tap ⋮ at the top right, then “Install app” (or “Add to Home screen”).',
      'Choose “Install”.',
      'Confirm with “Install”.',
      'Open LMS from your home screen or app list.',
    ],
    androidAlts: [
      'Chrome with the ⋮ button circled and its menu open at “Install app”.',
      'The install panel with “Install” circled.',
      'The install dialog with “Install” circled.',
      'The LMS icon on the home screen, circled.',
    ],
    androidNotes: [
      'Not there? Look for “Install app” or “Add to Home screen” in your browser’s menu.',
    ],
    installLms: 'Install LMS',
    confirmOnce: 'Your phone asks once to confirm. That’s it.',
    qr: 'QR code to open this guide on your phone',
    scan: 'Scan with your phone',
    scanLine: 'Opens this guide on the phone, ready to add LMS to its Home Screen.',
    installComputer: 'Install on this computer',
    desktopAlt: 'A browser address bar with the install icon circled at its right end.',
    desktopLine:
      'Or install it here: in Chrome or Edge, click the install icon at the right end of the address bar.',
    desktopNotes: [
      'No icon? In Chrome: ⋮ → “Cast, save, and share” → “Install page as app”. In Safari on a Mac: File → “Add to Dock”.',
    ],
    devices: { iphone: 'iPhone', android: 'Android', computer: 'Computer' } as Record<
      Device,
      string
    >,
    yourDevice: 'Your device',
    // The phones' own labels, for the drawings.
    ios: {
      share: 'Share',
      addToHome: 'Add to Home Screen',
      cancel: 'Cancel',
      add: 'Add',
      openAsWebApp: 'Open as Web App',
    },
    android: {
      installApp: 'Install app',
      install: 'Install',
      createShortcut: 'Create shortcut',
      shortcutsNote: 'Shortcuts open in Chrome',
      cancel: 'Cancel',
    },
  },
  ro: {
    installedToast: 'LMS e instalat',
    openFromHome: 'Deschide-l de pe ecranul principal sau din lista de aplicații.',
    linkCopied: 'Linkul a fost copiat',
    copyFailed: 'Nu s-a putut copia. Ține apăsat pe bara de adrese.',
    titleInstalled: ['LMS e pe', ' acest dispozitiv.'],
    titleAdd: ['Pune LMS', ' pe ecranul principal.'],
    intro:
      'Aplicația se deschide pe tot ecranul dintr-o atingere, ca oricare alta. Fără magazin, nimic de descărcat, mereu la zi.',
    perksLabel: 'Ce îți oferă aplicația',
    perks: [
      'Se deschide dintr-o atingere',
      'Pe tot ecranul, fără barele browserului',
      'Rămâi conectat',
      'Se actualizează singură',
    ],
    guideBelow: {
      iphone: 'Ghidul pentru iPhone e mai jos',
      android: 'Ghidul pentru Android e mai jos',
      computer: 'Ghidul pentru calculator e mai jos',
    },
    continueHere: 'Continuă aici',
    sheetTitle: {
      iphone: 'Pe iPhone',
      android: 'Pe telefonul cu Android',
      computer: 'Pe calculator',
    },
    inApp: (app: string | null) =>
      `Ești în browserul integrat din ${app ?? 'această aplicație'}, care nu poate adăuga aplicații. Deschide pagina în Safari sau Chrome: atinge ⋯ și alege „Deschide în browser”, sau copiază linkul.`,
    copyLink: 'Copiază linkul',
    iosSteps: [
      'În Safari, atinge ⋯ din dreapta jos.',
      'Atinge „Partajează”.',
      'Derulează în jos și atinge „Adaugă pe ecranul principal” (pe unele iPhone, sub „Vezi mai multe”).',
      'Lasă pornit „Deschide ca aplicație web” și atinge „Adaugă”.',
      'Deschide LMS de pe ecranul principal, ca pe orice aplicație.',
    ],
    iosAlts: [
      'Bara de jos din Safari, cu butonul ⋯ încercuit în dreapta.',
      'Meniul ⋯ din Safari, cu „Partajează” încercuit.',
      'Panoul de partajare, cu „Adaugă pe ecranul principal” încercuit.',
      'Ecranul „Adaugă pe ecranul principal”, cu „Deschide ca aplicație web” pornit și „Adaugă” încercuit.',
      'Pictograma LMS pe ecranul principal, încercuită.',
    ],
    iosNotes: [
      'Butonul Partajează e chiar în bara Safari (iOS 18 sau mai vechi, ori pe iPad)? Atinge-l și continuă de la pasul 3.',
      'Chrome pe iPhone: atinge Partajează din dreapta barei de adrese, apoi „Adaugă pe ecranul principal” și „Adaugă”.',
    ],
    androidSteps: [
      'În Chrome, atinge ⋮ din dreapta sus, apoi „Instalați aplicația” (sau „Adăugați pe ecranul de pornire”).',
      'Alege „Instalați”.',
      'Confirmă cu „Instalați”.',
      'Deschide LMS de pe ecranul de pornire sau din lista de aplicații.',
    ],
    androidAlts: [
      'Chrome, cu butonul ⋮ încercuit și meniul deschis la „Instalați aplicația”.',
      'Panoul de instalare, cu „Instalați” încercuit.',
      'Fereastra de instalare, cu „Instalați” încercuit.',
      'Pictograma LMS pe ecranul de pornire, încercuită.',
    ],
    androidNotes: [
      'Nu e acolo? Caută „Instalați aplicația” sau „Adăugați pe ecranul de pornire” în meniul browserului.',
    ],
    installLms: 'Instalează LMS',
    confirmOnce: 'Telefonul îți cere o singură confirmare. Asta e tot.',
    qr: 'Cod QR care deschide acest ghid pe telefon',
    scan: 'Scanează cu telefonul',
    scanLine: 'Deschide ghidul pe telefon, ca să pui LMS pe ecranul principal.',
    installComputer: 'Instalează pe acest calculator',
    desktopAlt:
      'Bara de adrese a browserului, cu pictograma de instalare încercuită în capătul din dreapta.',
    desktopLine:
      'Sau instalează-l aici: în Chrome sau Edge, apasă pictograma de instalare din capătul drept al barei de adrese.',
    desktopNotes: [
      'Nu vezi pictograma? În Chrome: ⋮ → „Proiectați, salvați și trimiteți” → „Instalați pagina ca aplicație”. În Safari pe Mac: Fișier → „Adaugă în Dock”.',
    ],
    devices: { iphone: 'iPhone', android: 'Android', computer: 'Computer' },
    yourDevice: 'Dispozitivul tău',
    ios: {
      share: 'Partajează',
      addToHome: 'Adaugă pe ecranul principal',
      cancel: 'Anulează',
      add: 'Adaugă',
      openAsWebApp: 'Deschide ca aplicație web',
    },
    android: {
      installApp: 'Instalați aplicația',
      install: 'Instalați',
      createShortcut: 'Creați o comandă rapidă',
      shortcutsNote: 'Comenzile rapide se deschid în Chrome',
      cancel: 'Anulați',
    },
  },
  ru: {
    installedToast: 'LMS установлен',
    openFromHome: 'Открывайте его с главного экрана или из списка приложений.',
    linkCopied: 'Ссылка скопирована',
    copyFailed: 'Не удалось скопировать. Нажмите и удерживайте адресную строку.',
    titleInstalled: ['LMS уже на', ' этом устройстве.'],
    titleAdd: ['Добавьте LMS', ' на главный экран.'],
    intro:
      'Приложение открывается на весь экран одним касанием, как любое другое. Без магазина, ничего не нужно скачивать, всегда свежая версия.',
    perksLabel: 'Что даёт приложение',
    perks: [
      'Открывается в одно касание',
      'На весь экран, без панелей браузера',
      'Не нужно входить заново',
      'Обновляется само',
    ],
    guideBelow: {
      iphone: 'Инструкция для iPhone ниже',
      android: 'Инструкция для Android ниже',
      computer: 'Инструкция для компьютера ниже',
    },
    continueHere: 'Продолжить здесь',
    sheetTitle: {
      iphone: 'На iPhone',
      android: 'На телефоне с Android',
      computer: 'На компьютере',
    },
    inApp: (app: string | null) =>
      `Вы во встроенном браузере ${app ? `приложения ${app}` : 'этого приложения'}, а он не умеет добавлять приложения. Откройте страницу в Safari или Chrome: нажмите ⋯ и выберите «Открыть в браузере» или скопируйте ссылку.`,
    copyLink: 'Копировать ссылку',
    iosSteps: [
      'В Safari нажмите ⋯ справа внизу.',
      'Нажмите «Поделиться».',
      'Прокрутите вниз и нажмите «На экран „Домой“» (на некоторых iPhone — в разделе «Ещё»).',
      'Оставьте включённым «Открыть как веб-приложение» и нажмите «Добавить».',
      'Открывайте LMS с экрана «Домой», как любое приложение.',
    ],
    iosAlts: [
      'Нижняя панель Safari, справа обведена кнопка ⋯.',
      'Меню ⋯ в Safari, обведено «Поделиться».',
      'Меню «Поделиться», обведено «На экран „Домой“».',
      'Экран «На экран „Домой“»: «Открыть как веб-приложение» включено, обведено «Добавить».',
      'Значок LMS на экране «Домой», обведён.',
    ],
    iosNotes: [
      'Кнопка «Поделиться» прямо на панели Safari (iOS 18 и раньше или iPad)? Нажмите её и продолжайте с шага 3.',
      'Chrome на iPhone: нажмите «Поделиться» справа от адресной строки, затем «На экран „Домой“» и «Добавить».',
    ],
    androidSteps: [
      'В Chrome нажмите ⋮ справа вверху, затем «Установить приложение» (или «Добавить на главный экран»).',
      'Выберите «Установить».',
      'Подтвердите кнопкой «Установить».',
      'Открывайте LMS с главного экрана или из списка приложений.',
    ],
    androidAlts: [
      'Chrome: обведена кнопка ⋮, меню открыто на пункте «Установить приложение».',
      'Панель установки, обведено «Установить».',
      'Окно установки, обведено «Установить».',
      'Значок LMS на главном экране, обведён.',
    ],
    androidNotes: [
      'Нет такого пункта? Поищите «Установить приложение» или «Добавить на главный экран» в меню браузера.',
    ],
    installLms: 'Установить LMS',
    confirmOnce: 'Телефон один раз попросит подтвердить. Вот и всё.',
    qr: 'QR-код, чтобы открыть эту инструкцию на телефоне',
    scan: 'Отсканируйте телефоном',
    scanLine: 'Откроет эту инструкцию на телефоне, чтобы добавить LMS на главный экран.',
    installComputer: 'Установить на этот компьютер',
    desktopAlt: 'Адресная строка браузера, справа обведён значок установки.',
    desktopLine:
      'Или установите здесь: в Chrome или Edge нажмите значок установки в правом конце адресной строки.',
    desktopNotes: [
      'Нет значка? В Chrome: ⋮ → «Трансляция, сохранение и отправка» → «Установить страницу как приложение». В Safari на Mac: Файл → «Добавить в Dock».',
    ],
    devices: { iphone: 'iPhone', android: 'Android', computer: 'Компьютер' },
    yourDevice: 'Ваше устройство',
    ios: {
      share: 'Поделиться',
      addToHome: 'На экран «Домой»',
      cancel: 'Отменить',
      add: 'Добавить',
      openAsWebApp: 'Открыть как веб-приложение',
    },
    android: {
      installApp: 'Установить приложение',
      install: 'Установить',
      createShortcut: 'Создать ярлык',
      shortcutsNote: 'Ярлыки открываются в Chrome',
      cancel: 'Отмена',
    },
  },
});
