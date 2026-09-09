import { supabase } from './supabase';

/** Authenticated fetch for admin panel write/read APIs (Bearer Supabase JWT or Telegram MiniApp HMAC initData). */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  // Telegram MiniApp real HMAC authentication: attach raw initData
  const tgInitData =
    (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) ||
    (typeof window !== 'undefined' && localStorage.getItem('obraclima_telegram_init_data')) ||
    '';

  if (tgInitData) {
    headers.set('X-Telegram-Init-Data', tgInitData);
  }

  return fetch(input, { ...init, headers });
}

/** Authenticated fetch for merchant portal APIs (X-Business-Access-Code). */
export async function businessFetch(
  input: RequestInfo | URL,
  accessCode: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessCode) {
    headers.set('X-Business-Access-Code', accessCode);
  }
  return fetch(input, { ...init, headers });
}
