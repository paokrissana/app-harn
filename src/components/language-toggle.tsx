import { useI18n } from '@/i18n/context'
import { Button } from '@/components/ui/button'

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={t('toggleLang')}
      onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
    >
      {lang === 'en' ? 'ไทย' : 'EN'}
    </Button>
  )
}
