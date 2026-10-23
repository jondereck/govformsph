import React, { useState } from "react";
import {
  FileText,
  Home,
  Download,
  Shield,
  Info,
  Moon,
  Sun,
  HelpCircle,
  Menu,
  X,
  Plus,
  ChevronDown,
} from "lucide-react";
import { Button } from "../common/Button";
import { BrandMark } from "../brand/BrandMark";
import { WhatsNewControl } from "./WhatsNewControl";

interface NavbarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onNewForm?: () => void;
  onReplayTour: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onNavigate,
  onNewForm,
  onReplayTour,
  isDark,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formsDropdownOpen, setFormsDropdownOpen] = useState(false);

  // Updated array (PDS Builder removed from here, handled separately)
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <Home className="w-4 h-4" /> },
    {
      id: "export-import",
      label: "Export / Import",
      icon: <Download className="w-4 h-4" />,
    },
    { id: "privacy", label: "Privacy", icon: <Shield className="w-4 h-4" /> },
    { id: "about", label: "About", icon: <Info className="w-4 h-4" /> },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 mb-6 border-b border-slate-200 bg-white dark:border-border-dark dark:bg-surface-dark">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        {/* Brand / Logo */}
        <div
          onClick={() => handleNavClick("dashboard")}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <BrandMark className="h-8 w-8 shrink-0" />
          <div>
            <span className="text-base font-medium tracking-[-0.02em] text-ink dark:text-slate-100">
              GovFormsPH
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {/* Dashboard */}
          <button
            onClick={() => handleNavClick("dashboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${currentTab === "dashboard"
                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* Forms Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFormsDropdownOpen(!formsDropdownOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${currentTab === "editor" || currentTab === "wes"
                  ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>Forms</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {formsDropdownOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-lg py-1.5 z-50">
                <button
                  onClick={() => {
                    handleNavClick("editor");
                    setFormsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer flex items-center justify-between"
                >
                  <span>PDS</span>
                </button>
                <button
                  onClick={() => {
                    handleNavClick("wes");
                    setFormsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-600 dark:hover:text-teal-300 cursor-pointer flex items-center justify-between"
                >
                  <span>Work Experience Sheet</span>
                </button>
                <button
                  onClick={() => {
                    handleNavClick("saln");
                    setFormsDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-medium cursor-pointer flex items-center justify-between ${
                    currentTab === "saln"
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"
                      : "text-slate-700 hover:bg-teal-50 hover:text-teal-600 dark:text-slate-200 dark:hover:bg-teal-950/50 dark:hover:text-teal-300"
                  }`}
                >
                  <span>SALN</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                    New
                  </span>
                </button>
              </div>
            )}
          </div>

          <WhatsNewControl layout="desktop" onOpenAbout={() => handleNavClick("about")} />

          {/* Remaining Nav Items */}
          {navItems.slice(1).map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${isActive
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onNewForm && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={onNewForm}
              className="hidden sm:inline-flex"
            >
              New PDS Form
            </Button>
          )}

          {/* Quick Tour Button */}
          <button
            onClick={onReplayTour}
            title="Replay Quick Tour"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Replay Tour"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-xl space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
          {onNewForm && (
            <div className="pb-2 border-b border-border-light dark:border-border-dark mb-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  onNewForm();
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-center"
              >
                New PDS Form
              </Button>
            </div>
          )}

          {/* Dashboard Mobile Link */}
          <button
            onClick={() => handleNavClick("dashboard")}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${currentTab === "dashboard"
                ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* Forms Section Mobile */}
          <div className="pt-1 pb-1">
            <div className="px-3.5 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Forms
            </div>
            <div className="ml-3 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-1 mt-1">
              <button
                onClick={() => handleNavClick("editor")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentTab === "editor"
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                <span>PDS</span>
              </button>
              <button
                onClick={() => handleNavClick("wes")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentTab === "wes"
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                <span>Work Experience Sheet</span>
              </button>
              <button
                onClick={() => handleNavClick("saln")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentTab === "saln"
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>SALN</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                  New
                </span>
              </button>
            </div>
          </div>

          <WhatsNewControl layout="mobile" onOpenAbout={() => handleNavClick("about")} />

          {/* Remaining Nav Items Mobile */}
          {navItems.slice(1).map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${isActive
                    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
