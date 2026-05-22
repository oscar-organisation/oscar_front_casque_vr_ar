# Teleoperation XR via LiveKit

Ce document decrit les donnees recuperables depuis le casque VR/AR, les donnees actuellement envoyees par le front OSCAR, et le contrat LiveKit a consommer cote backend / bridge ROS.

Objectif : permettre au backend de recevoir les mouvements de tete et les entrees controleurs du casque pour piloter un robot en basse latence.

## Resume executif

Le casque recoit toujours le flux robot via LiveKit sous forme de tracks audio/video.

En plus de cette reception, le front OSCAR publie maintenant les entrees XR du casque vers la room LiveKit sous forme de DataPacket JSON.

| Direction | Donnees | Canal LiveKit | Etat |
|:--|:--|:--|:--|
| Robot / serveur vers casque | Flux video robot, audio eventuel | Track video/audio WebRTC | Existant |
| Casque vers serveur | Pose tete, controleurs, joysticks, boutons | DataPacket LiveKit topic `oscar.xr.input` | Implemente |
| Backend vers ROS | Conversion en topics / commandes robot | A definir cote backend | A implementer |

L'envoi casque se fait a 30 Hz, en mode non fiable (`reliable: false`) pour privilegier la latence. Un paquet ancien ne doit pas etre rejoue pour piloter le robot.

## Ce que WebXR peut recuperer depuis un casque

Les donnees disponibles dependent du navigateur du casque, des permissions WebXR, du type de session et des peripheriques connectes.

### Donnees standard disponibles en session WebXR

| Famille | Donnees possibles | Utilite robot |
|:--|:--|:--|
| Tete / viewer | Position 3D de la tete | Translation camera, analyse mouvement operateur |
| Tete / viewer | Orientation de la tete sous forme quaternion | Orientation tete robot, orientation camera, pan/tilt virtuel |
| Tete / viewer | Matrices de vue par oeil | Rendu XR, pas necessaire au pilotage robot v1 |
| Timing | Timestamp de frame XR | Synchronisation / estimation latence |
| Controleurs | Main gauche/droite, mode de pointage | Mapping commande gauche/droite |
| Controleurs | Pose du rayon de pointage (`targetRay`) | Visee, selection, direction intentionnelle |
| Controleurs | Pose physique de la manette (`grip`) | Position main / manette dans l'espace |
| Gamepad | Axes joysticks / trackpads | Avancer, reculer, tourner, strafing |
| Gamepad | Boutons presses / touches / valeurs analogiques | Actions robot : stop, grip, interaction, mode |
| Reference space | Coordonnees dans l'espace XR local | Base de transformation vers repere robot |

### Donnees possibles mais non implementees en v1

| Donnee | Condition | Commentaire |
|:--|:--|:--|
| Hand tracking | Demander la feature WebXR `hand-tracking` | Permettrait de lire les articulations des mains si le navigateur l'autorise |
| Boundaries / zone de jeu | Feature `bounded-floor` | Utile pour connaitre les limites physiques de l'utilisateur |
| Hit test AR | Feature WebXR AR dediee | Plutot utile en realite augmentee, pas prioritaire en VR immersive |
| Light estimation / anchors | Features WebXR AR | Pas utile pour le controle robot v1 |
| Haptics controleurs | Gamepad haptic actuator | Sortie vers casque, pas une donnee entrante |

### Donnees generalement non accessibles depuis le navigateur

| Donnee | Raison |
|:--|:--|
| Flux brut des cameras de tracking du casque | Bloque pour des raisons de securite / vie privee |
| Eye tracking | Pas expose de maniere standard dans WebXR navigateur sur la plupart des casques |
| Face tracking | Non standard via navigateur |
| Body tracking complet | Non standard via navigateur |
| Carte spatiale / mesh complet de la piece | Non disponible en WebXR standard navigateur |

Pour acceder a ces donnees avancees, il faudrait probablement passer par une application native casque ou un SDK constructeur, pas uniquement par une page web WebXR.

## Donnees envoyees aujourd'hui par OSCAR

Le front envoie les donnees seulement pendant une session WebXR immersive active, c'est-a-dire quand l'utilisateur est entre en mode VR. Le panneau de debug peut etre visible hors VR, mais les vraies donnees de pose XR sont produites par les frames WebXR en session immersive.

### Canal LiveKit

| Element | Valeur |
|:--|:--|
| Canal | LiveKit DataPacket |
| Topic | `oscar.xr.input` |
| Encodage | UTF-8 JSON |
| Fiabilite | `reliable: false` |
| Frequence cible | 30 Hz |
| Destination | Broadcast room, pas de `destinationIdentities` specifique |
| Source | Participant local du casque |
| Version payload | `v: 1` |

