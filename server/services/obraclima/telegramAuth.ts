import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramValidationResult {
  valid: boolean;
  user?: TelegramUser;
  authDate?: number;
  error?: string;
}

/**
 * Validates Telegram Mini App initData against the bot token.
 * Validates HMAC, checks timestamp (< 24h), and verifies against OBRACLIMA_TELEGRAM_ADMIN_IDS.
 * No PII, passwords, NIF or IBAN are logged.
 */
export function validateTelegramInitData(rawInitData: string, botToken?: string): TelegramValidationResult {
  if (!rawInitData || typeof rawInitData !== 'string') {
    return { valid: false, error: 'InitData vacío o no proporcionado' };
  }

  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { valid: false, error: 'TELEGRAM_BOT_TOKEN no configurado en el servidor' };
  }

  try {
    const params = new URLSearchParams(rawInitData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'Hash no presente en initData' };
    }

    // 1. Verify freshness (older than 24 hours rejected)
    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);
    if (!authDate || isNaN(authDate)) {
      return { valid: false, error: 'auth_date no válido' };
    }
    if (now - authDate > 86400) {
      return { valid: false, error: 'initData caducado (> 24 horas)' };
    }

    // 2. Build data_check_string (all keys except 'hash', sorted alphabetically)
    const dataCheckPairs: string[] = [];
    const keys = Array.from(params.keys())
      .filter((key) => key !== 'hash')
      .sort();

    for (const key of keys) {
      const val = params.get(key);
      if (val !== null) {
        dataCheckPairs.push(`${key}=${val}`);
      }
    }
    const dataCheckString = dataCheckPairs.join('\n');

    // 3. Compute HMAC validation:
    // Support both standard Telegram WebAppData HMAC and direct SHA256(botToken)
    const secretHmac = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculatedHashHmac = crypto
      .createHmac('sha256', secretHmac)
      .update(dataCheckString)
      .digest('hex');

    const secretSha = crypto.createHash('sha256').update(token).digest();
    const calculatedHashSha = crypto
      .createHmac('sha256', secretSha)
      .update(dataCheckString)
      .digest('hex');

    const isValidHash =
      calculatedHashHmac.toLowerCase() === hash.toLowerCase() ||
      calculatedHashSha.toLowerCase() === hash.toLowerCase();

    if (!isValidHash) {
      return { valid: false, error: 'Firma HMAC inválida' };
    }

    // 4. Extract User
    const userRaw = params.get('user');
    let user: TelegramUser | undefined;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch {}
    }

    // 5. Verify against OBRACLIMA_TELEGRAM_ADMIN_IDS allowlist
    const rawAllowlist = process.env.OBRACLIMA_TELEGRAM_ADMIN_IDS || '';
    const allowlist = rawAllowlist
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (allowlist.length > 0) {
      const userIdStr = user?.id ? String(user.id) : '';
      if (!userIdStr || !allowlist.includes(userIdStr)) {
        return { valid: false, error: 'ID de usuario Telegram no autorizado en la lista de administradores' };
      }
    } else {
      // If allowlist is empty: allow only in development with warning
      if (process.env.NODE_ENV === 'production') {
        console.error('[TelegramAuth] OBRACLIMA_TELEGRAM_ADMIN_IDS is not configured in production.');
        return { valid: false, error: 'Lista de administradores Telegram no configurada en producción' };
      }
      console.warn('[TelegramAuth] OBRACLIMA_TELEGRAM_ADMIN_IDS está vacío en dev; autorizando temporalmente al usuario Telegram.');
    }

    return {
      valid: true,
      user,
      authDate
    };
  } catch (err: any) {
    return { valid: false, error: `Error en validación initData: ${err.message}` };
  }
}
