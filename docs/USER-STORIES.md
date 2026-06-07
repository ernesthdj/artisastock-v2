# User Stories — ArtisaStock V2 (MVP)

> **Projet :** ArtisaStock V2 — SaaS ERP + CMS pour artisans alimentaires
> **Date :** 2026-06-07
> **Auteur :** Agent #1 — Product Owner
> **Version :** 1.0.0

---

## Acteurs

| Acteur | Description |
|--------|-------------|
| **Artisan (Admin)** | Proprietaire du commerce, acces total a son tenant |
| **Employe** | Acces limite selon role defini par l'admin |
| **Client final** | Visiteur de la vitrine, passe commande |
| **Systeme** | Actions automatisees (calculs, sync, notifications) |

---

## Priorites

| Niveau | Signification |
|--------|---------------|
| **P0** | Indispensable — bloque le lancement si absent |
| **P1** | Important — forte valeur metier, livrable au MVP |
| **P2** | Nice-to-have — si le temps le permet au MVP |

---

# MODULE ERP (Backoffice Admin)

---

## US-001 — Dashboard artisan (KPI)

**Priorite : P0**

> En tant qu'Artisan, je veux voir un tableau de bord synthetique a ma connexion afin de prendre des decisions rapides sans naviguer dans plusieurs menus.

### Criteres d'acceptation

- [ ] Le dashboard affiche au minimum : nombre de commandes du jour, CA du jour, CA du mois, nombre d'ingredients en stock bas (sous le seuil d'alerte)
- [ ] Les KPI sont calcules en temps reel a chaque chargement de la page
- [ ] Un clic sur "stock bas" redirige vers la liste des ingredients filtree sur les alertes
- [ ] Un clic sur "commandes du jour" redirige vers la liste des commandes du jour
- [ ] Le dashboard ne montre que les donnees du tenant connecte (isolation multi-tenant)
- [ ] Le chargement initial du dashboard est inferieur a 2 secondes (donnees en cache ou pre-calculees)
- [ ] Le dashboard est responsive desktop-first (lisible a partir de 1024px)
- [ ] Un widget affiche les 5 dernieres commandes recues avec statut

---

## US-002 — Gestion des ingredients (CRUD)

**Priorite : P0**

> En tant qu'Artisan, je veux gerer mon catalogue d'ingredients (creer, modifier, supprimer, consulter) afin de connaitre precisement mon stock et mes couts.

### Criteres d'acceptation

- [ ] Je peux creer un ingredient avec : nom, categorie, unite de mesure (kg, L, piece, etc.), prix unitaire, prix par conditionnement, quantite en stock, seuil d'alerte
- [ ] Je peux modifier tout champ d'un ingredient existant
- [ ] La suppression est une suppression logique (soft delete) — l'ingredient est desactive mais conserve en base pour l'historique des recettes
- [ ] La liste est filtrable par categorie, par statut d'alerte (stock bas), et triable par nom/stock/prix
- [ ] La recherche par nom fonctionne en temps reel (debounce 300ms)
- [ ] Les donnees sont isolees par tenant
- [ ] Un ingredient ne peut pas avoir un prix negatif ou un stock negatif
- [ ] L'unite de mesure est choisie parmi une liste predeterminee (extensible par l'admin)

---

## US-003 — Alerte de stock bas

**Priorite : P0**

> En tant qu'Artisan, je veux etre averti lorsqu'un ingredient passe sous son seuil d'alerte afin de pouvoir reapprovisionner a temps.

### Criteres d'acceptation

- [ ] Le systeme detecte automatiquement les ingredients dont le stock est inferieur ou egal au seuil d'alerte
- [ ] Une notification visuelle est affichee dans le dashboard (badge compteur)
- [ ] Une notification par email est envoyee a l'artisan (configurable : activer/desactiver)
- [ ] La liste des alertes est accessible en un clic depuis le dashboard
- [ ] L'alerte disparait automatiquement lorsque le stock est remonte au-dessus du seuil
- [ ] Pas de spam : un email par ingredient et par franchissement de seuil (pas de reenvoi si le stock reste bas)

---

## US-004 — Gestion des recettes / fiches techniques

**Priorite : P0**

> En tant qu'Artisan, je veux creer et gerer mes recettes (fiches techniques) avec la liste des ingredients, les quantites et les etapes de fabrication afin de standardiser ma production et calculer mes couts.

### Criteres d'acceptation

- [ ] Je peux creer une recette avec : nom, description, categorie, photo (optionnelle), nombre de portions, temps de preparation, temps de cuisson
- [ ] Je peux ajouter un ou plusieurs ingredients a la recette avec leur quantite et unite
- [ ] Les ingredients sont selectionnes depuis mon catalogue (auto-complete)
- [ ] Je peux definir des etapes de fabrication ordonnees (texte libre par etape)
- [ ] Je peux modifier et supprimer une recette (soft delete)
- [ ] Le cout matiere premiere est calcule automatiquement a partir des prix des ingredients et des quantites (cf US-006)
- [ ] Je peux dupliquer une recette existante pour creer une variante
- [ ] La fiche technique est imprimable (version PDF propre)
- [ ] Les recettes sont isolees par tenant

