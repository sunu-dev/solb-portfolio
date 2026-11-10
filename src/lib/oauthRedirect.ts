export function resolveOAuthRedirect(origin: string, redirectPath = '/'): string {
  const safePath = redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/';
  return new URL(safePath, origin).toString();
}

export type OAuthReturnFailure = 'cancelled' | 'failed';

/** 인증 제공자가 돌려준 오류만 URL에서 제거하고, 다른 딥링크는 보존한다. */
export function parseOAuthReturnFailure(href: string): { failure: OAuthReturnFailure; cleanPath: string } | null {
  const url = new URL(href);
  const hashParams = new URLSearchParams(url.hash.slice(1));
  const hashError = hashParams.get('error') ?? hashParams.get('error_code');
  const queryError = url.searchParams.get('error') ?? url.searchParams.get('error_code');
  const error = hashError ?? queryError;
  if (!error) return null;

  for (const key of ['error', 'error_code', 'error_description', 'error_uri']) {
    url.searchParams.delete(key);
    if (hashError) hashParams.delete(key);
  }
  if (hashError) url.hash = hashParams.toString() ? `#${hashParams}` : '';

  return {
    failure: error === 'access_denied' ? 'cancelled' : 'failed',
    cleanPath: `${url.pathname}${url.search}${url.hash}`,
  };
}