Le mode `reliable: false` est volontaire. Pour des commandes continues de robot, il vaut mieux perdre un paquet que recevoir trop tard une ancienne commande.

### Structure generale du payload

```json
{
  "v": 1,
  "type": "xr-input",
  "seq": 1542,
  "t": 523184.1667,
  "head": {
    "p": [0.0123, 1.6432, -0.0876],
    "q": [0.0011, -0.1532, 0.0042, 0.9882]
  },
  "controllers": [
    {
      "hand": "left",
      "mode": "tracked-pointer",
      "axes": [0, -0.84, 0.03, 0],
      "buttons": [
        { "p": false, "t": false, "v": 0 },
        { "p": true, "t": true, "v": 1 }
      ],
      "target": {
        "p": [-0.31, 1.32, -0.54],
        "q": [0.02, -0.33, 0.01, 0.94]
      },
      "grip": {
        "p": [-0.24, 1.18, -0.38],
        "q": [0.01, -0.25, 0.02, 0.97]
      }
    }
  ]
}
```

### Champs racine

| Champ | Type | Description |
|:--|:--|:--|
| `v` | number | Version du format. Actuellement `1`. |
| `type` | string | Type fonctionnel du paquet. Actuellement `xr-input`. |
| `seq` | number | Numero de sequence incremente cote front. Repart a zero au rechargement de page. |
| `t` | number | Timestamp WebXR en millisecondes. Ce n'est pas un timestamp Unix. |
| `head` | object ou `null` | Pose de la tete / viewer. |
| `controllers` | array | Liste des sources d'entree XR detectees sur la frame. |

### Transform XR

Les champs `head`, `target` et `grip` utilisent le meme format compact.

| Champ | Type | Unite | Description |
|:--|:--|:--|:--|
| `p` | `[x, y, z]` | metres | Position dans le repere WebXR courant. |
| `q` | `[x, y, z, w]` | quaternion | Orientation dans le repere WebXR courant. |

Les valeurs sont arrondies a 4 decimales pour reduire la taille des paquets.

Repere attendu :

| Axe | Sens WebXR usuel |
|:--|:--|
| `x` | gauche / droite |
| `y` | hauteur |
| `z` | avant / arriere selon reference space et orientation utilisateur |

Le backend doit considerer ce repere comme un repere casque local. La conversion vers le repere robot / ROS doit etre explicitement definie cote bridge.

### Head

| Champ | Description |
|:--|:--|
| `head.p` | Position de la tete dans l'espace XR. |
| `head.q` | Orientation de la tete en quaternion. |

Usage robot typique :

| Donnee | Exploitation possible |
|:--|:--|
| Rotation yaw | Tourner la tete/camera robot horizontalement |
| Rotation pitch | Incliner la camera robot verticalement |
| Rotation roll | Optionnel, souvent a ignorer ou filtrer |
| Position x/y/z | Optionnel en v1, utile pour analyses ou controle avance |

### Controllers

Chaque entree de `controllers` represente une source WebXR : manette gauche, manette droite, main trackee ou autre source.

| Champ | Type | Description |
|:--|:--|:--|
| `hand` | string | `left`, `right` ou `none`. |
| `mode` | string | Mode de rayon WebXR, souvent `tracked-pointer`. |
| `axes` | number[] | Axes gamepad : joysticks / trackpads. Mapping exact dependant du casque. |
| `buttons` | object[] | Etats des boutons, dans l'ordre donne par le navigateur. |
| `target` | transform ou `null` | Pose du rayon de pointage. |
| `grip` | transform ou `null` | Pose physique de la manette, si disponible. |

### Buttons

Chaque bouton est compresse comme suit :

| Champ | Type | Description |
|:--|:--|:--|
| `p` | boolean | Bouton presse. |
| `t` | boolean | Bouton touche / effleure. |
| `v` | number | Valeur analogique entre 0 et 1 quand disponible. |

### Axes

Les axes sont transmis sous forme de tableau numerique.

Les valeurs sont generalement dans l'intervalle `[-1, 1]`, mais le mapping exact depend du casque et du navigateur.

Recommandation backend :

| Action | Recommandation |
|:--|:--|
| Dead zone | Ignorer les valeurs faibles, par exemple entre `-0.08` et `0.08`. |
| Saturation | Clamp dans `[-1, 1]` avant conversion robot. |
| Mapping | Rendre configurable le mapping axes -> vitesse lineaire / angulaire. |
| Perte paquet | Toujours utiliser le dernier paquet recu, ne pas rejouer une file ancienne. |

