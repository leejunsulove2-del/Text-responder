/**
 * Notification Service for Web Browser & Background Notifications
 */

let swRegistration: ServiceWorkerRegistration | null = null;
let audioContext: AudioContext | null = null;

// Initialize Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('[SW] Service worker registered successfully');
    return reg;
  } catch (err) {
    console.warn('[SW] Service worker registration failed or not supported in iframe:', err);
    return null;
  }
}

// Request Notification Permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    console.warn('Error requesting notification permission:', e);
    return 'default';
  }
}

// Check Notification Status
export function getNotificationPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Play pleasant web audio chime sound (harp/bell tone)
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext || audioContext.state === 'suspended') {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Tone 1 (High bell)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2 (Soft harmonic)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.5, now + 0.08); // C6
    gain2.gain.setValueAtTime(0.15, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Could not play audio chime:', e);
  }
}

interface NotifyOptions {
  title: string;
  body: string;
  tag?: string;
  data?: any;
  playSound?: boolean;
}

// Send Browser & Mobile Notification (Works in foreground, background, or minimized)
export async function sendBrowserNotification({
  title,
  body,
  tag = 'chat-alert',
  data = {},
  playSound = true,
}: NotifyOptions): Promise<void> {
  if (playSound) {
    playNotificationSound();
  }

  // Mobile Vibration API support for APK & Mobile Web
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([120, 80, 150]);
    }
  } catch (e) {
    // ignore vibration error
  }

  // Flash document title
  flashDocumentTitle(title);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  try {
    // If ServiceWorker registration exists, use showNotification for better background support
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, {
        body,
        tag,
        data,
        vibrate: [120, 80, 150],
        badge: '/favicon.ico',
        icon: '/favicon.ico',
        requireInteraction: false,
      } as any);
    } else {
      // Fallback to standard Notification API
      const n = new Notification(title, {
        body,
        tag,
        icon: '/favicon.ico',
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  } catch (e) {
    console.warn('Failed to display browser notification:', e);
  }
}

// Flash tab title when a notification arrives
let titleInterval: any = null;
const originalTitle = typeof document !== 'undefined' ? document.title : '실시간 상담톡';

export function flashDocumentTitle(alertText: string) {
  if (typeof document === 'undefined') return;

  if (titleInterval) {
    clearInterval(titleInterval);
  }

  let isAlert = true;
  let counter = 0;
  titleInterval = setInterval(() => {
    document.title = isAlert ? `🔔 ${alertText}` : originalTitle;
    isAlert = !isAlert;
    counter++;
    if (counter >= 10) {
      clearInterval(titleInterval);
      document.title = originalTitle;
      titleInterval = null;
    }
  }, 1000);

  const onFocus = () => {
    if (titleInterval) {
      clearInterval(titleInterval);
      titleInterval = null;
      document.title = originalTitle;
    }
    window.removeEventListener('focus', onFocus);
  };
  window.addEventListener('focus', onFocus);
}
