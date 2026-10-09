import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './Glyph';
import { launchPhase } from './launch-state';

/** Brand presentation only: storage/service-worker initialization belongs to App. */
export function LaunchIntro({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const [startedAt] = useState(Date.now), [elapsed, setElapsed] = useState(0);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const complete = useRef(onComplete); complete.current = onComplete;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt), duration = reduced ? 120 : 1440;
    tick();
    const brand = setTimeout(tick, Math.max(0, duration - (Date.now() - startedAt)));
    const handoff = setTimeout(tick, Math.max(0, duration + 160 - (Date.now() - startedAt)));
    return () => { clearTimeout(brand); clearTimeout(handoff); };
  }, [startedAt, reduced, ready]);
  const phase = launchPhase(elapsed, ready, reduced);
  useEffect(() => { if (phase === 'complete') complete.current(); }, [phase]);
  if (phase === 'complete') return null;
  return <div className={`launch-intro ${phase}`} data-testid="launch-intro" aria-label="EQUINOX starter" aria-busy={!ready}>
    <div className="launch-identity"><BrandMark /><strong>EQUINOX</strong></div>
    <p role="status" className="launch-status">{phase === 'initializing' ? 'Åbner din lokale portefølje…' : <span className="sr-only">EQUINOX</span>}</p>
  </div>;
}
