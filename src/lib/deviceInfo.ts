/**
 * Device & IP detection utility for customer auto-naming
 */

export function getDeviceModelName(): string {
  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  } else if (/iPad/i.test(ua)) {
    return 'iPad';
  } else if (/Android/i.test(ua)) {
    // Try matching specific popular models in UA
    const samsungMatch = ua.match(/SM-[A-Z0-9]+/i);
    if (samsungMatch) return `Galaxy (${samsungMatch[0]})`;
    if (/Galaxy/i.test(ua)) return 'Galaxy 스마트폰';
    if (/Pixel/i.test(ua)) return 'Google Pixel';
    return 'Android 스마트폰';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'Mac PC';
  } else if (/Windows NT/i.test(ua)) {
    return 'Windows PC';
  } else if (/Linux/i.test(ua)) {
    return 'Linux 기기';
  }
  return '모바일/PC 기기';
}

export async function fetchClientPublicIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.ip) {
        return data.ip;
      }
    }
  } catch (e) {
    // Network or CORS fallback
  }

  // Fallback to random realistic IP segment for demo/offline test
  const fallbackIp = `211.${Math.floor(100 + Math.random() * 90)}.${Math.floor(
    10 + Math.random() * 80
  )}.${Math.floor(10 + Math.random() * 80)}`;
  return fallbackIp;
}

export async function getAutoCustomerDeviceIdentifier(): Promise<string> {
  const device = getDeviceModelName();
  const ip = await fetchClientPublicIP();
  return `${device} (${ip})`;
}
