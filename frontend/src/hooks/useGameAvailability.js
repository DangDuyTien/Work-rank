import { useState, useEffect, useCallback } from 'react';
import { gameCatalogApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function useGameAvailability(gameKey) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [isComingSoon, setIsComingSoon] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);

  const checkAvailability = useCallback(() => {
    let mounted = true;
    gameCatalogApi
      .getCatalog()
      .then((res) => {
        if (!mounted) return;
        const list = res?.games || (Array.isArray(res) ? res : []);
        const found = list.find((g) => (g.gameKey || g.game_key) === gameKey);
        if (found) {
          setGame(found);
          const isUnavailable = found.status === 'COMING_SOON' || found.enabled === false;
          setIsComingSoon(isUnavailable);
        }
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [gameKey]);

  useEffect(() => {
    const cleanup = checkAvailability();
    const handleUpdate = () => {
      checkAvailability();
    };
    window.addEventListener('workrank:game-catalog-updated', handleUpdate);
    return () => {
      cleanup && cleanup();
      window.removeEventListener('workrank:game-catalog-updated', handleUpdate);
    };
  }, [checkAvailability]);

  return {
    loading,
    game,
    isComingSoon: isComingSoon && !(isAdmin && adminBypass),
    rawStatus: game?.status || 'AVAILABLE',
    isAdmin,
    proceedAsAdmin: () => setAdminBypass(true),
  };
}
