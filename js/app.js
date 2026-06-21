/**
 * OSCAR VR — Application Controller
 * Gère la navigation entre les 6 écrans et la logique métier
 */

class OSCARApp {
  constructor() {
    this.currentScreen   = 1;
    this.selectedCamera  = null;
    this.webrtc          = new OSCARWebRTC();
    this.vr360           = null;
    this.bgScene         = null;
    this.progressTimer   = null;
    this.progressValue   = 0;
    this.nightMode       = false;
    this.zoomLevel       = 1;

    this.cameras = [
      { id: 'cam-boissons', name: 'Caméra Rayon Boissons', location: 'Allée 2',          status: 'online'       },
      { id: 'robot-3',      name: 'Robot Allée 3',          location: 'Allée 3',          status: 'online'       },
      { id: 'cam-reserve',  name: 'Caméra Réserve',         location: 'Réserve',          status: 'maintenance'  },
    ];

    this.annotations = [
      { id: 'ann-1', type: 'yellow', title: 'Mauvais placement',  sub: 'Produit mal positionné',        left: '9%',  top: '32%', screen: 5 },
      { id: 'ann-2', type: 'red',    title: 'Rupture de stock',   sub: 'Coca-Cola 1.5L — Stock: 0',     left: '22%', top: '40%', screen: 5 },
      { id: 'ann-3', type: 'green',  title: 'Stock OK',           sub: 'Sprite 1.5L — Stock: 24',       left: '43%', top: '34%', screen: 5 },
      { id: 'ann-4', type: 'yellow', title: 'Zone encombrée',     sub: 'Allée partiellement bloquée',   left: '57%', top: '42%', screen: 5 },
      { id: 'ann-5', type: 'blue',   title: 'Client',             sub: 'Distance: 5m',                  left: '72%', top: '30%', screen: 5 },
    ];

    this._init();
  }

  _init() {
    // Background Three.js
    this.bgScene = new OSCARBackground('three-canvas');

    // Setup WebRTC status listener
    this.webrtc.onStatusChange(({ state, message }) => {
      this._updateWebRTCBadge(state, message);
    });

    // Gaze cursor VR
    this._initGazeCursor();

    // Bind all interactions
    this._bindScreens();

    // Horloge temps réel
    this._startClock();

    // Afficher écran 1
    this.showScreen(1);
  }

