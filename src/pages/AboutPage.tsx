import React from 'react';
import packageJson from '../../package.json';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import {
  Info,
  ShieldCheck,
  HardDrive,
  Download,
  HelpCircle,
  Mail,
} from 'lucide-react';

import { BrandMark } from '../components/brand/BrandMark';
import changelogData from '../generated/changelog.json';
import { ChangelogEntry } from '../types/changelog';

interface AboutPageProps {
  onReplayTour: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onReplayTour }) => {
  const version = packageJson.version || '1.0.0';
  const changelog = (changelogData || []) as ChangelogEntry[];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Info className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          About GovFormsPH
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Open-source, privacy-first Philippine government form builder for public servants and civil workers.
        </p>
      </div>

      {/* Main Info Card */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-light dark:border-border-dark pb-4">
          <div className="flex items-center gap-3">
            <BrandMark className="w-12 h-12 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  GovFormsPH
                </h2>
                <Badge variant="success" size="sm">v{version}</Badge>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<HelpCircle className="w-4 h-4" />}
            onClick={onReplayTour}
          >
            Replay Quick Tour
          </Button>
        </div>

        {/* Feature Highlights */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
            Key Architecture Features
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <HardDrive className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">Dexie.js IndexedDB</strong>
                All records and draft versions persist purely on the user's browser without the 5MB localStorage limit.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">100% Privacy by Design</strong>
                Zero telemetry, zero cloud backends, zero external script dependencies for data processing.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 dark:text-slate-100 block mb-0.5">Encrypted Backups</strong>
                Export whole database with native Web Crypto AES-GCM 256-bit password protection.
              </div>
            </div>

          </div>
        </div>

        {/* MIT License Box */}
        <div className="pt-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
            MIT License & Open Source
          </h3>
          <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-800">
            <p className="mb-2"><strong>MIT License</strong> — Copyright (c) 2026 GovFormsPH Contributors</p>
            <p>
              Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies.
            </p>
          </div>
        </div>

        {/* Changelog */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Changelog
            </h3>
            <span className="text-[11px] text-slate-400">
              Latest: v{version}
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
            {changelog.map((entry) => (
              <div
                key={entry.version}
                className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100 pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-teal-700 dark:text-teal-300 font-bold">
                      Version {entry.version}
                    </span>
                    {entry.version === version && (
                      <Badge variant="success" size="sm">Current</Badge>
                    )}
                  </div>
                  {entry.date && (
                    <span className="text-slate-400 text-[10px] font-mono">
                      {entry.date}
                    </span>
                  )}
                </div>

                {entry.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="space-y-1">
                    {entry.sections.length > 1 && (
                      <p className="font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {sec.type}
                      </p>
                    )}
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                      {sec.items.map((item, iIdx) => (
                        <li key={iIdx} className="text-slate-700 dark:text-slate-300">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex items-center gap-3">
        <Mail className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
        <div className="text-xs">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Contact</h2>
          <a
            href="mailto:jonderecknifas@gmail.com"
            className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            jonderecknifas@gmail.com
          </a>
        </div>
      </Card>
    </div>
  );
};