---

## US-005 — Versionnage des recettes

**Priorite : P1**

> En tant qu'Artisan, je veux conserver l'historique de modifications de mes recettes afin de pouvoir revenir a une version precedente ou comprendre l'evolution des couts.

### Criteres d'acceptation

- [ ] Chaque modification d'une recette cree une nouvelle version (increment automatique)
- [ ] Je peux consulter l'historique des versions d'une recette
- [ ] Je peux comparer deux versions (diff des ingredients/quantites)
- [ ] Je peux restaurer une version precedente (cree une nouvelle version = copie)
- [ ] Le calcul de cout est fige par version (snapshot des prix au moment de la creation)

---

## US-006 — Calcul automatique des couts de production

**Priorite : P0**

> En tant qu'Artisan, je veux que le systeme calcule automatiquement le cout de production de chaque recette afin de fixer mes prix de vente avec une marge maitrisee.

### Criteres d'acceptation

- [ ] Le cout matiere premiere est calcule : somme(quantite_ingredient * prix_unitaire_ingredient) pour chaque ingredient de la recette
- [ ] Le cout par portion est affiche : cout total / nombre de portions
- [ ] Je peux definir un coefficient de marge (ex : x2.5) pour obtenir un prix de vente suggere
- [ ] Le prix de vente suggere est recalcule en temps reel quand je modifie la marge
- [ ] Si le prix d'un ingredient change, un indicateur signale les recettes dont le cout a evolue
- [ ] L'affichage distingue clairement : cout matiere, marge, prix de vente HT, prix de vente TTC (avec taux TVA applicable : 6% alimentaire ou 21%)
- [ ] Le taux de TVA est configurable par produit/recette (defaut : 6% alimentaire)

---

## US-007 — Gestion des fournisseurs

**Priorite : P1**

> En tant qu'Artisan, je veux gerer un carnet de fournisseurs avec leurs coordonnees et catalogues afin de centraliser mes contacts et suivre mes approvisionnements.

### Criteres d'acceptation

- [ ] Je peux creer un fournisseur avec : nom, adresse, telephone, email, site web, numero TVA (format belge BE0xxx.xxx.xxx), personne de contact, notes
- [ ] Je peux associer un ou plusieurs ingredients a un fournisseur (avec le prix fournisseur specifique et la reference fournisseur)
- [ ] Je peux modifier et desactiver un fournisseur (soft delete)
- [ ] La liste des fournisseurs est recherchable et triable
- [ ] Je peux voir l'historique des commandes passees aupres d'un fournisseur (lecture seule — saisie manuelle pour le MVP)
- [ ] Les fournisseurs sont isoles par tenant
- [ ] Le numero TVA belge est valide au format (regex BE + 10 chiffres)

---

## US-008 — Gestion des produits finis

**Priorite : P0**

> En tant qu'Artisan, je veux transformer mes recettes en produits finis vendables sur ma vitrine afin de publier mon catalogue en ligne.

### Criteres d'acceptation

- [ ] Je peux creer un produit fini lie a une recette
- [ ] Le produit herite automatiquement du cout et du prix de vente suggere de la recette
- [ ] Je peux surcharger le prix de vente (prix final different du suggere)
- [ ] Je definis pour chaque produit : nom commercial, description vitrine, photo(s), categorie vitrine, disponibilite (actif/inactif), taux TVA (6% ou 21%)
- [ ] Je peux marquer un produit comme "disponible click & collect" (oui/non)
- [ ] Un produit inactif n'apparait pas sur la vitrine
- [ ] Je peux gerer le stock produit fini (quantite disponible par jour ou illimite)
- [ ] Les produits sont isoles par tenant
- [ ] Le prix TTC est calcule automatiquement : prix HT * (1 + taux TVA)

---

## US-009 — Facturation conforme TVA belge

**Priorite : P0**

> En tant qu'Artisan, je veux generer des factures conformes a la legislation belge afin d'etre en regle avec le fisc et de fournir des justificatifs a mes clients.

### Criteres d'acceptation

- [ ] La facture contient toutes les mentions legales obligatoires belges : numero sequentiel, date, identite vendeur (nom, adresse, numero TVA/BCE), identite acheteur, description des biens/services, quantite, prix unitaire HT, taux TVA, montant TVA, total TTC, conditions de paiement
- [ ] La numerotation est sequentielle sans trou (format configurable, ex : FACT-2026-0001)
- [ ] La facture est generee en PDF (telechargeeable et imprimable)
- [ ] Le taux de TVA est correctement applique par ligne (6% ou 21%)
- [ ] Le total TVA est ventile par taux sur la facture
- [ ] La facture est liee a une commande (tracabilite)
- [ ] L'historique des factures est consultable avec filtres (date, client, montant, statut)
- [ ] Les factures sont immutables une fois emises (pas de modification, uniquement note de credit)
- [ ] Les factures sont isolees par tenant
- [ ] Le format respecte les exigences pour une eventuelle facturation electronique (Peppol-ready : champs structures)

