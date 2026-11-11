import { useEffect, useState } from 'react';
import { localISODate, type ISODate } from './dates';

/** The device's local calendar date, kept current across midnight and app resumes. */
export function useToday(): ISODate {
  const [today, setToday] = useState(localISODate);
  useEffect(() => {
    const tick = () => setToday(localISODate());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);
  return today;
}
