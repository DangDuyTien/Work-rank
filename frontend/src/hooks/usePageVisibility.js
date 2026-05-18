import { useEffect, useState } from 'react';

function isPageVisible() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

export default function usePageVisibility() {
  const [visible, setVisible] = useState(isPageVisible);

  useEffect(() => {
    const syncVisibility = () => setVisible(isPageVisible());
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('focus', syncVisibility);
    window.addEventListener('blur', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('focus', syncVisibility);
      window.removeEventListener('blur', syncVisibility);
    };
  }, []);

  return visible;
}
