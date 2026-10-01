export function resolveOAuthRedirect(origin: string, redirectPath = '/'): string {
  const safePath = redirectPath.startsWith('/') && !redirectPath.startsWith('//')
    ? redirectPath
    : '/';
  return new URL(safePath, origin).toString();
}
