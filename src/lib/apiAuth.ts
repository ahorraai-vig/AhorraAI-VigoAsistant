import { supabase } from './supabase';

/** Authenticated fetch for admin panel write/read APIs (Bearer Supabase JWT or Telegram MiniApp Auth). */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  } else {
    // Fallback for Telegram MiniApp or ObraClima direct access
    const tgToken = localStorage.getItem('obraclima_token') || 'obraclima-telegram-miniapp';
    headers.set('X-Telegram-Auth', tgToken);
    headers.set('X-ObraClima-Auth', tgToken);
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
