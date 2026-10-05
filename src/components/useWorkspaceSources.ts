'use client';
import { useEffect, useState } from 'react';
import type { CalendarSnapshot, Reminder } from '@/lib/planning';
export default function useWorkspaceSources() {
  const [snapshot, setSnapshot] = useState<CalendarSnapshot | null>(null); const [reminders, setReminders] = useState<Reminder[]>([]); const [authorized, setAuthorized] = useState(false); const [sourceError, setSourceError] = useState(''); const [online, setOnline] = useState(true); const [loaded, setLoaded] = useState(false);
  useEffect(() => { let active = true; let pending = false;
    const connectivity = () => { if (active) setOnline(navigator.onLine); };
    async function refresh() { if (pending || document.hidden) return; pending = true;
      const results = await Promise.allSettled([fetch('/api/integrations/calendar', { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('Agenda externa no disponible.'); return r.json(); }), fetch('/api/reminders', { cache: 'no-store' }).then(async r => { if (!r.ok) throw new Error('Recordatorios no disponibles.'); return r.json(); })]);
      if (active) { const calendar = results[0]; if (calendar.status === 'fulfilled') { setSnapshot(calendar.value.snapshot); setAuthorized(!!calendar.value.appAuthorized); setSourceError(''); } else setSourceError('No se pudo comprobar la agenda. La última lectura puede estar desactualizada.'); const reminder = results[1]; if (reminder.status === 'fulfilled') setReminders(reminder.value.reminders || []); setLoaded(true); }
      pending = false;
    }
    connectivity(); refresh(); const timer = setInterval(refresh, 60000); window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity);
    return () => { active = false; clearInterval(timer); window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); };
  }, []);
  return { snapshot, reminders, authorized, sourceError, online, loaded };
}
