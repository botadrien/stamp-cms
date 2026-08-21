/**
 * Phase 2 (intégration, voir docs/plan-puck-ssg.md, "Règle anti-conflit de merge") :
 * seul fichier "registre" du projet — celui qui liste tous les composants Puck — écrit
 * ici plutôt que par une track individuelle, pour éviter tout conflit de merge entre
 * tracks parallèles. Exporte la Config Puck (voir @puckeditor/core) utilisée à la fois
 * par l'éditeur (canvas, à venir) et par le renderer de publication
 * (ssg-src/renderer.jsx).
 */

import { Hero } from "./components/hero.jsx";
import { FeatureGrid } from "./components/feature-grid.jsx";
import { Cta } from "./components/cta.jsx";
import { ArticleCard } from "./components/article-card.jsx";
import { ArticleTeaser } from "./components/article-teaser.jsx";
import { Nav } from "./components/nav.jsx";
import { Footer } from "./components/footer.jsx";
import { Repeater } from "./components/repeater.jsx";

/** @type {import("@puckeditor/core").Config} */
export const puckConfig = {
  components: {
    Hero,
    FeatureGrid,
    Cta,
    ArticleCard,
    ArticleTeaser,
    Nav,
    Footer,
    Repeater,
  },
};
