import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/app/auth';
import { LogoTile } from '@/components/brand/Logo';
import { Button, Chips, Skeleton } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { api } from '@/services/api/client';
import { useAuthT } from './i18n';

type Scope = 'food:read' | 'food' | 'admin';

/**
 * "Connect Claude Code to LMS?" — where an assistant (Claude Code, Codex, claude.ai, ChatGPT)
 * sends the person when it signs in to the MCP server. Signed in to the app (the route needs it),
 * they pick what it may do; the answer goes back to the assistant's own address with a one-time
 * code, which it trades for an access key (backend/src/modules/oauth.ts).
 */
export default function OAuthConsentPage() {
  const t = useAuthT();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const challenge = params.get('code_challenge') ?? '';
  const method = params.get('code_challenge_method') ?? '';
  const asked = (params.get('scope') ?? '').split(' ');
  const options: Scope[] =
    user?.role === 'admin' ? ['food:read', 'food', 'admin'] : ['food:read', 'food'];
  const [scope, setScope] = useState<Scope>(options.find((o) => asked.includes(o)) ?? 'food');
  const [leaving, setLeaving] = useState(false);

  const complete =
    params.get('response_type') === 'code' &&
    clientId &&
    redirectUri &&
    challenge &&
    method === 'S256';
  const client = useQuery({
    queryKey: ['oauth-client', clientId],
    queryFn: () =>
      api.get<{ name: string; scopes: Record<Scope, string> }>(
        `/oauth/clients/${encodeURIComponent(clientId)}`,
      ),
    enabled: Boolean(complete),
    retry: false,
  });
  const answer = useMutation({
    mutationFn: (approve: boolean) =>
      api.post<{ redirect: string }>('/oauth/authorize', {
        clientId,
        redirectUri,
        codeChallenge: challenge,
        codeChallengeMethod: method,
        scope,
        approve,
        ...(params.get('state') !== null ? { state: params.get('state') } : {}),
        ...(params.get('resource') ? { resource: params.get('resource') } : {}),
      }),
    onSuccess: ({ redirect }) => {
      setLeaving(true);
      window.location.assign(redirect);
    },
  });

  const name = client.data?.name ?? t.anAssistant;
  const returnsTo = (() => {
    try {
      return new URL(redirectUri).host;
    } catch {
      return redirectUri;
    }
  })();
  const broken = !complete || client.isError;

  return (
    <div className="min-h-dvh bg-butter-300">
      <main
        id="main"
        className="gutter-x mx-auto flex min-h-dvh max-w-md flex-col justify-center pb-[calc(var(--safe-bottom)+1.25rem)] pt-[calc(var(--safe-top)+1.5rem)] animate-page"
      >
        <LogoTile className="mx-auto size-14" />
        {broken ? (
          <>
            <h1 className="mt-7 text-center text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              {t.brokenTitle}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-center text-base font-medium text-butter-800">
              {client.isError ? errorMessage(client.error) : t.missing} {t.startAgain}
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-7 text-center text-[2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              {client.isPending ? (
                <Skeleton className="mx-auto h-9 w-56 bg-butter-200" />
              ) : (
                t.connectTitle(name)
              )}
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-center text-base font-medium text-butter-800">
              {t.actsAs(user?.name ?? '')}
            </p>

            <div className="mt-7 flex flex-col gap-3 rounded-[1.75rem] bg-white p-5 shadow-[0_20px_40px_-28px_rgb(110_80_0/0.6)]">
              <p className="text-[0.8125rem] font-semibold text-ink-700">{t.mayDo}</p>
              <Chips
                label={t.mayDo}
                tone="sheet"
                dense
                value={scope}
                onChange={setScope}
                options={options.map((value) => ({ value, label: t.scope[value] }))}
              />
              <p className="text-sm text-ink-600">{client.data?.scopes[scope]}</p>
              <p className="border-t border-ink-100 pt-3 text-sm text-ink-600">
                {t.returnsTo} <span className="font-semibold text-ink-800">{returnsTo}</span>
              </p>
              {answer.error ? (
                <p className="text-sm font-medium text-danger-600">{errorMessage(answer.error)}</p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                fullWidth
                loading={(answer.isPending && answer.variables) || leaving}
                disabled={client.isPending || answer.isPending || leaving}
                onClick={() => answer.mutate(true)}
              >
                {t.connect}
              </Button>
              <Button
                variant="outline"
                fullWidth
                disabled={answer.isPending || leaving}
                onClick={() => answer.mutate(false)}
              >
                {t.cancel}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