---

## US-010 — Gestion des commandes clients (backoffice)

**Priorite : P0**

> En tant qu'Artisan, je veux recevoir et gerer les commandes passees par mes clients afin de planifier ma production et assurer le suivi.

### Criteres d'acceptation

- [ ] Je vois la liste des commandes avec filtres : statut, date, client
- [ ] Chaque commande affiche : numero, date, client (nom + contact), liste des produits, quantites, total, creneau de retrait choisi, statut
- [ ] Les statuts possibles sont : nouvelle, en preparation, prete, retiree, annulee
- [ ] Je peux changer le statut d'une commande (workflow lineaire avec possibilite d'annulation a tout moment)
- [ ] Le changement de statut en "prete" declenche une notification au client (email)
- [ ] Je peux voir le detail d'une commande et son historique de statuts (timestamps)
- [ ] Les commandes sont isolees par tenant
- [ ] Une commande ne peut pas etre modifiee apres paiement (seul le statut change)
- [ ] Le CA de la commande est automatiquement pris en compte dans les KPI dashboard

---

## US-011 — RBAC dynamique (roles et permissions)

**Priorite : P1**

> En tant qu'Artisan, je veux definir des roles personnalises avec des permissions granulaires pour mes employes afin de controler precisement qui accede a quoi dans mon backoffice.

### Criteres d'acceptation

