import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed escape hatch for backend objects restored by migrations before
 * the generated database types are refreshed from the deployed schema.
 */
export const supabaseLoose = supabase as unknown as SupabaseClient<any>;