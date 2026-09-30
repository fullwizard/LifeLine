/**
 * Spanish → English rewrite for the keyword parser. Deterministic, no network.
 *
 * The English rules in keywordParser.ts do the real work; this pass only maps
 * the everyday Spanish a person would type ("me van a desalojar", "gano 2000
 * al mes", "tengo dos hijos") onto phrasings those rules already understand.
 * It runs only when the text looks Spanish, so short English words such as
 * "con" or "en" in an English sentence are never touched.
 */

/** Accent-insensitive: "desalojó" and "desalojo" match the same rule. */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const SPANISH_MARKERS =
  /\b(?:yo|mi|mis|tengo|tenemos|necesito|necesitamos|ayuda|estoy|estamos|somos|vivo|vivimos|renta|alquiler|comida|trabajo|hijos?|hijas?|ninos|esposo|esposa|dinero|pagar|puedo|podemos|desalojo|desalojar|casa|con|para|por|pero|porque|luz|mes|semana|gano|ganamos|soy|que|los|las|una?|del|al)\b/g;

/** True when enough common Spanish words appear to treat the text as Spanish. */
export function looksSpanish(text: string): boolean {
  const t = stripAccents(text.toLowerCase());
  const hits = t.match(SPANISH_MARKERS)?.length ?? 0;
  const words = t.split(/\s+/).filter(Boolean).length;
  return hits >= 2 && hits / Math.max(words, 1) >= 0.15;
}

/**
 * Ordered rewrites. Longer, more specific phrases come first so that
 * "aviso de desalojo" becomes "eviction notice" before "desalojo" alone is
 * rewritten.
 */