- [ ] Je peux creer des roles custom avec un nom et une description
- [ ] Chaque role est compose de permissions granulaires par module (ex : ingredients.read, ingredients.write, recettes.read, commandes.manage, facturation.view)
- [ ] Les permissions disponibles couvrent : lecture, ecriture, suppression, pour chaque module ERP
- [ ] Je peux assigner un ou plusieurs roles a un employe
- [ ] Un employe sans role assigne n'a acces a rien (deny by default)
- [ ] Le role "Admin" (artisan proprietaire) est non supprimable et a toutes les permissions
- [ ] Les modifications de role prennent effet immediatement (pas besoin de reconnecter l'employe)
- [ ] L'interface masque les menus/pages auxquels l'utilisateur n'a pas acces
- [ ] L'API refuse les requetes non autorisees avec un code 403 et un message clair
- [ ] Les roles et permissions sont isoles par tenant

---

## US-012 — Gestion des employes

**Priorite : P1**

> En tant qu'Artisan, je veux inviter et gerer mes employes afin qu'ils puissent acceder au backoffice selon leur role.

### Criteres d'acceptation

- [ ] Je peux inviter un employe par email (envoi d'un lien d'invitation)
- [ ] L'employe invite cree son compte via le lien (mot de passe personnel)
- [ ] Je peux voir la liste de mes employes (actifs et desactives)
- [ ] Je peux desactiver un employe (revocation d'acces immediate, compte conserve pour l'historique)
- [ ] Je peux modifier le role assigne a un employe
- [ ] Un employe desactive ne peut plus se connecter
- [ ] Le nombre d'employes peut etre limite selon le plan d'abonnement (prepare pour le billing futur)

---

# MODULE CMS (Vitrine)

---

## US-013 — Selection du template de vitrine

**Priorite : P0**

> En tant qu'Artisan, je veux choisir un template de vitrine adapte a mon metier afin d'avoir une base professionnelle sans competence technique.

### Criteres d'acceptation

- [ ] Au moins 3 templates sont disponibles : boulangerie, patisserie, traiteur
- [ ] Chaque template a une preview (screenshot ou demo live)
- [ ] Le choix du template est fait lors de l'onboarding ou modifiable ensuite dans les parametres
- [ ] Le template definit : disposition des sections, style typographique, palette de couleurs par defaut, structure de pages
- [ ] Le changement de template conserve le contenu existant (textes, images, produits)
- [ ] Le template est responsive (mobile-first pour la vitrine publique)

---

## US-014 — Personnalisation visuelle (logo, couleurs, polices)

**Priorite : P0**

> En tant qu'Artisan, je veux personnaliser l'apparence de ma vitrine (logo, couleurs, polices, images) afin qu'elle reflete mon identite de marque.

### Criteres d'acceptation

- [ ] Je peux uploader mon logo (formats : PNG, SVG, JPEG ; taille max : 2 Mo ; dimensions recommandees affichees)
- [ ] Je peux definir une palette de couleurs : couleur primaire, secondaire, accent, fond, texte (color picker)
- [ ] Je peux choisir parmi une selection de polices web (Google Fonts) : une pour les titres, une pour le corps
- [ ] Je peux uploader des images de fond / hero (formats : JPEG, PNG, WebP ; taille max : 5 Mo)
- [ ] Les modifications sont previewables en temps reel avant publication
- [ ] Un bouton "Publier" applique les changements sur la vitrine live
- [ ] Les assets sont stockes dans un espace dedie au tenant (isolation)
- [ ] Le contraste texte/fond respecte un ratio minimum de 4.5:1 (alerte si non conforme)

---

## US-015 — Presets de disposition (layouts)

**Priorite : P1**

> En tant qu'Artisan, je veux choisir parmi des dispositions predefinies pour mes pages afin d'organiser mon contenu sans designer.

### Criteres d'acceptation

- [ ] Au moins 3 presets de layout sont disponibles par type de page (accueil, catalogue, page libre)
- [ ] Chaque preset montre un schema visuel (wireframe preview)
- [ ] Le choix d'un preset reorganise les blocs selon la disposition choisie
- [ ] Le contenu existant est preserve lors du changement de preset
- [ ] Les presets sont compatibles mobile (responsive garanti)

---

## US-016 — Drag & drop pour rearranger les blocs

**Priorite : P1**

> En tant qu'Artisan, je veux pouvoir deplacer et reorganiser les blocs de contenu par glisser-deposer afin de personnaliser la mise en page de ma vitrine intuitivement.

### Criteres d'acceptation

- [ ] Les blocs de la page sont deplacables par drag & drop (interaction souris et tactile)
- [ ] Un indicateur visuel montre la zone de depot possible
- [ ] L'ordre est sauvegarde automatiquement (ou via un bouton "Sauvegarder")
- [ ] Les blocs disponibles incluent au minimum : hero/banniere, texte, image, galerie, catalogue produits, carte/contact, temoignages
- [ ] Je peux ajouter et supprimer des blocs
- [ ] L'edition se fait dans un mode "editeur" distinct du mode "preview"
- [ ] Le resultat est fidele au rendu final (WYSIWYG)

---

## US-017 — Gestion de pages libres

**Priorite : P1**

> En tant qu'Artisan, je veux creer et gerer des pages libres (Accueil, Menu, A propos, Contact, Galerie) afin de presenter mon activite au-dela du simple catalogue.

### Criteres d'acceptation

- [ ] Je peux creer une nouvelle page avec : titre, slug (URL), meta description (SEO)
- [ ] Je peux definir l'ordre des pages dans le menu de navigation
- [ ] Je peux activer/desactiver une page (non visible si desactivee)
- [ ] Je peux supprimer une page (soft delete, avec confirmation)
- [ ] Chaque page utilise le systeme de blocs (cf US-016)
- [ ] Le slug est genere automatiquement depuis le titre (modifiable manuellement)
- [ ] Les slugs sont uniques par tenant
- [ ] Les pages "Accueil" et "Contact" sont creees par defaut lors de l'onboarding (non supprimables)
- [ ] Le SEO de chaque page inclut : title, meta description, og:image

---

## US-018 — Catalogue produits (vitrine synchronisee)

**Priorite : P0**

> En tant que Client final, je veux consulter le catalogue des produits de l'artisan afin de decouvrir son offre et passer commande.

### Criteres d'acceptation

- [ ] Le catalogue affiche tous les produits actifs de l'artisan
- [ ] Chaque produit affiche : nom, description courte, photo, prix TTC, categorie
- [ ] Les produits sont filtrables par categorie
- [ ] Les produits sont tries par categorie puis par nom (tri par defaut) ; tri alternatif par prix possible
- [ ] Le catalogue est mis a jour en temps reel lorsque l'artisan modifie ses produits dans l'ERP
- [ ] Les produits marques "indisponibles" n'apparaissent pas
- [ ] Le catalogue est responsive (grille adaptative : 1 colonne mobile, 2-3 colonnes tablette, 3-4 colonnes desktop)
- [ ] Le chargement du catalogue est performant (pagination ou infinite scroll, max 20 produits par page)
- [ ] Le catalogue respecte le design du template choisi par l'artisan

---

## US-019 — Fiche produit detaillee

**Priorite : P0**

> En tant que Client final, je veux voir le detail d'un produit afin de decider si je veux le commander.

### Criteres d'acceptation

- [ ] La fiche produit affiche : nom, description longue, photo(s) (carousel si multiple), prix TTC, categorie, allergenes (si renseignes)
- [ ] Un bouton "Ajouter au panier" est visible si le click & collect est active
- [ ] Si le produit a un stock limite, la disponibilite restante est affichee
- [ ] La fiche est accessible via une URL unique (SEO-friendly : /produit/[slug])
- [ ] Les meta tags SEO sont generes automatiquement (title, description, og:image)
- [ ] La fiche est responsive (mobile-first)

---

## US-020 — Panier (click & collect)

**Priorite : P0**

> En tant que Client final, je veux ajouter des produits a mon panier et le consulter afin de preparer ma commande avant de payer.

### Criteres d'acceptation

- [ ] Je peux ajouter un produit au panier avec une quantite
- [ ] Je peux modifier la quantite d'un produit dans le panier
- [ ] Je peux supprimer un produit du panier
- [ ] Le panier affiche : liste des produits, quantites, prix unitaire, sous-total par ligne, total general TTC
- [ ] Le panier est persistant (conserve si je ferme le navigateur — localStorage ou session)
- [ ] Le panier verifie la disponibilite des produits au moment du checkout (alerte si indisponible)
- [ ] Le nombre d'articles dans le panier est visible en permanence (badge sur l'icone panier)
- [ ] Le panier est propre a chaque tenant (un panier par vitrine)

