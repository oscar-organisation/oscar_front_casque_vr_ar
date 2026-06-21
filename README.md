# OSCAR VR — Assistant Visuel Intelligent

Interface VR 360° pour la surveillance de magasin, développée avec HTML5, CSS3, Three.js et WebRTC.

---

## 📁 Structure du projet

```
oscar-vr/
├── index.html              ← Application principale (6 écrans)
├── css/
│   └── oscar.css           ← Design system VR-first
├── js/
│   ├── three-webrtc.js     ← Three.js (background + scène 360°) + WebRTC
│   └── app.js              ← Contrôleur principal de l'application
└── oscar-vr.code-workspace ← Workspace VS Code
```

---

## 🚀 Lancer le projet

### Option 1 — Live Server (VS Code) ✅ Recommandé
1. Ouvrir VS Code
2. Installer l'extension **Live Server** (ritwickdey.liveserver)
3. Clic droit sur `index.html` → **"Open with Live Server"**
4. URL : `http://127.0.0.1:5500`

> ⚠️ Ne pas ouvrir `index.html` directement dans le navigateur (`file://`)  
> WebRTC et DeviceOrientation nécessitent un serveur HTTP.

### Option 2 — Node.js
```bash
cd oscar-vr
npx serve .
# → http://localhost:3000
```

### Option 3 — Python
```bash
cd oscar-vr
python3 -m http.server 8080
# → http://localhost:8080
```

---

## 🥽 Utilisation sur casque VR

### Meta Quest 2/3/Pro
1. Ouvrir le **navigateur intégré** (Oculus Browser)
2. Naviguer vers l'URL de votre machine (ex: `http://192.168.1.X:5500`)
3. Le gyroscope sera automatiquement détecté pour la rotation de la vue 360°

### Pico 4
Même procédure avec Pico Browser.

### WebXR (si supporté)
Si le casque supporte WebXR, un bouton "Entrer en VR" apparaîtra automatiquement dans l'écran 5.

---

## 📱 Accès depuis le réseau local (casque / mobile)

```bash
# Trouver votre IP locale
ipconfig   # Windows
ifconfig   # Mac/Linux

# Lancer avec accès réseau
npx serve -l 5500 --no-clipboard .
# Accéder depuis le casque : http://192.168.X.X:5500
```

> Pour HTTPS (requis par certains navigateurs VR pour DeviceOrientation) :
```bash
npx serve -l 443 --ssl-cert cert.pem --ssl-key key.pem .
```

---

## 🎮 Navigation dans l'application

| Écran | Description | Déclencheur |
|-------|-------------|-------------|
| **1** | Authentification | Email + mot de passe → Se connecter |
| **2** | Sélection caméra | Cliquer une caméra → Accéder à la vue |
| **3** | Chargement WebRTC | Automatique (barre de progression) |
| **4** | Tutoriel VR | Première connexion uniquement |
| **5** | Vue 360° immersive | Cliquer sur les annotations pour les détails |
| **6** | Détail anomalie | Actions rapides → Retour |

### Contrôles Écran 5
- **Souris / Touch** : Cliquer-glisser pour regarder autour
- **Gyroscope VR** : Mouvement de tête automatique
- **Zoom** : Bouton bas → bascule entre ×1 et ×1.5
- **Mode nuit** : Filtre sépia pour environnements sombres
- **Recentrer** : Remet le regard à 0°

---

## 🔌 Intégration WebRTC réelle

Pour connecter de vraies caméras IP, modifier `js/three-webrtc.js` :

```javascript
// Remplacer _simulateConnection() par votre signaling serveur
async connectToCamera(cameraId, videoElement) {
  // 1. Créer une offre SDP
  const offer = await pc.createOffer({ offerToReceiveVideo: true });
  await pc.setLocalDescription(offer);
  
  // 2. Envoyer l'offre à votre serveur WebSocket
  socket.emit('offer', { cameraId, sdp: offer });
  
  // 3. Recevoir la réponse
  socket.on('answer', async ({ sdp }) => {
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  });
  
  // 4. ICE candidates
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('ice-candidate', { cameraId, candidate });
  };
}
```

### Serveur signaling suggéré
- [Mediasoup](https://mediasoup.org/) pour la production
- [simple-peer](https://github.com/feross/simple-peer) pour les tests

---

## 🛠️ Technologies

| Tech | Usage |
|------|-------|
| **Three.js r128** | Background 3D animé + scène VR 360° |
| **WebRTC API** | Flux vidéo des caméras en temps réel |
| **WebXR API** | Support natif casques VR (Meta Quest, Pico) |
| **DeviceOrientation API** | Rotation de la vue par gyroscope |
| **CSS custom properties** | Design system cohérent |
| **Exo 2 / Share Tech Mono** | Typographie VR lisible |

---

## 🔮 Évolutions possibles

- [ ] Connexion WebSocket pour le signaling multi-caméras
- [ ] Streaming RTSP → WebRTC avec [FFmpeg](https://ffmpeg.org/)
- [ ] Détection d'anomalies en temps réel (TensorFlow.js)
- [ ] Annotations 3D positionnées dans l'espace Three.js
- [ ] Mode stéréoscopique (œil gauche / droit) pour l'immersion totale
- [ ] Enregistrement et replay des sessions

---

## ⚠️ Prérequis navigateur

| Fonctionnalité | Chrome | Firefox | Oculus Browser | Safari |
|----------------|--------|---------|----------------|--------|
| Three.js | ✅ | ✅ | ✅ | ✅ |
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| WebXR | ✅ | ✅ | ✅ | ❌ |
| DeviceOrientation | ✅ | ✅ | ✅ | ✅* |

*Safari nécessite une permission utilisateur pour DeviceOrientation.
