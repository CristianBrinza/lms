import { messages, plural } from '@/i18n';

/**
 * The workout player's words: a dark full-screen view read from across the room, so every label
 * stays short. Units, reps, sets and record names come from Training's shared dictionary.
 */

const en = {
  open: {
    failed: 'Couldn’t open the workout',
    tryAgain: 'Try again',
    skipped: 'This workout was skipped',
    skippedText: 'Plan it again from the workout to play it.',
    empty: 'Nothing to play yet',
    emptyText: 'Add an exercise to the workout first.',
    loading: 'Loading the workout',
    back: 'Back to the workout',
  },
  saveFailed: 'A set couldn’t be saved',
  /** Said aloud. */
  speech: {
    getReady: (first: string | null) => `Get ready.${first ? ` First: ${first}.` : ''}`,
    finished: 'Workout finished.',
  },
  live: {
    getReady: 'Get ready',
    complete: 'Workout complete',
  },
  header: {
    leave: 'Leave the workout',
    sound: 'Sound and voice',
    allSteps: 'All steps',
    progress: 'Sets done',
    of: (current: number, total: number) => `${current} of ${total}`,
    pending: (n: number) =>
      `${plural(n, { one: '# set', other: '# sets' })} not saved yet, retrying`,
  },
  firstUp: 'First up',
  upNext: 'Up next',
  finishWorkout: 'Finish workout',
  previousStep: 'Previous step',
  nextStep: 'Next step',
  pause: 'Pause',
  resume: 'Resume',
  steps: 'Steps',
  leaving: {
    title: 'Leave the workout?',
    pending: (n: number) =>
      `${plural(n, { one: '# set', other: '# sets' })} not saved yet: stay until ${n === 1 ? 'it is' : 'they are'}, or come back to it.`,
    saved: 'Your sets are saved. Open the workout again to continue from this step.',
    leave: 'Leave',
    stay: 'Stay',
  },
  pendingError: 'A set isn’t saved yet: no connection. Try again when you’re back online.',
  paused: {
    title: 'Paused',
    time: (elapsed: string) => `Workout time ${elapsed}`,
    leave: 'Leave workout',
  },
  start: {
    continueWith: 'Continue with',
    about: (time: string) => `about ${time}`,
    start: 'Start',
    continue: 'Continue',
  },
  meta: {
    set: (n: number, of: number) => `Set ${n} of ${of}`,
    round: (n: number, of: number) => `Round ${n} of ${of}`,
    setN: (n: number) => `Set ${n}`,
    side: (side: 'left' | 'right'): string => (side === 'left' ? 'Left side' : 'Right side'),
  },
  /** "Last time 10, 12 · 8 kg". */
  lastTime: (text: string) => `Last time ${text}`,
  ready: {
    startNow: 'Start now',
    title: 'Get ready',
    tap: 'Tap to start now',
  },
  end: {
    allDone: 'All sets done',
    nothing: 'Nothing logged yet',
    allDoneText: 'Rate how hard it was, then save.',
    nothingText:
      'No sets logged. Go back and log at least one set, or leave and plan it for another day.',
    finish: 'Finish',
    back: 'Back to the last set',
  },
  rest: {
    switchSides: 'Switch sides',
    betweenRounds: 'Rest between rounds',
    rest: 'Rest',
    paused: 'paused',
    less: (n: number) => `${n} s less`,
    more: (n: number) => `${n} s more`,
    skip: 'Skip',
  },
  work: {
    next: 'Next',
    done: 'Done',
    doneEarly: 'Done early',
    startFor: (time: string) => `Start ${time}`,
    logged: (what: string) => `Logged · ${what}`,
    pauseTimer: 'Pause the timer',
    startTimer: 'Start the timer',
    oneLess: 'One rep less',
    oneMore: 'One rep more',
    /** Under the big rep count. */
    repsUnder: (_n: number) => 'reps',
    weight: 'Weight',
    noWeight: 'No weight',
    stopStopwatch: 'Stop the stopwatch',
    startStopwatch: 'Start the stopwatch',
  },
  /** A logged step in the list, and a set logged without a value. */
  done: 'Done',
  finish: {
    title: 'Finish the workout',
    save: 'Save',
    timeTrained: 'Time trained',
    setsDone: 'Sets done',
    feel: 'How did it feel?',
    note: 'Note',
    notePlaceholder: 'Anything to remember for next time',
  },
  /** 1 (very hard) to 5 (great). */
  feeling: ['Very hard', 'Hard', 'OK', 'Good', 'Great'] as string[],
  /** "Leg day · felt good". */
  felt: (feeling: string) => `felt ${feeling.toLowerCase()}`,
  summary: {
    saved: 'Workout saved',
    time: 'Time',
    sets: 'Sets',
    reps: 'Reps',
    energy: 'Energy',
    distance: 'Distance',
    bests: 'New bests',
    whatYouDid: 'What you did',
    done: 'Done',
    /** "10, 12, 11 reps": the word follows the last number. */
    repsList: (list: string, _last: number) => `${list} reps`,
  },
};

