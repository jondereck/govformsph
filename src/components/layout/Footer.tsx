import React from "react";
import { ShieldCheck } from "lucide-react";

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="mt-16 bg-band px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-white/80 md:flex-row">
        <div className="flex items-center gap-1.5 font-medium text-white">
          <ShieldCheck className="h-4 w-4" />
          <span>100% Client-Side Privacy</span>
        </div>

        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => onNavigate("privacy")}
            className="cursor-pointer transition-colors hover:text-white"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onNavigate("about")}
            className="cursor-pointer transition-colors hover:text-white"
          >
            About & License
          </button>
          <a
            href="https://jdnifas.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="JN System"
            className="inline-flex"
          >
            <img src="/jn-mark.png" alt="" className="h-6 w-auto" />
          </a>
        </div>
      </div>
    </footer>
  );
};
