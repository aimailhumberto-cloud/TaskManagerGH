import {pbkdf2Sync,timingSafeEqual} from 'crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {User} from './mockData';
import {WorkspaceError} from '../lib/projects';

export interface OriginalAccounts {
  profiles(): Promise<User[]>;
  authenticate(email: string,password: string): Promise<User|null>;
}
const profile=(row: any): User => ({id:row.id,personId:row.person_id,email:row.email,isActive:row.is_active,passwordHash:'',salt:''});

/** Runtime login only. Never exports credentials to a workspace, response or log. */
export class SupabaseOriginalAccounts implements OriginalAccounts {
  constructor(private readonly client: SupabaseClient) {}
  async profiles(): Promise<User[]> {
    const result=await this.client.from('users').select('id,person_id,email,is_active').order('id');
    if(result.error||!result.data)throw new WorkspaceError('No se pudieron verificar las cuentas originales.',503);
    return result.data.map(profile);
  }
  async authenticate(email:string,password:string): Promise<User|null> {
    const matches=(await this.profiles()).filter(u=>u.email.toLowerCase()===email.toLowerCase());
    if(matches.length!==1||!matches[0].isActive)return null;
    // Narrow lookup during an actual login, against the original row; no migration copy.
    const result=await this.client.from('users').select('id,person_id,email,is_active,password_hash,salt').eq('id',matches[0].id).maybeSingle();
    if(result.error)throw new WorkspaceError('La autenticación original no está disponible.',503);
    const row=result.data;
    if(!row?.is_active||row.email?.toLowerCase()!==email.toLowerCase()||row.person_id!==matches[0].personId||typeof row.salt!=='string'||typeof row.password_hash!=='string'||!/^[a-f0-9]{128}$/i.test(row.password_hash))return null;
    const actual=pbkdf2Sync(password,row.salt,1000,64,'sha512');
    const expected=Buffer.from(row.password_hash,'hex');
    return actual.length===expected.length&&timingSafeEqual(actual,expected)?profile(row):null;
  }
}

/** Protected account/configuration collections never enter remote workspace storage. */
export function workDataOnly<T extends Record<string,any>>(data: T): Omit<T,'users'|'smtpConfig'|'aiConfig'> & {users?:never;smtpConfig?:never;aiConfig?:never} {
  const privateKeys=new Set(['passwordhash','password_hash','passwordplain','salt','auth_user','auth_pass','apikey','api_key','service_role_key']);
  const clean=(value:any):any=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!privateKeys.has(key.toLowerCase())).map(([key,item])=>[key,clean(item)])):value;
  const {users:_users,smtpConfig:_smtp,aiConfig:_ai,...work}=data;
  return clean(work);
}
