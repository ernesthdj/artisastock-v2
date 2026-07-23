# Étape 0 — Login (WinForms)

> Source : `CN_docs/SCRIPT_DEFENSE_EXAMEN.md` §ETAPE 0. Voir [00-INDEX.md](00-INDEX.md).

## 0.1 Connexion admin

**Action utilisateur :**
1. Lancer `CharlesNadejda.exe`
2. `FrmLogin` s'affiche : champs Email + Mot de passe
3. Saisir les credentials admin (`admin@artisastock.be` / `admin123` en démo)
4. Cliquer "Se connecter"
5. Redirection vers le Hub (`FrmHub`), sidebar affichant : Hub | Stocks | Activités | Contextes | Fiches & Stock | Recettes BOM | Production | Commandes | Déconnexion

**Use case :** Authentifier un administrateur ERP et lui donner accès au shell applicatif (SFA — Single-Form Architecture).

**Fonctionnalité(s) impliquée(s) :** `Forms/FrmLogin.cs`, `DAL/UtilisateurDAL.cs` (méthode `Authenticate`)

**Règles métier :**
- Seuls les comptes `role = 'admin'` ET `actif = 1` peuvent se connecter à l'ERP (double filtre dans la requête, pas de vérification a posteriori)
- Mot de passe vérifié par hash BCrypt (`BCrypt.Net.BCrypt.Verify`), jamais en clair
- Message d'erreur toujours générique ("Email ou mot de passe incorrect.") — ne révèle jamais si c'est l'email ou le mot de passe qui est faux (anti-énumération de comptes, OWASP)
- Compte côté Laravel (`clients`) est une table séparée de `utilisateurs` — un client boutique n'a jamais accès à l'ERP, et le hash BCrypt est interopérable (`password_hash()` PHP ↔ `BCrypt.Net` C#) même si les deux tables restent distinctes

**Code réel v1 (`UtilisateurDAL.Authenticate`) :**
```csharp
public static Utilisateur Authenticate(string email, string motDePasse)
{
    using (var conn = DbHelper.GetConnection())
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = @"
            SELECT id, nom, prenom, email, role, mot_de_passe
            FROM utilisateurs
            WHERE email = @email AND actif = 1 AND role = 'admin'";

        cmd.Parameters.AddWithValue("@email", email);

        using (var reader = cmd.ExecuteReader())
        {
            if (!reader.Read())
                return null;   // Email inconnu ou role != admin

            string hash = reader["mot_de_passe"].ToString();

            if (!BCrypt.Net.BCrypt.Verify(motDePasse, hash))
                return null;   // Mot de passe incorrect

            return new Utilisateur
            {
                Id     = (int)reader["id"],
                Nom    = reader["nom"].ToString(),
                Prenom = reader["prenom"].ToString(),
                Email  = reader["email"].ToString(),
                Role   = reader["role"].ToString()
            };
        }
    }
}
```

**Mapping v2 :** `POST /api/v1/auth/login` (JWT ou session httpOnly selon [13-reference-roles-permissions.md](13-reference-roles-permissions.md)) → `/auth/login` `LoginPage`. Le rôle unique `admin` v1 devient le rôle `OWNER`/`MANAGER` dans le RBAC multi-tenant v2 — voir [13-reference-roles-permissions.md](13-reference-roles-permissions.md) pour la table de correspondance des rôles.
