export type Theme = "dark" | "light";

const KEY = "atlas.theme";

// Runs before React hydrates (inlined in the root layout) so a light-theme visitor never sees a dark flash.
export const THEME_BOOT = `try{if(localStorage.getItem("${KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme): void {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode: the choice lasts for this page only
  }
}

export function toggleTheme(): Theme {
  const next = currentTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}
