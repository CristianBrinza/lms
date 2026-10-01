import { useAuth } from '@/app/auth';
import { ButtonLink } from '@/components/ui';
import { HomeIcon } from '@/components/ui/icons';

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="tabular text-[5rem] font-bold leading-none tracking-[-0.06em] text-lav-800">404</p>
        <h1 className="mt-4 text-h1 font-bold">This page doesn’t exist</h1>
        <p className="mt-3 text-ink-700">The link may be old or mistyped.</p>
        <ButtonLink to={user ? '/home' : '/'} icon={HomeIcon} className="mt-8">
          {user ? 'Back to Home' : 'Go to the start'}
        </ButtonLink>
      </div>
    </main>
  );
}