---

## US-021 — Commande click & collect avec paiement Stripe

**Priorite : P0**

> En tant que Client final, je veux passer ma commande et payer en ligne afin de reserver mes produits pour le retrait.

### Criteres d'acceptation

- [ ] Le checkout demande : nom, prenom, email, telephone
- [ ] Le client choisit un creneau de retrait parmi ceux definis par l'artisan
- [ ] Le paiement est gere via Stripe Checkout (redirection vers page Stripe securisee)
- [ ] Aucune donnee de carte bancaire n'est stockee dans notre systeme (PCI compliance via Stripe)
- [ ] En cas de paiement reussi : la commande est creee avec statut "nouvelle", un email de confirmation est envoye au client, l'artisan est notifie
- [ ] En cas d'echec de paiement : le client est informe, la commande n'est pas creee, le stock n'est pas decrement
- [ ] La commande contient un numero unique, la date, les produits, le total, le creneau de retrait
- [ ] Le client recoit un recapitulatif par email avec les informations de retrait (adresse, creneau)
- [ ] L'idempotence est geree (pas de double commande si le client rafraichit la page)

---

## US-022 — Creneaux de retrait

**Priorite : P0**

> En tant qu'Artisan, je veux definir mes creneaux de retrait disponibles afin que mes clients choisissent un horaire compatible avec mon organisation.

### Criteres d'acceptation