const RULES: [RegExp, string][] = [
  // Numbers
  [/\b(?:un|una|uno)\b(?= (?:hij|nin|bebe|nene|mes|semana))/g, "one"],
  [/\bdos\b/g, "two"],
  [/\btres\b/g, "three"],
  [/\bcuatro\b/g, "four"],
  [/\bcinco\b/g, "five"],
  [/\bseis\b/g, "six"],
  [/\bsiete\b/g, "seven"],
  [/\bocho\b/g, "eight"],
  [/\bmil\b/g, "thousand"],

  // Eviction and housing
  [/\b(?:aviso|orden|notificacion|carta) de (?:desalojo|desahucio)\b/g, "eviction notice"],
  [/\baviso de (?:3|tres|30|treinta|60|sesenta) dias\b/g, "3-day notice"],
  [/\b(?:me|nos) (?:van a|quieren|puede[n]?) (?:desalojar|sacar|correr)\b/g, "i might get evicted"],
  [/\b(?:me|nos) (?:desalojaron|sacaron|corrieron|echaron)\b/g, "we got kicked out"],
  [/\b(?:desalojo|desahucio)\b/g, "eviction"],
  [/\b(?:atrasad[oa]s?|debo|debemos) (?:en|con)? ?(?:la |el )?(?:renta|alquiler|arriendo)\b/g, "behind on rent"],
  [/\b(?:de|para|en) (?:la |el )?(?:renta|alquiler|arriendo)\b/g, "for rent"],
  [/\b(?:renta|alquiler|arriendo)\b/g, "rent"],
  [/\b(?:el |la )?(?:casero|casera|dueno|duena|propietario|arrendador|landlord)\b/g, "landlord"],
  [/\b(?:sin hogar|sin casa|indigente|vivo en la calle|en la calle)\b/g, "homeless"],
  [/\b(?:vivo|vivimos|duermo|dormimos) en (?:mi|el|un|nuestro) (?:carro|coche|auto|camioneta|troca)\b/g, "sleeping in my car"],
  [/\b(?:refugio|albergue)\b/g, "shelter"],
  [/\bno (?:tengo|tenemos) (?:donde|a donde) (?:dormir|quedarme|quedarnos|ir|vivir)\b/g, "nowhere to go"],
  [/\b(?:donde dormir|donde quedarme|lugar para dormir)\b/g, "place to sleep"],
  [/\b(?:apartamento|departamento|depa)\b/g, "apartment"],
  [/\bvivienda (?:economica|asequible)\b/g, "affordable housing"],

  // Money and income
  [/\bno (?:puedo|podemos) pagar\b/g, "can't pay"],
  [/\bno (?:me |nos )?alcanza\b/g, "can't afford"],
  [/\b(?:gano|cobro)\b/g, "i make"],
  [/\b(?:ganamos|cobramos)\b/g, "we make"],
  [/\brecibo\b/g, "i receive"],
  [/\brecibimos\b/g, "we receive"],
  [/\b(?:gana|cobra)\b/g, "makes"],
  [/\b(?:al|por|cada) mes\b|\bmensual(?:es)?\b/g, "a month"],
  [/\b(?:a la|por|cada) semana\b|\bsemanal(?:es)?\b/g, "a week"],
  [/\b(?:al|por|cada) ano\b|\banual(?:es)?\b/g, "a year"],
  [/\b(?:por|la) hora\b/g, "an hour"],
  [/\bdolares\b/g, "dollars"],
  [/\b(?:sin|no tengo|no tenemos) (?:trabajo|empleo)\b/g, "out of work"],
  [/\b(?:sin|no tengo|no tenemos) (?:dinero|ingresos)\b/g, "no income"],
  [/\bdinero\b/g, "money"],
  [/\bingresos?\b/g, "income"],
  [/\bseguro social\b/g, "social security"],
  [/\bdesempleo\b/g, "unemployment"],
  [/\bestampillas(?: de comida)?\b|\bcupones de comida\b/g, "food stamps"],

  // Work
  [/\b(?:me|lo|la) (?:despidieron|corrieron del trabajo)\b|\bperdi (?:mi|el) (?:trabajo|empleo)\b/g, "i got laid off"],
  [/\b(?:me|le) (?:cortaron|redujeron|bajaron) (?:las )?horas\b/g, "hours got cut"],
  [/\bdesemplead[oa]\b/g, "unemployed"],
  [/\b(?:trabajo|empleo|chamba)\b/g, "job"],

  // Food
  [/\bbanco de (?:comida|alimentos)\b/g, "food bank"],
  [/\b(?:comida|alimentos|despensa|mandado)\b/g, "food"],
  [/\bhambre\b/g, "hungry"],
  [/\bpanales\b/g, "diapers"],
  [/\bleche (?:de|para) bebe\b|\bformula\b/g, "formula"],

  // Utilities
  [/\b(?:nos|me) (?:van a )?(?:cortar|cortaron|quitar|quitaron) (?:la )?(?:luz|electricidad)\b/g, "lights got shut off"],
  [/\b(?:recibo|factura|cuenta|bill) de (?:la )?(?:luz|electricidad)\b/g, "electric bill"],
  [/\b(?:recibo|factura|cuenta) del? (?:gas)\b/g, "gas bill"],
  [/\b(?:recibo|factura|cuenta) del? (?:agua)\b/g, "water bill"],
  [/\b(?:luz|electricidad)\b/g, "electricity"],
  [/\b(?:recibo|factura|cuenta)s?\b/g, "bill"],

  // Legal
  [/\b(?:abogad[oa]|licenciad[oa])\b/g, "lawyer"],
  [/\b(?:corte|tribunal|juzgado)\b/g, "court"],
  [/\bayuda legal\b/g, "legal help"],
  [/\binmigracion\b/g, "immigration"],

  // Health
  [/\b(?:seguro medico|aseguranza|seguro de salud)\b/g, "health insurance"],
  [/\b(?:medico|doctora?)\b/g, "doctor"],
  [/\bclinica\b/g, "clinic"],
  [/\b(?:medicinas?|medicamentos?)\b/g, "medicine"],
  [/\bdentista\b/g, "dentist"],
  [/\bembarazada\b/g, "pregnant"],
  [/\b(?:depresion|deprimid[oa])\b/g, "depression"],
  [/\bansiedad\b/g, "anxiety"],
  [/\b(?:discapacidad|discapacitad[oa]|incapacidad)\b/g, "disability"],

  // Family and people
  [/\b(?:violencia domestica|abuso|me pega|me golpea|me maltrata)\b/g, "domestic violence"],
  [/\b(?:cuidado de ninos|guarderia)\b/g, "childcare"],
  [/\b(?:madre|mama) soltera\b/g, "single mom"],
  [/\b(?:padre|papa) soltero\b/g, "single dad"],
  [/\b(?:hijos|hijas|ninos|ninas|nenes|chamacos|chiquitos|criaturas)\b/g, "kids"],
  [/\bhijo\b/g, "son"],
  [/\bhija\b/g, "daughter"],
  [/\b(?:bebe|nene)\b/g, "baby"],
  [/\b(?:esposo|marido)\b/g, "husband"],
  [/\besposa\b/g, "wife"],
  [/\b(?:pareja|novio|novia)\b/g, "partner"],
  [/\b(?:mi )?mama\b/g, "my mom"],
  [/\b(?:mi )?papa\b/g, "my dad"],
  [/\bno (?:tengo|tenemos) kids\b/g, "no kids"],
  [/\bno soy veteran[oa]\b/g, "not a veteran"],
  [/\bveteran[oa]\b/g, "veteran"],
  [/\bfamilia de\b/g, "family of"],
  [/\bsomos\b/g, "we are"],
  [/\b(?:vivo|estoy) sol[oa]\b/g, "live alone"],
  [/\btengo (\d{2}) anos\b/g, "i am $1"],
  [/\b(?:personas|miembros)\b/g, "people"],
  [/\b(?:de la tercera edad|adulto mayor|anciano|jubilad[oa])\b/g, "senior"],

  // Glue words, last
  [/\b(?:necesito|necesitamos)\b/g, "need"],
  [/\bayuda\b/g, "help"],
  [/\btengo\b/g, "i have"],
  [/\btenemos\b/g, "we have"],
  [/\b(?:estoy|soy)\b/g, "i'm"],
  [/\b(?:vivo|vivimos)\b/g, "i live"],
  [/\bmis?\b/g, "my"],
  [/\bnuestr[oa]s?\b/g, "our"],
  [/\bcon\b/g, "with"],
  [/\ben\b/g, "in"],
  [/\by\b/g, "and"],
  [/\b(?:es|son|era)\b/g, "is"],
  [/\bpago\b/g, "pay"],
  [/\bpero\b/g, "but"],
  [/\bpara\b/g, "for"],
  [/\bno puedo\b/g, "can't"],
];

/** Rewrite Spanish text into English phrasings the keyword rules recognise. */
export function spanishToEnglish(text: string): string {
  let t = stripAccents(text.toLowerCase());
  for (const [re, replacement] of RULES) t = t.replace(re, replacement);
  return t;
}
