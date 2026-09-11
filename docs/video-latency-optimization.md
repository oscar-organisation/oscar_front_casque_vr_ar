# Video latency: measurement and optimization

## Observed baseline (2026-07-24)

Physical ROSMASTER path:

`Orbbec DaBai DCW2 -> ROS 2 Image -> Python LiveKit publisher -> LiveKit SFU -> browser/Quest`

Measured facts:

- LiveKit publisher and viewers negotiate direct UDP with the SFU on port 7882.
- Robot-to-SFU RTT was about 25 ms; command transport measured about 40-45 ms on average.
- The Orbbec launch profile is configured for 640x480 RGB at 10 fps.
- With the full perception/navigation stack active, the ROS image subscriber received about 5.9 fps.
- ROS image age before LiveKit averaged about 103 ms and reached 765 ms.
- Suspending only the object detector raised reception to about 10 fps.
- The Jetson Nano was using 273% container CPU; all four CPU cores were generally 75-88% busy.
- The Python LiveKit publisher used software OpenH264 and repeatedly reported skipped frames.

Conclusion: Internet quality can add RTT, jitter, loss, and congestion delay, but it was not the main source of the observed 500-600 ms. Camera/ROS queueing and software encoding on a saturated Jetson were dominant.

## Low-risk changes

1. Publish at the camera's real 10 fps instead of requesting 15 fps.
2. Forward each camera frame at most once; do not re-encode duplicates.
3. Use RGB24 instead of expanding every RGB frame to RGBA, reducing frame-copy volume by 25%.
4. Use ROS `KEEP_LAST(depth=1)` for teleoperation. Old frames are dropped instead of accumulating up to 500 ms in a five-frame sensor queue.
5. Request zero additional browser playout delay where the browser supports it.
6. Record WebRTC jitter-buffer, decode, RTT, packet-loss, PLI/NACK, and selected-transport metrics in the browser console.

## Recommended runtime profile

For manual teleoperation, run camera, base control, LiveKit media, and LiveKit commands. Disable SLAM, Nav2, and object detection unless the current task needs them. Those services can be restored for autonomous or perception tests.

Target for the current software path:

- 640x480, 10 fps, H.264, 1.0-1.5 Mbps
- UDP end to end
- ROS queue depth 1
- Browser jitter buffer under 100 ms in a stable network

## Quality upgrade path

The current Python SDK falls back to software OpenH264 on this Jetson. Raising resolution while keeping that path will increase CPU use and latency. The correct next step for 720p or higher quality is hardware H.264 encoding:

1. Capture 1280x720 (or 640x480 first for validation).
2. Convert to NVMM and encode with Jetson `nvv4l2h264enc` in low-latency mode (no B-frames, short GOP, CBR/VBR tuned for WebRTC).
3. Publish the pre-encoded H.264 stream through a LiveKit client path that accepts encoded frames. LiveKit's Rust SDK explicitly supports NVIDIA Jetson hardware H.264/H.265; the existing Python raw-frame path does not expose this advantage.
4. Compare glass-to-glass latency, CPU, packet loss, and visual quality before making it the default.

Useful primary references:

