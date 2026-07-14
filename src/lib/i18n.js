const translations = {
  en: {
    app_name: 'Local AI', chat: 'Chat', documents: 'Documents', settings: 'Settings',
    new_chat: 'New Chat', search_conv: 'Search conversations...', download: 'Download',
    unload: 'Unload (Free memory)', cancel: 'Cancel', save: 'Save', clear: 'Clear',
    send: 'Send', thinking: 'Thinking...', system_prompt: 'System prompt (guides AI behavior):',
    rag_mode: 'RAG Mode', load_embedding_warning: '⚠️ Load Embedding Model in sidebar',
    no_conv: 'No conversations yet', all_data_device: 'All data stays on your device',
    no_messages: 'Send a message to start chatting', upload: 'Upload', processing: 'Processing...',
    search: 'Search', today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', older: 'Older',
    generated_in: 'Generated in {time}s',
    model_embedding: 'Embedding Model', model_language: 'Language Model', model_whisper: 'Whisper (Speech)',
    no_documents: 'No documents yet', storage: 'Storage', accent_color: 'Accent Color',
    statistics: 'Statistics', conversations: 'Conversations', messages: 'Messages',
    tokens_est: 'Tokens (est.)', export_backup: '⬇ Export Backup', import_backup: '⬆ Import Backup',
    clear_all: '🗑 Clear All Data',
    clear_all_confirm: '⚠️ This will delete ALL local data including:\n\n• All conversations and messages\n• All uploaded documents\n• All vector embeddings\n• All cached AI models\n\nThis cannot be undone. Are you sure?',
    llm_server: 'Local LLM Server (Ollama)', server_enabled: 'Enabled', test_connection: 'Test',
    testing: 'Testing...', connected: '✅ Connected!', not_connected: '❌ Connection failed',
    theme_dark: 'Dark', theme_light: 'Light',
    presets_concise: 'Concise', presets_expert: 'Expert', presets_translate: 'Translate FR', presets_step: 'Step by step',
    share_copy: '📋 Copy as text', share_download: '⬇ Download MD',
    switch_model: 'SWITCH MODEL', download_default: 'Download Default', active: 'Active',
    downloading: 'Downloading...', memory_warning: '⚠️ Large models require significant memory.',
    no_conv_match: 'No conversations match', type_message: 'Type a message...', ask_documents: 'Ask about your documents...',
    web_search: 'Web search', system: 'System', regenerate: 'Regenerate', copy: 'Copy', edit: 'Edit', del: 'Delete',
    read_aloud: 'Read aloud', search_messages: 'Search messages...', share: 'Share', messages_count: '{n} messages',
    sources: 'Sources:', no_embedding: '⚠️ Load Embedding', system_prompt_short: 'System prompt:',
    type_placeholder: 'e.g. You are a helpful assistant...',
    concise: 'Answer concisely.', expert: 'Provide expert-level answers with examples.',
    translate_fr: 'Translate and answer in French.', step_by_step: 'Break down your answer into steps.',
    cancel_label: 'Cancel', save_send: 'Save & Send',
    prompt_templates: 'Templates',
  },
  fr: {
    app_name: 'IA Locale', chat: 'Discussion', documents: 'Documents', settings: 'Paramètres',
    new_chat: 'Nouveau Chat', search_conv: 'Rechercher...', download: 'Télécharger',
    unload: 'Décharger (Libérer mémoire)', cancel: 'Annuler', save: 'Enregistrer', clear: 'Effacer',
    send: 'Envoyer', thinking: 'Réflexion...', system_prompt: 'Prompt système (guide le comportement de l\'IA) :',
    rag_mode: 'Mode RAG', load_embedding_warning: '⚠️ Chargez le modèle d\'embedding',
    no_conv: 'Aucune conversation', all_data_device: 'Toutes les données restent sur votre appareil',
    no_messages: 'Envoyez un message pour commencer', upload: 'Importer', processing: 'Traitement...',
    search: 'Rechercher', today: 'Aujourd\'hui', yesterday: 'Hier', this_week: 'Cette Semaine', older: 'Plus Ancien',
    generated_in: 'Généré en {time}s',
    model_embedding: 'Modèle d\'Embedding', model_language: 'Modèle de Langage', model_whisper: 'Whisper (Parole)',
    no_documents: 'Aucun document', storage: 'Stockage', accent_color: 'Couleur d\'Accent',
    statistics: 'Statistiques', conversations: 'Conversations', messages: 'Messages',
    tokens_est: 'Tokens (est.)', export_backup: '⬇ Exporter la Sauvegarde', import_backup: '⬆ Importer la Sauvegarde',
    clear_all: '🗑 Tout Effacer', clear_all_confirm: '⚠️ Cela supprimera TOUTES les données...',
    llm_server: 'Serveur LLM Local (Ollama)', server_enabled: 'Activé', test_connection: 'Tester',
    testing: 'Test en cours...', connected: '✅ Connecté !', not_connected: '❌ Échec de connexion',
    theme_dark: 'Sombre', theme_light: 'Clair',
    presets_concise: 'Concis', presets_expert: 'Expert', presets_translate: 'Traduire FR', presets_step: 'Étape par étape',
    share_copy: '📋 Copier le texte', share_download: '⬇ Télécharger MD',
    switch_model: 'CHANGER DE MODÈLE', download_default: 'Télécharger Défaut', active: 'Actif',
    downloading: 'Téléchargement...', memory_warning: '⚠️ Les grands modèles nécessitent beaucoup de mémoire.',
    no_conv_match: 'Aucune conversation ne correspond à', type_message: 'Écrivez un message...',
    ask_documents: 'Posez une question sur vos documents...',
    web_search: 'Recherche web', system: 'Système', regenerate: 'Regénérer', copy: 'Copier', edit: 'Modifier',
    del: 'Supprimer', read_aloud: 'Lire à haute voix', search_messages: 'Rechercher des messages...',
    share: 'Partager', messages_count: '{n} messages', sources: 'Sources :', no_embedding: '⚠️ Charger Embedding',
    system_prompt_short: 'Prompt système :', type_placeholder: 'ex. Vous êtes un assistant utile...',
    concise: 'Répondez de manière concise.', expert: 'Fournissez des réponses détaillées avec exemples.',
    translate_fr: 'Traduisez et répondez en français.', step_by_step: 'Détaillez votre réponse étape par étape.',
    cancel_label: 'Annuler', save_send: 'Enregistrer & Envoyer', prompt_templates: 'Modèles',
  },
  ar: {
    app_name: 'الذكاء المحلي', chat: 'المحادثة', documents: 'المستندات', settings: 'الإعدادات',
    new_chat: 'محادثة جديدة', search_conv: 'بحث...', download: 'تحميل',
    unload: 'تفريغ (تحرير الذاكرة)', cancel: 'إلغاء', save: 'حفظ', clear: 'مسح',
    send: 'إرسال', thinking: 'تفكير...', system_prompt: 'توجيه النظام (يوجه سلوك الذكاء الاصطناعي):',
    rag_mode: 'وضع RAG', load_embedding_warning: '⚠️ قم بتحميل نموذج التضمين',
    no_conv: 'لا توجد محادثات بعد', all_data_device: 'جميع البيانات تبقى على جهازك',
    no_messages: 'أرسل رسالة لبدء المحادثة', upload: 'رفع', processing: 'معالجة...',
    search: 'بحث', today: 'اليوم', yesterday: 'الأمس', this_week: 'هذا الأسبوع', older: 'أقدم',
    generated_in: 'تم التوليد في {time}ث',
    model_embedding: 'نموذج التضمين', model_language: 'نموذج اللغة', model_whisper: 'Whisper (الكلام)',
    no_documents: 'لا توجد مستندات بعد', storage: 'التخزين', accent_color: 'لون التمييز',
    statistics: 'الإحصائيات', conversations: 'المحادثات', messages: 'الرسائل',
    tokens_est: 'الرموز (تقريباً)', export_backup: '⬇ تصدير النسخة الاحتياطية', import_backup: '⬆ استيراد النسخة الاحتياطية',
    clear_all: '🗑 مسح الكل', clear_all_confirm: '⚠️ سيتم حذف جميع البيانات...',
    llm_server: 'خادم LLM المحلي (Ollama)', server_enabled: 'مفعل', test_connection: 'اختبار',
    testing: 'جاري الاختبار...', connected: '✅ متصل!', not_connected: '❌ فشل الاتصال',
    theme_dark: 'داكن', theme_light: 'فاتح',
    switch_model: 'تغيير النموذج', download_default: 'تحميل الافتراضي', active: 'نشط',
    downloading: 'جاري التحميل...', memory_warning: '⚠️ النماذج الكبيرة تحتاج ذاكرة كبيرة.',
    no_conv_match: 'لا توجد محادثات تطابق', type_message: 'اكتب رسالة...', ask_documents: 'اسأل عن مستنداتك...',
    web_search: 'بحث الويب', system: 'النظام', regenerate: 'إعادة التوليد', copy: 'نسخ', edit: 'تعديل',
    del: 'حذف', read_aloud: 'القراءة بصوت عال', search_messages: 'ابحث في الرسائل...',
    share: 'مشاركة', messages_count: '{n} رسالة', sources: 'المصادر:', no_embedding: '⚠️ تحميل التضمين',
    system_prompt_short: 'توجيه النظام:', type_placeholder: 'مثال: أنت مساعد مفيد...',
    concise: 'أجب بإيجاز.', expert: 'قدم إجابات متعمقة مع أمثلة.',
    translate_fr: 'ترجم وأجب بالفرنسية.', step_by_step: 'قسّم إجابتك إلى خطوات.',
    cancel_label: 'إلغاء', save_send: 'حفظ وإرسال', prompt_templates: 'قوالب',
  },
};

let currentLang = 'en';
try {
  const saved = localStorage.getItem('lang');
  if (saved && translations[saved]) currentLang = saved;
} catch {}

export function t(key, params = {}) {
  let text = translations[currentLang]?.[key] || translations.en[key] || key;
  for (const [k, v] of Object.entries(params)) text = text.replace(`{${k}}`, v);
  return text;
}

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    try { localStorage.setItem('lang', lang); } catch {}
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }
}

export function getLanguage() { return currentLang; }
export function getLanguages() { return Object.keys(translations); }