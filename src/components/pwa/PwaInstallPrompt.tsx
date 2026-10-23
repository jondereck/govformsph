import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { Button } from '../common/Button';
import { usePwaInstall } from '../../hooks/usePwaInstall';

const DISMISS_DAY_KEY = 'govforms:pwa-install-dismissed-day';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isIosSafari(): boolean {
  const userAgent = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
}

export const PwaInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, promptInstall } = usePwaInstall();
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_DAY_KEY) === todayKey());
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (!isMobile || isInstalled || dismissed) return null;

  const kind = isInstallable ? 'native' : isIosSafari() ? 'ios' : 'fallback';

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_DAY_KEY, todayKey());
    setDismissed(true);
  };

  const install = async () => {
    setOpening(true);
    try {
      const accepted = await promptInstall();
      if (!accepted) dismiss();
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 md:hidden">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50">
        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            {kind === 'native' ? <Download className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Install Govforms on your phone</h2>
            {kind === 'native' ? (
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Add it to your home screen so your forms open like an app and stay on this device.
              </p>
            ) : kind === 'ios' ? (
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Tap <span className="font-medium text-slate-900 dark:text-white">Share</span>, then choose{' '}
                <span className="font-medium text-slate-900 dark:text-white">Add to Home Screen</span>.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Open the browser menu and choose <span className="font-medium text-slate-900 dark:text-white">Install app</span> or{' '}
                <span className="font-medium text-slate-900 dark:text-white">Add to Home Screen</span>.
              </p>
            )}
            <div className="mt-4 flex items-center gap-2">
              {kind === 'native' ? (
                <Button variant="primary" size="sm" loading={opening} onClick={install}>
                  {opening ? 'Opening…' : 'Install app'}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={dismiss}>
                  Got it
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
