// ============================================================
// Settings Page
// ============================================================
// Principles:
// - Progressive Disclosure: Groups of related settings
// - Recognition over Recall: Preview of theme changes
// - Fitts's Law: Large toggle targets
// ============================================================

import React from 'react';
import { useApp } from '@/hooks/useApp';
import { resetAllData } from '@/lib/storage';
import type { ThemeMode } from '@/types';
import { Sun, Moon, BookOpen, Eye, Type, RotateCcw, AlertTriangle } from 'lucide-react';

export function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const [confirmReset, setConfirmReset] = React.useState(false);

  const themes: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={16} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
    { id: 'reading', label: 'Reading', icon: <BookOpen size={16} /> },
    { id: 'high-contrast', label: 'High Contrast', icon: <Eye size={16} /> },
  ];

  const fontSizes = [
    { id: 'small' as const, label: 'Small', size: '14px' },
    { id: 'medium' as const, label: 'Medium', size: '16px' },
    { id: 'large' as const, label: 'Large', size: '18px' },
  ];

  const handleReset = () => {
    if (confirmReset) {
      resetAllData();
      window.location.reload();
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Customize your N3 learning environment, themes, and study preferences
        </p>
      </div>

      {/* ============================================================
          2-Column Apple Settings Workspace (lg:grid-cols-12)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 Spans): Settings Controls */}
        <div className="lg:col-span-7 space-y-8">
          {/* Theme */}
          <SettingsGroup title="Theme Palette" icon={<Sun size={16} />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => updateSettings({ theme: theme.id })}
                  className={`
                    flex items-center justify-center gap-2 px-4 py-3 rounded-xl border
                    text-sm font-medium transition-all duration-150 cursor-pointer focus-ring shadow-xs
                    ${settings.theme === theme.id
                      ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent-text)] ring-2 ring-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  {theme.icon}
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          </SettingsGroup>

          {/* Font Size */}
          <SettingsGroup title="Typography Scale" icon={<Type size={16} />}>
            <div className="grid grid-cols-3 gap-2.5">
              {fontSizes.map((fs) => (
                <button
                  key={fs.id}
                  onClick={() => updateSettings({ fontSize: fs.id })}
                  className={`
                    px-4 py-3 rounded-xl border text-sm font-medium text-center
                    transition-all duration-150 cursor-pointer focus-ring shadow-xs
                    ${settings.fontSize === fs.id
                      ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent-text)] ring-2 ring-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }
                  `}
                >
                  <span>{fs.label}</span>
                  <span className="block text-xs font-mono opacity-70 mt-0.5">{fs.size}</span>
                </button>
              ))}
            </div>
          </SettingsGroup>

          {/* Study Preferences */}
          <SettingsGroup title="Study Preferences" icon={<BookOpen size={16} />}>
            <div className="space-y-4 p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
              <ToggleSetting
                label="Show Furigana"
                description="Display hiragana reading above kanji in flashcards and study modules"
                checked={settings.showFurigana}
                onChange={(v) => updateSettings({ showFurigana: v })}
              />
              <ToggleSetting
                label="Reduced Motion"
                description="Minimize animations and transitions for calm cognitive load"
                checked={settings.reducedMotion}
                onChange={(v) => updateSettings({ reducedMotion: v })}
              />
            </div>
          </SettingsGroup>

          {/* Danger Zone */}
          <SettingsGroup title="Data Management" icon={<RotateCcw size={16} />}>
            <div className="p-6 rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error-subtle)] shadow-xs">
              <div className="flex items-start gap-4">
                <AlertTriangle size={20} className="text-[var(--color-error)] mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">Reset All Progress Data</div>
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                    This will clear all SRS repetition intervals, review histories, bookmarks, and streaks from local storage. This action cannot be undone.
                  </div>
                  <button
                    onClick={handleReset}
                    className={`
                      mt-4 px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer focus-ring
                      transition-all duration-150 shadow-xs
                      ${confirmReset
                        ? 'bg-[var(--color-error)] text-white'
                        : 'bg-[var(--color-surface)] border border-[var(--color-error)]/30 text-[var(--color-error)] hover:bg-[var(--color-error)]/10'
                      }
                    `}
                  >
                    {confirmReset ? 'Click again to confirm reset' : 'Reset All Data'}
                  </button>
                </div>
              </div>
            </div>
          </SettingsGroup>
        </div>

        {/* Right Column (5 Spans): Sticky Live Theme & Card Preview Studio */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          <div className="p-7 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-6">
            <div>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] mb-3">
                Live Interactive Preview
              </span>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                Sample N3 Study Card
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Preview how your current theme ({settings.theme}) and font size ({settings.fontSize}) appear across learning screens.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-border)] space-y-4 text-center">
              {settings.showFurigana && (
                <div className="font-jp text-sm text-[var(--color-text-secondary)] -mb-2">
                  じゅん び
                </div>
              )}
              <div className="font-jp-serif text-5xl font-semibold text-[var(--color-text)]">
                準備
              </div>
              <div className="text-base font-medium text-[var(--color-text)]">
                sự chuẩn bị, chuẩn bị
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                <span>N3 Noun / Suru-verb</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              App Architecture & Privacy
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Your N3 learning data is stored 100% locally in your browser's IndexedDB / LocalStorage. Zero external tracking, zero cloud login latency, and instant offline readability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--color-text-secondary)]">{icon}</span>
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-[var(--color-text)]">{label}</div>
        <div className="text-xs text-[var(--color-text-tertiary)]">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer
          ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]'}
        `}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <div className={`
          w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
          ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}
        `} />
      </button>
    </div>
  );
}
