# Étape 6 — Parcours client (boutique Laravel)

> Source : `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` §ETAPE 6. Voir [00-INDEX.md](00-INDEX.md).
> **Note v2 :** en v1 ce parcours tourne sur une app Laravel séparée qui partage la DB MySQL avec le C#. En v2, tout est unifié dans le même monolithe Next.js — mais les règles métier ci-dessous (validation, sécurité session, N+1, verrouillage stock) restent à reproduire à l'identique.

## 6.1 Catalogue (visiteur anonyme)

**Action utilisateur :**
1. Ouvrir la page d'accueil boutique → liste des produits en vente
2. Cliquer un produit → page détail
3. "Ajouter au panier" visible mais redirige vers login si non connecté

**Use case :** Consultation publique du catalogue sans authentification.

**Fonctionnalité(s) impliquée(s) :** `resources/views/catalogue/index.blade.php`, `app/Http/Controllers/CatalogueController.php`, `routes/web.php`

**Règles métier :**
- Page catalogue publique, aucune authentification requise
- **Eager loading obligatoire** (`->with('categorie')`) pour éviter le problème N+1 : sans lui, 1 requête produits + 1 requête par produit pour sa catégorie = N+1 requêtes ; avec lui, 2 requêtes au total quel que soit le nombre de produits

**Code réel v1 (`CatalogueController::index`) :**
```php
public function index(): \Illuminate\Contracts\View\View
{
    $query = ProduitWeb::where('en_vente', 1)
        ->with('categorie')        // eager loading — 1 requete au lieu de N
        ->withStockDisponible();   // scope local : sous-requete sur bom_stocks

    if (request('categorie')) {
        $query->where('id_categorie', request('categorie'));
    }

    $produits   = $query->get();
    $categories = CategorieWeb::where('actif', 1)->orderBy('ordre_affichage')->get();

    return view('catalogue.index', compact('produits', 'categories'));
}
```

**Mapping v2 :** `GET /api/v1/catalogue` avec `include: { categorie: true }` côté Prisma (équivalent eager loading). Le "stock disponible" doit rester une sous-requête/agrégation live sur l'équivalent de `bom_stocks`, jamais une valeur mise en cache côté produit.

---

## 6.2 Inscription client

**Action utilisateur :** Formulaire Nom/Prénom/Email/Mot de passe/Confirmation → soumission → redirection catalogue avec message de succès.

**Use case :** Créer un compte client boutique (distinct des comptes admin ERP).

**Fonctionnalité(s) impliquée(s) :** `app/Http/Controllers/Auth/RegisterController.php`, `app/Http/Requests/RegisterRequest.php` (Form Request), `app/Models/Client.php`

**Règles métier :**
- Validation centralisée dans un Form Request (Single Responsibility — le Controller ne fait que le flux)
- Email unique, mot de passe min 8 caractères + confirmation
- Hash `password_hash(..., PASSWORD_BCRYPT)` — même algorithme que `BCrypt.Net` côté C#, les deux applications sont interopérables sur le format de hash même si les comptes restent dans des tables séparées (`clients` ≠ `utilisateurs`)

**Code réel v1 (`RegisterRequest::rules`) :**
```php
public function rules(): array
{
    return [
        'prenom'   => 'required|string|max:100',
        'nom'      => 'required|string|max:100',
        'email'    => 'required|email|max:255|unique:clients,email',
        'password' => 'required|string|min:8|confirmed',  // confirmed = champ password_confirmation
    ];
}
```

**Mapping v2 :** `POST /api/v1/auth/register` avec validation Zod équivalente. Hash via bcrypt (bibliothèque Node compatible) ou argon2 selon choix v2 — si compatibilité de hash avec l'existant est requise, rester sur bcrypt.

---

## 6.3 Connexion client

**Action utilisateur :** Email + mot de passe → connexion réussie → redirection catalogue, menu affiche "Mon compte" et "Panier".

**Use case :** Authentifier un client boutique (guard distinct du guard admin ERP).

**Fonctionnalité(s) impliquée(s) :** `app/Http/Controllers/Auth/LoginController.php`, `app/Http/Middleware/ClientAuth.php`

**Règles métier :**
- Seuls les comptes `actif = 1` peuvent se connecter
- Message d'erreur générique (même principe qu'en 01-etape0-login.md, ne jamais révéler quel champ est incorrect)
- Session régénérée après connexion (`session()->regenerate()`) — protection contre la session fixation (OWASP A07)
- Cookie de session **httpOnly** — protection XSS (JavaScript ne peut pas lire le cookie)
- Guard `Client` totalement séparé du guard `Utilisateur` (admin) — un client ne peut jamais accéder à l'ERP

**Code réel v1 (`LoginController::login`) :**
```php
public function login(LoginRequest $request): \Illuminate\Http\RedirectResponse
{
    $client = Client::where('email', $request->email)
        ->where('actif', 1)
        ->first();

    if (!$client || !password_verify($request->password, $client->mot_de_passe)) {
        return back()
            ->withInput($request->only('email'))
            ->with('error', 'Email ou mot de passe incorrect.');
    }

    session([
        'client_id'    => $client->id,
        'client_nom'   => $client->nom,
        'client_prenom'=> $client->prenom,
        'panier_count' => 0,
    ]);
    session()->regenerate();  // Protection session fixation (OWASP A07)

    return redirect()->intended(route('catalogue'));
}
```