- [ ] Je peux definir des creneaux recurrents par jour de la semaine (ex : lundi 8h-12h, mardi 14h-18h)
- [ ] Je peux definir la duree d'un creneau (ex : 15 min, 30 min)
- [ ] Je peux definir un nombre maximum de commandes par creneau
- [ ] Je peux fermer exceptionnellement un jour (vacances, fermeture exceptionnelle)
- [ ] Les creneaux pleins ne sont plus proposables au client
- [ ] Les creneaux passes ne sont plus affichables
- [ ] Je peux definir un delai minimum de commande (ex : commander au moins 24h a l'avance)
- [ ] Les creneaux sont isoles par tenant

---

## US-023 — Configuration Stripe par l'artisan

**Priorite : P0**

> En tant qu'Artisan, je veux connecter mon compte Stripe afin de recevoir les paiements de mes clients directement sur mon compte.

### Criteres d'acceptation

- [ ] L'artisan connecte son compte Stripe via Stripe Connect (OAuth flow)
- [ ] Le systeme utilise Stripe Connect en mode "Standard" (l'artisan a son propre dashboard Stripe)
- [ ] L'etat de connexion Stripe est affiche clairement (connecte / non connecte)
- [ ] Si Stripe n'est pas connecte, le click & collect est desactive sur la vitrine (message explicite)
- [ ] L'artisan peut deconnecter son compte Stripe a tout moment
- [ ] Les frais Stripe sont directement preleves par Stripe (pas de gestion de notre cote)
- [ ] Le webhook Stripe est configure pour recevoir les evenements de paiement (payment_intent.succeeded, payment_intent.failed)

---

# MODULE TRANSVERSAL

---

## US-024 — Inscription artisan

**Priorite : P0**

> En tant que futur Artisan, je veux m'inscrire sur la plateforme afin de creer mon espace de gestion et ma vitrine.

### Criteres d'acceptation

- [ ] Le formulaire d'inscription demande : nom du commerce, nom complet, email, mot de passe, confirmation mot de passe
- [ ] Le mot de passe respecte les regles de securite : minimum 8 caracteres, au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractere special
- [ ] Un email de verification est envoye (double opt-in)
- [ ] Le compte est actif uniquement apres verification de l'email
- [ ] L'email est unique dans le systeme (pas de doublon)
- [ ] Le nom du commerce genere un sous-domaine ou slug unique (ex : ma-boulangerie.artisastock.be)
- [ ] Un tenant est automatiquement cree a l'inscription (isolation des donnees)
- [ ] Les mots de passe sont hashes avec bcrypt (cost factor >= 12)
- [ ] Le formulaire est protege contre les bots (rate limiting + honeypot ou captcha)

---

## US-025 — Connexion (login)

**Priorite : P0**

> En tant qu'Artisan ou Employe, je veux me connecter a mon espace afin d'acceder a mes outils de gestion.

### Criteres d'acceptation

- [ ] La connexion se fait par email + mot de passe
- [ ] En cas d'echec : message generique "Email ou mot de passe incorrect" (pas d'enumeration d'utilisateurs)
- [ ] Apres 5 tentatives echouees : verrouillage temporaire du compte (15 minutes)
- [ ] Un token JWT est emis avec une duree de vie de 1 heure (refresh token : 7 jours)
- [ ] Le refresh token est stocke dans un cookie httpOnly secure sameSite=strict
- [ ] L'utilisateur est redirige vers le dashboard apres connexion reussie
- [ ] Une option "Se souvenir de moi" prolonge le refresh token a 30 jours
- [ ] La session est invalidable cote serveur (revocation du refresh token)

---

## US-026 — Reset de mot de passe

**Priorite : P0**

> En tant qu'utilisateur, je veux reinitialiser mon mot de passe si je l'ai oublie afin de recuperer l'acces a mon compte.

### Criteres d'acceptation

- [ ] Un lien "Mot de passe oublie ?" est accessible depuis la page de connexion
- [ ] Je saisis mon email et un lien de reinitialisation est envoye (si l'email existe en base)
- [ ] Le message de confirmation est identique que l'email existe ou non (pas d'enumeration)
- [ ] Le lien de reinitialisation est valide 1 heure et a usage unique
- [ ] Le nouveau mot de passe doit respecter les memes regles que l'inscription
- [ ] Apres reinitialisation, toutes les sessions existantes sont invalidees
- [ ] Le lien contient un token cryptographiquement securise (min 32 bytes, URL-safe)

---

## US-027 — Multi-langue (FR/NL)

**Priorite : P1**

> En tant qu'Artisan ou Client, je veux utiliser la plateforme dans ma langue (francais ou neerlandais) afin de comprendre toutes les fonctionnalites.

### Criteres d'acceptation

- [ ] L'interface backoffice (ERP) est disponible en FR et NL
- [ ] La vitrine publique est disponible en FR et NL
- [ ] La langue est selectionnable via un switcher visible (header)
- [ ] La langue par defaut est determinee par la preference navigateur (fallback : FR)
- [ ] L'artisan peut definir la langue par defaut de sa vitrine
- [ ] Les textes statiques (labels, boutons, messages) sont externalises dans des fichiers de traduction (i18n)
- [ ] Les contenus metier (noms de produits, descriptions) sont geres par l'artisan dans la langue de son choix (pas de traduction automatique au MVP)
- [ ] Les URLs de la vitrine integrent le prefixe de langue (/fr/..., /nl/...) pour le SEO
- [ ] Les emails transactionnels sont envoyes dans la langue de l'utilisateur

---

## US-028 — Conformite RGPD : consentement cookies

**Priorite : P0**

> En tant que Client final visitant une vitrine, je veux etre informe des cookies utilises et donner mon consentement afin que mes droits RGPD soient respectes.

### Criteres d'acceptation

- [ ] Un bandeau de consentement s'affiche au premier acces a la vitrine
- [ ] Le bandeau presente les categories de cookies : necessaires (non decochables), analytiques (optionnels), marketing (optionnels)
- [ ] Je peux accepter tout, refuser les optionnels, ou personnaliser
- [ ] Mon choix est memorise (cookie de consentement, duree 6 mois)
- [ ] Les cookies optionnels ne sont PAS deposes tant que le consentement n'est pas donne (opt-in)
- [ ] Je peux modifier mon choix a tout moment (lien dans le footer "Gerer mes cookies")
- [ ] Le consentement est logge avec horodatage pour preuve (accountability)
- [ ] Le bandeau est conforme visuellement (pas de dark pattern : bouton refuser aussi visible qu'accepter)

---

## US-029 — RGPD : droit d'acces et suppression

**Priorite : P0**

> En tant que Client final, je veux pouvoir demander l'acces a mes donnees personnelles ou leur suppression afin d'exercer mes droits RGPD.

### Criteres d'acceptation

- [ ] Un formulaire de demande est accessible depuis la vitrine (page "Politique de confidentialite" ou lien dedié)
- [ ] La demande est envoyee a l'artisan (notification email + affichage dans le backoffice)
- [ ] L'artisan peut traiter la demande : exporter les donnees du client (JSON/CSV) ou supprimer/anonymiser
- [ ] La suppression anonymise les donnees personnelles mais conserve les donnees comptables requises legalement (factures)
- [ ] Le delai de traitement est de maximum 30 jours (RGPD)
- [ ] Un log des demandes RGPD est conserve pour preuve de conformite
- [ ] Les donnees anonymisees ne permettent plus d'identifier la personne (hash irreversible ou suppression)

---

## US-030 — Responsive design

**Priorite : P0**

> En tant qu'utilisateur (Artisan sur ERP ou Client sur vitrine), je veux une interface adaptee a mon ecran afin de naviguer confortablement quel que soit mon appareil.

### Criteres d'acceptation

- [ ] La vitrine publique est mobile-first : optimisee pour 375px, adaptee 768px et 1440px
- [ ] L'ERP (backoffice) est desktop-first : optimise pour 1440px, lisible a 1024px, fonctionnel a 768px
- [ ] Aucun scroll horizontal non voulu sur aucun breakpoint
- [ ] Les zones tactiles (boutons, liens) font au minimum 44x44px sur mobile
- [ ] Les images sont servies en taille adaptee (srcset / responsive images)
- [ ] Le menu de navigation de la vitrine se transforme en hamburger menu sur mobile
- [ ] Les tableaux de donnees (ERP) ont un scroll horizontal sur mobile si necessaire (pas de troncature de donnees)
- [ ] Le temps de chargement sur mobile 4G est inferieur a 3 secondes (LCP < 2.5s)

---

## US-031 — Onboarding guide (wizard)

**Priorite : P1**

> En tant que nouvel Artisan, je veux etre guide pas a pas lors de ma premiere configuration afin de mettre en route mon espace rapidement sans me perdre.

### Criteres d'acceptation

- [ ] Apres la premiere connexion (post-verification email), un wizard de configuration se lance automatiquement
- [ ] Les etapes du wizard sont : 1) Informations commerce (nom, adresse, telephone, numero TVA), 2) Choix du template de vitrine, 3) Upload du logo, 4) Personnalisation des couleurs, 5) Connexion Stripe (optionnel, skippable), 6) Creation du premier produit (optionnel, skippable)
- [ ] Chaque etape est skippable (sauf etape 1 : informations commerce)
- [ ] La progression est affichee (barre de progression ou etapes numerotees)
- [ ] Le wizard peut etre interrompu et repris plus tard
- [ ] Un message de bienvenue personnalise s'affiche a la fin du wizard
- [ ] Les etapes skippees sont rappelees dans le dashboard ("Completez votre profil : X/6")
- [ ] L'artisan peut relancer le wizard depuis les parametres

