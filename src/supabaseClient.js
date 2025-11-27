import { createClient } from '@supabase/supabase-js'

// 1. Cole a URL do seu projeto (Settings > API > Project URL)
const supabaseUrl = 'https://bmyyuqrmarxudiezqesp.supabase.co'

// 2. Cole a chave ANON pública (Settings > API > Project API Keys > anon/public)
const supabaseKey = 'sb_publishable_uz4Mt6TnYYupDpTrLFXlNg_c7vEv5ZQ'

// 3. A CORREÇÃO ESTÁ AQUI: Tem que ter "export const"
export const supabase = createClient(supabaseUrl, supabaseKey)