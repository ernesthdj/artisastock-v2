# Tâches — Sécurité

- [ ] T001 [US1] FAILLE-001 : blocage PIN contournable (src/lib/pos/vendeur-auth.ts)
- [ ] T002 [US2] FAILLE-003 et FAILLE-006 : garde de rang de rôle, auto-promotion et invitation (src/app/api/v1/users/route.ts)
- [ ] T003 [US3] FAILLE-002 : secret JWT absent, arrêt au démarrage (src/middleware.ts)
- [ ] T004 FAILLE-005 : logo SVG sans nettoyage (XSS stocké)
- [ ] T005 FAILLE-004 : limitation de débit sur les routes d'authentification
- [ ] T006 [US4] FAILLE-008 : AuditLog du webhook dans la transaction (src/app/api/webhooks/stripe/route.ts)
- [ ] T007 FAILLE-007, 009, 010 : révocation de session, rôles système, blocage du tenant
- [ ] T008 FAILLE-011 : test d'isolation tenant sur le vrai mécanisme (tests/integration/tenant-isolation.test.ts)
- [ ] T009 FAILLE-012 à 015 : algorithmes JWT, réutilisation du refresh token, RBAC homogène
