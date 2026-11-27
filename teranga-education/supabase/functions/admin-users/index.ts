// Point d'entrée Supabase Edge Function.
// Le code partagé est dans ../_shared (déployé avec les fonctions).
import { handler } from './handler.ts';

Deno.serve(handler);
