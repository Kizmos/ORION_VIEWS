# ORION

ORION est une application d'affichage TV simple avec :

- un compte à rebours vers une date définie ;
- un diaporama d'images dynamique ;
- un planning de réunions importé depuis un fichier Excel (sujet, créneau, salle) ;
- un planning de tâches internes ;

L'affichage (`index.html`) et le paramétrage (`settings.html`) sont deux pages séparées : l'écran
TV n'affiche que des données, toute la configuration se fait dans les paramètres.

## Démarrage

Un petit serveur sans dépendance est fourni (utile pour ouvrir les deux pages depuis un même
serveur, notamment si l'écran TV et le poste d'administration doivent un jour être séparés) :

```bash
node server.js
# ou : npm start
```

Puis ouvrez :
- **Affichage (TV)** : http://localhost:8080/index.html
- **Paramètres (admin)** : http://localhost:8080/settings.html

## Configuration

1. Ouvrez `settings.html`.
2. Dans **Compte à rebours**, choisissez la date/heure cible et un titre optionnel, puis validez.
3. Dans **Visionnage d'images**, importez les images du diaporama, réglez l'intervalle de
   défilement, la taille du bloc à l'affichage (Petit/Moyen/Grand), et réordonnez ou supprimez des
   images si besoin.
4. Dans **Planning des réunions**, importez le fichier Excel du planning (voir format ci-dessous).
   L'écran affiche automatiquement les réunions du jour (ou, à défaut, celles du prochain jour où
   des réunions sont prévues).
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

- Les données (compte à rebours, images, réglages, tâches, planning de réunions) sont stockées
  localement dans le navigateur (`localStorage` et `IndexedDB`) : affichage et paramètres doivent
  donc être ouverts dans le **même navigateur**.
- Le compte à rebours se met à jour automatiquement toutes les secondes et se relit toutes les
  5 secondes pour prendre en compte les changements faits depuis les paramètres.
- Le diaporama et le planning de réunions sont relus automatiquement (toutes les 20 et 30
  secondes) sans qu'il soit nécessaire de recharger la page d'affichage. La disposition (blocs
  visibles/ordre) est relue toutes les 5 secondes.
- La page d'affichage occupe tout l'écran sans défilement, quelle que soit la résolution de la
  TV (elle s'adapte automatiquement en hauteur et en largeur).
