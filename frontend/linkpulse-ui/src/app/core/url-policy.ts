export interface UrlCheck {
  ok: boolean;
  message: string;
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export function validatePublicUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, message: 'Indiquez une URL complète, par exemple https://exemple.org.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, message: 'Seuls les liens HTTP et HTTPS sont acceptés.' };
  }
  if (url.username || url.password) {
    return { ok: false, message: 'Retirez l’identifiant inclus dans l’URL.' };
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    return { ok: false, message: 'Seuls les ports 80 et 443 sont acceptés.' };
  }
  const host = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    isPrivateAddress(host)
  ) {
    return { ok: false, message: 'Les adresses locales et privées ne peuvent pas être surveillées.' };
  }
  return { ok: true, message: '' };
}

function isPrivateAddress(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return false;
  }
  const parts = match.slice(1).map((part) => Number(part));
  if (parts.some((part) => part > 255)) {
    return true;
  }
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}