- [LiveKit self-hosted ports and UDP media](https://docs.livekit.io/transport/self-hosting/ports-firewall/)
- [LiveKit media publishing options](https://docs.livekit.io/transport/media/publish/)
- [WebRTC receiver statistics](https://www.w3.org/TR/webrtc-stats/)
- [NVIDIA accelerated GStreamer on Jetson](https://docs.nvidia.com/jetson/archives/r35.1/DeveloperGuide/text/SD/Multimedia/AcceleratedGstreamer.html)
- [LiveKit Rust SDK hardware encoder support](https://github.com/livekit/rust-sdks)
- [Orbbec ROS 2 wrapper](https://github.com/orbbec/OrbbecSDK_ROS2)

## Campagne de mesure du 28/08/2026 (ROSMASTER M3, Jetson Nano B01)

Toutes les optimisations logicielles listées plus haut etaient deja appliquees
(10 fps reels, image la plus recente uniquement, RGB24, QoS KEEP_LAST(1)
BEST_EFFORT, bitrate plafonne, jitterBufferTarget=0 cote navigateur). Le
chemin restant a ete mesure avec `isaac-sim/oscar_latency_probe.py`, dans le
depot `oscar_script_simulateur_robot`.

### Cause dominante identifiee : famine CPU, pas lenteur de l encodeur

Au demarrage de la campagne, 38 noeuds ROS tournaient simultanement. Nav2,
slam_toolbox, le detecteur d objets et le pont MQTT consommaient ensemble plus
d un coeur entier sur les quatre disponibles. Charge moyenne : 13,7.

L encodeur H.264 logiciel signalait des abandons d images en continu
(`iContinualSkipFrames`). Apres liberation du CPU, ces abandons ont
completement disparu **sans changer une ligne de code d encodage**. L encodeur
n etait pas trop lent pour 640x480 : il etait prive de processeur.

### Resultats (profil teleoperation applique)

| Grandeur                       | Avant     | Apres        |
|--------------------------------|-----------|--------------|
| Cadence camera recue           | 4,5 fps   | 8,4-8,8 fps  |
| Intervalle moyen entre images  | 221 ms    | 114-121 ms   |
| Intervalle maximum             | 901 ms    | 257-304 ms   |
| Gigue (ecart-type)             | 166 ms    | 46-60 ms     |
| Etalement de l age des images  | > 2450 ms | 128 ms       |
| Cadence publiee vers LiveKit   | 4,4 fps   | 8,2-9,4 fps  |
| Images abandonnees a l encodage| continues | aucune       |
| Charge (4 coeurs)              | 13,7      | 3,97         |

Maillons hors robot, mesures le meme jour : RTT vers le SFU 20 ms avec 0 % de
perte, SFU a 6 % de CPU. Ni le reseau ni le serveur ne limitent la chaine.

### Precaution de mesure : l age absolu n est pas exploitable

L horodatage pose par le pilote camera et l horloge systeme derivent l un par
rapport a l autre (NTP actif). Des mesures successives ont donne un age median
de 16, 93, 156 puis 120 ms alors que chaque distribution restait tres
resserree : c est un decalage d horloge, pas une variation reelle de latence.

La sonde rapporte donc **l etalement (max - min)** comme metrique de reference,
insensible a tout decalage constant. L age absolu n est conserve qu a titre
indicatif. Toute comparaison avant/apres doit se faire sur l etalement, la
cadence, la gigue et le nombre d images abandonnees.

### Conclusion sur l encodage materiel

Il n est pas necessaire en 640x480. La piste NVENC (`nvv4l2h264enc`) ne se
justifie qu au-dela, pour du 720p ou plus. Elle imposerait de quitter le SDK
Python, qui n accepte que des images brutes, au profit du SDK Rust.

La voie LiveKit Ingress (WHIP ou RTMP) est a ecarter : le service transcode
systematiquement, ce qui ajouterait de la latence et de la charge serveur. Le
passthrough sans reencodage reste une demande non implementee (livekit/ingress
issue #69).

### Reste a traiter

- Etalement encore a 128 ms pour une cible de 50 ms. Principal suspect restant :
  le pilote Orbbec lui-meme (`component_container`, 39 % de CPU a lui seul,
  decodage MJPG vers RGB en logiciel).
- Cadence plafonnee a 8,4-8,8 fps pour 10 fps configures.
- Mesure glass-to-glass complete a relever cote navigateur (jitterBufferDelay,
  framesDecoded, RTT) pour attribuer les millisecondes restantes.
- Conflit sur `/cmd_vel` : le `velocity_smoother` de Nav2 publie sur ce meme
  topic (`-r cmd_vel_smoothed:=cmd_vel`) et entre en concurrence avec l agent
  de teleoperation quand la navigation tourne. Le profil teleoperation supprime
  le conflit ; une correction durable demanderait un remapping.

### Outils livres

- `oscar_script_simulateur_robot/isaac-sim/oscar_latency_probe.py` : sonde en
  lecture seule (cadence, gigue,
  etalement, charge, liste des noeuds concurrents).
- `oscar_script_simulateur_robot/isaac-sim/oscar-teleop-profile.sh` : applique
  le profil teleoperation, verifie que
  la chaine OSCAR reste vivante. Reversible par `docker restart m3pro`.

## Profil teleoperation rendu permanent (28/08/2026)

### Mecanisme

Un drapeau opt-in a ete ajoute au demarrage du conteneur. Sans lui, le
comportement d origine est stricitement conserve.

- `container_autostart.sh` : nouvelle variable `ROBLAUDE_OSCAR_TELEOP_ONLY`
  (defaut `false`). A `true`, elle saute `mqtt_bridge`, `mission_executor` et
  `mapping_supervisor`. Sauvegardes : `container_autostart.sh.avant-oscar` et
  `container_autostart.sh.bak-<horodatage>`.
- `Docker_M3Pro_Joy.sh` : passe `ROBLAUDE_OSCAR_TELEOP_ONLY=true` au conteneur.
  Sauvegarde : `Docker_M3Pro_Joy.sh.bak-<horodatage>`.
- Le mode reste `minimal`, donc ni SLAM, ni Nav2, ni detecteur au demarrage.
  La camera est lancee par la section OSCAR, qui en a besoin.

Journal de demarrage attendu :

    [autostart] profil OSCAR teleop : mqtt_bridge / mission_executor / mapping_supervisor non lances
    [autostart] ▶ lance camera
    [autostart] ▶ lance oscar_media avec reconnexion
    [autostart] ▶ lance oscar_commands avec reconnexion

### Services hote desactives

`apt-daily.timer`, `apt-daily-upgrade.timer`, `snapd.service`, `snapd.socket`,
`ModemManager`, `whoopsie`, `apport`.

Conserves volontairement : `bluetooth` (manette de teleoperation) et
`avahi-daemon` (resolution du nom d hote). Le bureau graphique est conserve
aussi : 522 Mo de RAM mais moins de 2 % de CPU au repos, donc sans effet sur le
goulot mesure.

### Mesures apres demarrage propre

| Grandeur                | Avant campagne | Profil permanent |
|-------------------------|----------------|------------------|
| Cadence camera          | 4,5 fps        | 8,8 fps          |
| Intervalle maximum      | 901 ms         | 203 ms           |
| Gigue (ecart-type)      | 166 ms         | 36 ms            |
| Etalement de l age      | > 2450 ms      | 103 ms           |
| Cadence publiee LiveKit | 4,4 fps        | 8,3-8,8 fps      |
| Charge (moyenne 5 min)  | 13,7           | 4,4              |

### Revenir en arriere

Restaurer navigation, perception et MQTT, de facon durable :

    # sur le robot
    cp ~/Docker_M3Pro_Joy.sh.bak-<horodatage> ~/Docker_M3Pro_Joy.sh
    bash ~/Docker_M3Pro_Joy.sh

Ou ponctuellement, sans modifier de fichier :

    ROBLAUDE_OSCAR_TELEOP_ONLY=false bash ~/Docker_M3Pro_Joy.sh

Reactiver un service hote : `sudo systemctl enable --now <service>`.

## Deuxieme palier : camera en couleur seule (28/08/2026)

### Constat

Le pilote Orbbec capturait trois flux — couleur, profondeur et infrarouge —
et publiait aussi deux nuages de points. Releve des abonnes :

    /camera/color/image_raw            1 abonne  (agent OSCAR)
    /camera/depth/image_raw            0 abonne
    /camera/depth/points               0 abonne
    /camera/depth_registered/points    0 abonne
    /camera/ir/image_raw               0 abonne

La DaBai DCW2 est connectee en **USB 2.0** (confirme par le pilote :
`usb connect type: USB2.0`). Les trois flux se partageaient donc une bande
passante limitee, et `depth_registration:=true` imposait en plus un alignement
profondeur/couleur par pixel — le tout pour aucun consommateur.

### Effet

Le gain n est pas d abord processeur (29 % -> 27 % sur le pilote) mais
**bande passante USB** : la couleur cesse d etre concurrencee.

| Grandeur              | Profil teleop | + couleur seule |
|-----------------------|---------------|-----------------|
| Cadence camera        | 8,8 fps       | 10,0 fps        |
| Intervalle moyen      | 114 ms        | 100 ms          |
| Gigue (ecart-type)    | 36 ms         | 8 ms            |
| Etalement de l age    | 103 ms        | 6 a 18 ms       |
| Charge (4 coeurs)     | 4,4           | 1,4 a 2,1       |

Cote spectateur, mesure depuis un abonne LiveKit distant :

| Grandeur           | Avant | Apres |
|--------------------|-------|-------|
| Cadence recue      | 9,1 fps | 9,5 fps |
| Intervalle maximum | 301 ms  | 272 ms  |
| Gigue              | 26 ms   | 16 a 22 ms |

### Mise en permanence

`container_autostart.sh` lance desormais, quand `ROBLAUDE_OSCAR_TELEOP_ONLY`
vaut `true`, le pilote Orbbec directement avec :

    enable_depth:=false enable_ir:=false
    enable_point_cloud:=false enable_colored_point_cloud:=false
    depth_registration:=false

Sinon, le lancement d origine `roblaude_nav camera.launch.py` est conserve
intact, avec profondeur et infrarouge, pour la navigation et le pick and place.
Sauvegarde : `container_autostart.sh.bak-cam-<horodatage>`.

Validation apres redemarrage complet du conteneur : 0 flux profondeur, 0 flux
infrarouge, couleur seule, chaine OSCAR relancee automatiquement.

## Bilan de la campagne

| Grandeur                | Depart    | Final     |
|-------------------------|-----------|-----------|
| Cadence camera          | 4,5 fps   | 8,8-10 fps|
| Etalement de l age      | > 2450 ms | 6-18 ms   |
| Gigue acquisition       | 166 ms    | 8-41 ms   |
| Cadence publiee LiveKit | 4,4 fps   | 8,2-9,5 fps |
| Cadence recue spectateur| non mesuree | 9,5 fps |
| Images abandonnees      | continues | aucune    |
| Charge (4 coeurs)       | 13,7      | 1,4-2,1   |

Le reseau et le SFU ne limitent rien : la cadence recue egale la cadence
publiee et la gigue diminue meme en transit (36 ms au robot, 16 a 22 ms chez
le spectateur). Aucune optimisation de transport ou de codec n est justifiee.

### Ce qui n a pas ete fait, et pourquoi

L encodage materiel NVENC reste inutile en 640x480 : une fois le processeur
libere, l encodeur logiciel n abandonne plus aucune image. Il ne se justifierait
qu au-dela de cette resolution, et imposerait de quitter le SDK Python.

### Prochaine etape de mesure

La chaine est instrumentee du capteur jusqu a la reception. Il manque le
dernier segment : buffer de lecture, decodage et affichage dans le casque. Le
front collecte deja `jitterBufferDelay`, `framesDecoded` et le RTT ; il reste a
les relever pendant une session casque pour obtenir un glass-to-glass complet.
