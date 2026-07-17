import { t } from '../lib/i18n';

export default function TemplatesPanel({ showTemplates, setShowTemplates, setInput, inputRef }) {
  if (!showTemplates) return null;
  return (
    <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}>
      <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>{t('prompt_templates')}</p>
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: t('presets_concise'), prompt: t('concise') },
          { label: t('presets_expert'), prompt: t('expert') },
          { label: t('presets_translate'), prompt: t('translate_fr') },
          { label: t('presets_step'), prompt: t('step_by_step') },
        ].map((tmpl) => (
          <button key={tmpl.label} onClick={() => { setInput(tmpl.prompt); setShowTemplates(false); inputRef.current?.focus(); }}
            className="text-[10px] px-2.5 py-1.5 rounded-md transition-colors hover:bg-white/5"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>{tmpl.label}</button>
        ))}
        <button onClick={() => setShowTemplates(false)} className="text-[10px] px-2 py-1 rounded-md hover:bg-white/5" style={{ color: 'var(--text-muted)' }} aria-label="Close">✕</button>
      </div>
    </div>
  );
}