type Player = typeof en;

const ro: Player = {
  open: {
    failed: 'Antrenamentul nu s-a deschis',
    tryAgain: 'Încearcă din nou',
    skipped: 'Antrenamentul a fost sărit',
    skippedText: 'Planifică-l din nou din pagina antrenamentului ca să-l pornești.',
    empty: 'Încă nu e nimic de pornit',
    emptyText: 'Mai întâi adaugă un exercițiu în antrenament.',
    loading: 'Se încarcă antrenamentul',
    back: 'Înapoi la antrenament',
  },
  saveFailed: 'O serie nu s-a putut salva',
  speech: {
    getReady: (first) => `Pregătește-te.${first ? ` Primul exercițiu: ${first}.` : ''}`,
    finished: 'Antrenament încheiat.',
  },
  live: {
    getReady: 'Pregătește-te',
    complete: 'Antrenament încheiat',
  },
  header: {
    leave: 'Ieși din antrenament',
    sound: 'Sunet și voce',
    allSteps: 'Toți pașii',
    progress: 'Serii făcute',
    of: (current, total) => `${current} din ${total}`,
    pending: (n) =>
      plural(n, {
        one: 'O serie nu e salvată încă, reîncercăm',
        few: '# serii nu sunt salvate încă, reîncercăm',
        other: '# de serii nu sunt salvate încă, reîncercăm',
      }),
  },
  firstUp: 'Începem cu',
  upNext: 'Urmează',
  finishWorkout: 'Încheie antrenamentul',
  previousStep: 'Pasul anterior',
  nextStep: 'Pasul următor',
  pause: 'Pauză',
  resume: 'Continuă',
  steps: 'Pași',
  leaving: {
    title: 'Ieși din antrenament?',
    pending: (n) =>
      plural(n, {
        one: 'O serie nu e salvată încă: rămâi până se salvează sau revino la antrenament mai târziu.',
        few: '# serii nu sunt salvate încă: rămâi până se salvează sau revino la antrenament mai târziu.',
        other:
          '# de serii nu sunt salvate încă: rămâi până se salvează sau revino la antrenament mai târziu.',
      }),
    saved:
      'Seriile tale sunt salvate. Deschide antrenamentul din nou ca să continui de la acest pas.',
    leave: 'Ieși',
    stay: 'Rămâi',
  },
  pendingError: 'O serie nu e salvată încă: nu e conexiune. Încearcă din nou când ai internet.',
  paused: {
    title: 'În pauză',
    time: (elapsed) => `Timp de antrenament ${elapsed}`,
    leave: 'Ieși din antrenament',
  },
  start: {
    continueWith: 'Continuăm cu',
    about: (time) => `circa ${time}`,
    start: 'Începe',
    continue: 'Continuă',
  },
  meta: {
    set: (n, of) => `Seria ${n} din ${of}`,
    round: (n, of) => `Runda ${n} din ${of}`,
    setN: (n) => `Seria ${n}`,
    side: (side) => (side === 'left' ? 'Partea stângă' : 'Partea dreaptă'),
  },
  lastTime: (text) => `Data trecută: ${text}`,
  ready: {
    startNow: 'Începe acum',
    title: 'Pregătește-te',
    tap: 'Atinge ca să începi acum',
  },
  end: {
    allDone: 'Toate seriile sunt gata',
    nothing: 'Încă nimic înregistrat',
    allDoneText: 'Spune cât de greu a fost, apoi salvează.',
    nothingText:
      'Nicio serie înregistrată. Întoarce-te și înregistrează cel puțin o serie sau ieși și planifică-l pentru altă zi.',
    finish: 'Încheie',
    back: 'Înapoi la ultima serie',
  },
  rest: {
    switchSides: 'Schimbă partea',
    betweenRounds: 'Pauză între runde',
    rest: 'Pauză',
    paused: 'în pauză',
    less: (n) => `Cu ${n} s mai puțin`,
    more: (n) => `Cu ${n} s mai mult`,
    skip: 'Omite',
  },
  work: {
    next: 'Următorul',
    done: 'Gata',
    doneEarly: 'Gata mai devreme',
    startFor: (time) => `Începe · ${time}`,
    logged: (what) => `Salvat · ${what}`,
    pauseTimer: 'Pune cronometrul pe pauză',
    startTimer: 'Pornește cronometrul',
    oneLess: 'O repetare mai puțin',
    oneMore: 'O repetare în plus',
    repsUnder: (n) => (n === 1 ? 'repetare' : 'repetări'),
    weight: 'Greutate',
    noWeight: 'Fără greutate',
    stopStopwatch: 'Oprește cronometrul',
    startStopwatch: 'Pornește cronometrul',
  },
  done: 'Făcut',
  finish: {
    title: 'Încheie antrenamentul',
    save: 'Salvează',
    timeTrained: 'Timp de antrenament',
    setsDone: 'Serii făcute',
    feel: 'Cum a fost?',
    note: 'Notiță',
    notePlaceholder: 'Ceva de ținut minte pentru data viitoare',
  },
  feeling: ['Foarte greu', 'Greu', 'Normal', 'Bine', 'Super'],
  felt: (feeling) => `a fost ${feeling.toLowerCase()}`,
  summary: {
    saved: 'Antrenament salvat',
    time: 'Timp',
    sets: 'Serii',
    reps: 'Repetări',
    energy: 'Energie',
    distance: 'Distanță',
    bests: 'Recorduri noi',
    whatYouDid: 'Ce ai făcut',
    done: 'Gata',
    repsList: (list, last) =>
      `${list} ${plural(last, { one: 'repetare', few: 'repetări', other: 'de repetări' })}`,
  },
};

