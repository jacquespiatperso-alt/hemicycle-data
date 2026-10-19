# hemicycle-data

Flux de données de l'application Android **L'Hémicycle** : une revue quotidienne de l'actualité politique française, avec la lecture de cinq courants politiques.

> ⚠️ **Contenu actuel : exemple fictif.** Le fichier `editions.json` publié ici sert à tester l'appli. Les sujets, chiffres et propos sont inventés : ils ne décrivent pas l'actualité réelle, et aucune citation n'est attribuée à une personne réelle.

## URL du flux

https://jacquespiatperso-alt.github.io/hemicycle-data/editions.json

## Format (résumé)

- `updated` : date ISO 8601 de la dernière publication.
- `editions` : les 10 derniers jours au maximum, de la plus récente à la plus ancienne. Chaque édition contient `date`, `label`, `maj`, `intro`, `stories`, `breves` et `agenda`.
- Chaque position d'un courant (`gr`, `g`, `c`, `d`, `dn`) a un `type` : `declare` (propos public sourcé, `src` obligatoire) ou `lecture` (position habituelle du courant, `src` facultatif).
- Toutes les URL doivent être en `https://`.