## Donnees du panneau de debug

Le panneau de debug affiche une version lisible du dernier paquet local.

Il montre notamment :

| Element affiche | Origine |
|:--|:--|
| Etat `TRANSMIS` / `NON CONNECTE` | Retour local de publication LiveKit |
| Topic | Constante `oscar.xr.input` |
| Sequence | `payload.seq` |
| Cadence | `30 Hz` |
| Position tete | `payload.head.p` |
| Rotation tete | Conversion locale de `payload.head.q` vers roll / pitch / yaw en degres |
| Joysticks | `payload.controllers[].axes` |
| Boutons | `payload.controllers[].buttons` |
| Grip controleurs | `payload.controllers[].grip.p` si disponible |

Important : la rotation roll/pitch/yaw affichee dans le HUD est une aide de lecture. Le payload envoye au backend contient le quaternion brut, plus robuste pour les transformations 3D.

## Contrat backend minimal

Le backend doit rejoindre la room LiveKit avec un participant capable de recevoir les DataPackets.

Il doit filtrer les messages :

| Critere | Valeur |
|:--|:--|
| Topic | `oscar.xr.input` |
| Payload | UTF-8 JSON |
| `type` | `xr-input` |
| `v` | `1` |

Traitement conseille :

1. Ignorer tout message dont le topic n'est pas `oscar.xr.input`.
2. Decoder le payload en UTF-8.
3. Parser le JSON.
4. Verifier `v === 1` et `type === "xr-input"`.
5. Garder seulement le paquet le plus recent par participant casque.
6. Convertir `head.q` en orientation robot.
7. Convertir les axes joystick en commandes de vitesse.
8. Publier vers ROS selon les topics retenus par l'equipe robotique.

## Mapping ROS propose

Ce mapping est une proposition de depart, a valider avec l'equipe robot.

| Donnee OSCAR | Topic ROS possible | Message possible | Usage |
|:--|:--|:--|:--|
| `head.p`, `head.q` | `/oscar/operator/head_pose` | `geometry_msgs/PoseStamped` | Pose tete operateur |
| yaw/pitch derive de `head.q` | `/oscar/robot/head_cmd` | message custom ou `geometry_msgs/Vector3` | Orientation tete/camera robot |
| joystick gauche/droit | `/cmd_vel` | `geometry_msgs/Twist` | Deplacement base mobile |
| boutons actifs | `/oscar/operator/buttons` | message custom | Actions / modes |
| `controllers[].grip` | `/oscar/operator/controller_pose` | `geometry_msgs/PoseStamped[]` | Position controleurs |

## Recommandations de securite robot

Le backend ne doit jamais appliquer directement une commande sans garde-fous.

| Risque | Protection recommandee |
|:--|:--|
| Perte de paquets | Timeout si aucun paquet recent, par exemple 150 a 300 ms. |
| Deconnexion casque | Stop robot immediat ou passage en mode safe. |
| Axes instables | Dead zone et filtrage passe-bas leger. |
| Rotation tete brusque | Limiter vitesse et amplitude robot. |
| Sequence reset | Ne pas supposer que `seq` est global. Il est local a la page. |
| Horloge | Ne pas utiliser `t` comme heure absolue. Utiliser l'heure de reception backend pour les timeouts. |

## Evolutions possibles

| Evolution | Impact front | Impact backend |
|:--|:--|:--|
| Ajout hand tracking | Demander `hand-tracking` et publier les joints | Consommer un nouveau champ `hands` |
| Ajout profil controleur | Publier `profiles` WebXR | Adapter mapping par modele de controleur |
| Ajout calibration repere robot | Envoyer une matrice ou offset de calibration | Transformer WebXR local -> repere robot |
| Ajout haptics | Recevoir commandes backend -> declencher vibration controleur | Nouveau topic LiveKit backend -> casque |
| Ajout ack/debug backend | Backend publie etat de reception | Panneau HUD affiche latence et dernier ack |

## Points d'attention

- Les donnees de pose ne sont disponibles qu'en session WebXR active.
- Le navigateur du casque peut exposer des mappings d'axes differents selon le modele.
- `reliable: false` signifie que le backend ne doit pas s'attendre a recevoir tous les numeros `seq`.
- Le payload est optimise pour la latence, pas pour l'archivage.
- La conversion quaternion -> commande robot doit etre faite cote backend/ROS avec une convention de repere documentee.
- Le topic `oscar.xr.input` est le contrat stable v1.
