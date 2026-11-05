import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cycleTheme, useThemePreference } from '../../lib/theme';

const STATES = {
  system: { Icon: Monitor, label: 'Theme: follows your device. Switch to light' },
  light: { Icon: Sun, label: 'Theme: light. Switch to dark' },
  dark: { Icon: Moon, label: 'Theme: dark. Switch to follow your device' },
};

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { Icon, label } = STATES[useThemePreference()];
  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-md text-ink-3 hover:text-ink hover:bg-site-hover cursor-pointer ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};
