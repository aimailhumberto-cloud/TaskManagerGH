import {createHmac,randomBytes,timingSafeEqual} from 'crypto';
export const PUBLIC_HB_CSRF_COOKIE='tm_public_hb_csrf';
const lifespan=30*60*1000;
function mac(value:string){const secret=process.env.SESSION_SECRET;if(!secret||secret.length<32)throw new Error('Protección de cambios no configurada.');return createHmac('sha256',secret).update('public-hb-tasks:'+value).digest('hex');}
function same(a:string,b:string){return /^[a-f0-9]{64}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
export function validPublicHbNonce(cookie:string|undefined,now=Date.now()){if(!cookie)return false;const parts=cookie.split('.');if(parts.length!==3||!/^\d{13}$/.test(parts[0])||! /^[a-f0-9]{48}$/.test(parts[1]))return false;const at=Number(parts[0]);return at<=now&&now-at<lifespan&&same(parts[2],mac(parts[0]+'.'+parts[1]));}
export function publicHbCsrf(existing?:string,now=Date.now()){const cookie=validPublicHbNonce(existing,now)?existing!:String(now)+'.'+randomBytes(24).toString('hex');const signed=cookie.split('.').length===3?cookie:cookie+'.'+mac(cookie);return {cookie:signed,token:mac('header:'+signed)};}
export function validPublicHbCsrf(cookie:string|undefined,header:string|null,now=Date.now()){return !!header&&validPublicHbNonce(cookie,now)&&same(header,mac('header:'+cookie));}
