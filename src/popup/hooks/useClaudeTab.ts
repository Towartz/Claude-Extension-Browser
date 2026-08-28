import { useEffect, useState } from 'react';

export function useClaudeTab(): { isClaudeTab: boolean } {
  const [isClaudeTab, setIsClaudeTab] = useState(true);

  useEffect(() => {
    if (typeof chrome === 'undefined' || chrome.tabs === undefined) {
      setIsClaudeTab(true);
      return;
    }

    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        const url = tab?.url ?? '';
        setIsClaudeTab(url.startsWith('https://claude.ai/'));
      })
      .catch(() => {
        setIsClaudeTab(true);
      });
  }, []);

  return { isClaudeTab };
}
