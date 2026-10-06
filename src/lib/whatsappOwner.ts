import type {DatabaseSchema} from '@/services/mockData';
import type {SessionData} from './session';
export function whatsappOwnerAllowed(actor:SessionData,db:DatabaseSchema,env:Record<string,string|undefined>=process.env):boolean{
 const admins=[...new Set(db.users.filter(u=>u.isActive&&db.people.some(p=>p.id===u.personId&&p.role==='Admin')).map(u=>u.personId))];
 const owner=env.TASKMANAGER_WHATSAPP_OWNER_ID||(env.TASKMANAGER_LOCAL_ONLY==='1'&&admins.length===1?admins[0]:undefined);
 return !!owner&&owner===actor.personId&&admins.includes(owner);
}
