'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'

/** Beendet die Lumi-Core-Session (lc-* Cookies). Löst NICHT die
 *  gespeicherte Verknüpfung (lumi_core_profile_id) auf. */
export async function disconnectLumiCoreSession() {
  const lumiCore = await createLumiCoreClient()
  await lumiCore.auth.signOut()
  revalidatePath('/family')
  redirect('/family')
}