const ru: Player = {
  open: {
    failed: 'Не удалось открыть тренировку',
    tryAgain: 'Повторить',
    skipped: 'Эта тренировка пропущена',
    skippedText: 'Запланируйте её снова на странице тренировки, чтобы начать.',
    empty: 'Пока нечего запускать',
    emptyText: 'Сначала добавьте упражнение в тренировку.',
    loading: 'Загрузка тренировки',
    back: 'Назад к тренировке',
  },
  saveFailed: 'Не удалось сохранить подход',
  speech: {
    getReady: (first) => `Приготовьтесь.${first ? ` Первое упражнение: ${first}.` : ''}`,
    finished: 'Тренировка завершена.',
  },
  live: {
    getReady: 'Приготовьтесь',
    complete: 'Тренировка завершена',
  },
  header: {
    leave: 'Выйти из тренировки',
    sound: 'Звук и голос',
    allSteps: 'Все шаги',
    progress: 'Сделано подходов',
    of: (current, total) => `${current} из ${total}`,
    pending: (n) =>
      plural(n, {
        one: '# подход ещё не сохранён, пробуем снова',
        few: '# подхода ещё не сохранены, пробуем снова',
        many: '# подходов ещё не сохранены, пробуем снова',
        other: '# подхода ещё не сохранены, пробуем снова',
      }),
  },
  firstUp: 'Первое упражнение',
  upNext: 'Далее',
  finishWorkout: 'Завершить тренировку',
  previousStep: 'Предыдущий шаг',
  nextStep: 'Следующий шаг',
  pause: 'Пауза',
  resume: 'Продолжить',
  steps: 'Шаги',
  leaving: {
    title: 'Выйти из тренировки?',
    pending: (n) =>
      plural(n, {
        one: '# подход ещё не сохранён: останьтесь, пока он сохранится, или вернитесь к тренировке позже.',
        few: '# подхода ещё не сохранены: останьтесь, пока они сохранятся, или вернитесь к тренировке позже.',
        many: '# подходов ещё не сохранены: останьтесь, пока они сохранятся, или вернитесь к тренировке позже.',
        other:
          '# подхода ещё не сохранены: останьтесь, пока они сохранятся, или вернитесь к тренировке позже.',
      }),
    saved: 'Подходы сохранены. Откройте тренировку снова, чтобы продолжить с этого шага.',
    leave: 'Выйти',
    stay: 'Остаться',
  },
  pendingError: 'Подход ещё не сохранён: нет связи. Попробуйте снова, когда появится интернет.',
  paused: {
    title: 'Пауза',
    time: (elapsed) => `Время тренировки ${elapsed}`,
    leave: 'Выйти из тренировки',
  },
  start: {
    continueWith: 'Продолжаем',
    about: (time) => `около ${time}`,
    start: 'Начать',
    continue: 'Продолжить',
  },
  meta: {
    set: (n, of) => `Подход ${n} из ${of}`,
    round: (n, of) => `Круг ${n} из ${of}`,
    setN: (n) => `Подход ${n}`,
    side: (side) => (side === 'left' ? 'Левая сторона' : 'Правая сторона'),
  },
  lastTime: (text) => `В прошлый раз: ${text}`,
  ready: {
    startNow: 'Начать сейчас',
    title: 'Приготовьтесь',
    tap: 'Нажмите, чтобы начать сразу',
  },
  end: {
    allDone: 'Все подходы сделаны',
    nothing: 'Пока ничего не записано',
    allDoneText: 'Оцените, насколько было тяжело, и сохраните.',
    nothingText:
      'Ни одного подхода не записано. Вернитесь и запишите хотя бы один или выйдите и запланируйте тренировку на другой день.',
    finish: 'Завершить',
    back: 'К последнему подходу',
  },
  rest: {
    switchSides: 'Смените сторону',
    betweenRounds: 'Отдых между кругами',
    rest: 'Отдых',
    paused: 'пауза',
    less: (n) => `На ${n} с меньше`,
    more: (n) => `На ${n} с больше`,
    skip: 'Дальше',
  },
  work: {
    next: 'Дальше',
    done: 'Готово',
    doneEarly: 'Закончить раньше',
    startFor: (time) => `Старт · ${time}`,
    logged: (what) => `Записано · ${what}`,
    pauseTimer: 'Поставить таймер на паузу',
    startTimer: 'Запустить таймер',
    oneLess: 'На одно повторение меньше',
    oneMore: 'На одно повторение больше',
    repsUnder: (n) =>
      plural(n, { one: 'повторение', few: 'повторения', many: 'повторений', other: 'повторения' }),
    weight: 'Вес',
    noWeight: 'Без веса',
    stopStopwatch: 'Остановить секундомер',
    startStopwatch: 'Запустить секундомер',
  },
  done: 'Сделано',
  finish: {
    title: 'Завершить тренировку',
    save: 'Сохранить',
    timeTrained: 'Время тренировки',
    setsDone: 'Сделано подходов',
    feel: 'Как ощущения?',
    note: 'Заметка',
    notePlaceholder: 'Что учесть в следующий раз',
  },
  feeling: ['Очень тяжело', 'Тяжело', 'Нормально', 'Хорошо', 'Отлично'],
  felt: (feeling) => `было ${feeling.toLowerCase()}`,
  summary: {
    saved: 'Тренировка сохранена',
    time: 'Время',
    sets: 'Подходы',
    reps: 'Повторения',
    energy: 'Энергия',
    distance: 'Дистанция',
    bests: 'Новые рекорды',
    whatYouDid: 'Что вы сделали',
    done: 'Готово',
    repsList: (list, last) =>
      `${list} ${plural(last, { one: 'повторение', few: 'повторения', many: 'повторений', other: 'повторения' })}`,
  },
};

/** A plain lookup (safe in helpers); usePlayerT is the same, named for components. */
export const playerT = messages({ en, ro, ru });
export const usePlayerT = playerT;

/**
 * How "last time" begins in each language: the suggestion from the server often already says
 * what last time was, so the player doesn't repeat it.
 */
export const LAST_TIME_PREFIXES = ['last time', 'data trecută', 'в прошлый раз'];