**Mapping v2 :** `POST /api/v1/auth/client-login` — JWT avec cookie httpOnly + `sameSite`, rotation du token à la connexion (équivalent `regenerate()`). Le rôle `VIEWER`/client reste séparé des rôles ERP dans le RBAC (voir [13-reference-roles-permissions.md](13-reference-roles-permissions.md)).

---

## 6.4 Ajout au panier (AJAX)

**Action utilisateur :** "Ajouter au panier" sur un produit → pas de rechargement de page, compteur menu mis à jour dynamiquement → page panier → modifier quantité → sous-total recalculé.

**Use case :** Construire une commande en statut "panier" de façon incrémentale, avec vérification de stock à chaque ajout.

**Fonctionnalité(s) impliquée(s) :** `app/Http/Controllers/PanierController.php`, `routes/web.php` (`POST /panier/ajouter`)

**Règles métier :**
- **Le panier est stocké en base de données** (`commandes_web` avec `statut = 'panier'`), pas en session — seule la session garde l'ID client et un compteur d'affichage. Avantage : persistance multi-appareil, reprise de panier abandonné, stock vérifié à chaque ajout
- Vérification de stock disponible AVANT d'ajouter au panier — refus explicite si `stock_disponible < quantité demandée`
- Si le produit est déjà dans le panier, incrémenter la quantité de la ligne existante plutôt que dupliquer

**Code réel v1 (`PanierController::ajouter`) :**
```php
public function ajouter(Request $request): \Illuminate\Http\JsonResponse
{
    $request->validate([
        'id_produit' => 'required|integer|exists:produits_web,id',
        'quantite'   => 'required|integer|min:1',
    ]);

    $produit = ProduitWeb::withStockDisponible()->findOrFail($request->id_produit);

    if ($produit->stock_disponible < $request->quantite) {
        return response()->json(['success' => false,
            'message' => 'Stock insuffisant. Disponible : ' . $produit->stock_disponible]);
    }

    $panier = $this->getOrCreatePanier();   // CommandeWeb statut='panier'

    $ligne = $panier->lignes()->where('id_produit_web', $produit->id)->first();
    if ($ligne) {
        $ligne->update(['quantite' => $ligne->quantite + $request->quantite]);
    } else {
        CommandeWebLigne::create([
            'id_commande'    => $panier->id,
            'id_produit_web' => $produit->id,
            'quantite'       => $request->quantite,
            'prix_unitaire'  => $produit->prix_vente,
        ]);
    }

    $count = $this->refreshPanierCount($panier);
    return response()->json(['success' => true,
        'message' => $produit->nom_commercial . ' ajoute au panier.',
        'panier_count' => $count]);
}
```

**Mapping v2 :** `POST /api/v1/panier/ajouter` — logique identique en Prisma. Le "panier" reste une commande en statut `PANIER`, jamais un state client-side volatile.

---

## 6.5 Checkout (paiement + décrémentation FIFO du stock)

**Action utilisateur :** Page panier → "Commander" → checkout (adresse, mode paiement Stripe test) → carte test `4242 4242 4242 4242` → "Payer" → confirmation avec numéro de commande.

**Use case :** Finaliser une commande : valider le paiement, décrémenter le stock produit fini de façon atomique et concurrente-safe, changer le statut de la commande.

**Fonctionnalité(s) impliquée(s) :** `app/Http/Controllers/CommandeController.php` (méthode `valider`), `app/Models/BomStock.php`

**Règles métier :**
- **`lockForUpdate()` obligatoire** sur les lignes de stock lues dans la transaction — pose un verrou exclusif ; toute autre transaction concurrente doit attendre le `COMMIT`. Sans ce verrou : *overselling* possible (deux clients achètent simultanément le dernier stock, les deux transactions lisent la même quantité disponible avant que l'une ne décrémente)
- FIFO sur le stock produit fini : `ORDER BY date_production ASC`
- **Le paiement est validé AVANT toute décrémentation de stock.** Si le paiement échoue, le stock n'est jamais touché. Si la mise à jour du statut échoue après décrémentation, le `rollback()` restaure le stock
- Snapshot du prix dans `commandes_web_lignes.prix_unitaire` au moment de l'ajout au panier — protection contre une modification de prix catalogue en cours de commande

**Code réel v1 (extrait `CommandeController::valider`) :**
```php
DB::beginTransaction();
$stocks = BomStock::where('id_fiche', $idFiche)
    ->where('quantite_disponible', '>', 0)
    ->orderBy('date_production', 'asc')
    ->lockForUpdate()->get();
foreach ($stocks as $stock) {
    if ($restant <= 0) break;
    $aConsommer = min($restant, $stock->quantite_disponible);
    $stock->quantite_disponible -= $aConsommer;
    $stock->save();
    $restant -= $aConsommer;
}
$panier->update(['statut' => 'payee', 'date_commande' => now(),
                 'total_ttc' => $panier->lignes->sum('sous_total')]);
DB::commit();
```

**Mapping v2 :** `POST /api/v1/checkout` — `$transaction` Prisma avec `isolationLevel: Serializable` (ou lecture avec verrou explicite selon le moteur PostgreSQL — `SELECT ... FOR UPDATE` via `$queryRaw` si Prisma ne l'expose pas nativement). C'est une des règles les plus critiques du backlog à ne pas rater : voir [12-reference-logique-metier.md](12-reference-logique-metier.md) §3.3 (double vérification anti-TOCTOU, même principe que la production BOM).
