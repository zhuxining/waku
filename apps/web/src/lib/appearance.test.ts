import { describe, expect, test } from 'bun:test'
import { followAppearance, readThemeChoice, resolvedTheme } from './appearance'

describe('appearance preferences', () => {
  test('system follows the current operating-system appearance', () => {
    expect(resolvedTheme('system', true)).toBe('dark')
    expect(resolvedTheme('system', false)).toBe('light')
  })

  test('an explicit appearance overrides the operating system', () => {
    expect(resolvedTheme('light', true)).toBe('light')
    expect(resolvedTheme('dark', false)).toBe('dark')
  })

  test('unknown and missing stored values fall back to system', () => {
    expect(readThemeChoice(null)).toBe('system')
    expect(readThemeChoice({ getItem: () => 'sepia' })).toBe('system')
    expect(readThemeChoice({ getItem: () => 'dark' })).toBe('dark')
  })
})

describe('followAppearance', () => {
  function harness(stored: string | null, prefersDark: boolean) {
    const classes = new Set<string>()
    const store = { value: stored }
    const storage = {
      getItem: (key: string) => (key === 'waku.theme' ? store.value : null),
      setItem: (_key: string, value: string) => { store.value = value },
    }
    let mediaListener: (() => void) | undefined
    const media = {
      matches: prefersDark,
      addEventListener: (_type: 'change', listener: () => void) => { mediaListener = listener },
      removeEventListener: () => { mediaListener = undefined },
    }
    const storageListeners: Array<(event: StorageEvent) => void> = []
    const events = {
      addEventListener: (_type: 'storage', listener: (event: StorageEvent) => void) => { storageListeners.push(listener) },
      removeEventListener: () => { storageListeners.length = 0 },
    }
    const doc = {
      documentElement: {
        classList: {
          toggle: (token: string, force: boolean) => {
            if (force) classes.add(token)
            else classes.delete(token)
          },
        },
      },
    }
    return {
      classes,
      doc,
      events,
      media,
      storage,
      setSystemDark: (value: boolean) => { media.matches = value; mediaListener?.() },
      emitStorage: () => { for (const listener of storageListeners) listener({ key: 'waku.theme' } as StorageEvent) },
      hasListener: () => mediaListener !== undefined,
    }
  }

  test('system choice follows the operating system live', () => {
    const h = harness(null, false)
    const stop = followAppearance(h.doc, h.storage ?? null, h.media, h.events)
    expect(h.classes.has('light')).toBe(true)
    h.setSystemDark(true)
    expect(h.classes.has('dark')).toBe(true)
    expect(h.classes.has('light')).toBe(false)
    stop()
    expect(h.hasListener()).toBe(false)
  })

  test('an explicit choice ignores the operating system', () => {
    const h = harness('light', false)
    followAppearance(h.doc, h.storage ?? null, h.media, h.events)
    h.setSystemDark(true)
    expect(h.classes.has('light')).toBe(true)
    expect(h.classes.has('dark')).toBe(false)
  })

  test('another tab changing the choice is applied', () => {
    const h = harness(null, true)
    followAppearance(h.doc, h.storage ?? null, h.media, h.events)
    expect(h.classes.has('dark')).toBe(true)
    h.storage.setItem('waku.theme', 'light')
    h.emitStorage()
    expect(h.classes.has('light')).toBe(true)
  })
})
