// Fournisseurs d'IA interchangeables. Un seul fichier à adapter pour en changer.
//  * « simulation » : réponses fabriquées, sans IA ni coût (développement, tests) ;
//  * « anthropic »  : API Claude, via le kit officiel. La clé ANTHROPIC_API_KEY
//                     reste une variable du serveur, jamais envoyée au navigateur.
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0';
import { choisirFournisseur, simuler, type Contexte, type Fournisseur, type RequeteIA, type Tache } from '../_shared/ia.ts';

export interface ReponseIA {
  json: unknown;
  fournisseur: string;
  modele: string;
  tokens_in: number | null;
  tokens_out: number | null;
}

export class ErreurIA extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export function fournisseurConfigure(): Fournisseur {
  return choisirFournisseur(Deno.env.get('TERANGA_IA_FOURNISSEUR'), !!Deno.env.get('ANTHROPIC_API_KEY'));
}

/** Modèle par défaut : Claude Opus 5.5. Modifiable sans toucher au code
 *  (variable TERANGA_IA_MODELE), par exemple pour un modèle moins coûteux. */
export const modeleConfigure = () => Deno.env.get('TERANGA_IA_MODELE') ?? 'claude-opus-5-5';

let client: Anthropic | null = null;

async function appelerAnthropic(req: RequeteIA): Promise<ReponseIA> {
  client ??= new Anthropic();   // lit ANTHROPIC_API_KEY dans l'environnement du serveur
  const modele = modeleConfigure();
  try {
    const r = await client.beta.messages.create({
      model: modele,
      max_tokens: 16000,
      // Si les filtres de sécurité déclinent la demande, un autre modèle reprend
      // automatiquement (repli côté serveur recommandé par Anthropic).
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: req.system,
      messages: [{ role: 'user', content: req.utilisateur }],
      output_config: { effort: req.effort, format: { type: 'json_schema', schema: req.schema } },
    });
    if (r.stop_reason === 'refusal') {
      throw new ErreurIA('L’assistant a décliné cette demande. Reformulez-la ou faites-la sans assistant.', 422);
    }
    if (r.stop_reason === 'max_tokens') throw new ErreurIA('Réponse de l’assistant incomplète. Réessayez avec une demande plus courte.');
    const texte = r.content.find((b) => b.type === 'text');
    if (!texte || texte.type !== 'text') throw new ErreurIA('Réponse de l’assistant vide.');
    let json: unknown;
    try {
      json = JSON.parse(texte.text);
    } catch {
      throw new ErreurIA('Réponse de l’assistant illisible.');
    }
    return { json, fournisseur: 'anthropic', modele: r.model, tokens_in: r.usage.input_tokens, tokens_out: r.usage.output_tokens };
  } catch (e) {
    if (e instanceof ErreurIA) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new ErreurIA('L’assistant est très sollicité. Réessayez dans une minute.', 429);
    if (e instanceof Anthropic.AuthenticationError) throw new ErreurIA('Assistant mal configuré (clé d’accès). Prévenez l’administrateur.', 503);
    if (e instanceof Anthropic.BadRequestError) throw new ErreurIA('Demande refusée par le fournisseur d’IA.', 502);
    if (e instanceof Anthropic.APIConnectionError) throw new ErreurIA('Fournisseur d’IA injoignable. Vérifiez la connexion du serveur.', 503);
    if (e instanceof Anthropic.APIError) throw new ErreurIA(`Erreur du fournisseur d’IA (${e.status}).`, 502);
    throw e;
  }
}

export async function demanderIA(tache: Tache, contexte: Contexte, req: RequeteIA): Promise<ReponseIA> {
  const f = fournisseurConfigure();
  if (f === 'aucun') throw new ErreurIA('Assistant non activé : aucun fournisseur d’IA n’est configuré.', 503);
  if (f === 'anthropic') return appelerAnthropic(req);
  return { json: simuler(tache, contexte), fournisseur: 'simulation', modele: 'simulation', tokens_in: null, tokens_out: null };
}