  /* ── Navigation ─────────────────────────────────────────── */
  showScreen(num, data = {}) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${num}`);
    if (target) {
      target.classList.add('active');
      this.currentScreen = num;

      if (num === 3) this._startProgress(data.camera);
      if (num === 5) this._initImmersiveScreen();
      if (num === 6 && data.annotation) this._populateAnomalyDetail(data.annotation);
    }
  }

  /* ── Écran 1: Auth ─────────────────────────────────────── */
  _bindScreens() {
    // Screen 1
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const email = document.getElementById('input-email').value;
        const pass  = document.getElementById('input-pass').value;
        if (email && pass) {
          this._animateBtn(loginBtn, 'Connexion...');
          setTimeout(() => this.showScreen(2), 1000);
        } else {
          this._shakeInput('input-email');
        }
      });
    }

    // Enter key on inputs
    document.querySelectorAll('.form-input').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-login')?.click();
      });
    });

    // Screen 2
    document.querySelectorAll('.camera-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.camera-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedCamera = card.dataset.cameraId;
      });
    });

    const btnImmersive = document.getElementById('btn-immersive');
    if (btnImmersive) {
      btnImmersive.addEventListener('click', () => {
        if (!this.selectedCamera) {
          // Sélectionner le premier par défaut
          const first = document.querySelector('.camera-card');
          if (first) { first.click(); return; }
        }
        const cam = this.cameras.find(c => c.id === this.selectedCamera) || this.cameras[0];
        this.showScreen(3, { camera: cam });
      });
    }

    // Screen 3 — pas de bouton, auto-avance

    // Screen 4
    const btnStart = document.getElementById('btn-start-vr');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.showScreen(5));
    }

    // Screen 5 — sidebar
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.target === 'quitter') this.showScreen(2);
        if (btn.dataset.target === 'carte')   this._showToast('Carte du magasin — fonctionnalité bientôt disponible');
        if (btn.dataset.target === 'alertes') this.showScreen(6, { annotation: this.annotations[1] });
      });
    });

    // Bottom actions screen 5
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => this._handleZoom());
    document.getElementById('btn-night')?.addEventListener('click', () => this._toggleNight());
    document.getElementById('btn-recenter')?.addEventListener('click', () => this._recenter());

    // Annotations screen 5 → screen 6
    document.querySelectorAll('.annotation').forEach(ann => {
      ann.addEventListener('click', () => {
        const id = ann.dataset.annotId;
        const data = this.annotations.find(a => a.id === id);
        if (data) this.showScreen(6, { annotation: data });
      });
    });

    // Screen 6
    document.getElementById('btn-back')?.addEventListener('click', () => this.showScreen(5));
    document.getElementById('btn-traiter')?.addEventListener('click', () => {
      this._showToast('✓ Anomalie marquée comme traitée');
      setTimeout(() => this.showScreen(5), 1500);
    });
    document.getElementById('btn-notifier')?.addEventListener('click', () => {
      this._showToast('📢 Employé notifié avec succès');
    });
    document.getElementById('btn-historique')?.addEventListener('click', () => {
      this._showToast('Historique — fonctionnalité bientôt disponible');
    });
  }

  /* ── Screen 3: Progress ──────────────────────────────────── */
  _startProgress(camera) {
    this.progressValue = 0;
    clearInterval(this.progressTimer);

    const ring  = document.querySelector('.progress-ring-fill');
    const label = document.querySelector('.progress-ring-label');
    const name  = document.querySelector('.progress-source-name');
    const sub   = document.querySelector('.progress-source-sub');

    const circumference = 2 * Math.PI * 70; // r=70
    if (ring) ring.style.strokeDasharray = circumference;

    if (name && camera) name.textContent = camera.name;
    if (sub  && camera) sub.textContent  = camera.location;

    this.progressTimer = setInterval(() => {
      this.progressValue += Math.random() * 8 + 3;
      if (this.progressValue >= 100) {
        this.progressValue = 100;
        clearInterval(this.progressTimer);

        // Avancer vers screen 4 (première fois) ou screen 5
        setTimeout(() => {
          const firstTime = !sessionStorage.getItem('oscar-tutorial-done');
          if (firstTime) {
            sessionStorage.setItem('oscar-tutorial-done', '1');
            this.showScreen(4);
          } else {
            this.showScreen(5);
          }
        }, 600);
      }

      if (label) label.textContent = `${Math.round(this.progressValue)}%`;
      if (ring) {
        const offset = circumference * (1 - this.progressValue / 100);
        ring.style.strokeDashoffset = offset;
      }
    }, 180);

    // Connexion WebRTC
    this.webrtc.connectToCamera(camera?.id || 'cam-1', null);
  }

  /* ── Screen 5: Immersive ─────────────────────────────────── */
  _initImmersiveScreen() {
    if (!this.vr360) {
      this.vr360 = new OSCARVR360('immersive-canvas');
    }
    this._positionAnnotations();
  }

  _positionAnnotations() {
    this.annotations.forEach(ann => {
      const el = document.querySelector(`[data-annot-id="${ann.id}"]`);
      if (el) {
        el.style.left = ann.left;
        el.style.top  = ann.top;
        el.style.animationDelay = Math.random() * 0.4 + 's';
      }
    });
  }

  /* ── Screen 6: Anomaly ───────────────────────────────────── */
  _populateAnomalyDetail(ann) {
    const title = document.getElementById('anomaly-product-name');
    if (title && ann.type === 'red') {
      title.textContent = 'Coca-Cola 1.5L';
    }
  }

  /* ── VR Controls ─────────────────────────────────────────── */
  _handleZoom() {
    this.zoomLevel = this.zoomLevel === 1 ? 1.5 : 1;
    if (this.vr360) {
      this.vr360.camera.fov = this.zoomLevel === 1 ? 90 : 50;
      this.vr360.camera.updateProjectionMatrix();
    }
    const btn = document.getElementById('btn-zoom-out');
    if (btn) {
      btn.classList.toggle('active', this.zoomLevel > 1);
      btn.querySelector('span').textContent = this.zoomLevel > 1 ? 'Zoom ×1.5' : 'Zoom';
    }
  }

  _toggleNight() {
    this.nightMode = !this.nightMode;
    const btn = document.getElementById('btn-night');
    if (btn) btn.classList.toggle('active', this.nightMode);
    document.body.style.filter = this.nightMode ? 'sepia(0.4) hue-rotate(180deg) brightness(0.7)' : '';
    this._showToast(this.nightMode ? '🌙 Mode nuit activé' : '☀️ Mode normal');
  }

  _recenter() {
    if (this.vr360) {
      this.vr360.sphereYaw   = 0;
      this.vr360.spherePitch = 0;
    }
    this._showToast('Vue recentrée');
  }

  /* ── Gaze Cursor VR ─────────────────────────────────────── */
  _initGazeCursor() {
    const cursor = document.createElement('div');
    cursor.className = 'gaze-cursor';
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    });

    // Hover detection
    document.addEventListener('mouseover', (e) => {
      const interactive = e.target.closest('button, .camera-card, .annotation, .action-btn, .nav-item, .sidebar-btn, .bottom-action, .back-btn');
      cursor.classList.toggle('hovering', !!interactive);
    });
  }

  /* ── Clock ──────────────────────────────────────────────── */
  _startClock() {
    const update = () => {
      const now = new Date();
      const hh  = String(now.getHours()).padStart(2, '0');
      const mm  = String(now.getMinutes()).padStart(2, '0');
      const ss  = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${hh}:${mm}:${ss}`;
      document.querySelectorAll('.vr-time').forEach(el => { el.textContent = timeStr; });
    };
    update();
    setInterval(update, 1000);
  }

  /* ── WebRTC Badge ───────────────────────────────────────── */
  _updateWebRTCBadge(state, message) {
    const badge = document.getElementById('webrtc-badge');
    if (!badge) return;
    const dot = badge.querySelector('.webrtc-dot');
    const txt = badge.querySelector('span');
    if (txt) txt.textContent = message;
    const colors = { connected: '#22C55E', connecting: '#F59E0B', error: '#EF4444', demo: '#7A92BB', disconnected: '#3D5070' };
    if (dot) dot.style.background = colors[state] || colors.disconnected;
    badge.style.borderColor = (colors[state] || '#3D5070') + '33';
    badge.style.color = colors[state] || '#7A92BB';
  }

  /* ── Utils ──────────────────────────────────────────────── */
  _animateBtn(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    btn.style.opacity = '0.8';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.style.opacity = '1';
      btn.disabled = false;
    }, 1200);
  }

  _shakeInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake 0.4s cubic-bezier(0.4,0,0.2,1)';
    el.parentElement.querySelector('svg')?.style && (el.parentElement.querySelector('svg').style.color = '#EF4444');
    setTimeout(() => {
      el.style.animation = '';
      if (el.parentElement.querySelector('svg')) el.parentElement.querySelector('svg').style.color = '';
    }, 500);
  }

  _showToast(message) {
    const existing = document.querySelector('.oscar-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'oscar-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(8,18,35,0.95); border: 1px solid rgba(30,143,255,0.4);
      color: #E8F0FF; padding: 14px 28px; border-radius: 100px;
      font-family: 'Exo 2', sans-serif; font-size: 16px; font-weight: 600;
      z-index: 9999; white-space: nowrap;
      animation: toastIn 0.3s cubic-bezier(0.4,0,0.2,1) both;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(30,143,255,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s cubic-bezier(0.4,0,0.2,1) both';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
}

// Keyframes dynamiques
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes toastOut {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to   { opacity: 0; transform: translateX(-50%) translateY(10px); }
  }
`;
document.head.appendChild(style);

// Init au chargement
window.addEventListener('DOMContentLoaded', () => {
  window.oscar = new OSCARApp();
});
