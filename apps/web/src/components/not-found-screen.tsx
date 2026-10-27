import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { WakuIcon } from '@/components/waku-icon'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useI18n } from '@/lib/i18n'

export function NotFoundScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const title = t('web.not_found_title')
  useDocumentTitle(title)
  const path = typeof window === 'undefined' ? undefined : window.location.pathname
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <WakuIcon className="text-[var(--text-ghost)]" name="search" />
        <h1 className="mt-3 text-[14px] font-medium">{title}</h1>
        <p className="mt-1.5 text-[11.5px] leading-[18px] text-[var(--text-tertiary)]">
          {t('web.not_found_description')}
        </p>
        {path && (
          <code className="mt-3 max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
            {path}
          </code>
        )}
        <Button
          className="mt-4 rounded-full px-4"
          size="sm"
          type="button"
          onClick={() => void navigate({ to: '/', search: { session: undefined } })}
        >
          <WakuIcon name="rewind" />
          {t('web.not_found_back')}
        </Button>
      </div>
    </main>
  )
}
