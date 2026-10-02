import { useState, useEffect } from 'react';
import { gameCatalogApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function useGameAvailability(gameKey) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [isComingSoon, setIsComingSoon] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);

  useEffect(() => {
    let mounted = true;
    gameCatalogApi
      .getCatalog()
      .then((res) => {
        if (!mounted) return;
        const found = res?.games?.find((g) => g.gameKey === gameKey);
        if (found) {
          setGame(found);
          if (found.status === 'COMING_SOON' || found.enabled === false) {
            setIsComingSoon(true);
          }
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

  return {
    loading,
    game,
    isComingSoon: isComingSoon && !(isAdmin && adminBypass),
    rawStatus: game?.status || 'AVAILABLE',
    isAdmin,
    proceedAsAdmin: () => setAdminBypass(true),
  };
}
