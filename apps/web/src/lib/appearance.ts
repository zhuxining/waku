export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'waku.theme'

export function readThemeChoice(storage: Pick<Storage, 'getItem'> | null): ThemeChoice {
  const stored = storage?.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function resolvedTheme(
  choice: ThemeChoice,
  systemPrefersDark: boolean,
): Exclude<ThemeChoice, 'system'> {
  if (choice === 'system') return systemPrefersDark ? 'dark' : 'light'
  return choice
}

export type ThemeClassTarget = {
  classList: { toggle: (token: string, force: boolean) => unknown }
}

export function applyThemeChoice(
  root: ThemeClassTarget,
  choice: ThemeChoice,
  systemPrefersDark: boolean,
) {
  const resolved = resolvedTheme(choice, systemPrefersDark)
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
}

type AppearanceMediaQuery = {
  matches: boolean
  addEventListener: (type: 'change', listener: () => void) => void
  removeEventListener: (type: 'change', listener: () => void) => void
}

type AppearanceEventTarget = {
  addEventListener: (type: 'storage', listener: (event: StorageEvent) => void) => void
  removeEventListener: (type: 'storage', listener: (event: StorageEvent) => void) => void
}

/**
 * Applies the stored appearance choice and keeps it applied while the operating
 * system switches appearance or another tab changes the choice. Returns a
 * cleanup function.
 *
 * Without this, `system` is only resolved once by the inline head script, so an
 * operating-system appearance change while the app is open is ignored.
 */
export function followAppearance(
  doc: { documentElement: ThemeClassTarget },
  storage: Pick<Storage, 'getItem'> | null,
  systemAppearance: AppearanceMediaQuery,
  events?: AppearanceEventTarget,
) {
  const apply = () =>
    applyThemeChoice(doc.documentElement, readThemeChoice(storage), systemAppearance.matches)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) apply()
  }

  apply()
  systemAppearance.addEventListener('change', apply)
  events?.addEventListener('storage', onStorage)

  return () => {
    systemAppearance.removeEventListener('change', apply)
    events?.removeEventListener('storage', onStorage)
  }
}
