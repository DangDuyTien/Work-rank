import { useEffect, useMemo, useState } from 'react';
import { expectedPosition } from '../components/privateMedia/mediaTime';

/**
 * A local 1-second clock for components that display the playhead.
 *
 * Deliberately NOT in the media context: a global ticker re-renders the whole
 * page every second, which is exactly the performance trap this feature has to
 * avoid. Only the seek bar and the time label subscribe.
 */
export default function useMediaClock(session) {
  const [now, setNow] = useState(() => Date.now());
  const playing = session?.status === 'PLAYING';

  useEffect(() => {
    if (!session?.video) return undefined;
    const timer = setInterval(() => setNow(Date.now()), playing ? 1000 : 4000);
    return () => clearInterval(timer);
  }, [session?.video, playing]);

  return useMemo(() => expectedPosition(session, now), [session, now]);
}
