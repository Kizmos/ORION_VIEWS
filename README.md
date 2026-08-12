# ORION

ORION est une application d'affichage TV simple avec :

- un compte à rebours vers une date définie ;
- un diaporama d'images dynamique, avec un message défilant optionnel ;
- un planning de réunions importé depuis un fichier Excel (sujet, créneau, salle) ;
- un planning de tâches internes ;

L'affichage (`index.html`) et le paramétrage (`settings.html`) sont deux pages séparées : l'écran
TV n'affiche que des données, toute la configuration se fait dans les paramètres.

## Architecture

Toutes les données (compte à rebours, images, planning, réglages) sont stockées **côté serveur**,
via des fonctions serverless Vercel (`/api/*`) adossées à **Vercel Blob**. N'importe quel
navigateur ou appareil ouvrant le site voit donc les mêmes données — configurez depuis votre
téléphone, ça s'affiche sur la TV, et inversement.

- `js/storage.js` : lit l'état une fois au chargement (`initStorage()`), le garde en mémoire, et
  envoie les modifications au serveur (avec un léger différé pour grouper les frappes rapides).
- La page d'affichage (`index.html`) re-synchronise avec le serveur toutes les 5 secondes pour
  détecter les changements faits depuis un autre appareil.
- `api/state.js` lit/écrit un unique fichier JSON (`data/settings.json` dans Vercel Blob) qui
  contient tout sauf les images elles-mêmes.
- `api/upload-image.js` / `api/delete-image.js` gèrent les fichiers image, stockés individuellement
  dans Vercel Blob et référencés par leur URL publique.

## Déploiement sur Vercel

1. Dans le projet Vercel → onglet **Storage** → **Create Database** → **Blob** → connectez-le au
   projet (Vercel ajoute automatiquement la variable d'environnement `BLOB_READ_WRITE_TOKEN`).
2. Déployez (`git push` suffit si le projet est connecté au dépôt GitHub).
3. Ouvrez `https://votre-projet.vercel.app/settings.html` pour configurer, et
   `https://votre-projet.vercel.app/` pour l'affichage.

## Démarrage en local

Un petit serveur sans dépendance (`server.js`) sert les fichiers statiques en local, mais **ne
fournit pas les routes `/api/*`** (celles-ci n'existent que sur Vercel, ou via `vercel dev` si le
CLI Vercel est installé et lié au projet). En local avec `node server.js`, les pages se chargent
mais les données ne pourront pas être lues/enregistrées : utilisez le lien Vercel déployé pour un
usage réel.

```bash
node server.js
# ou : npm start
```

## Configuration

1. Ouvrez `settings.html`.
2. Dans **Compte à rebours**, choisissez la date/heure cible et un titre optionnel, puis validez.
3. Dans **Visionnage d'images**, importez les images du diaporama, réglez l'intervalle de
   défilement, la taille du bloc à l'affichage (Petit/Moyen/Grand), réordonnez ou supprimez des
   images, et activez éventuellement un message défilant (texte libre ou planning du jour
   automatique) affiché en bas de l'image.
4. Dans **Planning des réunions**, importez le fichier Excel du planning (voir format ci-dessous).
   L'écran affiche automatiquement les réunions du jour (ou, à défaut, celles du prochain jour où
   des réunions sont prévues), groupées par salle. La salle et le créneau de chaque réunion sont
   modifiables directement dans la liste. Vous pouvez aussi définir les horaires réels de Matin /
   Après-midi et choisir de les afficher à la place des libellés.
5. Dans **Agenda / Planning**, ajoutez et suivez vos tâches internes.
6. Dans **Disposition de l'affichage**, activez/désactivez les blocs (compte à rebours, planning
   de réunions, images) visibles sur l'écran TV et réordonnez-les avec ▲ / ▼ ; le dernier bloc
   visible occupe toute la largeur.

## Format du fichier Excel de planning

Chaque feuille du classeur représente une semaine, avec :
- une ligne d'en-tête : **Squad** en première colonne, un jour par paire de colonnes fusionnées
  (Matin / Après-midi), puis **Salle** en dernière colonne ;
- une ligne par squad : le nom du squad, le sujet de la réunion dans la cellule du jour/créneau
  concerné, et la salle assignée à ce squad en dernière colonne.

ORION lit **toutes les feuilles** du classeur à l'import et retient la date réelle de chaque
réunion (via l'en-tête de colonne) : il n'est donc pas nécessaire de réimporter le fichier chaque
semaine s'il couvre plusieurs semaines à l'avance - il suffit de le remettre à jour quand son
contenu change.

## Notes

- Le compte à rebours se met à jour localement toutes les secondes (pas d'appel réseau requis pour
  ça) ; l'ensemble des données est resynchronisé avec le serveur toutes les 5 secondes.
- Le diaporama et le planning de réunions défilent automatiquement (verticalement pour le planning,
  horizontalement pour le message sur l'image) quand leur contenu dépasse l'espace disponible.
- La page d'affichage occupe tout l'écran sans défilement manuel, quelle que soit la résolution de
  la TV (elle s'adapte automatiquement en hauteur et en largeur).
