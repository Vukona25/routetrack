// Light / dark mode, same idea as CareCollect's Settings → Appearance
const KEY = 'routetrack_theme';

export const getTheme = () => localStorage.getItem(KEY) || 'system';

export function applyTheme(theme = getTheme()) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function isDark() {
  const theme = getTheme();
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches;
  return theme === 'dark';
}
