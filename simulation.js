// ============================================================================
// SIMULATION.JS - ENGINE 3D FRANCHISE MUNCHIES (FINAL STABLE & ZERO F12 ERROR)
// ============================================================================
// Fitur & Perbaikan Utama:
// 1. Klik Kiri di Mode Jelajah: Langsung menyambung kembali ke mode game penuh
//    tanpa kursor (seperti awal), dan mengambil/menaruh makanan saat terkunci.
// 2. Tahan Klik Kanan (Hold RMB) di Mode Jelajah: Menengok bebas sementara
//    posisi kursor tetap diam di tempat (tidak bergeser ke mana-mana), dan
//    kembali normal tepat di titik yang sama saat Klik Kanan dilepas.
// 3. Gerobak 100% Utuh Saat Didorong (hanya Standing Banner yang diam).
// 4. Optimasi 60 FPS (Static Matrix Freezing + Smart Backface Culling) &
//    Proteksi Penuh Anti-Error di F12 Console.
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 0. DEKLARASI VARIABEL & VEKTOR REUSABLE (ZERO GARBAGE COLLECTION!)
  // --------------------------------------------------------------------------
  let currentModel = null;
  let creamLogoTexture = null;
  let currentMode = 'ORBIT';
  let activeOutletType = 'booth_portable';

  let showDimensions = false;
  let showEquipmentCard = false;

  let grabbableObjects = [];
  let floorBoxes = [];
  let obstacleBoxes = [];
  let allInspectableMeshes = [];
  let activeFloatingTags = [];

  let vehicleControllers = [];
  let hoveredVehicleCtrl = null;
  let activeVehicleCtrl = null;

  let hoveredGrabObj = null;
  let heldObject = null;
  let navbarTimeout = null;
  let hudHelpTimer = null;
  let drivePromptTimer = null;
  let hideDrivePromptAfterTimeout = false;

  // State khusus Tahan Klik Kanan (Hold RMB Look dengan kursor tetap diam)
  let isRightMouseHolding = false;
  let isRmbHoldLock = false;
  let prevMouseDragX = 0;
  let prevMouseDragY = 0;

  let lookTouchId = null;
  let prevTouchX = 0;
  let prevTouchY = 0;

  // State Analog Joystick Bulat (Multi-Touch Kiri Bawah & Setengah Layar Kiri)
  let analogTouchId = null;
  let analogMouseActive = false;
  let analogOriginX = 0;
  let analogOriginY = 0;
  let analogForward = 0.0;
  let analogRight = 0.0;
  const ANALOG_MAX_RADIUS = 40;

  let frameCounter = 0;

  const EYE_HEIGHT = 1.65;
  const COLLISION_RADIUS = 0.40;
  const GRAVITY = 15.5;
  const JUMP_VELOCITY = 5.3;
  let playerVelY = 0.0;
  let isPlayerGrounded = true;

  // Vektor pre-allocated agar tidak memicu lag memori setiap frame
  const _forwardDir = new THREE.Vector3();
  const _rightDir = new THREE.Vector3();
  const _moveVec = new THREE.Vector3();
  const _upVec = new THREE.Vector3(0, 1, 0);
  const _downVec = new THREE.Vector3(0, -1, 0);
  const _worldFwd = new THREE.Vector3();
  const _seatWorldPos = new THREE.Vector3();
  const _camDir = new THREE.Vector3();
  const _targetSpotWorld = new THREE.Vector3();
  const _toSpot = new THREE.Vector3();
  const _rayOrigin = new THREE.Vector3();
  const _projVec = new THREE.Vector3();
  const _spinQuat = new THREE.Quaternion();
  const _zeroVec2 = new THREE.Vector2(0, 0);

  const moveState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false
  };

  // Elemen Kursor Statis (Muncul diam di tempat saat Tahan Klik Kanan di Mode Jelajah)
  const frozenCursor = document.createElement('div');
  frozenCursor.id = 'frozen-rmb-cursor';
  frozenCursor.style.cssText =
    'position:fixed;width:20px;height:20px;pointer-events:none;z-index:9999;display:none;transform:translate(-2px,-2px);';
  frozenCursor.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M4 2L20 11L12 13L9 21L4 2Z" fill="#FFFFFF" stroke="#111111" stroke-width="2" stroke-linejoin="round"/>' +
    '</svg>';
  document.body.appendChild(frozenCursor);

  function hideFrozenCursor() {
    frozenCursor.style.display = 'none';
    if (container) container.style.cursor = '';
  }

  function resetAnalogStick() {
    analogTouchId = null;
    analogMouseActive = false;
    analogForward = 0.0;
    analogRight = 0.0;
    const knob = document.getElementById('analog-knob');
    const base = document.getElementById('dpad-container');
    if (knob) {
      knob.style.transform = 'translate3d(0px, 0px, 0px)';
      knob.classList.remove('active');
    }
    if (base) {
      base.classList.remove('active');
      base.style.transform = 'translate3d(0px, 0px, 0px)';
    }
  }

  function resetMoveState() {
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
    moveState.sprint = false;
    isRightMouseHolding = false;
    isRmbHoldLock = false;
    lookTouchId = null;
    resetAnalogStick();
    hideFrozenCursor();
  }

  function addEvt(elOrId, evt, handler, opts) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (el && typeof el.addEventListener === 'function') {
      el.addEventListener(evt, handler, opts);
    }
  }

  // Referensi DOM
  const container = document.getElementById('canvas-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');
  const activeOutletPill = document.getElementById('active-outlet-pill');
  const crosshair = document.getElementById('crosshair');
  const grabPrompt = document.getElementById('grab-prompt');
  const hudHelp = document.getElementById('hud-help');
  const dimLabelsContainer = document.getElementById('dimension-labels-container');
  const objMeasureHud = document.getElementById('object-measure-hud');

  const topRightDimCard = document.getElementById('top-right-dim-card');
  const topRightEquipCard = document.getElementById('top-right-equip-card');
  const dimSpecPanel = document.getElementById('dim-spec-panel');
  const equipSpecPanel = document.getElementById('equip-spec-panel');
  const btnQuickDim = document.getElementById('btn-quick-dim');
  const btnQuickEquip = document.getElementById('btn-quick-equip');
  const btnCloseDimCard = document.getElementById('btn-close-dim-card');
  const btnCloseEquipCard = document.getElementById('btn-close-equip-card');

  const mainNavbar = document.getElementById('main-navbar');
  const topHoverSensor = document.getElementById('top-hover-sensor');
  const navbarPullHint = document.getElementById('navbar-pull-hint');
  const leftSidebar = document.getElementById('left-sidebar');
  const btnOpenSidebar = document.getElementById('btn-open-sidebar');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const sidebarTeleportSection = document.getElementById('sidebar-teleport-section');
  const trikeSubSwitch = document.getElementById('trike-sub-switch');
  const trikeVariantBtns = document.querySelectorAll('.trike-variant-btn');

  const btnOrbit = document.getElementById('btn-mode-orbit');
  const btnFps = document.getElementById('btn-mode-fps');
  const btnResetCenter = document.getElementById('btn-reset-center');
  const btnQuickCenter = document.getElementById('btn-quick-center');
  const btnMobToggleMode = document.getElementById('btn-mob-toggle-mode');
  const btnMobGrab = document.getElementById('btn-mob-grab');
  const outletBtns = document.querySelectorAll('.outlet-btn');
  const teleportBtns = document.querySelectorAll('.teleport-btn');

  if (hudHelp) hudHelp.style.transition = 'opacity 0.5s ease';
  if (grabPrompt) grabPrompt.style.transition = 'opacity 0.4s ease';

  function showHudHelpTemporary(htmlContent, durationMs = 8000) {
    if (!hudHelp) return;
    hudHelp.innerHTML = htmlContent;
    hudHelp.style.display = 'block';
    hudHelp.style.opacity = '1';
    clearTimeout(hudHelpTimer);
    hudHelpTimer = setTimeout(() => {
      hudHelp.style.opacity = '0';
      setTimeout(() => {
        if (hudHelp.style.opacity === '0') hudHelp.style.display = 'none';
      }, 500);
    }, durationMs);
  }

  function triggerDrivePromptAutoHide(durationMs = 8000) {
    hideDrivePromptAfterTimeout = false;
    if (grabPrompt) grabPrompt.style.opacity = '1';
    clearTimeout(drivePromptTimer);
    drivePromptTimer = setTimeout(() => {
      hideDrivePromptAfterTimeout = true;
    }, durationMs);
  }

  // --------------------------------------------------------------------------
  // 1. SENSOR NAVBAR ATAS & SIDEBAR
  // --------------------------------------------------------------------------
  function showTopNavbar() {
    clearTimeout(navbarTimeout);
    if (mainNavbar) mainNavbar.classList.add('visible');
    if (navbarPullHint) navbarPullHint.style.opacity = '0';
  }

  function hideTopNavbarDelayed() {
    navbarTimeout = setTimeout(() => {
      if (mainNavbar) mainNavbar.classList.remove('visible');
      if (navbarPullHint) navbarPullHint.style.opacity = '1';
    }, 420);
  }

  addEvt(topHoverSensor, 'mouseenter', showTopNavbar);
  addEvt(navbarPullHint, 'mouseenter', showTopNavbar);
  addEvt(navbarPullHint, 'click', () => {
    if (mainNavbar && mainNavbar.classList.contains('visible')) hideTopNavbarDelayed();
    else showTopNavbar();
  });
  addEvt(mainNavbar, 'mouseenter', showTopNavbar);
  addEvt(mainNavbar, 'mouseleave', hideTopNavbarDelayed);

  addEvt(window, 'mousemove', (e) => {
    if (e.clientY <= 10 && e.clientX > 350) showTopNavbar();
  });

  function setSidebarOpen(isOpen) {
    if (!leftSidebar) return;
    if (isOpen) {
      leftSidebar.classList.add('open');
      if (window.innerWidth <= 768) {
        setDimensionsVisibility(false);
        setEquipmentVisibility(false);
      }
    } else {
      leftSidebar.classList.remove('open');
    }
    updateCameraViewportCenter();
  }

  if (window.innerWidth <= 768 && leftSidebar) {
    leftSidebar.classList.remove('open');
  }

  addEvt(btnOpenSidebar, 'click', () => setSidebarOpen(true));
  addEvt(btnCloseSidebar, 'click', () => setSidebarOpen(false));

  function toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }
  addEvt('btn-sidebar-fullscreen', 'click', toggleFullScreen);
  addEvt('btn-quick-fullscreen', 'click', toggleFullScreen);

  // --------------------------------------------------------------------------
  // 2. INISIALISASI SCENE, CAMERA, & RENDERER (BEBAS ERROR F12 & HIGH FPS)
  // --------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdbe7f0);
  scene.fog = new THREE.FogExp2(0xdbe7f0, 0.0045);

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.12, 320);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    precision: 'mediump'
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.15));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  if (container) container.appendChild(renderer.domElement);

  // Bungkus requestPointerLock agar TIDAK PERNAH memunculkan SecurityError di F12 Console
  // (misalnya saat user menekan klik tepat setelah menekan ESC)
  const rawReqPointerLock = renderer.domElement.requestPointerLock
    ? renderer.domElement.requestPointerLock.bind(renderer.domElement)
    : null;
  if (rawReqPointerLock) {
    renderer.domElement.requestPointerLock = function () {
      try {
        const res = rawReqPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
        return res;
      } catch (_) {
        return null;
      }
    };
  }

  function safeExitPointerLock() {
    try {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } catch (_) {}
  }

  // Nonaktifkan menu klik kanan bawaan browser di atas kanvas 3D
  addEvt(renderer.domElement, 'contextmenu', (e) => e.preventDefault());

  let currentBuildingCenter = new THREE.Vector3(0, 1.1, 0);
  let currentOrbitCamPos = new THREE.Vector3(0, 2.2, 4.5);

  function updateCameraViewportCenter() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    const isSidebarOpen = leftSidebar && leftSidebar.classList.contains('open');
    if (isSidebarOpen && w > 900 && currentMode === 'ORBIT') {
      camera.setViewOffset(w, h, -135, 0, w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const ambientLight = new THREE.AmbientLight(0xfff6e6, 0.66);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xfffdf8, 0xb89468, 0.54);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfff0d4, 0.92);
  dirLight.position.set(-22, 38, 28);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  const d = 42;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.bias = -0.0008;
  scene.add(dirLight);

  // --------------------------------------------------------------------------
  // 3. TEKSTUR LOGO.PNG BERLATAR KREM
  // --------------------------------------------------------------------------
  function applyLogoTextureToScene() {
    if (!creamLogoTexture || !currentModel) return;
    currentModel.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m && m.name && m.name.toLowerCase().includes('logo')) {
            m.map = creamLogoTexture;
            m.emissiveMap = null;
            m.emissive.setHex(0x000000);
            m.color.setHex(0xffffff);
            m.needsUpdate = true;
          }
        });
      }
    });
  }

  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.onload = () => {
    const cvs = document.createElement('canvas');
    cvs.width = logoImg.width || 512;
    cvs.height = logoImg.height || 345;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#F9EEDD';
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(logoImg, 0, 0, cvs.width, cvs.height);
    creamLogoTexture = new THREE.CanvasTexture(cvs);
    creamLogoTexture.encoding = THREE.sRGBEncoding;
    creamLogoTexture.flipY = false;
    applyLogoTextureToScene();
  };
  logoImg.src = 'Logo.png';

  // --------------------------------------------------------------------------
  // 4. DATA SPESIFIKASI UKURAN & FASILITAS MITRA (6 OUTLET + GABUNGAN)
  // --------------------------------------------------------------------------
  const dimensionGroup3D = new THREE.Group();
  scene.add(dimensionGroup3D);

  const OUTLET_PARTNER_DATA = {
    'booth_portable': {
      tierSummary: 'Paket Reguler 1 — Booth Event & Teras Minimarket (Portable Knock-Down)',
      specs: [
        ['Panjang × Lebar Meja Booth', '1,30 m × 0,68 m'],
        ['Tinggi Meja Kerja', '0,88 Meter'],
        ['Tinggi Total + Header', '2,08 Meter'],
        ['Tebal Kaca Sneeze Guard', 'L-Shape 35 cm (Depan & Samping)'],
        ['Kebutuhan Lahan Minimum', '2,00 m × 1,50 m']
      ],
      equipment: [
        '1 Unit Meja Booth Lipat Portable Rangka Besi Hollow & Panel Kayu Tahan Air',
        '1 Set Papan Header Atas Berlogo Munchies + 2 Tiang Penyangga Besi',
        '1 Set Kaca Pelindung Makanan (Sneeze Guard L-Shape Transparan)',
        '1 Unit Kompor Panggang / Griddle Satu Tungku + Wajan Datar Besi Cor',
        '1 Unit Peniris & Wadah Gorengan Stainless + 1 Cetakan Pancong 6 Lubang',
        '3 Botol Saus/Selai Squeeze (Chocomaltine, Srikaya, Susu Kental Manis)',
        '1 Set Talenan Kayu, Spatula, Capitan, & Rak Kemasan Bawah Meja',
        '3 Poster Menu Depan 1:1 (Roti Bakar, Pancong Lumer, Pisang Goreng)'
      ],
      lines: [
        { p1: [-0.65, 2.15, 0.0],  p2: [0.65, 2.15, 0.0],  text: '↔ Panjang Booth Portabel: 1,30 m (130 cm)' },
        { p1: [-0.78, 0.0, 0.0],   p2: [-0.78, 2.08, 0.0], text: '⇕ Tinggi Total + Header: 2,08 m' },
        { p1: [0.75, 0.10, -0.34], p2: [0.75, 0.10, 0.34], text: '↔ Lebar Meja: 0,68 m (68 cm)' },
        { p1: [0.0, 0.96, 0.42],   p2: [0.0, 0.96, 0.42],  text: 'Tinggi Meja Kerja: 88 cm + Kaca Sneeze Guard 35 cm' }
      ]
    },
    'gerobak': {
      tierSummary: 'Paket Reguler 2 — Gerobak Dagang Dorong Modern (Street Food Mangkal)',
      specs: [
        ['Panjang Bodi Gerobak', '1,80 m (Total + Gagang 2,06 m)'],
        ['Lebar Bodi Gerobak', '0,80 Meter (Dengan Roda 0,94 m)'],
        ['Tinggi Meja Masak', '0,88 Meter'],
        ['Tinggi Atap Kanopi', '2,12 Meter (Bentang Atap 2,16 m)'],
        ['Roda & Penggerak', '2 Roda Jari-Jari Besar Ø 56 cm + 1 Castor']
      ],
      equipment: [
        '1 Unit Gerobak Kayu & Besi Beroda (2 Roda Utama Ø 56 cm + 1 Roda Putar Belakang)',
        '1 Set Atap Kanopi Pelindung Hujan Lebar 2,16 m + Fascia Logo Munchies',
        '1 Unit Etalase Kaca 2 Tingkat (Display Roti, Pisang, & Bahan Baku)',
        '1 Unit Deep Fryer Gas Stainless + Keranjang Tirisan Kawat',
        '1 Unit Flat Griddle Panggang Roti + 1 Cetakan Pancong Lumer Aluminium',
        '1 Set Tabung Gas LPG 3 Kg + Regulator & Selang Aman di Kolong Gerobak',
        '4 Botol Saus Topping, Toples Keju/Regal, & 3 Poster Menu di Dinding Bawah',
        '1 Papan Iklan Standing Banner Trotoar + 2 Bangku Pelanggan'
      ],
      lines: [
        { p1: [-0.90, 2.22, 0.0],  p2: [0.90, 2.22, 0.0],  text: '↔ Panjang Bodi Gerobak: 1,80 m (Atap 2,16 m)' },
        { p1: [-1.15, 0.0, 0.0],   p2: [-1.15, 2.12, 0.0], text: '⇕ Tinggi Gerobak + Kanopi: 2,12 m' },
        { p1: [1.05, 0.30, -0.45], p2: [1.05, 0.30, 0.45], text: '↔ Lebar Gerobak + Roda: 0,94 m' },
        { p1: [-0.62, 1.35, 0.46], p2: [-0.62, 1.35, 0.46],text: 'Etalase Kaca 2 Tingkat: 42 cm × 68 cm × T 56 cm' }
      ]
    },
    'trike_terbuka': {
      tierSummary: 'Paket Reguler 3A — Sepeda/Motor Listrik Kargo (Mode Mangkal Jualan)',
      specs: [
        ['Panjang Total Kendaraan', '2,45 Meter (Roda Tiga Stabil)'],
        ['Ukuran Boks Kargo Belakang', '1,25 m × 0,88 m × T 0,92 m'],
        ['Lebar Rentang Sayap Buka', '1,90 Meter (Meja Kiri & Kanan)'],
        ['Diameter Payung Penjual', 'Ø 2,30 Meter (Tinggi 2,55 m)'],
        ['Daya & Penggerak', 'Motor Listrik + Baterai 48V + Pengecas']
      ],
      equipment: [
        '1 Unit Sepeda/Motor Listrik Kargo Roda Tiga (3-Wheel Electric Trike) Siap Jalan',
        '1 Set Boks Dapur Belakang Sistem Sayap Lipat (Gullwing) + 2 Meja Samping Lipat',
        '1 Unit Payung Dagang Segi Delapan Lebar Ø 2,30 m (Warna Hijau-Emas Munchies)',
        '1 Unit Etalase Kaca Mini + Kompor Griddle Roti & Cetakan Pancong Terintegrasi',
        '1 Unit Deep Fryer Mini + Rak Botol Saus Topping di Atas Meja Kargo',
        '3 Papan Menu Foto 1:1 di Atas Penutup Boks yang Terbuka Tegak',
        '1 Set Lampu Depan LED, Layar Speedometer Digital, & Keranjang Depan'
      ],
      lines: [
        { p1: [-1.20, 0.40, 0.0],  p2: [1.15, 0.40, 0.0],  text: '↔ Panjang Total Motor Listrik Kargo: 2,45 m' },
        { p1: [0.42, 0.95, -0.95], p2: [0.42, 0.95, 0.95], text: '↔ Rentang Meja Sayap Terbuka: 1,90 m' },
        { p1: [0.15, 2.62, 0.0],   p2: [0.15, 2.62, 0.0],  text: 'Payung Penjual Segi Delapan: Ø 2,30 m × Tinggi 2,55 m' }
      ]
    },
    'trike_tertutup': {
      tierSummary: 'Paket Reguler 3B — Sepeda/Motor Listrik Kargo (Mode Tertutup Siap Jalan)',
      specs: [
        ['Panjang Total Kendaraan', '2,45 Meter'],
        ['Lebar Boks Saat Tertutup', '0,90 Meter (Aman Masuk Gang)'],
        ['Tinggi Boks Kargo Rapat', '1,12 Meter dari Tanah'],
        ['Payung Penjual', 'Terlipat Rapi di Sisi Kiri Boks'],
        ['Simulasi Mengendarai', 'Bisa Dikendarai di Mode Gabungan Kota']
      ],
      equipment: [
        '1 Unit Sepeda/Motor Listrik Kargo Roda Tiga dalam Posisi Boks Terkunci Rapat',
        'Seluruh Alat Masak, Etalase, & Botol Saus Tersimpan Aman di Dalam Boks Kargo',
        'Payung Dagang Terlipat Rapi pada Bracket Samping Kiri Boks',
        '3 Panel Branding Menu & Logo Munchies di Sisi Kiri, Kanan, dan Belakang Boks',
        'Di Mode Kompleks Gabungan Kota, Arahkan ke Jok/Stang Lalu Tekan [F] untuk Mengendarai'
      ],
      lines: [
        { p1: [-1.20, 0.40, 0.0],  p2: [1.15, 0.40, 0.0],  text: '↔ Panjang Total Kendaraan: 2,45 m' },
        { p1: [0.42, 1.18, -0.45], p2: [0.42, 1.18, 0.45], text: '↔ Lebar Boks Tertutup Rapat: 0,90 m' },
        { p1: [0.42, 0.0, 0.55],   p2: [0.42, 1.12, 0.55], text: '⇕ Tinggi Boks Kargo: 1,12 m' }
      ]
    },
    'kontainer': {
      tierSummary: 'Paket Premium 1 — Semi-Container Island Booth + 4 Set Meja Kursi Outdoor',
      specs: [
        ['Ukuran Booth Kontainer', '2,50 m × 2,00 m'],
        ['Tinggi Booth + Atap', '2,50 m (Tinggi Dalam 2,40 m)'],
        ['Tinggi Meja Kerja Dapur', '0,85 m (Meja Bar Luar 1,00 m)'],
        ['Lebar Jendela Layanan', '2,30 m × 1,10 m (Kanopi Hidrolik)'],
        ['Area Duduk Outdoor', '4,50 m × 3,50 m (4 Meja + 16 Kursi)'],
        ['Kebutuhan Lahan Total', '6,50 m × 4,50 m']
      ],
      equipment: [
        '1 Unit Booth Kontainer Baja Berinsulasi (2,5 m × 2,0 m) dengan Jendela Kanopi Hidrolik',
        '4 Set Meja Makan Lipat Kayu + 16 Kursi Lipat Besi-Kayu untuk Area Dine-In Outdoor',
        '1 Set Tiang & Rangkaian Lampu Taman Gantung (Warm Festoon String Lights)',
        '1 Set Meja Kerja Dapur L-Shape Full Stainless Steel + Wastafel Cuci Tangan & Keran',
        '1 Unit Mesin Kasir POS Layar Sentuh Ganda + Laci Uang & Printer Struk',
        '1 Unit Deep Fryer Komersial + 1 Griddle Roti Bakar Besar + 1 Kompor Pancong Lumer',
        '1 Unit Kulkas Under-Counter Chiller + Exhaust Fan Dinding Belakang + Papan A-Board',
        '6 Lightbox Menu Foto Menyala di Atas Jendela Layanan + Neon Box Logo Atap'
      ],
      lines: [
        { p1: [-1.25, 2.68, 1.02], p2: [1.25, 2.68, 1.02],  text: '↔ Panjang Kontainer: 2,50 m (250 cm)' },
        { p1: [-1.42, 0.0, 1.02],  p2: [-1.42, 2.50, 1.02], text: '⇕ Tinggi Kontainer: 2,50 m (250 cm)' },
        { p1: [-1.35, 0.15, -1.00],p2: [-1.35, 0.15, 1.00], text: '↔ Lebar Dalam: 2,00 m (200 cm)' },
        { p1: [0.0, 0.97, 1.25],   p2: [0.0, 0.97, 1.25],   text: 'Tinggi Meja Dapur: 85 cm | Bar Luar: 100 cm' },
        { p1: [1.80, 0.85, 2.15],  p2: [5.60, 0.85, 2.15],  text: '↔ Zona 4 Meja & 16 Kursi Lipat: 3,80 m × 3,50 m' }
      ]
    },
    'ruko': {
      tierSummary: 'Paket Premium 2 — Outlet Ruko Permanen (Show Kitchen & Takeaway Lobby)',
      specs: [
        ['Lebar Fasad Ruko', '6,00 Meter'],
        ['Kedalaman Ruang Lantai 1', '6,00 Meter + Teras 1,70 m'],
        ['Tinggi Total Bangunan', '7,00 Meter (Fasad Ruko 2 Lantai)'],
        ['Tinggi Plafon Lantai 1', '3,25 Meter'],
        ['Ukuran Counter Bar Kasir', '4,76 m × 0,76 m × T 0,85 m'],
        ['Lobi Antrean Pembeli', '5,80 m × 2,10 m (Indoor AC)']
      ],
      equipment: [
        'Renovasi Penuh Interior & Fasad Ruko 6×6 m (Dinding Kaca Tempered & Pintu Ganda)',
        '1 Unit Meja Counter Bar Show Kitchen Panjang 4,76 m Berlapis Kayu Slats & Marmer',
        '1 Set Bulkhead Gantung Atas + 9 Lightbox Menu Foto 1:1 Menyala Penuh',
        '1 Unit Cerobong Asap Komersial (Stainless Exhaust Hood 2,2 m) + Kaca Sneeze Guard',
        '2 Unit Deep Fryer Komersial + 1 Griddle Baja Lebar + 2 Tungku Pancong Lumer',
        '1 Unit Kulkas Chiller Vertikal Pintu Kaca + Meja Stainless Dapur Belakang + Sink',
        '1 Set Kasir POS Dual-Screen + Nampan Pickup Pesanan + Rak Bertingkat Saus Topping',
        '2 Bangku Tunggu Pelanggan Berlapis Bantalan Empuk di Lobi + 2 Stand X-Banner Teras'
      ],
      lines: [
        { p1: [-3.00, 3.65, 4.02], p2: [3.00, 3.65, 4.02],  text: '↔ Lebar Fasad Ruko: 6,00 m (600 cm)' },
        { p1: [-3.25, 0.0, 3.05],  p2: [-3.25, 7.00, 3.05], text: '⇕ Tinggi Ruko 2 Lantai: 7,00 m' },
        { p1: [-3.15, 0.15, 3.00], p2: [-3.15, 3.25, 3.00], text: '⇕ Tinggi Plafon Lantai 1: 3,25 m' },
        { p1: [3.15, 0.20, -3.00], p2: [3.15, 0.20, 3.00],  text: '↔ Kedalaman Ruko: 6,00 m + Teras 1,70 m' },
        { p1: [-1.85, 1.15, 0.95], p2: [2.75, 1.15, 0.95],  text: '↔ Meja Counter Bar & Show Kitchen: 4,76 m' }
      ]
    },
    'restoran': {
      tierSummary: 'Paket Premium 3 (Flagship) — Restoran Mewah 2 Lantai + Live Music & Mushola',
      specs: [
        ['Ukuran Gedung Utama', '28,00 m × 22,00 m (2 Lantai Penuh)'],
        ['Luas Total Bangunan', '± 1.150 m² (Kapasitas 110+ Tamu)'],
        ['Tinggi Gedung Total', '8,40 m + Mahkota Atap 1,35 m'],
        ['Grand Show Kitchen & Bar', '11,60 m × 0,98 m + 6 Kursi Bar'],
        ['Panggung Live Music L2', '4,60 m × 2,30 m (Baby Grand Piano)'],
        ['Fasilitas Ibadah & Sanitasi', 'Mushola L2 (Wudhu) + Toilet L1 & L2']
      ],
      equipment: [
        'Gedung Flagship 2 Lantai Full Interior Marmer, Plafon Coffered LED, & Chandelier Atrium',
        '25 Set Meja Makan Marmer (100 Kursi Berlapis Emas) + 3 Sofa VIP Booth + 6 Kursi Bar Tinggi',
        'Stasiun Barista & Bartender Lengkap: Mesin Espresso 3-Group, 2 Grinder, 2 Blender, Ice Bin, Shaker, & Etalase Kue Kaca',
        'Dapur Utama & Pulau Preparasi Tengah: Rak Gantung Panci Tembaga, 2 Oven Konveksi, Mixer 20L, Troli Loyang 6 Tingkat, & Chiller 4 Pintu',
        'Ruang Gudang Stok Bahan Baku (4 Rak Besi 4 Tingkat Penuh) + Pintu Bongkar Muat (Loading Dock Samping)',
        'Panggung Live Music Akustik Lantai 2: Baby Grand Piano 3D Glossy, Bangku Pianis, Gitar Akustik, Mic Stand, & 2 Speaker Monitor',
        'Kompleks Mushola Lantai 2 (Shaf Pria & Wanita Terpisah Sekat Kisi Kayu, 2 Mihrab, 12 Sajadah, & Ruang Wudhu 4 Keran)',
        'Toilet Pria & Wanita Terpisah di Bawah Tangga Lantai 1 dan Lantai 2 + Lounge Wastafel Marmer Cermin Menyala',
        '14 Unit AC Komersial (8 AC Cassette Plafon 4-Arah + 6 AC Split Dinding) + Plang Totem Pylon Besar di Taman Parkir'
      ],
      lines: [
        { p1: [-14.0, 4.30, 9.25], p2: [14.0, 4.30, 9.25],  text: '↔ Lebar Gedung Restoran Flagship: 28,00 Meter' },
        { p1: [-14.2, 0.0, 8.85],  p2: [-14.2, 8.40, 8.85], text: '⇕ Tinggi Gedung 2 Lantai: 8,40 Meter' },
        { p1: [14.1, 0.20, -13.0], p2: [14.1, 0.20, 9.00],  text: '↔ Kedalaman Gedung: 22,00 Meter' },
        { p1: [0.0, 4.95, 3.15],   p2: [0.0, 4.95, 3.15],   text: 'Panggung Live Music & Baby Grand Piano L2: 4,60 m × 2,30 m' },
        { p1: [1.50, 1.35, -6.80], p2: [13.1, 1.35, -6.80], text: '↔ Grand Show Kitchen, Barista & Bartender Bar: 11,60 Meter' }
      ]
    },
    'gabungan': {
      tierSummary: 'Simulasi Kompleks Kota Munchies — Membandingkan Seluruh 6 Tipe Outlet Sekaligus',
      specs: [
        ['Reguler 1: Booth Portabel', '1,30 m × 0,68 m × T 2,08 m'],
        ['Reguler 2: Gerobak Dagang', '1,80 m × 0,80 m × T 2,12 m'],
        ['Reguler 3: Sepeda Listrik', '2,45 m × 0,90 m (Buka 1,90 m)'],
        ['Premium 1: Booth Kontainer', '2,50 m × 2,00 m (+16 Kursi Outdoor)'],
        ['Premium 2: Ruko Takeaway', '6,00 m × 6,00 m × T 7,00 m (2 Lantai)'],
        ['Premium 3: Restoran Flagship', '28,00 m × 22,00 m × T 8,40 m (2 Lantai)']
      ],
      equipment: [
        'Menampilkan Perbandingan Skala Nyata Ke-6 Tipe Outlet Munchies (3 Reguler & 3 Premium) di Satu Kota',
        'Arahkan Pandangan ke Jok/Stang Sepeda Listrik Tertutup (di jalan barat) lalu tekan [F] untuk Mengendarai Cepat!',
        'Arahkan Pandangan ke Gagang Belakang Gerobak (di jalan simpang utara) lalu tekan [F] untuk Mendorong!',
        'Saat Kursor Terlihat di Mode Jelajah: [Klik Kiri] = Masuk Mode Tanpa Kursor, atau [Tahan Klik Kanan] = Menengok dengan Kursor Tetap Diam!',
        'Tombol Teleport "3. Sepeda Listrik" & "2. Gerobak Dagang" otomatis mengikuti lokasi terbaru unit!'
      ],
      lines: [
        { p1: [-12.5, 2.6, -11.0], p2: [-12.5, 2.6, -11.0], text: 'Reguler 1 (Booth Portabel): 1,30 m × 0,68 m × T 2,08 m' },
        { p1: [9.2, 2.7, -28.5],   p2: [9.2, 2.7, -28.5],   text: 'Reguler 2 (Gerobak Dagang): 1,80 m × 0,80 m × T 2,12 m' },
        { p1: [39.5, 3.1, -7.1],   p2: [39.5, 3.1, -7.1],   text: 'Reguler 3B (Sepeda Listrik Buka Payung): 2,45 m × Lebar Buka 1,90 m' },
        { p1: [-28.0, 1.9, 2.2],   p2: [-28.0, 1.9, 2.2],   text: 'Reguler 3A (Sepeda Listrik Tertutup): 2,45 m × 0,90 m × T 1,12 m' },
        { p1: [-35.0, 3.3, -15.0], p2: [-35.0, 3.3, -15.0], text: 'Premium 1 (Booth Kontainer): 2,50 m × 2,00 m × T 2,50 m (+16 Kursi)' },
        { p1: [-14.0, 7.8, 16.0],  p2: [-14.0, 7.8, 16.0],  text: 'Premium 2 (Ruko Takeaway): 6,00 m × 6,00 m × T 7,00 m' },
        { p1: [18.0, 9.8, 24.2],   p2: [18.0, 9.8, 24.2],   text: 'Premium 3 (Restoran Flagship 2 Lantai): 28,00 m × 22,00 m × T 8,40 m' }
      ]
    }
  };

  function updateRightInfoPanels(outletType) {
    const data = OUTLET_PARTNER_DATA[outletType] || OUTLET_PARTNER_DATA['booth_portable'];

    if (dimSpecPanel) {
      dimSpecPanel.innerHTML = data.specs
        .map(([k, v]) => `<div class="spec-row-item"><span>${k}</span><b>${v}</b></div>`)
        .join('');
    }

    if (equipSpecPanel) {
      equipSpecPanel.innerHTML = `
        <div class="equip-badge-summary">${data.tierSummary}</div>
        <ul class="equip-list-ul">
          ${data.equipment.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      `;
    }

    while (dimensionGroup3D.children.length > 0) {
      dimensionGroup3D.remove(dimensionGroup3D.children[0]);
    }
    if (dimLabelsContainer) dimLabelsContainer.innerHTML = '';
    activeFloatingTags = [];

    if (!showDimensions) {
      dimensionGroup3D.visible = false;
      if (dimLabelsContainer) dimLabelsContainer.style.display = 'none';
      if (topRightDimCard) topRightDimCard.classList.remove('visible');
      if (btnQuickDim) {
        btnQuickDim.classList.remove('active');
        btnQuickDim.textContent = 'Ukuran 3D: OFF';
      }
      if (objMeasureHud) objMeasureHud.style.display = 'none';
      return;
    }

    dimensionGroup3D.visible = true;
    if (dimLabelsContainer) dimLabelsContainer.style.display = 'block';
    if (topRightDimCard) topRightDimCard.classList.add('visible');
    if (btnQuickDim) {
      btnQuickDim.classList.add('active');
      btnQuickDim.textContent = 'Ukuran 3D: ON';
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x503418, linewidth: 2 });
    const dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xAA7641 });

    data.lines.forEach((item) => {
      const v1 = new THREE.Vector3(...item.p1);
      const v2 = new THREE.Vector3(...item.p2);
      if (v1.distanceTo(v2) > 0.05) {
        const bufGeo = new THREE.BufferGeometry().setFromPoints([v1, v2]);
        dimensionGroup3D.add(new THREE.Line(bufGeo, lineMat));
        const d1 = new THREE.Mesh(dotGeo, dotMat);
        d1.position.copy(v1);
        const d2 = new THREE.Mesh(dotGeo, dotMat);
        d2.position.copy(v2);
        dimensionGroup3D.add(d1, d2);
      }

      if (dimLabelsContainer) {
        const mid = v1.clone().add(v2).multiplyScalar(0.5);
        const tagEl = document.createElement('div');
        tagEl.className = 'dim-floating-tag';
        tagEl.textContent = item.text;
        dimLabelsContainer.appendChild(tagEl);
        activeFloatingTags.push({ el: tagEl, worldPos: mid });
      }
    });
  }

  function updateFloatingDimensionTags() {
    if (!showDimensions || activeFloatingTags.length === 0) return;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < activeFloatingTags.length; i++) {
      const tag = activeFloatingTags[i];
      _projVec.copy(tag.worldPos).project(camera);
      if (_projVec.z > 1.0) {
        tag.el.style.display = 'none';
        continue;
      }
      const x = (_projVec.x * 0.5 + 0.5) * w;
      const y = (-(_projVec.y * 0.5) + 0.5) * h;
      tag.el.style.display = 'block';
      tag.el.style.left = `${x}px`;
      tag.el.style.top = `${y}px`;
    }
  }

  function setDimensionsVisibility(val) {
    showDimensions = val;
    if (val && window.innerWidth <= 768 && leftSidebar) {
      leftSidebar.classList.remove('open');
    }
    updateRightInfoPanels(activeOutletType);
  }

  function setEquipmentVisibility(val) {
    showEquipmentCard = val;
    if (val && window.innerWidth <= 768 && leftSidebar) {
      leftSidebar.classList.remove('open');
    }
    if (topRightEquipCard) topRightEquipCard.classList.toggle('visible', showEquipmentCard);
    if (btnQuickEquip) {
      btnQuickEquip.classList.toggle('active', showEquipmentCard);
      btnQuickEquip.textContent = showEquipmentCard ? 'Detail Mitra: ON' : 'Detail Mitra: OFF';
    }
  }

  setDimensionsVisibility(false);
  setEquipmentVisibility(false);

  addEvt(btnQuickDim, 'click', () => setDimensionsVisibility(!showDimensions));
  addEvt(btnCloseDimCard, 'click', () => setDimensionsVisibility(false));
  addEvt(btnQuickEquip, 'click', () => setEquipmentVisibility(!showEquipmentCard));
  addEvt(btnCloseEquipCard, 'click', () => setEquipmentVisibility(false));

  // --------------------------------------------------------------------------
  // 5. KONTROL KAMERA, BATAS LUAR AREA (`WORLD_BOUNDS`), & TELEPORT 6 OUTLET
  // --------------------------------------------------------------------------
  const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.maxPolarAngle = Math.PI / 2 - 0.015;
  orbitControls.minDistance = 1.0;
  orbitControls.maxDistance = 140;

  const fpsControls = new THREE.PointerLockControls(camera, renderer.domElement);

  const OUTLET_WORLD_BOUNDS = {
    'booth_portable': { minX: -3.2, maxX: 3.2, minZ: -2.8, maxZ: 3.2 },
    'gerobak':        { minX: -4.2, maxX: 4.2, minZ: -3.2, maxZ: 3.5 },
    'trike_terbuka':  { minX: -4.2, maxX: 4.2, minZ: -3.2, maxZ: 3.5 },
    'trike_tertutup': { minX: -4.2, maxX: 4.2, minZ: -3.2, maxZ: 3.5 },
    'kontainer':      { minX: -4.5, maxX: 7.5, minZ: -4.0, maxZ: 5.5 },
    'ruko':           { minX: -5.5, maxX: 5.5, minZ: -4.5, maxZ: 8.5 },
    'restoran':       { minX: -18.5, maxX: 18.5, minZ: -14.0, maxZ: 20.5 },
    'gabungan':       { minX: -80.0, maxX: 80.0, minZ: -68.0, maxZ: 38.0 }
  };

  const TELEPORT_PRESETS = {
    'booth_portable': { default: { pos: [0.0, EYE_HEIGHT, 2.5],  look: [0.0, 1.1, 0.0] } },
    'gerobak':        { default: { pos: [0.0, EYE_HEIGHT, 2.8],  look: [0.0, 1.15, 0.0] } },
    'trike_terbuka':  { default: { pos: [0.0, EYE_HEIGHT, 3.0],  look: [0.0, 1.15, 0.0] } },
    'trike_tertutup': { default: { pos: [0.0, EYE_HEIGHT, 2.8],  look: [0.0, 0.95, 0.0] } },
    'kontainer':      { default: { pos: [1.2, EYE_HEIGHT, 4.4],  look: [1.2, 1.2, 0.0] } },
    'ruko':           { default: { pos: [0.0, EYE_HEIGHT, 6.2],  look: [0.0, 1.6, 0.0] } },
    'restoran':       { default: { pos: [0.0, EYE_HEIGHT, 14.5], look: [0.0, 2.4, 0.0] } },
    'gabungan': {
      default:        { pos: [-12.5, EYE_HEIGHT, -7.2],  look: [-12.5, 1.3, -11.0] },
      booth_portable: { pos: [-12.5, EYE_HEIGHT, -7.2],  look: [-12.5, 1.3, -11.0] },
      gerobak:        { pos: [5.5,   EYE_HEIGHT, -28.5], look: [9.2,   1.3, -28.5] },
      sepeda_listrik: { pos: [-28.0, EYE_HEIGHT, 5.2],   look: [-28.0, 1.1, 2.2] },
      kontainer:      { pos: [-29.0, EYE_HEIGHT, -15.0], look: [-35.0, 1.5, -15.0] },
      ruko:           { pos: [-14.0, EYE_HEIGHT, 7.2],   look: [-14.0, 2.1, 16.0] },
      restoran:       { pos: [18.0,  EYE_HEIGHT, 6.5],   look: [18.0,  3.2, 24.2] }
    }
  };

  const gltfLoader = new THREE.GLTFLoader();

  // --------------------------------------------------------------------------
  // 6. SETUP SEPEDA LISTRIK & GEROBAK
  // --------------------------------------------------------------------------
  function setupVehicleController(rootObj, vehType) {
    rootObj.matrixAutoUpdate = true;
    rootObj.rotation.order = 'YXZ';
    rootObj.updateMatrixWorld(true);

    const invRootMat = new THREE.Matrix4().copy(rootObj.matrixWorld).invert();
    const wheels = [];
    const triggerMeshes = [];
    const bodyColliders = [];
    const detachedBannerProps = [];

    rootObj.traverse((c) => {
      c.matrixAutoUpdate = true;
      if (!c.isMesh) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox;
      const wBox = new THREE.Box3().setFromObject(c);
      const wCenter = new THREE.Vector3();
      const wSize = new THREE.Vector3();
      wBox.getCenter(wCenter);
      wBox.getSize(wSize);
      const lCenter = wCenter.clone().applyMatrix4(invRootMat);
      const nm = (c.name || '').toLowerCase();

      // Hanya pisahkan Standing Banner yang berada di luar rentang panjang gerobak (`|x| > 1.22m`)
      if (vehType === 'gerobak_push') {
        const isStandingBannerOutsideX = Math.abs(lCenter.x) > 1.22 && wBox.max.y < 1.68;
        if (isStandingBannerOutsideX) {
          detachedBannerProps.push(c);
          return;
        }
      }

      const isWheelName =
        (nm.includes('wheel') || nm.includes('roda') || nm.includes('castor')) &&
        !nm.includes('fender') && !nm.includes('spatbor') && !nm.includes('fork') &&
        !nm.includes('bracket') && !nm.includes('bumper') && !nm.includes('plate') &&
        !nm.includes('banner') && !nm.includes('trim') && !nm.includes('atap');

      const sortedDims = [wSize.x, wSize.y, wSize.z].sort((a, b) => a - b);
      const isRoundWheelShape = (sortedDims[2] < 0.78) && (Math.abs(sortedDims[2] - sortedDims[1]) < 0.18);

      if (isWheelName && wCenter.y < 0.55 && isRoundWheelShape) {
        const dx = bb.max.x - bb.min.x;
        const dy = bb.max.y - bb.min.y;
        const dz = bb.max.z - bb.min.z;

        let axle = new THREE.Vector3(0, 0, 1);
        if (dx <= dy && dx <= dz) axle.set(1, 0, 0);
        else if (dy <= dx && dy <= dz) axle.set(0, 1, 0);

        const radius = Math.max(dx, dy, dz) * 0.5 || 0.25;
        wheels.push({
          mesh: c,
          initQuat: c.quaternion.clone(),
          axleAxis: axle,
          radius: radius,
          spinAngle: 0.0
        });
      }

      if (vehType === 'trike_closed') {
        if (
          nm.includes('sadel') || nm.includes('saddle') || nm.includes('seat') || nm.includes('jok') ||
          nm.includes('stang') || nm.includes('handle') || nm.includes('fork') || nm.includes('depan') ||
          nm.includes('front') || nm.includes('chassis') || nm.includes('frame')
        ) {
          triggerMeshes.push(c);
        }
      } else if (vehType === 'gerobak_push') {
        if (
          nm.includes('gagang') || nm.includes('handle') || nm.includes('dorong') ||
          nm.includes('push') || nm.includes('bodi') || nm.includes('meja') || nm.includes('etalase')
        ) {
          triggerMeshes.push(c);
        }
      }

      if (!nm.includes('floor') && !nm.includes('jalan') && !nm.includes('trotoar')) {
        bodyColliders.push(c);
      }
    });

    if (detachedBannerProps.length > 0 && currentModel) {
      detachedBannerProps.forEach((propMesh) => {
        currentModel.attach(propMesh);
        propMesh.updateMatrixWorld(true);
        propMesh.matrixAutoUpdate = false;
        const propBox = new THREE.Box3().setFromObject(propMesh);
        if (!propBox.isEmpty()) {
          obstacleBoxes.push(propBox);
        }
      });
    }

    if (vehType === 'trike_closed') {
      return {
        root: rootObj,
        type: 'trike_closed',
        promptText: 'Tekan [F] Naik ke Atas Jok & Kendarai Sepeda Listrik',
        activeText: 'Mengendarai Sepeda Listrik (W = Gas Maju, S = Rem/Mundur, A/D = Belok Mulus, [F] = Turun)',
        maxSpeed: 14.0,
        maxReverseSpeed: 4.5,
        accelRate: 11.5,
        brakeRate: 18.0,
        coastFriction: 4.2,
        maxSteerRate: 2.15,
        currentVel: 0.0,
        steerInputSmooth: 0.0,
        currentRoll: 0.0,
        currentPitch: 0.0,
        suspOffsetY: 0.0,
        suspVelY: 0.0,
        wheelSpinSign: -1.0,
        steerSign: -1.0,
        initialLookDir: new THREE.Vector3(1, 0, 0),
        localForward: new THREE.Vector3(1, 0, 0),
        localCameraPos: new THREE.Vector3(-0.58, 1.48, 0.0),
        localInteractSpot: new THREE.Vector3(-0.75, 0.95, 0.0),
        wheels: wheels,
        triggerMeshes: triggerMeshes,
        bodyColliders: bodyColliders,
        boundingBoxWorld: new THREE.Box3()
      };
    } else {
      return {
        root: rootObj,
        type: 'gerobak_push',
        promptText: 'Tekan [F] Pegang Gagang & Dorong Gerobak',
        activeText: 'Mendorong Gerobak (W = Dorong Maju, S = Tarik, A/D = Belok, [F] = Lepas Gagang)',
        maxSpeed: 2.2,
        maxReverseSpeed: 1.5,
        accelRate: 6.0,
        brakeRate: 10.0,
        coastFriction: 7.5,
        maxSteerRate: 1.25,
        currentVel: 0.0,
        steerInputSmooth: 0.0,
        currentRoll: 0.0,
        currentPitch: 0.0,
        suspOffsetY: 0.0,
        suspVelY: 0.0,
        wheelSpinSign: -1.0,
        steerSign: -1.0,
        initialLookDir: new THREE.Vector3(1, 0, 0),
        localForward: new THREE.Vector3(1, 0, 0),
        localCameraPos: new THREE.Vector3(-1.52, 1.62, 0.0),
        localInteractSpot: new THREE.Vector3(-1.08, 0.92, 0.0),
        wheels: wheels,
        triggerMeshes: triggerMeshes,
        bodyColliders: bodyColliders,
        boundingBoxWorld: new THREE.Box3()
      };
    }
  }

  function updateVehicleWorldBoundingBox(vc) {
    vc.boundingBoxWorld.makeEmpty();
    for (let i = 0; i < vc.bodyColliders.length; i++) {
      vc.boundingBoxWorld.expandByObject(vc.bodyColliders[i]);
    }
  }

  // --------------------------------------------------------------------------
  // 7. KAMERA ORBIT AWAL 100% TAMPAK DEPAN UNTUK SEMUA OUTLET SATUAN
  // --------------------------------------------------------------------------
  function computeBalancedOrbitCenter(model, outletType) {
    if (outletType === 'gabungan') {
      currentBuildingCenter.set(0, 1.8, 0);
      currentOrbitCamPos.set(-18, 16.0, 28.0);
      return;
    }

    const box = new THREE.Box3();
    let hasMesh = false;
    model.traverse((child) => {
      if (child.isMesh) {
        const n = (child.name || '').toLowerCase();
        const isGround =
          n.includes('floor_pad') ||
          n.includes('floor_paving') ||
          n.includes('floor_jalan') ||
          n.includes('floor_trotoar') ||
          n.includes('kerb_bibir') ||
          n.includes('jalan_raya');
        if (!isGround) {
          box.expandByObject(child);
          hasMesh = true;
        }
      }
    });
    if (!hasMesh) box.setFromObject(model);

    const center = new THREE.Vector3();
    box.getCenter(center);
    currentBuildingCenter.copy(center);
    currentBuildingCenter.y = Math.max(0.95, Math.min(center.y * 0.72, 3.2));

    if (outletType === 'booth_portable') {
      currentOrbitCamPos.set(center.x, 1.55, center.z + 2.65);
    } else if (outletType === 'gerobak') {
      currentOrbitCamPos.set(center.x, 1.65, center.z + 3.15);
    } else if (outletType === 'trike_terbuka' || outletType === 'trike_tertutup') {
      currentOrbitCamPos.set(center.x, 1.70, center.z + 3.25);
    } else if (outletType === 'kontainer') {
      currentOrbitCamPos.set(center.x, 2.25, center.z + 6.20);
    } else if (outletType === 'ruko') {
      currentOrbitCamPos.set(center.x, 2.60, center.z + 8.50);
    } else if (outletType === 'restoran') {
      currentOrbitCamPos.set(center.x, 5.20, center.z + 22.00);
    }
  }

  function centerOrbitCameraNow() {
    if (currentMode !== 'ORBIT') activateOrbitMode();
    orbitControls.target.copy(currentBuildingCenter);
    camera.position.copy(currentOrbitCamPos);
    orbitControls.update();
    updateCameraViewportCenter();
  }

  addEvt(btnResetCenter, 'click', centerOrbitCameraNow);
  addEvt(btnQuickCenter, 'click', centerOrbitCameraNow);

  const OUTLET_FILE_CANDIDATES = {
    'booth_portable': ['outlet_4.glb', 'booth_portable.glb'],
    'gerobak':        ['outlet_5.glb', 'gerobak.glb'],
    'trike_terbuka':  ['outlet_6_terbuka.glb', 'trike_terbuka.glb'],
    'trike_tertutup': ['outlet_6_tertutup.glb', 'trike_tertutup.glb'],
    'kontainer':      ['outlet_2.glb', 'outlet_1.glb', 'kontainer.glb'],
    'ruko':           ['outlet_1.glb', 'outlet_2.glb', 'ruko.glb'],
    'restoran':       ['outlet_3.glb', 'restoran.glb'],
    'gabungan':       ['gabungan.glb', 'munchies_gabungan_kompleks.glb']
  };

  function detectGlbActualType(rootScene) {
    let hasKontainer = false;
    let hasRuko = false;
    rootScene.traverse((c) => {
      const nm = c.name || '';
      if (nm.startsWith('K_') || nm.includes('Kontainer') || nm.includes('Meja_Lipat')) hasKontainer = true;
      if (nm.startsWith('RukoM_') || nm.includes('Ruko')) hasRuko = true;
    });
    if (hasKontainer && !hasRuko) return 'kontainer';
    if (hasRuko && !hasKontainer) return 'ruko';
    return 'other';
  }

  function findGrabRoot(obj) {
    let curr = obj;
    while (curr) {
      if (curr.name && curr.name.startsWith('GRAB_')) return curr;
      curr = curr.parent;
    }
    return null;
  }

  function isInsideDrivenVehicle(obj) {
    let curr = obj;
    while (curr) {
      if (
        curr.name &&
        (curr.name.startsWith('VEH_Trike_Tertutup') ||
         curr.name.startsWith('MASTER_Outlet5_Gerobak'))
      ) {
        return true;
      }
      curr = curr.parent;
    }
    return false;
  }

  function loadOutletByType(outletType, labelText) {
    activeOutletType = outletType;
    activeVehicleCtrl = null;
    hoveredVehicleCtrl = null;
    playerVelY = 0.0;
    isPlayerGrounded = true;
    resetMoveState();

    const maxPR = (outletType === 'gabungan') ? 1.1 : 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPR));

    if (labelText && activeOutletPill) activeOutletPill.textContent = labelText;

    if (sidebarTeleportSection) {
      sidebarTeleportSection.style.display = (outletType === 'gabungan') ? 'flex' : 'none';
    }

    if (trikeSubSwitch) {
      const isTrike = (outletType === 'trike_terbuka' || outletType === 'trike_tertutup');
      trikeSubSwitch.classList.toggle('visible', isTrike);
    }

    if (heldObject) {
      camera.remove(heldObject);
      heldObject = null;
    }

    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
      loadingOverlay.style.opacity = '1';
    }
    if (loadingText) {
      loadingText.textContent = `Memuat 3D ${labelText || outletType}...`;
    }

    const candidates = OUTLET_FILE_CANDIDATES[outletType] || ['outlet_4.glb'];
    tryLoadVerifiedCandidate(outletType, candidates, 0);
  }

  function tryLoadVerifiedCandidate(desiredType, candidates, idx) {
    if (idx >= candidates.length) {
      if (loadingText) {
        loadingText.textContent = `File 3D untuk ${desiredType} tidak ditemukan di folder.`;
      }
      return;
    }

    const fileUrl = candidates[idx];
    gltfLoader.load(
      fileUrl,
      (gltf) => {
        const detected = detectGlbActualType(gltf.scene);
        if (
          (desiredType === 'kontainer' && detected === 'ruko' && idx + 1 < candidates.length) ||
          (desiredType === 'ruko' && detected === 'kontainer' && idx + 1 < candidates.length)
        ) {
          tryLoadVerifiedCandidate(desiredType, candidates, idx + 1);
          return;
        }

        if (currentModel) scene.remove(currentModel);
        currentModel = gltf.scene;
        scene.add(currentModel);
        currentModel.updateMatrixWorld(true);

        grabbableObjects = [];
        floorBoxes = [];
        obstacleBoxes = [];
        allInspectableMeshes = [];
        vehicleControllers = [];
        hoveredVehicleCtrl = null;
        activeVehicleCtrl = null;

        const lightsToRemove = [];
        const standaloneSolidUnitBox = new THREE.Box3();
        let hasStandaloneSolidMesh = false;

        const trikeRoots = [];
        const gerobakRoots = [];

        currentModel.traverse((child) => {
          if (child.isLight) {
            child.intensity = 0;
            lightsToRemove.push(child);
          }

          if (desiredType === 'gabungan' && child.name) {
            if (child.name.startsWith('VEH_Trike_Tertutup')) {
              trikeRoots.push(child);
            } else if (child.name.startsWith('MASTER_Outlet5_Gerobak')) {
              gerobakRoots.push(child);
            } else if (
              child.name.startsWith('MASTER_Outlet6B_Trike') ||
              child.name.startsWith('MASTER_Outlet4_Booth') ||
              child.name.startsWith('VEH_')
            ) {
              const unitBox = new THREE.Box3().setFromObject(child);
              if (!unitBox.isEmpty()) {
                obstacleBoxes.push(unitBox);
              }
            }
          }
        });

        trikeRoots.forEach((r) => {
          const vc = setupVehicleController(r, 'trike_closed');
          updateVehicleWorldBoundingBox(vc);
          vehicleControllers.push(vc);
        });

        gerobakRoots.forEach((r) => {
          const vc = setupVehicleController(r, 'gerobak_push');
          updateVehicleWorldBoundingBox(vc);
          vehicleControllers.push(vc);
        });

        const shadowSizeThreshold = (desiredType === 'gabungan') ? 0.85 : 0.38;

        currentModel.traverse((child) => {
          if (!child.isMesh) return;

          allInspectableMeshes.push(child);

          if (child.geometry && !child.geometry.boundingSphere) {
            child.geometry.computeBoundingSphere();
          }
          child.frustumCulled = true;

          const wBox = new THREE.Box3().setFromObject(child);
          const sz = new THREE.Vector3();
          wBox.getSize(sz);
          const maxDim = Math.max(sz.x, sz.y, sz.z);

          child.castShadow = maxDim > shadowSizeThreshold;
          child.receiveShadow = maxDim > 0.65;

          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (!m) return;
            const mName = (m.name || '').toLowerCase();
            const needsDoubleSide =
              m.transparent ||
              m.alphaTest > 0 ||
              mName.includes('leaf') ||
              mName.includes('leaves') ||
              mName.includes('glass') ||
              mName.includes('kaca');
            m.side = needsDoubleSide ? THREE.DoubleSide : THREE.FrontSide;

            if (m.emissive && !mName.includes('glow')) {
              m.emissive.setHex(0x000000);
              m.emissiveIntensity = 0;
            }
          });

          const grabRoot = findGrabRoot(child);
          if (grabRoot) {
            if (!grabbableObjects.includes(grabRoot)) grabbableObjects.push(grabRoot);
            return;
          }

          if (desiredType === 'gabungan' && isInsideDrivenVehicle(child)) {
            return;
          }

          child.matrixAutoUpdate = false;

          const n = (child.name || '').toLowerCase();

          const isFloorOrStair =
            (n.includes('floor') ||
             n.includes('lantai') ||
             n.includes('fondasi') ||
             n.includes('paving') ||
             n.includes('parkir') ||
             n.includes('jalan') ||
             n.includes('trotoar') ||
             n.includes('ramp') ||
             n.includes('teras') ||
             n.includes('slab_l2') ||
             n.includes('stair_step') ||
             n.includes('stage_platform')) &&
            !n.includes('gerobak') && !n.includes('trike') && !n.includes('frame') && !n.includes('bodi');

          if (isFloorOrStair) {
            floorBoxes.push({
              box: wBox,
              mesh: child,
              topY: wBox.max.y,
              isSlope: n.includes('ramp')
            });
          }

          if (
            (desiredType === 'booth_portable' ||
             desiredType === 'gerobak' ||
             desiredType === 'trike_terbuka' ||
             desiredType === 'trike_tertutup') &&
            !isFloorOrStair &&
            !n.includes('kerb') &&
            !n.includes('payung_kubah')
          ) {
            standaloneSolidUnitBox.expandByObject(child);
            hasStandaloneSolidMesh = true;
          }

          const isNonObstacle =
            isFloorOrStair ||
            n.includes('pintu_terbuka') ||
            n.includes('pintu_masuk') ||
            n.includes('pintu_utama') ||
            n.includes('pintu_f1') ||
            n.includes('pintu_balkon') ||
            n.includes('entry_door') ||
            n.includes('stall_door') ||
            n.includes('tactile') ||
            n.includes('marka') ||
            n.includes('zebra') ||
            n.includes('kerb') ||
            n.includes('leaf') ||
            n.includes('leaves') ||
            n.includes('vine') ||
            n.includes('fern') ||
            n.includes('shrub') ||
            n.includes('roof') ||
            n.includes('atap') ||
            n.includes('kanopi') ||
            n.includes('canopy') ||
            n.includes('payung_kubah') ||
            n.includes('coffer') ||
            n.includes('bulkhead') ||
            n.includes('wire') ||
            n.includes('chandelier');

          if (!isNonObstacle && wBox.max.y > 0.22 && wBox.min.y < 7.5 && maxDim > 0.14) {
            obstacleBoxes.push(wBox);
          }
        });

        if (hasStandaloneSolidMesh && !standaloneSolidUnitBox.isEmpty()) {
          obstacleBoxes.push(standaloneSolidUnitBox);
        }

        lightsToRemove.forEach((l) => {
          if (l.parent) l.parent.remove(l);
        });

        applyLogoTextureToScene();
        computeBalancedOrbitCenter(currentModel, desiredType);
        updateRightInfoPanels(desiredType);

        if (currentMode === 'ORBIT') {
          centerOrbitCameraNow();
        } else {
          teleportPlayerTo('default');
        }

        renderer.shadowMap.needsUpdate = true;

        if (loadingOverlay) {
          loadingOverlay.style.opacity = '0';
          setTimeout(() => { loadingOverlay.style.display = 'none'; }, 220);
        }
      },
      (xhr) => {
        if (xhr.total > 0 && loadingText) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          loadingText.textContent = `Memuat 3D (${pct}%)...`;
        }
      },
      () => {
        tryLoadVerifiedCandidate(desiredType, candidates, idx + 1);
      }
    );
  }

  // --------------------------------------------------------------------------
  // 8. TELEPORTASI DINAMIS (MENGIKUTI POSISI SEPEDA LISTRIK & GEROBAK!)
  // --------------------------------------------------------------------------
  function dismountActiveVehicle() {
    if (!activeVehicleCtrl) return;
    activeVehicleCtrl.currentVel = 0.0;
    activeVehicleCtrl.steerInputSmooth = 0.0;
    activeVehicleCtrl.currentRoll = 0.0;
    activeVehicleCtrl.currentPitch = 0.0;
    activeVehicleCtrl.root.rotation.x = 0.0;
    activeVehicleCtrl.root.rotation.z = 0.0;
    camera.rotation.z = 0.0;
    clearTimeout(drivePromptTimer);
    hideDrivePromptAfterTimeout = false;

    activeVehicleCtrl.root.updateMatrixWorld();
    updateVehicleWorldBoundingBox(activeVehicleCtrl);

    const worldFwd = activeVehicleCtrl.localForward.clone().transformDirection(activeVehicleCtrl.root.matrixWorld).normalize();
    const worldRight = new THREE.Vector3().crossVectors(worldFwd, _upVec).normalize();
    const exitPos = activeVehicleCtrl.root.position.clone().addScaledVector(worldRight, -1.25);

    camera.position.set(exitPos.x, activeVehicleCtrl.root.position.y + EYE_HEIGHT, exitPos.z);
    activeVehicleCtrl = null;
    if (grabPrompt) grabPrompt.style.display = 'none';
  }

  function teleportPlayerTo(spotKey) {
    if (activeVehicleCtrl) dismountActiveVehicle();
    resetMoveState();
    playerVelY = 0.0;
    isPlayerGrounded = true;

    if (activeOutletType === 'gabungan') {
      if (spotKey === 'sepeda_listrik') {
        const trikeVc = vehicleControllers.find((v) => v.type === 'trike_closed');
        if (trikeVc && trikeVc.root) {
          trikeVc.root.updateMatrixWorld();
          const vPos = trikeVc.root.position;
          const worldRight = new THREE.Vector3(0, 0, 1).applyQuaternion(trikeVc.root.quaternion);
          const camPos = vPos.clone().addScaledVector(worldRight, 2.8);
          camPos.y = vPos.y + EYE_HEIGHT;
          const lookAtPos = new THREE.Vector3(vPos.x, vPos.y + 1.0, vPos.z);
          camera.position.copy(camPos);
          camera.lookAt(lookAtPos);
          if (currentMode === 'ORBIT') {
            orbitControls.target.copy(lookAtPos);
            orbitControls.update();
          }
          return;
        }
      } else if (spotKey === 'gerobak') {
        const cartVc = vehicleControllers.find((v) => v.type === 'gerobak_push');
        if (cartVc && cartVc.root) {
          cartVc.root.updateMatrixWorld();
          const vPos = cartVc.root.position;
          const worldSide = new THREE.Vector3(0, 0, -1).applyQuaternion(cartVc.root.quaternion);
          const camPos = vPos.clone().addScaledVector(worldSide, 3.2);
          camPos.y = vPos.y + EYE_HEIGHT;
          const lookAtPos = new THREE.Vector3(vPos.x, vPos.y + 1.2, vPos.z);
          camera.position.copy(camPos);
          camera.lookAt(lookAtPos);
          if (currentMode === 'ORBIT') {
            orbitControls.target.copy(lookAtPos);
            orbitControls.update();
          }
          return;
        }
      }
    }

    const cfg = TELEPORT_PRESETS[activeOutletType] || TELEPORT_PRESETS['booth_portable'];
    const spot = cfg[spotKey] || cfg.default;
    camera.position.set(...spot.pos);
    camera.lookAt(...spot.look);
    if (currentMode === 'ORBIT') {
      orbitControls.target.set(...spot.look);
      orbitControls.update();
    }
  }

  teleportBtns.forEach((btn) => {
    addEvt(btn, 'click', () => {
      teleportPlayerTo(btn.getAttribute('data-tp'));
      if (window.innerWidth <= 768) setSidebarOpen(false);
    });
  });

  function activateOrbitMode() {
    if (activeVehicleCtrl) dismountActiveVehicle();
    currentMode = 'ORBIT';
    resetMoveState();
    safeExitPointerLock();
    orbitControls.enabled = true;
    centerOrbitCameraNow();

    if (btnOrbit) btnOrbit.classList.add('active');
    if (btnFps) btnFps.classList.remove('active');
    if (btnMobToggleMode) btnMobToggleMode.textContent = 'Mode Jelajah';
    if (crosshair) crosshair.style.display = 'none';
    showHudHelpTemporary(
      '<b>Pandangan Orbit:</b> Klik Kiri + Geser = Putar Kamera | Scroll = Zoom | Klik Kanan = Geser | <b>Klik Makanan/Alat</b> = Ambil',
      8000
    );
  }

  function activateFpsMode() {
    currentMode = 'FPS';
    resetMoveState();
    orbitControls.enabled = false;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    teleportPlayerTo('default');

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) {
      isRmbHoldLock = false;
      fpsControls.lock();
    } else {
      setSidebarOpen(false);
    }

    if (btnFps) btnFps.classList.add('active');
    if (btnOrbit) btnOrbit.classList.remove('active');
    if (btnMobToggleMode) btnMobToggleMode.textContent = 'Mode Orbit';
    if (crosshair) crosshair.style.display = 'block';
    showHudHelpTemporary(
      '<b>Mode Jelajah:</b> <b>Klik Kiri</b> = Mode Game Tanpa Kursor | <b>Tahan Klik Kanan</b> = Tengok (Kursor Diam) | <b>WASD</b> = Jalan | <b>[F]</b> = Kendarai/Dorong',
      8000
    );
  }

  showHudHelpTemporary(
    '<b>Pandangan Orbit:</b> Klik Kiri + Geser = Putar Kamera | Scroll = Zoom | Klik Kanan = Geser | <b>Klik Makanan/Alat</b> = Ambil',
    8000
  );

  addEvt(btnOrbit, 'click', activateOrbitMode);
  addEvt(btnFps, 'click', activateFpsMode);
  addEvt(btnMobToggleMode, 'click', () => {
    if (currentMode === 'ORBIT') activateFpsMode();
    else activateOrbitMode();
  });

  outletBtns.forEach((btn) => {
    addEvt(btn, 'click', () => {
      outletBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const oType = btn.getAttribute('data-type');
      const oLabel = btn.getAttribute('data-label');
      if (oType === 'trike_terbuka') {
        trikeVariantBtns.forEach((tb) => tb.classList.toggle('active', tb.getAttribute('data-trike') === 'trike_terbuka'));
      }
      loadOutletByType(oType, oLabel);
      if (window.innerWidth <= 768) setSidebarOpen(false);
    });
  });

  trikeVariantBtns.forEach((tBtn) => {
    addEvt(tBtn, 'click', () => {
      trikeVariantBtns.forEach((b) => b.classList.remove('active'));
      tBtn.classList.add('active');
      const tType = tBtn.getAttribute('data-trike');
      const tLabel = tType === 'trike_terbuka'
        ? 'Reguler 3A: Sepeda Listrik (Mode Jualan)'
        : 'Reguler 3B: Sepeda Listrik (Mode Jalan)';
      loadOutletByType(tType, tLabel);
      if (window.innerWidth <= 768) setSidebarOpen(false);
    });
  });

  // --------------------------------------------------------------------------
  // 9. KONTROL KEYBOARD (`WASD`, `SHIFT` LARI, `SPASI` LOMPAT, `[F]` JOK/GAGANG)
  // --------------------------------------------------------------------------
  addEvt(fpsControls, 'unlock', () => {
    moveState.forward = false;
    moveState.backward = false;
    moveState.left = false;
    moveState.right = false;
    moveState.sprint = false;
    if (!isRightMouseHolding) {
      isRmbHoldLock = false;
      hideFrozenCursor();
    }
  });
  addEvt(document, 'pointerlockchange', () => {
    if (!document.pointerLockElement) {
      moveState.forward = false;
      moveState.backward = false;
      moveState.left = false;
      moveState.right = false;
      moveState.sprint = false;
      if (!isRightMouseHolding) {
        isRmbHoldLock = false;
        hideFrozenCursor();
      }
    }
  });
  addEvt(window, 'blur', resetMoveState);
  addEvt(document, 'visibilitychange', () => {
    if (document.hidden) resetMoveState();
  });

  function mountOrDismountVehicle() {
    if (activeOutletType !== 'gabungan') return;

    if (activeVehicleCtrl) {
      dismountActiveVehicle();
      return;
    }

    if (currentMode === 'FPS' && hoveredVehicleCtrl) {
      activeVehicleCtrl = hoveredVehicleCtrl;
      hoveredVehicleCtrl = null;
      playerVelY = 0.0;
      activeVehicleCtrl.currentVel = 0.0;
      activeVehicleCtrl.steerInputSmooth = 0.0;
      activeVehicleCtrl.currentRoll = 0.0;
      activeVehicleCtrl.currentPitch = 0.0;

      activeVehicleCtrl.root.updateMatrixWorld(true);
      const seatWorldPos = activeVehicleCtrl.localCameraPos.clone().applyMatrix4(activeVehicleCtrl.root.matrixWorld);
      const lookDirWorld = activeVehicleCtrl.initialLookDir.clone().transformDirection(activeVehicleCtrl.root.matrixWorld);
      lookDirWorld.y = 0;
      lookDirWorld.normalize();

      camera.position.copy(seatWorldPos);
      camera.rotation.set(-0.08, Math.atan2(-lookDirWorld.x, -lookDirWorld.z), 0.0, 'YXZ');

      triggerDrivePromptAutoHide(8000);
    }
  }

  addEvt(window, 'keydown', (e) => {
    if (e.code === 'Escape') {
      resetMoveState();
      return;
    }
    if (e.code === 'KeyW' || e.code === 'ArrowUp') moveState.forward = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') moveState.backward = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveState.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.right = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') moveState.sprint = true;

    if (e.code === 'Space' && currentMode === 'FPS' && !activeVehicleCtrl && isPlayerGrounded) {
      e.preventDefault();
      playerVelY = JUMP_VELOCITY;
      isPlayerGrounded = false;
    }

    if (e.code === 'KeyE') handleGrabOrDrop();
    if (e.code === 'KeyF') mountOrDismountVehicle();
  });

  addEvt(window, 'keyup', (e) => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') moveState.forward = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') moveState.backward = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveState.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') moveState.right = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') moveState.sprint = false;
  });

  // --------------------------------------------------------------------------
  // 9B. ANALOG JOYSTIK BULAT (KIRI BAWAH & SETENGAH LAYAR KIRI) + MULTI-TOUCH LOOK
  //     Jempol Kiri = Jalan/Setir 360 Derajat | Jempol Kanan = Menengok Bebas
  // --------------------------------------------------------------------------
  const dpadContainer = document.getElementById('dpad-container');
  let analogKnob = null;

  if (dpadContainer) {
    // Ubah #dpad-container dari 4 tombol panah menjadi Analog Bulat
    const analogStyle = document.createElement('style');
    analogStyle.textContent = `
      #dpad-container {
        display: flex !important;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 118px !important;
        height: 118px !important;
        border-radius: 50% !important;
        background: rgba(248, 242, 230, 0.76) !important;
        border: 3px solid #503418 !important;
        box-shadow: 0 6px 20px rgba(80, 52, 24, 0.25), inset 0 0 14px rgba(80, 52, 24, 0.12) !important;
        backdrop-filter: blur(4px);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        pointer-events: auto;
        transition: border-color 0.15s ease, background-color 0.15s ease;
      }
      #dpad-container.active {
        background: rgba(248, 242, 230, 0.92) !important;
        border-color: #AA7641 !important;
      }
      .analog-ring-guide {
        position: absolute;
        width: 72%;
        height: 72%;
        border-radius: 50%;
        border: 1.5px dashed rgba(80, 52, 24, 0.32);
        pointer-events: none;
      }
      .analog-knob {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #FED57D;
        border: 2.5px solid #503418;
        box-shadow: 0 4px 10px rgba(80, 52, 24, 0.32);
        pointer-events: none;
        transform: translate3d(0px, 0px, 0px);
        transition: background-color 0.12s ease, border-color 0.12s ease;
        will-change: transform;
      }
      .analog-knob.active {
        background: #503418;
        border-color: #FED57D;
      }
      @media (max-width: 768px) {
        #dpad-container {
          width: 106px !important;
          height: 106px !important;
        }
        .analog-knob {
          width: 42px;
          height: 42px;
        }
      }
    `;
    document.head.appendChild(analogStyle);

    dpadContainer.innerHTML = `
      <div class="analog-ring-guide"></div>
      <div class="analog-knob" id="analog-knob"></div>
    `;
    analogKnob = document.getElementById('analog-knob');
  }

  function updateAnalogFromPoint(clientX, clientY) {
    const dx = clientX - analogOriginX;
    const dy = clientY - analogOriginY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, ANALOG_MAX_RADIUS);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (analogKnob) {
      analogKnob.style.transform = `translate3d(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px, 0px)`;
    }

    const normX = knobX / ANALOG_MAX_RADIUS;
    const normY = knobY / ANALOG_MAX_RADIUS;
    const DEADZONE = 0.08;

    analogRight = Math.abs(normX) > DEADZONE ? normX : 0.0;
    analogForward = Math.abs(normY) > DEADZONE ? -normY : 0.0;
  }

  function startAnalogAt(clientX, clientY, useStickCenter) {
    if (currentMode !== 'FPS') activateFpsMode();
    if (dpadContainer) {
      const rect = dpadContainer.getBoundingClientRect();
      if (useStickCenter) {
        analogOriginX = rect.left + rect.width * 0.5;
        analogOriginY = rect.top + rect.height * 0.5;
      } else {
        analogOriginX = clientX;
        analogOriginY = clientY;
      }
      dpadContainer.classList.add('active');
    } else {
      analogOriginX = clientX;
      analogOriginY = clientY;
    }
    if (analogKnob) analogKnob.classList.add('active');
    updateAnalogFromPoint(clientX, clientY);
  }

  // Sentuh langsung pada lingkaran analog di pojok kiri bawah
  if (dpadContainer) {
    addEvt(dpadContainer, 'touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (analogTouchId !== null) return;
      const t = e.changedTouches[0];
      if (!t) return;
      analogTouchId = t.identifier;
      startAnalogAt(t.clientX, t.clientY, true);
    }, { passive: false });

    // Dukungan drag mouse pada analog bulat (jika dites di laptop/PC)
    addEvt(dpadContainer, 'mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      analogMouseActive = true;
      startAnalogAt(e.clientX, e.clientY, true);
    });
  }

  addEvt(window, 'mousemove', (e) => {
    if (analogMouseActive) {
      updateAnalogFromPoint(e.clientX, e.clientY);
    }
  });

  addEvt(window, 'mouseup', () => {
    if (analogMouseActive) {
      resetAnalogStick();
    }
  });

  addEvt(btnMobGrab, 'click', (e) => {
    e.preventDefault();
    if (activeVehicleCtrl || hoveredVehicleCtrl) {
      mountOrDismountVehicle();
    } else {
      handleGrabOrDrop();
    }
  });

  // MULTI-TOUCH PADA KANVAS:
  // - Setengah layar kiri & bawah kiri = Analog Jalan (analogTouchId)
  // - Setengah layar kanan (atau jari kedua saat jalan) = Menengok Kamera (lookTouchId)
  function isInLeftAnalogScreenZone(clientX, clientY) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isSidebarOpen = leftSidebar && leftSidebar.classList.contains('open');
    if (isSidebarOpen && clientX <= 315) return false;
    // Area setengah layar kiri (0 s/d 50% lebar layar) dari tengah ke bawah kiri (30% s/d 100% tinggi layar)
    return clientX <= w * 0.50 && clientY >= h * 0.30;
  }

  addEvt(renderer.domElement, 'touchstart', (e) => {
    if (currentMode !== 'FPS') return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (analogTouchId === null && isInLeftAnalogScreenZone(t.clientX, t.clientY)) {
        analogTouchId = t.identifier;
        let insideCircle = false;
        if (dpadContainer) {
          const r = dpadContainer.getBoundingClientRect();
          insideCircle = (t.clientX >= r.left - 16 && t.clientX <= r.right + 16 && t.clientY >= r.top - 16 && t.clientY <= r.bottom + 16);
        }
        startAnalogAt(t.clientX, t.clientY, insideCircle);
      } else if (lookTouchId === null && t.identifier !== analogTouchId) {
        lookTouchId = t.identifier;
        prevTouchX = t.clientX;
        prevTouchY = t.clientY;
      }
    }
  }, { passive: true });

  addEvt(window, 'touchmove', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === analogTouchId) {
        updateAnalogFromPoint(t.clientX, t.clientY);
      } else if (t.identifier === lookTouchId && currentMode === 'FPS') {
        const dx = t.clientX - prevTouchX;
        const dy = t.clientY - prevTouchY;
        prevTouchX = t.clientX;
        prevTouchY = t.clientY;

        camera.rotation.y -= dx * 0.0045;
        camera.rotation.x = THREE.MathUtils.clamp(
          camera.rotation.x - dy * 0.0045,
          -Math.PI / 2.2,
          Math.PI / 2.2
        );
      }
    }
  }, { passive: true });

  function handleTouchEndOrCancel(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === analogTouchId) {
        resetAnalogStick();
      }
      if (t.identifier === lookTouchId) {
        lookTouchId = null;
      }
    }
  }

  addEvt(window, 'touchend', handleTouchEndOrCancel, { passive: true });
  addEvt(window, 'touchcancel', handleTouchEndOrCancel, { passive: true });

  // --------------------------------------------------------------------------
  // 10. KONTROL MOUSE:
  //     - KLIK KIRI (`e.button === 0`) = Masuk Mode Game Tanpa Kursor (PointerLock)
  //       atau Ambil/Taruh Makanan.
  //     - TAHAN KLIK KANAN (`e.button === 2`) = Menengok dengan Kursor Tetap Diam
  //       di Tempat (dan lepas kembali saat Klik Kanan dilepas).
  // --------------------------------------------------------------------------
  const interactRaycaster = new THREE.Raycaster();
  const downRaycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  addEvt(renderer.domElement, 'mousedown', (e) => {
    // 1. TAHAN KLIK KANAN (e.button === 2) DI MODE JELAJAH:
    //    Jika kursor sedang terlihat (!fpsControls.isLocked), bekukan kursor di titik
    //    saat ini dan kunci hardware mouse agar kursor TIDAK bergerak saat menengok!
    if (e.button === 2 && currentMode === 'FPS') {
      e.preventDefault();
      if (!fpsControls.isLocked) {
        isRightMouseHolding = true;
        isRmbHoldLock = true;
        prevMouseDragX = e.clientX;
        prevMouseDragY = e.clientY;

        // Tampilkan kursor statis tepat di koordinat mouse saat ini agar terlihat diam di tempat
        frozenCursor.style.left = `${e.clientX}px`;
        frozenCursor.style.top = `${e.clientY}px`;
        frozenCursor.style.display = 'block';
        if (container) container.style.cursor = 'none';

        // Kunci hardware mouse agar kursor OS tidak ikut bergeser
        fpsControls.lock();
      }
      return;
    }

    // 2. KLIK KIRI (e.button === 0):
    if (e.button === 0) {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (currentMode === 'FPS') {
        // Jika belum terkunci (kursor sedang muncul), Klik Kiri langsung mengunci
        // kembali ke mode game tanpa kursor persis seperti awal!
        if (!isTouchDevice && !fpsControls.isLocked) {
          isRightMouseHolding = false;
          isRmbHoldLock = false;
          hideFrozenCursor();
          fpsControls.lock();
          return;
        }
        // Jika sudah terkunci, Klik Kiri untuk ambil/taruh makanan
        if (hoveredGrabObj || heldObject) {
          handleGrabOrDrop();
        }
      } else if (currentMode === 'ORBIT') {
        if (hoveredGrabObj || heldObject) {
          handleGrabOrDrop();
        }
      }
    }
  });

  addEvt(window, 'mousemove', (e) => {
    if (currentMode === 'ORBIT') {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    } else if (currentMode === 'FPS') {
      // Fallback: jika Tahan Klik Kanan dilakukan saat browser masih dalam masa jeda ESC
      // (sehingga fpsControls.isLocked belum aktif), tetap putar kamera dengan mulus!
      if (isRightMouseHolding && !fpsControls.isLocked) {
        const dx = (e.movementX !== undefined) ? e.movementX : (e.clientX - prevMouseDragX);
        const dy = (e.movementY !== undefined) ? e.movementY : (e.clientY - prevMouseDragY);
        prevMouseDragX = e.clientX;
        prevMouseDragY = e.clientY;

        camera.rotation.y -= dx * 0.0042;
        camera.rotation.x = THREE.MathUtils.clamp(
          camera.rotation.x - dy * 0.0042,
          -Math.PI / 2.2,
          Math.PI / 2.2
        );
      }
      mouse.set(0, 0);
    }
  });

  addEvt(window, 'mouseup', (e) => {
    // Saat Klik Kanan dilepas, kembalikan kursor asli di titik semula!
    if (e.button === 2 && (isRightMouseHolding || isRmbHoldLock)) {
      isRightMouseHolding = false;
      hideFrozenCursor();
      if (isRmbHoldLock) {
        isRmbHoldLock = false;
        safeExitPointerLock();
      }
    }
  });

  function handleGrabOrDrop() {
    if (heldObject && currentModel) {
      const dropPos = new THREE.Vector3(0, -0.25, -0.95).applyMatrix4(camera.matrixWorld);
      currentModel.attach(heldObject);
      heldObject.position.copy(dropPos);
      heldObject.rotation.set(0, camera.rotation.y, 0);
      heldObject.updateMatrixWorld(true);
      heldObject = null;
      if (grabPrompt) grabPrompt.style.display = 'none';
      return;
    }
    if (hoveredGrabObj) {
      heldObject = hoveredGrabObj;
      camera.add(heldObject);
      heldObject.position.set(0.24, -0.22, -0.55);
      heldObject.rotation.set(0.12, -0.35, 0);
    }
  }

  function checkAimAtVehicleHandleOrSeat() {
    hoveredVehicleCtrl = null;
    if (activeOutletType !== 'gabungan' || currentMode !== 'FPS' || activeVehicleCtrl) return;

    camera.getWorldDirection(_camDir);

    for (let i = 0; i < vehicleControllers.length; i++) {
      const vc = vehicleControllers[i];
      _targetSpotWorld.copy(vc.localInteractSpot).applyMatrix4(vc.root.matrixWorld);
      const dist = camera.position.distanceTo(_targetSpotWorld);

      if (dist <= 3.3) {
        _toSpot.copy(_targetSpotWorld).sub(camera.position).normalize();
        const dot = _camDir.dot(_toSpot);

        interactRaycaster.setFromCamera(_zeroVec2, camera);
        interactRaycaster.far = 3.3;
        const hits = interactRaycaster.intersectObjects(vc.triggerMeshes, true);

        if (hits.length > 0 || dot > 0.85) {
          hoveredVehicleCtrl = vc;
          return;
        }
      }
    }
  }

  function clampInsideWorldBorder(pos) {
    const b = OUTLET_WORLD_BOUNDS[activeOutletType] || OUTLET_WORLD_BOUNDS['kontainer'];
    pos.x = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX);
    pos.z = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
  }

  function pushCircleOutOfBox(pos, radius, box) {
    const closestX = Math.max(box.min.x, Math.min(pos.x, box.max.x));
    const closestZ = Math.max(box.min.z, Math.min(pos.z, box.max.z));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = radius - dist;
        pos.x += (dx / dist) * overlap;
        pos.z += (dz / dist) * overlap;
        return true;
      } else {
        const penLeft = Math.abs(pos.x - box.min.x);
        const penRight = Math.abs(box.max.x - pos.x);
        const penFront = Math.abs(pos.z - box.min.z);
        const penBack = Math.abs(pos.z - box.max.z);
        const minPen = Math.min(penLeft, penRight, penFront, penBack);
        if (minPen === penLeft) pos.x = box.min.x - radius;
        else if (minPen === penRight) pos.x = box.max.x + radius;
        else if (minPen === penFront) pos.z = box.min.z - radius;
        else pos.z = box.max.z + radius;
        return true;
      }
    }
    return false;
  }

  function resolveFastAABBCollisions(pos, radius, isDrivingUnit) {
    clampInsideWorldBorder(pos);
    const footY = isDrivingUnit ? pos.y : (pos.y - EYE_HEIGHT);
    const headY = isDrivingUnit ? (pos.y + 1.8) : (pos.y - 0.15);
    let hitAny = false;

    for (let i = 0; i < obstacleBoxes.length; i++) {
      const box = obstacleBoxes[i];
      if (box.max.y < footY + 0.25 || box.min.y > headY) continue;
      if (pushCircleOutOfBox(pos, radius, box)) hitAny = true;
    }

    for (let i = 0; i < vehicleControllers.length; i++) {
      const vc = vehicleControllers[i];
      if (vc === activeVehicleCtrl) continue;
      if (pushCircleOutOfBox(pos, radius, vc.boundingBoxWorld)) hitAny = true;
    }

    clampInsideWorldBorder(pos);
    return hitAny;
  }

  function findGroundHeightAt(px, footY, pz) {
    let bestY = 0.0;
    let slopeMesh = null;

    for (let i = 0; i < floorBoxes.length; i++) {
      const fb = floorBoxes[i];
      if (px >= fb.box.min.x && px <= fb.box.max.x && pz >= fb.box.min.z && pz <= fb.box.max.z) {
        if (fb.isSlope) {
          slopeMesh = fb.mesh;
        } else if (fb.topY <= footY + 0.58 && fb.topY > bestY) {
          bestY = fb.topY;
        }
      }
    }

    if (slopeMesh) {
      _rayOrigin.set(px, footY + 0.8, pz);
      downRaycaster.set(_rayOrigin, _downVec);
      downRaycaster.far = 2.0;
      const hits = downRaycaster.intersectObject(slopeMesh, false);
      if (hits.length > 0 && hits[0].point.y > bestY) {
        bestY = hits[0].point.y;
      }
    }
    return bestY;
  }

  // --------------------------------------------------------------------------
  // 11. MAIN ANIMATION LOOP (ZERO-GC & HIGH-FPS OPTIMIZED)
  // --------------------------------------------------------------------------
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);
    frameCounter++;

    if (currentMode === 'ORBIT') {
      orbitControls.update();
    } else if (currentMode === 'FPS') {
      const kbForward = (moveState.forward ? 1 : 0) - (moveState.backward ? 1 : 0);
      const kbRight = (moveState.right ? 1 : 0) - (moveState.left ? 1 : 0);
      const forwardInput = Math.abs(analogForward) > 0.01 ? analogForward : kbForward;
      const rightInput = Math.abs(analogRight) > 0.01 ? analogRight : kbRight;

      // ======================================================================
      // A. MODE MENGENDARAI SEPEDA LISTRIK (FISIKA GAME) ATAU GEROBAK
      // ======================================================================
      if (activeVehicleCtrl) {
        const vc = activeVehicleCtrl;
        const vRoot = vc.root;
        const isTrike = (vc.type === 'trike_closed');

        // 1. INERSIA & MOMENTUM
        const prevVel = vc.currentVel;
        if (forwardInput > 0) {
          if (vc.currentVel < 0) {
            vc.currentVel += vc.brakeRate * delta;
          } else {
            vc.currentVel = Math.min(vc.maxSpeed, vc.currentVel + vc.accelRate * delta);
          }
        } else if (forwardInput < 0) {
          if (vc.currentVel > 0) {
            vc.currentVel -= vc.brakeRate * delta;
          } else {
            vc.currentVel = Math.max(-vc.maxReverseSpeed, vc.currentVel - (vc.accelRate * 0.65) * delta);
          }
        } else {
          const drag = vc.coastFriction * delta;
          if (Math.abs(vc.currentVel) <= drag) {
            vc.currentVel = 0.0;
          } else {
            vc.currentVel -= Math.sign(vc.currentVel) * drag;
          }
        }

        // 2. STEERING SMOOTHING
        vc.steerInputSmooth += (rightInput - vc.steerInputSmooth) * Math.min(1.0, delta * 7.5);

        const speedFactor = isTrike
          ? Math.min(1.0, Math.abs(vc.currentVel) / 2.2)
          : (Math.abs(vc.currentVel) > 0.05 ? 1.0 : 0.6);

        if (Math.abs(vc.steerInputSmooth) > 0.005 && speedFactor > 0.02) {
          const forwardSign = vc.currentVel >= -0.05 ? 1.0 : -1.0;
          const dYaw = vc.steerInputSmooth * vc.steerSign * forwardSign * vc.maxSteerRate * speedFactor * delta;
          vRoot.rotation.y += dYaw;
          camera.rotation.y += dYaw;
        }

        // 3. EFEK FISIKA KHUSUS SEPEDA LISTRIK (Body Roll & Pitch Squat/Nose Dive)
        if (isTrike) {
          const speedRatio = vc.currentVel / vc.maxSpeed;
          const targetRoll = vc.steerInputSmooth * speedRatio * 0.085;
          vc.currentRoll += (targetRoll - vc.currentRoll) * Math.min(1.0, delta * 8.0);

          const accelDelta = (vc.currentVel - prevVel) / Math.max(delta, 0.016);
          const targetPitch = THREE.MathUtils.clamp(-accelDelta * 0.0035, -0.045, 0.035);
          vc.currentPitch += (targetPitch - vc.currentPitch) * Math.min(1.0, delta * 9.0);

          vRoot.rotation.x = vc.currentRoll;
          vRoot.rotation.z = vc.currentPitch;
          camera.rotation.z = -vc.currentRoll * 0.65;
        }

        // 4. TRANSLASI GERAK & SUSPENSI JALAN/TROTOAR
        if (Math.abs(vc.currentVel) > 0.001) {
          const distStep = vc.currentVel * delta;

          vRoot.updateMatrixWorld();
          _worldFwd.copy(vc.localForward).transformDirection(vRoot.matrixWorld);
          _worldFwd.y = 0;
          _worldFwd.normalize();

          vRoot.position.x += _worldFwd.x * distStep;
          vRoot.position.z += _worldFwd.z * distStep;

          const hitWall = resolveFastAABBCollisions(vRoot.position, 0.85, true);
          if (hitWall) {
            vc.currentVel *= 0.25;
          }

          const groundY = findGroundHeightAt(vRoot.position.x, vRoot.position.y, vRoot.position.z);
          const heightDiff = groundY - vRoot.position.y;
          vc.suspVelY += heightDiff * 28.0 * delta;
          vc.suspVelY *= Math.max(0.0, 1.0 - 9.0 * delta);
          vRoot.position.y += heightDiff * 0.35 + vc.suspVelY * delta;

          for (let w = 0; w < vc.wheels.length; w++) {
            const wh = vc.wheels[w];
            wh.spinAngle += (distStep / wh.radius) * vc.wheelSpinSign;
            _spinQuat.setFromAxisAngle(wh.axleAxis, wh.spinAngle);
            wh.mesh.quaternion.copy(wh.initQuat).multiply(_spinQuat);
          }

          if (frameCounter % 4 === 0) {
            updateVehicleWorldBoundingBox(vc);
          }
        }

        vRoot.updateMatrixWorld();
        _seatWorldPos.copy(vc.localCameraPos).applyMatrix4(vRoot.matrixWorld);
        camera.position.copy(_seatWorldPos);

      } else {
        // ====================================================================
        // B. MODE JALAN KAKI, LARI CEPAT (`SHIFT`), & LOMPAT (`SPASI`)
        // ====================================================================
        const inputMagnitude = Math.min(1.0, Math.hypot(forwardInput, rightInput));
        const baseWalkSpeed = moveState.sprint ? 7.8 : 4.2;
        const walkOrRunSpeed = baseWalkSpeed * (inputMagnitude > 0 ? inputMagnitude : 1.0);
        const moveStep = walkOrRunSpeed * delta;

        if (forwardInput !== 0 || rightInput !== 0) {
          camera.getWorldDirection(_forwardDir);
          _forwardDir.y = 0;
          _forwardDir.normalize();

          _rightDir.crossVectors(_forwardDir, _upVec).normalize();
          _moveVec.set(
            _forwardDir.x * forwardInput + _rightDir.x * rightInput,
            0,
            _forwardDir.z * forwardInput + _rightDir.z * rightInput
          ).normalize().multiplyScalar(moveStep);

          const SUB_STEPS = 2;
          for (let s = 0; s < SUB_STEPS; s++) {
            camera.position.x += _moveVec.x / SUB_STEPS;
            camera.position.z += _moveVec.z / SUB_STEPS;
            resolveFastAABBCollisions(camera.position, COLLISION_RADIUS, false);
          }
        }

        const footY = camera.position.y - EYE_HEIGHT;
        const groundY = findGroundHeightAt(camera.position.x, footY, camera.position.z);
        const targetEyeY = groundY + EYE_HEIGHT;

        if (!isPlayerGrounded || playerVelY > 0) {
          camera.position.y += playerVelY * delta;
          playerVelY -= GRAVITY * delta;
          if (camera.position.y <= targetEyeY) {
            camera.position.y = targetEyeY;
            playerVelY = 0.0;
            isPlayerGrounded = true;
          }
        } else {
          camera.position.y += (targetEyeY - camera.position.y) * 0.32;
        }
      }
    }

    if (showDimensions) {
      updateFloatingDimensionTags();
    }

    if (frameCounter % 8 === 0) {
      checkAimAtVehicleHandleOrSeat();

      if (activeVehicleCtrl && grabPrompt) {
        if (hideDrivePromptAfterTimeout) {
          grabPrompt.style.opacity = '0';
          setTimeout(() => {
            if (hideDrivePromptAfterTimeout && grabPrompt) grabPrompt.style.display = 'none';
          }, 400);
        } else {
          grabPrompt.style.display = 'block';
          grabPrompt.style.opacity = '1';
          grabPrompt.textContent = activeVehicleCtrl.activeText;
        }
      } else if (hoveredVehicleCtrl && grabPrompt) {
        grabPrompt.style.display = 'block';
        grabPrompt.style.opacity = '1';
        grabPrompt.textContent = hoveredVehicleCtrl.promptText;
      } else if (heldObject && grabPrompt) {
        grabPrompt.style.display = 'block';
        grabPrompt.style.opacity = '1';
        grabPrompt.textContent = `Memegang: ${heldObject.name.replace('GRAB_', '').replace(/_/g, ' ')} (Klik / [E] Taruh)`;
      } else {
        if (currentMode === 'FPS') mouse.set(0, 0);
        interactRaycaster.setFromCamera(mouse, camera);
        interactRaycaster.far = 4.2;

        if (grabbableObjects.length > 0 && grabPrompt) {
          const grabHits = interactRaycaster.intersectObjects(grabbableObjects, true);
          if (grabHits.length > 0 && grabHits[0].distance <= 4.0) {
            hoveredGrabObj = findGrabRoot(grabHits[0].object);
            if (hoveredGrabObj) {
              grabPrompt.style.display = 'block';
              grabPrompt.style.opacity = '1';
              grabPrompt.textContent = `Klik / [E] Ambil: ${hoveredGrabObj.name.replace('GRAB_', '').replace(/_/g, ' ')}`;
            }
          } else {
            hoveredGrabObj = null;
            grabPrompt.style.display = 'none';
          }
        } else if (grabPrompt) {
          grabPrompt.style.display = 'none';
        }

        if (showDimensions && allInspectableMeshes.length > 0 && objMeasureHud) {
          const meshHits = interactRaycaster.intersectObjects(allInspectableMeshes, false);
          if (meshHits.length > 0) {
            const hitMesh = meshHits[0].object;
            const bBox = new THREE.Box3().setFromObject(hitMesh);
            const sz = new THREE.Vector3();
            bBox.getSize(sz);
            const cleanName = (hitMesh.name || 'Objek').replace(/_/g, ' ');
            objMeasureHud.style.display = 'block';
            objMeasureHud.textContent = `${cleanName}: P ${(sz.x * 100).toFixed(0)} cm × L ${(sz.z * 100).toFixed(0)} cm × T ${(sz.y * 100).toFixed(0)} cm`;
          } else {
            objMeasureHud.style.display = 'none';
          }
        }
      }
    }

    renderer.render(scene, camera);
  }

  const params = new URLSearchParams(window.location.search);
  const initialType = params.get('preset') || 'booth_portable';
  const typeToLabel = {
    'booth_portable': 'Reguler 1: Booth Portabel',
    'gerobak':        'Reguler 2: Gerobak Dagang',
    'trike_terbuka':  'Reguler 3: Sepeda Listrik Kargo',
    'trike_tertutup': 'Reguler 3B: Sepeda Listrik (Mode Jalan)',
    'kontainer':      'Premium 1: Booth Kontainer',
    'ruko':           'Premium 2: Ruko Takeaway',
    'restoran':       'Premium 3: Restoran 2 Lantai',
    'gabungan':       'Kompleks Gabungan (Semua Outlet)'
  };

  outletBtns.forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-type') === initialType);
  });

  updateCameraViewportCenter();
  loadOutletByType(initialType, typeToLabel[initialType] || typeToLabel['booth_portable']);
  animate();

  addEvt(window, 'resize', updateCameraViewportCenter);
});