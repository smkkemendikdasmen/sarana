export function resolveNpsn(
  scope: 'me' | string,
  session: { user?: { npsn?: string | null } },
): string | null {
  if (scope === 'me') {
    return session?.user?.npsn ?? null;
  }
  return scope;
}

export function buildRoleScopePath(
  role: string,
  scope: string | 'me',
  page: string,
): `/${string}/${string}/${string}` {
  const cleanPage = page.replace(/^\//, '');
  return `/${role}/${scope}/${cleanPage}`;
}
