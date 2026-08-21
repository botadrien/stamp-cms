// Vérification DNS en direct depuis le navigateur, pour l'écran "Réglages du site" (voir
// app/app.js, domaine personnalisé) — pas de serveur possible pour ça (principe du projet),
// donc DNS-over-HTTPS plutôt qu'une vraie résolution DNS (inaccessible depuis un
// navigateur). Cloudflare répond en CORS ouvert sur cet endpoint (vérifié en direct,
// `access-control-allow-origin: *`), pas de proxy nécessaire.
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

function normalizeDnsTarget(value) {
  return value.replace(/\.$/, "").toLowerCase();
}

// Résout le CNAME d'un domaine — renvoie la cible (sans le point final) ou `null` si
// aucun enregistrement CNAME n'est encore configuré (domaine pas encore modifié, ou
// propagation en cours).
async function resolveCname(domain) {
  let response;
  try {
    response = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=CNAME`, {
      headers: { accept: "application/dns-json" },
    });
  } catch (networkErr) {
    console.error("Network error sur la résolution DNS:", networkErr);
    throw new Error("Impossible de vérifier le DNS — vérifie ta connexion et réessaie.");
  }
  if (!response.ok) {
    console.error(`Réponse DNS-over-HTTPS inattendue (${response.status})`);
    throw new Error("Impossible de vérifier le DNS pour le moment, réessaie plus tard.");
  }
  const data = await response.json();
  const answer = (data.Answer || []).find((a) => a.type === 5); // type 5 = CNAME
  return answer ? normalizeDnsTarget(answer.data) : null;
}

// Vrai si le CNAME du domaine pointe déjà vers la cible attendue pour ce fournisseur
// (`codeberg.page`, `{owner}.github.io`, `{owner}.gitlab.io`).
async function checkCnameTarget(domain, expectedTarget) {
  const resolved = await resolveCname(domain);
  return resolved !== null && resolved === normalizeDnsTarget(expectedTarget);
}
