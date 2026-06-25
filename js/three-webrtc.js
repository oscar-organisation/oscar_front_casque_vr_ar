/**
 * OSCAR VR — Three.js Background & WebRTC Manager
 * Crée un environnement 3D ambiant + gestion flux WebRTC
 */

/* ══════════════════════════════════════════════
   THREE.JS — Ambient VR Background
══════════════════════════════════════════════ */
class OSCARBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.particles = null;
    this.grid      = null;
    this.clock     = new THREE.Clock();
    this.mouse     = new THREE.Vector2();

    this._init();
    this._bindEvents();
    this._animate();
  }

  _init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    this.camera.position.set(0, 0, 5);

    // Particules flottantes (étoiles / data points)
    const count = 800;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color(0x1E8FFF),
      new THREE.Color(0x00D4FF),
      new THREE.Color(0x1E3A6E),
      new THREE.Color(0x0D4080),
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
      sizes[i]       = Math.random() * 2.5 + 0.5;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      vertexColors: true,
      uniforms: { time: { value: 0 }, opacity: { value: 0.7 } },
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float time;
        void main(){
          vColor = color;
          vec3 p = position;
          p.y += sin(time * 0.3 + position.x * 0.5) * 0.15;
          p.x += cos(time * 0.2 + position.z * 0.3) * 0.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float opacity;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          if(d > 0.5) discard;
          float alpha = (1.0 - d * 2.0) * opacity;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);

    // Grille futuriste
    const gridHelper = new THREE.GridHelper(40, 30, 0x1E3A6E, 0x0D2040);
    gridHelper.position.y = -8;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
    this.grid = gridHelper;

    // Lumière ambiante
    const ambientLight = new THREE.AmbientLight(0x1E3A6E, 0.5);
    this.scene.add(ambientLight);

    // Point light bleu
    const pointLight = new THREE.PointLight(0x1E8FFF, 2, 20);
    pointLight.position.set(0, 5, 3);
    this.scene.add(pointLight);
    this.pointLight = pointLight;
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const t = this.clock.getElapsedTime();

    if (this.particles) {
      this.particles.material.uniforms.time.value = t;
      this.particles.rotation.y = t * 0.015;
      this.particles.rotation.x = Math.sin(t * 0.08) * 0.05;
    }

    if (this.grid) {
      this.grid.rotation.y = t * 0.005;
    }

    if (this.pointLight) {
      this.pointLight.position.x = Math.sin(t * 0.5) * 4;
      this.pointLight.position.z = Math.cos(t * 0.5) * 4;
      this.pointLight.intensity  = 1.5 + Math.sin(t * 2) * 0.5;
    }

    // Mouvement doux de caméra
    this.camera.position.x += (this.mouse.x * 0.3 - this.camera.position.x) * 0.02;
    this.camera.position.y += (-this.mouse.y * 0.2 - this.camera.position.y) * 0.02;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    });
  }
}


