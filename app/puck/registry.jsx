/**
 * Seul fichier "registre" du projet — celui qui liste tous les composants Puck.
 * Exporte la Config Puck (voir @puckeditor/core) utilisée à la fois par l'éditeur de
 * mise en page (canvas, editor-src/puck-layout-editor.jsx) et par le renderer de
 * publication (app/ssg/renderer.jsx).
 */

import { Hero } from "./components/hero.jsx";
import { FeatureGrid } from "./components/feature-grid.jsx";
import { Cta } from "./components/cta.jsx";
import { ArticleCard } from "./components/article-card.jsx";
import { ArticleTeaser } from "./components/article-teaser.jsx";
import { Nav } from "./components/nav.jsx";
import { Footer } from "./components/footer.jsx";
import { Repeater } from "./components/repeater.jsx";
import { ContentSlot } from "./components/content-slot.jsx";
import { RichText } from "./components/rich-text.jsx";
import { Heading } from "./components/heading.jsx";
import { Callout } from "./components/callout.jsx";
import { Quote } from "./components/quote.jsx";
import { Divider } from "./components/divider.jsx";
import { CodeBlock } from "./components/code-block.jsx";
import { Accordion } from "./components/accordion.jsx";
import { Space } from "./components/space.jsx";
import { Image } from "./components/image.jsx";
import { Testimonial } from "./components/testimonial.jsx";
import { LogoCloud } from "./components/logo-cloud.jsx";
import { Stats } from "./components/stats.jsx";
import { SocialLinks } from "./components/social-links.jsx";
import { PricingTable } from "./components/pricing-table.jsx";
import { TagList } from "./components/tag-list.jsx";

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
    ContentSlot,
    RichText,
    Heading,
    Callout,
    Quote,
    Divider,
    CodeBlock,
    Accordion,
    Space,
    Image,
    Testimonial,
    LogoCloud,
    Stats,
    SocialLinks,
    PricingTable,
    TagList,
  },
};
