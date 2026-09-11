# Acces reseau OSCAR via Tailscale

Installe le 07/09/2026. Supprime la dependance a l adresse IP locale des
machines, qui changeait a chaque changement de reseau Wi-Fi et imposait un scan
du sous-reseau avant chaque intervention.

## Adresses fixes

| Machine        | Nom Tailscale    | IP fixe          | Acces                          |
|----------------|------------------|------------------|--------------------------------|
| Robot M3       | `oscar-robot-m3` | `100.78.49.123`  | `ssh jetson@100.78.49.123`     |
| VPS OSCAR      | `oscar-vps`      | `100.73.151.122` | `ssh ubuntu@100.73.151.122`    |

Ces adresses ne changent plus, quel que soit le reseau des machines.

## Ce que cela resout

- **Plus de scan reseau.** L adresse du robot est stable.
- **SSH depuis un reseau restrictif.** Quand l UDP est bloque (mesure sur le
  Wi-Fi de l ecole : UDP sortant et TCP 7881 fermes, seul le 443 passe),
  Tailscale bascule sur ses relais DERP en TCP/443 et la connexion tient.

## Ce que cela ne resout pas tel quel

Le flux video LiveKit. Le robot joint `stream-livekit.oscar-bot.com` par
l internet public, en dehors du tunnel. Sur un reseau bloquant l UDP, WebRTC
reste impossible sans passer par le noeud de sortie ci-dessous.

## Noeud de sortie (contournement des reseaux bloquants)

Le VPS est configure pour servir de noeud de sortie : routage IP active,
`--advertise-exit-node` pose, et optimisation `rx-udp-gro-forwarding`
appliquee sur `ens3` (service `tailscale-udp-gro.service`, persistant).

**Approbation requise une fois** dans la console :
`login.tailscale.com/admin/machines` -> `oscar-vps` -> Edit route settings ->
Use as exit node.

Le robot utilise desormais `oscar-vps` comme noeud de sortie permanent. Ce
reglage Tailscale survit aux redemarrages et permet a WebRTC et NTP de passer
meme lorsque le Wi-Fi ne laisse sortir que TCP/443.

Utilisation depuis un poste operateur sur un reseau bloquant :

    tailscale up --exit-node=oscar-vps
    # pour revenir en direct :
    tailscale up --exit-node=

Tout le trafic passe alors par le VPS, en empruntant le tunnel Tailscale qui
traverse lui-meme le port 443. WebRTC redevient possible depuis l ecole, sans
avoir a deployer un serveur TURN.

## Recuperation automatique apres changement de reseau

`oscar-network-recovery.timer` controle toutes les 20 secondes l interface
physique, la passerelle et l adresse IPv4 du robot. Les metriques de route et
les interfaces virtuelles sont ignorees. Apres un changement, il attend le
retour du DNS puis relance uniquement les agents LiveKit. Les moteurs, la
camera et la pile ROS ne sont pas redemarres. Une fermeture bloquee est forcee
apres 10 secondes.

Les agents quittent aussi explicitement leur session lorsque LiveKit signale
une deconnexion. Leurs fermetures sont bornees, afin que la supervision puisse
toujours les relancer.
