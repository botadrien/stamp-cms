// Valeurs par défaut partagées par la palette de composants (ssg-src/components/) —
// inspirées de https://demo.puckeditor.com/ (quasi monochrome noir/blanc/gris + un seul
// accent bleu, cartes à bordure fine + ombre douce, badges d'icône ronds, coins
// modérément arrondis, titres en gras serré). Toujours de simples valeurs par défaut :
// chaque composant garde ses champs couleur (`backgroundColor`/`textColor`, texte libre)
// éditables, ce module ne fait qu'éviter de réécrire les mêmes teintes dans chaque
// fichier.
export const TOKENS = {
  ink: "#09090b",
  body: "#3f3f46",
  muted: "#71717a",
  accent: "#1d4ed8",
  accentSoft: "#dbeafe",
  border: "#e4e4e7",
  surface: "#ffffff",
  surfaceAlt: "#f7f7f8",
  radius: "0.875rem",
  radiusSm: "0.625rem",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  cardShadow: "0 1px 2px rgba(9, 9, 11, 0.04), 0 8px 24px -12px rgba(9, 9, 11, 0.12)",
};

// Style de bouton "plein" (fond de couleur, texte clair) partagé par Hero/Cta — mêmes
// coins/poids que les boutons "Visit GitHub"/"Edit this page" de la démo Puck.
export function solidButtonStyle(bg, fg) {
  return {
    display: "inline-block",
    padding: "0.75rem 1.5rem",
    borderRadius: TOKENS.radiusSm,
    backgroundColor: bg,
    color: fg,
    fontWeight: 600,
    fontSize: "0.9375rem",
    textDecoration: "none",
    border: "1px solid transparent",
  };
}
