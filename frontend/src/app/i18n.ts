import { messages } from '@/i18n';

/** Before any screen: the connection error and the skip link. */
export const useAppT = messages({
  en: {
    cantConnect: 'LMS can’t connect',
    cantConnectLine:
      'Check your connection. If it works elsewhere, the server may be restarting; try again in a minute.',
    tryAgain: 'Try again',
    skip: 'Skip to content',
  },
  ro: {
    cantConnect: 'LMS nu se poate conecta',
    cantConnectLine:
      'Verifică conexiunea. Dacă internetul merge, poate serverul repornește; încearcă peste un minut.',
    tryAgain: 'Încearcă din nou',
    skip: 'Treci la conținut',
  },
  ru: {
    cantConnect: 'LMS не может подключиться',
    cantConnectLine:
      'Проверьте подключение. Если интернет работает, возможно, сервер перезапускается; попробуйте через минуту.',
    tryAgain: 'Попробовать снова',
    skip: 'Перейти к содержимому',
  },
});
