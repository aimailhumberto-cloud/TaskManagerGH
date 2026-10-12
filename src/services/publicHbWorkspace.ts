import { dbService } from './dbService';
import { publicHbView } from '@/lib/publicHbAccess';
/** Does not seed, migrate, repair or fall back to another dataset. */
export async function readPublicHbWorkspace() {
 let hostname:string|null=null;
 try { if(process.env.SUPABASE_URL) hostname=new URL(process.env.SUPABASE_URL).hostname; } catch { /* no configuration values are printed */ }
 console.info('[TaskManager public HB] backend', {hostname,source:hostname?'existing-supabase-workspace':'configured-local-workspace'});
 return publicHbView(await dbService.readData());
}
