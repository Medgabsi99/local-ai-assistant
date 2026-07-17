import { t } from '../lib/i18n';

export default function SystemPromptEditor({ systemPrompt, saveSystemPrompt, showSystemPrompt, setShowSystemPrompt }) {
  if (!showSystemPrompt) return null;
  return (
    <div className="px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}>
      <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{t('system_prompt_short')}</p>
      <div className="flex gap-2 mb-2">
        <textarea value={systemPrompt} onChange={(e) => saveSystemPrompt(e.target.value)} placeholder={t('type_placeholder')} rows={2}
          className="w-full rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-500/50 resize-none"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        <button onClick={() => { saveSystemPrompt(''); setShowSystemPrompt(false); }}
          className="text-xs px-2 py-1 rounded-md hover:bg-white/5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{t('clear')}</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: t('presets_concise'), value: t('concise') },
          { label: t('presets_expert'), value: t('expert') },
          { label: t('presets_translate'), value: t('translate_fr') },
          { label: t('presets_step'), value: t('step_by_step') },
        ].map((preset) => (
          <button key={preset.label} onClick={() => saveSystemPrompt(preset.value)}
            className={`text-[10px] px-2 py-1 rounded-md transition-colors ${systemPrompt === preset.value ? 'bg-emerald-500/20 text-emerald-300' : ''}`}
            style={{ background: systemPrompt === preset.value ? undefined : 'var(--bg-hover)', color: systemPrompt === preset.value ? undefined : 'var(--text-muted)' }}>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}