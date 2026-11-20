// Point d'entrée Supabase Edge Function.
// NB : le dossier shared/ doit être accessible au déploiement (voir doc Phase 2).
import { handler } from './handler.ts';

Deno.serve(handler);
