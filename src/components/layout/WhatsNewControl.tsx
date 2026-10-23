import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import changelogData from '../../generated/changelog.json';
import { ChangelogEntry } from '../../types/changelog';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

const SEEN_KEY = 'govforms:last-seen-version';
const changelog = (changelogData || []) as ChangelogEntry[];

function latestVersion(): string {
  return changelog[0]?.version || '';
}

function hasSeenLatest(): boolean {
  return window.localStorage.getItem(SEEN_KEY) === latestVersion();
}

export const WhatsNewControl: React.FC<{
  layout: 'desktop' | 'mobile';
  onOpenAbout: () => void;
}> = ({ layout, onOpenAbout }) => {
  const latest = changelog[0];
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => !hasSeenLatest());

  if (!latest || !unread) return null;

  const markSeen = () => {
    window.localStorage.setItem(SEEN_KEY, latest.version);
    setUnread(false);
    setOpen(false);
  };

  const notes = (
    <div className={layout === 'desktop' ? 'p-3.5' : 'px-3 pb-3'}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Version {latest.version}</p>
        {latest.date ? <span className="font-mono text-[10px] text-slate-400">{latest.date}</span> : null}
      </div>
      <div className="space-y-2">
        {latest.sections.map((section) => (
          <div key={section.type}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{section.type}</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={markSeen}>
          Got it
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            onOpenAbout();
          }}
        >
          All versions
        </Button>
      </div>
    </div>
  );

  const triggerClass =
    layout === 'desktop'
      ? `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
          open
            ? 'border border-teal-200/60 bg-teal-50 text-teal-700 dark:border-teal-800/60 dark:bg-teal-950/60 dark:text-teal-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
        }`
      : `flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
          open
            ? 'bg-teal-50 font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`;

  return (
    <div className={layout === 'desktop' ? 'relative' : ''}>
      <button type="button" className={triggerClass} onClick={() => setOpen((value) => !value)}>
        <Sparkles className="h-4 w-4" />
        <span>What's New</span>
        {unread ? <Badge variant="info" size="sm">New</Badge> : null}
      </button>
      {open && layout === 'desktop' ? (
        <div className="absolute left-0 z-50 mt-2 w-80 rounded-xl border border-border-light bg-surface-light shadow-lg dark:border-border-dark dark:bg-surface-dark">
          {notes}
        </div>
      ) : null}
      {open && layout === 'mobile' ? notes : null}
    </div>
  );
};