/* ══════════════════════════════════════════════
   THREE.JS — Scène VR 360 (Écran 5)
══════════════════════════════════════════════ */
class OSCARVR360 {
  constructor(canvasId) {
    this.canvas   = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(90, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.clock    = new THREE.Clock();
    this.isVR     = false;
    this.isDragging = false;
    this.lastMouse  = { x: 0, y: 0 };
    this.sphereYaw   = 0;
    this.spherePitch = 0;
    this.useStereo   = false;
    this.ipd         = 0.06;
    this.vignetteStrength = 0;
    this.motionIntensity = 0;
    this.lastViewYaw = 0;
    this.lastViewPitch = 0;
    this.controllers = [];
    this.vignetteEl  = document.getElementById('vr-vignette');
    this.stereoBtn   = document.getElementById('btn-stereo');
    this.vrEnterBtn  = document.getElementById('btn-vr-enter');
    this.hudEl       = document.querySelector('.vr-hud');
    this.comfortShell = document.getElementById('vr-comfort-shell');
    this.latencyPill = document.getElementById('vr-latency-pill');
    this.comfortMode = false;

    this._init();
    this._bindControls();
    this._animate();
  }

  _init() {
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x050A12);

    // Sphère 360° avec texture procédurale (simule le magasin)
    const geoSphere = new THREE.SphereGeometry(50, 64, 32);

    // Canvas texture procédurale simulant un couloir de supermarché
    const texCanvas = this._createStoreTexture();
    const texture   = new THREE.CanvasTexture(texCanvas);

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
    });

    this.sphere = new THREE.Mesh(geoSphere, mat);
    this.scene.add(this.sphere);

    // Sol
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x080E1A, side: THREE.DoubleSide });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -5;
    this.scene.add(floor);

    this.camera.position.set(0, 0, 0);
    this.leftCamera = new THREE.PerspectiveCamera(90, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
    this.rightCamera = new THREE.PerspectiveCamera(90, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
    this.leftCamera.position.set(-this.ipd / 2, 0, 0);
    this.rightCamera.position.set(this.ipd / 2, 0, 0);

    // VR Support WebXR (si disponible)
    if ('xr' in navigator) {
      this.renderer.xr.enabled = true;
      this.renderer.xr.setReferenceSpaceType('local');
    }

    this._setupXRControllers();
    this.enterComfortMode(false);
    this._syncHUD();
  }

  _createStoreTexture() {
    const w = 2048, h = 1024;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    // Fond sombre
    ctx.fillStyle = '#060C18';
    ctx.fillRect(0, 0, w, h);

    // Plafond lumineux
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, h * 0.3);
    ceilGrad.addColorStop(0, '#E8F0FF');
    ceilGrad.addColorStop(1, '#1A2840');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, w, h * 0.3);

    // Lumières néon sur le plafond
    for (let i = 0; i < 8; i++) {
      const x = (i / 8) * w + w / 16;
      const lg = ctx.createRadialGradient(x, h * 0.1, 0, x, h * 0.1, 120);
      lg.addColorStop(0, 'rgba(200,220,255,0.9)');
      lg.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - 120, 0, 240, h * 0.3);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 40, 0, 80, 10);
    }

    // Rayons de gauche
    for (let row = 0; row < 5; row++) {
      const y = h * 0.3 + row * h * 0.1;
      // Étagères
      ctx.fillStyle = `hsl(220, 30%, ${15 + row * 3}%)`;
      ctx.fillRect(0, y, w * 0.25, h * 0.08);
      ctx.fillRect(0, y, w * 0.25, 4);

      // Produits colorés
      for (let p = 0; p < 20; p++) {
        const hue = (p * 37 + row * 73) % 360;
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.85)`;
        ctx.fillRect(p * (w * 0.012), y + 6, w * 0.01, h * 0.07);
      }
    }

    // Rayons de droite
    for (let row = 0; row < 5; row++) {
      const y = h * 0.3 + row * h * 0.1;
      ctx.fillStyle = `hsl(220, 30%, ${15 + row * 3}%)`;
      ctx.fillRect(w * 0.75, y, w * 0.25, h * 0.08);
      ctx.fillRect(w * 0.75, y, w * 0.25, 4);

      for (let p = 0; p < 20; p++) {
        const hue = (p * 53 + row * 41) % 360;
        ctx.fillStyle = `hsla(${hue}, 65%, 55%, 0.85)`;
        ctx.fillRect(w * 0.75 + p * (w * 0.012), y + 6, w * 0.01, h * 0.07);
      }
    }

    // Allée centrale (sol)
    const floorGrad = ctx.createLinearGradient(w * 0.25, h * 0.5, w * 0.75, h);
    floorGrad.addColorStop(0, '#1A2030');
    floorGrad.addColorStop(1, '#0A1020');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(w * 0.25, h * 0.5, w * 0.5, h * 0.5);

    // Perspective lignes
    ctx.strokeStyle = 'rgba(100,130,170,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.45);
      ctx.lineTo(w * 0.2 + i * w * 0.08, h);
      ctx.stroke();
    }

    return c;
  }

  updateCameraOrientation(yaw, pitch) {
    this.sphereYaw   = yaw;
    this.spherePitch = pitch;
    this.setMotionIntensity(0.18);
  }

  toggleStereo() {
    this.useStereo = !this.useStereo;
    this._syncHUD();
  }

  enterComfortMode(force = true) {
    this.comfortMode = force;
    if (this.comfortShell) {
      this.comfortShell.style.display = this.comfortMode ? 'block' : 'none';
    }
    if (this.hudEl) {
      this.hudEl.classList.toggle('vr-comfort-active', this.comfortMode);
    }
  }

  updateLatency(latencyMs) {
    if (this.latencyPill) {
      const label = latencyMs < 80 ? 'Faible' : latencyMs < 180 ? 'Correct' : 'Élevée';
      this.latencyPill.textContent = `Latence WebRTC · ${Math.round(latencyMs)} ms (${label})`;
    }
  }

  _syncHUD() {
    if (this.stereoBtn) {
      this.stereoBtn.classList.toggle('active', this.useStereo);
    }
    if (this.vrEnterBtn) {
      this.vrEnterBtn.classList.toggle('active', this.isVR);
    }
  }

  setMotionIntensity(intensity) {
    this.motionIntensity = Math.min(0.6, Math.max(this.motionIntensity, intensity));
  }

  _setupXRControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.addEventListener('selectstart', () => this._handleXRAction('trigger'));
      controller.addEventListener('squeezestart', () => this._handleXRAction('squeeze'));
      this.scene.add(controller);

      const grip = this.renderer.xr.getControllerGrip(i);
      this.scene.add(grip);
      this.controllers.push({ controller, grip });
    }
  }

  _handleXRAction(action) {
    if (action === 'trigger') {
      this.toggleStereo();
    } else if (action === 'squeeze') {
      this.sphereYaw = 0;
      this.spherePitch = 0;
    }
  }

  _updateControllerInput() {
    this.controllers.forEach(({ controller }) => {
      if (!controller.gamepad) return;
      const [x, y] = controller.gamepad.axes;
      if (Math.abs(x) > 0.15) this.sphereYaw -= x * 0.012;
      if (Math.abs(y) > 0.15) this.spherePitch -= y * 0.012;
    });
  }

  _renderScene() {
    if (!this.useStereo) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const halfWidth = width / 2;
    const aspect = width / height;

    this.leftCamera.aspect = aspect;
    this.rightCamera.aspect = aspect;
    this.leftCamera.updateProjectionMatrix();
    this.rightCamera.updateProjectionMatrix();

    this.renderer.setScissorTest(true);

    this.renderer.setScissor(0, 0, halfWidth, height);
    this.renderer.setViewport(0, 0, halfWidth, height);
    this.renderer.render(this.scene, this.leftCamera);

    this.renderer.setScissor(halfWidth, 0, halfWidth, height);
    this.renderer.setViewport(halfWidth, 0, halfWidth, height);
    this.renderer.render(this.scene, this.rightCamera);

    this.renderer.setScissorTest(false);
  }

  _bindControls() {
    const el = this.canvas;

    // Drag mouse
    el.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup',  () => { this.isDragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.sphereYaw   -= dx * 0.004;
      this.spherePitch -= dy * 0.003;
      this.spherePitch  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.spherePitch));
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    // Touch pour VR / mobile
    el.addEventListener('touchstart', (e) => {
      this.isDragging = true;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });
    el.addEventListener('touchend', () => { this.isDragging = false; });
    el.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;
      this.sphereYaw   -= dx * 0.005;
      this.spherePitch -= dy * 0.004;
      this.spherePitch  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.spherePitch));
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    // Resize
    window.addEventListener('resize', () => {
      const w = this.canvas.parentElement.clientWidth;
      const h = this.canvas.parentElement.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.leftCamera.aspect = w / h;
      this.rightCamera.aspect = w / h;
      this.leftCamera.updateProjectionMatrix();
      this.rightCamera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    // DeviceOrientation (gyroscope casque VR)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.alpha !== null) {
          this.sphereYaw   = THREE.MathUtils.degToRad(-e.alpha);
          this.spherePitch = THREE.MathUtils.degToRad(e.beta - 90) * 0.5;
          this.setMotionIntensity(0.22);
        }
      });
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const t = this.clock.getElapsedTime();

    this._updateControllerInput();

    // Rotation caméra
    const euler = new THREE.Euler(this.spherePitch, this.sphereYaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    if (this.leftCamera && this.rightCamera) {
      this.leftCamera.quaternion.copy(this.camera.quaternion);
      this.rightCamera.quaternion.copy(this.camera.quaternion);
      this.leftCamera.position.set(-this.ipd / 2, 0, 0);
      this.rightCamera.position.set(this.ipd / 2, 0, 0);
    }

    // Légère oscillation ambiante
    this.sphere.rotation.y = Math.sin(t * 0.03) * 0.01;

    const turnSpeed = Math.abs(this.sphereYaw - this.lastViewYaw) + Math.abs(this.spherePitch - this.lastViewPitch);
    if (turnSpeed > 0.001) {
      this.motionIntensity = Math.min(0.6, this.motionIntensity + turnSpeed * 0.6);
    } else {
      this.motionIntensity = Math.max(0, this.motionIntensity - 0.025);
    }

    this.vignetteStrength = this.motionIntensity;
    if (this.vignetteEl) {
      this.vignetteEl.style.opacity = `${Math.min(0.55, 0.12 + this.vignetteStrength)}`;
    }

    if (this.latencyPill) {
      const simulatedLatency = 32 + Math.abs(Math.sin(t * 0.7)) * 40;
      this.updateLatency(simulatedLatency);
    }
    this.lastViewYaw = this.sphereYaw;
    this.lastViewPitch = this.spherePitch;

    this._renderScene();
  }

  async enterVRMode() {
    if (navigator.xr) {
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (supported) {
          const session = await navigator.xr.requestSession('immersive-vr');
          this.renderer.xr.setSession(session);
          this.renderer.xr.setReferenceSpaceType('local');
          this.isVR = true;
          this.enterComfortMode(true);
          this._syncHUD();
          session.addEventListener('end', () => {
            this.isVR = false;
            this.enterComfortMode(false);
            this._syncHUD();
          });
          return true;
        }
      } catch (e) {
        console.warn('[OSCAR VR] WebXR non disponible:', e.message);
      }
    }
    return false;
  }
}


/* ══════════════════════════════════════════════
   WEBRTC — Gestionnaire de flux caméras
══════════════════════════════════════════════ */
class OSCARWebRTC {
  constructor() {
    this.peerConnections = new Map();
    this.localStream     = null;
    this.remoteStream    = null;
    this.isConnected     = false;
    this.statusCallbacks = [];

    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  async connectToCamera(cameraId, videoElement) {
    try {
      this._updateStatus('connecting', `Connexion à ${cameraId}...`);

      const pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.peerConnections.set(cameraId, pc);

      // Gérer les flux entrants
      pc.ontrack = (event) => {
        if (videoElement && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          this.remoteStream = event.streams[0];
          this._updateStatus('connected', `Flux ${cameraId} actif`);
          this.isConnected = true;
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE state (${cameraId}):`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          this._updateStatus('error', `Flux ${cameraId} interrompu`);
          this.isConnected = false;
        }
      };

      // Pour la démo : simuler une connexion réussie avec getUserMedia
      await this._simulateConnection(cameraId, videoElement);

      return pc;
    } catch (err) {
      this._updateStatus('error', `Erreur: ${err.message}`);
      throw err;
    }
  }

  async _simulateConnection(cameraId, videoElement) {
    // En production: remplacer par le vrai signaling serveur
    // Ici on simule avec la webcam locale ou un flux vide
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080, facingMode: 'environment' },
        audio: false,
      });
      this.localStream = stream;
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
      }
      this.isConnected = true;
      this._updateStatus('connected', `Flux ${cameraId} simulé (webcam locale)`);
    } catch (e) {
      // Pas de webcam disponible — afficher un message
      console.warn('[WebRTC] Webcam indisponible, mode démo activé');
      this._updateStatus('demo', `Mode démo — pas de flux réel`);
    }
  }

  async createOffer(cameraId) {
    const pc = this.peerConnections.get(cameraId);
    if (!pc) throw new Error('Connexion non trouvée');

    const offer = await pc.createOffer({ offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    return offer;
  }

  async handleAnswer(cameraId, answer) {
    const pc = this.peerConnections.get(cameraId);
    if (!pc) throw new Error('Connexion non trouvée');
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  disconnect(cameraId) {
    const pc = this.peerConnections.get(cameraId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(cameraId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.isConnected = false;
    this._updateStatus('disconnected', 'Déconnecté');
  }

  disconnectAll() {
    for (const id of this.peerConnections.keys()) {
      this.disconnect(id);
    }
  }

  onStatusChange(cb) { this.statusCallbacks.push(cb); }

  _updateStatus(state, message) {
    this.statusCallbacks.forEach(cb => cb({ state, message }));
  }

  getStats(cameraId) {
    const pc = this.peerConnections.get(cameraId);
    if (!pc) return null;
    return pc.getStats();
  }
}

// Export global
window.OSCARBackground = OSCARBackground;
window.OSCARVR360      = OSCARVR360;
window.OSCARWebRTC     = OSCARWebRTC;
