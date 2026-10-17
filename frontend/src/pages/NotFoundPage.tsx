import { useAuth } from '@/app/auth';
import { ButtonLink } from '@/components/ui';
import { HomeIcon } from '@/components/ui/icons';
import { messages } from '@/i18n';

const useT = messages({
  en: {
    title: 'This page doesn’t exist',
    line: 'The link may be old or mistyped.',
    home: 'Back to Home',
    start: 'Go to the start',
  },
  ro: {
    title: 'Pagina asta nu există',
    line: 'Poate linkul e vechi sau greșit.',
    home: 'Înapoi Acasă',
    start: 'Mergi la început',
  },
  ru: {
    title: 'Такой страницы нет',
    line: 'Возможно, ссылка устарела или набрана с ошибкой.',
    home: 'На главную',
    start: 'К началу',
  },
});

export default function NotFoundPage() {
  const t = useT();
  const { user } = useAuth();
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="tabular text-[5rem] font-bold leading-none tracking-[-0.06em] text-lav-800">
          404
        </p>
        <h1 className="mt-4 text-h1 font-bold">{t.title}</h1>
        <p className="mt-3 text-ink-700">{t.line}</p>
        <ButtonLink to={user ? '/home' : '/'} icon={HomeIcon} className="mt-8">
          {user ? t.home : t.start}
        </ButtonLink>
      </div>
    </main>
  );
}