---

## US-032 — Gestion du profil artisan

**Priorite : P0**

> En tant qu'Artisan, je veux gerer les informations de mon commerce afin de les tenir a jour sur ma vitrine et mes factures.

### Criteres d'acceptation

- [ ] Je peux modifier : nom du commerce, adresse complete, telephone, email de contact public, numero TVA (BCE), description courte, horaires d'ouverture
- [ ] Les informations mises a jour sont automatiquement reflétees sur la vitrine (footer, page contact) et sur les factures
- [ ] Le numero TVA est valide au format belge (BE + 10 chiffres)
- [ ] L'adresse est structuree (rue, numero, code postal, ville, pays)
- [ ] Les horaires sont definissables par jour de la semaine (ouverture/fermeture ou "Ferme")
- [ ] Je peux modifier mon email de connexion (reconfirmation requise)
- [ ] Je peux changer mon mot de passe (ancien mot de passe requis + nouvelles regles de securite)

---

## US-033 — Domaine personnalise (sous-domaine)

**Priorite : P2**

> En tant qu'Artisan, je veux avoir un sous-domaine dedie (ex : ma-boulangerie.artisastock.be) afin d'avoir une URL professionnelle pour ma vitrine.

### Criteres d'acceptation

- [ ] Un sous-domaine est attribue automatiquement a l'inscription (base sur le nom du commerce, slug)
- [ ] Le sous-domaine est unique et valide (caracteres alphanumeriques et tirets uniquement)
- [ ] L'artisan peut modifier son sous-domaine (verification d'unicite)
- [ ] La vitrine est accessible via : sous-domaine.artisastock.be
- [ ] Le certificat SSL est automatiquement provisionne (wildcard ou Let's Encrypt)
- [ ] La redirection HTTP -> HTTPS est automatique

---

## US-034 — Notifications email transactionnelles

**Priorite : P0**

> En tant que Systeme, je veux envoyer des emails transactionnels automatiques afin de tenir informes les artisans et leurs clients.

### Criteres d'acceptation

- [ ] Les emails suivants sont automatises : confirmation d'inscription, verification email, reset mot de passe, nouvelle commande recue (artisan), confirmation de commande (client), commande prete (client), alerte stock bas (artisan)
- [ ] Les emails utilisent des templates HTML responsives
- [ ] Les emails incluent le branding minimal de la plateforme (logo ArtisaStock)
- [ ] Les emails sont envoyes dans la langue de l'utilisateur destinataire
- [ ] Le service d'envoi est externe (SendGrid, Resend, ou equivalent — pas d'envoi direct SMTP)
- [ ] Les emails contiennent un lien de desabonnement pour les emails non-critiques (alertes)
- [ ] Les emails critiques (securite, commandes) ne sont pas desabonnables
- [ ] Un log d'envoi est conserve (date, destinataire, type, statut)

---

## US-035 — Isolation multi-tenant

**Priorite : P0**

