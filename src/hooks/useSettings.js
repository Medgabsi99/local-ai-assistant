import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../db/database';

export function useSettings() {
  const [theme, setTheme] = useState('dark');
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    (async () => {
      const [themeS, promptS, accentS] = await Promise.all([
        getSetting('theme'),
        getSetting('systemPrompt'),
        getSetting('accent'),
      ]);
      if (themeS?.value) setTheme(themeS.value);
      if (promptS?.value) setSystemPrompt(promptS.value);
      if (accentS?.value) document.documentElement.setAttribute('data-accent', accentS.value);
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await setSetting('theme', next);
  };

  const saveSystemPrompt = async (val) => {
    setSystemPrompt(val);
    await setSetting('systemPrompt', val);
  };

  return { theme, toggleTheme, systemPrompt, saveSystemPrompt };
}