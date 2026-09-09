'use server';

import { cookies } from 'next/headers';

export async function setTestSessionCookie(value: string) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    throw new Error('Qualification endpoints disabled in production');
  }

  const cookieStore = await cookies();
  cookieStore.set('__Host-qual-session', value, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 3600,
  });

  return {
    success: true,
    storedValue: true,
    timestamp: new Date().toISOString(),
  };
}

export async function clearTestSessionCookie() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_QUALIFICATION_ENDPOINTS !== 'true') {
    throw new Error('Qualification endpoints disabled in production');
  }

  const cookieStore = await cookies();
  cookieStore.delete('__Host-qual-session');
  return { success: true };
}
