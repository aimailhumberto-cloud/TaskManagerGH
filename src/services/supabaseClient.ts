import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if(process.env.RENDER_SERVICE_ID&&!supabaseUrl&&!supabaseKey)throw new Error('Supabase debe configurarse en el servicio existente; no se permite iniciar una base JSON alternativa.');

if (!!supabaseUrl !== !!supabaseKey) {
  throw new Error('Configuración Supabase incompleta. No se permite cambiar automáticamente al backend JSON.');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : null;