> En tant que Systeme, je veux garantir l'isolation complete des donnees entre les tenants afin qu'aucun artisan ne puisse acceder aux donnees d'un autre.

### Criteres d'acceptation

- [ ] Chaque artisan (commerce) = 1 tenant avec un identifiant unique (tenant_id)
- [ ] Toutes les requetes en base de donnees sont filtrees par tenant_id (middleware global ou query scope)
- [ ] Il est impossible d'acceder a une donnee d'un autre tenant via manipulation d'URL ou d'API (IDOR protection)
- [ ] Les tests d'integration verifient l'isolation (un utilisateur du tenant A ne peut pas lire/ecrire les donnees du tenant B)
- [ ] Les fichiers uploades (images, logos) sont stockes dans un namespace separe par tenant
- [ ] L'administration plateforme (super-admin ArtisaStock) peut acceder a tous les tenants pour le support (role specifique, avec audit log)
- [ ] La suppression d'un tenant supprime (ou anonymise) toutes ses donnees associees

---

## US-036 — Politique de confidentialite et CGV

**Priorite : P1**

> En tant qu'Artisan, je veux pouvoir renseigner mes conditions generales de vente et ma politique de confidentialite afin d'etre conforme legalement.

### Criteres d'acceptation

- [ ] Une page "Politique de confidentialite" est auto-generee avec les mentions legales obligatoires (RGPD) — template pre-rempli modifiable
- [ ] Une page "CGV" (Conditions Generales de Vente) est disponible — template pre-rempli modifiable par l'artisan
- [ ] Les deux pages sont accessibles depuis le footer de la vitrine
- [ ] Le client doit cocher "J'accepte les CGV" avant de valider une commande
- [ ] L'horodatage de l'acceptation est enregistre

---

## US-037 — SEO de base pour la vitrine

**Priorite : P1**

> En tant qu'Artisan, je veux que ma vitrine soit bien referencee sur Google afin d'attirer des clients locaux.

### Criteres d'acceptation

- [ ] Chaque page genere automatiquement les balises : title, meta description, og:title, og:description, og:image
- [ ] Les URLs sont propres et SEO-friendly (slugs lisibles)
- [ ] Un sitemap.xml est genere automatiquement et mis a jour a chaque modification
- [ ] Un robots.txt est configure correctement
- [ ] Les images ont des attributs alt renseignes
- [ ] Les donnees structurees (schema.org) sont integrees pour : LocalBusiness, Product, BreadcrumbList
- [ ] Le rendu est SSR (Server-Side Rendering) ou SSG (Static Site Generation) pour les pages publiques (SEO-friendly)
- [ ] Le temps de chargement respecte les Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)

---

## US-038 — Page de suivi de commande (client)

**Priorite : P1**

> En tant que Client final, je veux suivre l'etat de ma commande apres l'avoir passee afin de savoir quand venir la retirer.

### Criteres d'acceptation

- [ ] Apres paiement, le client recoit un lien de suivi unique (dans l'email de confirmation)
- [ ] La page de suivi affiche : numero de commande, statut actuel, creneau de retrait, adresse de retrait, recapitulatif des produits
- [ ] Le statut est mis a jour en temps reel (ou au rechargement) lorsque l'artisan le modifie
- [ ] Aucune authentification n'est requise pour consulter le suivi (lien unique non devinable — UUID)
- [ ] Le lien de suivi expire 30 jours apres la date de retrait

---

---

# Recapitulatif des priorites

| Priorite | Stories |
|----------|---------|
| **P0** | US-001, US-002, US-003, US-004, US-006, US-008, US-009, US-010, US-013, US-014, US-018, US-019, US-020, US-021, US-022, US-023, US-024, US-025, US-026, US-028, US-029, US-030, US-032, US-034, US-035 |
| **P1** | US-005, US-007, US-011, US-012, US-015, US-016, US-017, US-027, US-031, US-036, US-037, US-038 |
| **P2** | US-033 |

---

# Dependencies (ordre d'implementation suggere)

```
US-024 (inscription) → US-025 (login) → US-026 (reset pwd)
US-035 (multi-tenant) → toutes les autres stories
US-002 (ingredients) → US-004 (recettes) → US-006 (couts) → US-008 (produits finis)
US-008 (produits finis) → US-018 (catalogue vitrine) → US-019 (fiche produit)
US-019 (fiche produit) → US-020 (panier) → US-021 (commande + paiement)
US-023 (config Stripe) → US-021 (paiement)
US-022 (creneaux) → US-021 (choix creneau)
US-010 (gestion commandes) ← US-021 (creation commande)
US-013 (template) → US-014 (perso) → US-015/016/017 (layout/drag/pages)
US-011 (RBAC) → US-012 (employes)
```

---

> **Document genere par Agent #1 — Product Owner**
> Prochaine etape : validation par mentalyas, puis transmission a l'Agent #2 (Architecte) et Agent #3 (UI/UX).
