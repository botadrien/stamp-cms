---
title: objective
---
# Objectif : ce que le POC doit savoir faire

Ce document décrit, en langage narratif, ce que le POC doit permettre à un·e  
utilisateur·rice **non technique** de faire — pas une liste de tâches techniques, mais  
des critères d'acceptation observables. Il sert d'objectif de référence pour itérer en  
boucle sur l'implémentation.

**Vocabulaire** : on parle toujours en termes de **site**, jamais de "dépôt" — la  
personne qui utilise le POC gère un site, pas un repo Git. De même, on ne parle jamais de  
"commit" : l'action de sauvegarder s'appelle **publier**. Le vocabulaire Git/GitHub  
(dépôt, commit, branche...) ne doit jamais transparaître dans ce que voit  
l'utilisateur·rice.

## Connexion

Une personne qui a un compte Codeberg peut se connecter au POC en un clic, sans jamais  
voir apparaître les mots "OAuth", "token" ou "client ID". Elle atterrit sur un écran de  
connexion Codeberg qu'elle connaît déjà (ou crée son compte si besoin), autorise  
l'application, et revient automatiquement sur le POC déjà connectée. Si elle recharge la  
page ou revient plus tard dans le même onglet, elle reste connectée tant que sa session  
n'a pas expiré. Si sa session expire, elle voit un message clair et peut se reconnecter  
en un clic, sans perdre son travail en cours si possible.

Une personne qui a un compte GitHub à la place peut aussi se connecter, mais pas en un  
clic : GitHub exige un secret d'application pour l'échange OAuth, ce qu'on ne peut pas  
stocker de façon sûre dans une appli 100% navigateur (voir README, section technique).  
Elle colle donc un jeton d'accès personnel généré sur GitHub — la seule exception  
acceptée au principe "jamais le mot token à l'écran" ci-dessus, faute de mieux tant que ce  
verrou côté GitHub n'est pas levé.

## Choisir son site

Une fois connectée, elle voit la liste de ses sites existants (ceux qu'elle possède ou  
auxquels elle a accès en écriture), présentés simplement — pas de jargon Git — et peut en  
choisir un pour l'éditer.

## Créer un site

Elle peut aussi créer un nouveau site à partir du POC. Une fois créé, ce site est  
automatiquement configuré pour être publié sur Codeberg Pages, sans qu'elle ait à  
comprendre ou toucher à une quelconque configuration technique (pas de fichier de  
config à écrire, pas d'option Codeberg Pages à aller cocher elle-même) : le site devient  
accessible à une URL publique de façon automatique dès qu'il existe du contenu.

## Éditer du contenu

Elle voit la liste des pages existantes du site (pas un champ de texte où taper un  
chemin de fichier à la main) et peut en ouvrir une pour l'éditer avec un éditeur de texte  
riche façon Notion/Docs : mise en forme (gras, italique, titres), listes, images,  
tableaux — jamais du Markdown brut à l'écran. Elle peut aussi créer une nouvelle page.  
Ce qu'elle tape est converti en Markdown en interne, de façon invisible pour elle.

## Publier

Quand elle clique sur "Publier" (ou équivalent), son travail est envoyé sur Codeberg et  
devient visible sur son site — mais elle n'a jamais besoin de savoir qu'un commit Git se  
cache derrière cette action. Elle voit une confirmation claire que c'est publié. Si  
quelque chose a changé entre-temps sur cette même page (édition concurrente), elle est  
prévenue plutôt que d'écraser silencieusement le travail de quelqu'un d'autre.

## Gestion des erreurs

À aucun moment elle ne doit se retrouver face à un message d'erreur technique brut  
(stack trace, JSON d'erreur API) : perte de connexion, session expirée, page introuvable,  
site vide — chaque cas a un message compréhensible et une action claire pour continuer.

## Hors scope pour cette itération

*   Support d'autres fournisseurs Git au-delà de Codeberg et GitHub (GitLab...).
    
*   Gestion avancée des médias (upload, bibliothèque d'images).
    
*   Système de plugins/thèmes.
    
*   Prévisualisation avant publication.
    

## Comment vérifier

Le scénario de bout en bout : une personne qui n'a jamais entendu parler de Git arrive  
sur le POC, se connecte avec Codeberg, crée un nouveau site (ou en choisit un existant),  
ouvre une page, la modifie avec l'éditeur riche (texte + au moins une image ou un  
tableau), publie, et voit la confirmation — puis vérifie que le site est bien accessible  
publiquement via Codeberg Pages avec le contenu attendu. Les tests e2e (`e2e/`) sont le  
bon endroit pour coder ce scénario et garder une preuve automatisée que ça fonctionne.