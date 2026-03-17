// =============================================
// 21st Birthday — Summer Garden Invitation
// Three.js Envelope + GSAP + Fireflies
// =============================================

(function () {
  'use strict';

  // ---- Mobile detection ----
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);
  const isTouchDevice = 'ontouchstart' in window;

  // ---- State ----
  let isEnvelopeOpen = false;
  let isAnimating = false;
  let scene, camera, renderer, raycaster, mouse;
  let ambientFireflies = [];
  let burstFireflies = [];
  let butterflies = [];
  let hoverScale = 1;
  let targetHoverScale = 1;
  let clock = new THREE.Clock();

  // ---- Envelope refs ----
  let envelopeGroup;
  let envelopeBody;
  let flapPivot;
  let heartMesh;
  let sealGroup;
  let envelopeFlowerGroups = [];
  let activeTimeline = null;
  let sealParticles = [];

  // ---- Drag rotation ----
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let envelopeTargetRotY = 0;
  let envelopeTargetRotX = 0.05;
  let envelopeCurrentRotY = 0;
  let envelopeCurrentRotX = 0.05;
  let dragMoved = false;
  let touchStartTime = 0;

  // ---- Constants ----
  const ENVELOPE_WIDTH = 3.2;
  const ENVELOPE_HEIGHT = 2.2;
  const ENVELOPE_DEPTH = 0.12;
  const FLAP_ANGLE_CLOSED = 0;
  const FLAP_ANGLE_OPEN = -Math.PI * 0.85;

  // =============================================
  // Init
  // =============================================

  function init() {
    createScene();
    createEnvelope();
    initFireflyCanvas();
    spawnAmbientFireflies(isMobile ? 15 : 30);
    spawnFloatingElements(isMobile ? 4 : 8);
    addEventListeners();
    animate();
    hideLoadingScreen();

    gsap.to('#drag-hint', { opacity: 1, duration: 1, delay: 2.5 });
    gsap.to('#drag-hint', { opacity: 0, duration: 1, delay: 7 });
  }

  function hideLoadingScreen() {
    setTimeout(() => {
      const ls = document.getElementById('loading-screen');
      ls.classList.add('fade-out');
      setTimeout(() => ls.style.display = 'none', 1000);
    }, 1200);
  }

  // =============================================
  // Three.js Scene
  // =============================================

  function createScene() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    const camZ = window.innerWidth < 600 ? 8 : 6;
    camera.position.set(0, 0.3, camZ);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: !isMobile });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = !isMobile;
    if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Soft garden lighting — angled to preserve envelope color
    scene.add(new THREE.AmbientLight(0xfff5f5, 0.7));

    const sunLight = new THREE.DirectionalLight(0xfff8e7, 0.5);
    sunLight.position.set(-4, 6, -2);
    if (!isMobile) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 512;
      sunLight.shadow.mapSize.height = 512;
    }
    scene.add(sunLight);

    const warmFill = new THREE.PointLight(0xffecd2, 0.2, 15);
    warmFill.position.set(-4, 2, -1);
    scene.add(warmFill);

    const skyBounce = new THREE.PointLight(0xd4eaff, 0.15, 12);
    skyBounce.position.set(3, -1, -1);
    scene.add(skyBounce);

    const rimLight = new THREE.PointLight(0xffffff, 0.15, 10);
    rimLight.position.set(0, 1, 4);
    scene.add(rimLight);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
  }

  // =============================================
  // 3D Envelope — Clean white, rounded edges, pink heart, tiny flowers
  // =============================================

  function createRoundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return shape;
  }

  function createEnvelope() {
    envelopeGroup = new THREE.Group();

    const makeMat = (color, roughness) => new THREE.MeshStandardMaterial({
      color, roughness, transparent: true, opacity: 1,
    });

    // Rounded body using ExtrudeGeometry
    const bodyShape = createRoundedRectShape(ENVELOPE_WIDTH, ENVELOPE_HEIGHT, 0.15);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: ENVELOPE_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    // Center the extrusion along Z
    bodyGeo.translate(0, 0, -ENVELOPE_DEPTH / 2);
    envelopeBody = new THREE.Mesh(bodyGeo, makeMat(0xfde2e8, 0.6));
    envelopeBody.castShadow = true;
    envelopeBody.receiveShadow = true;
    envelopeGroup.add(envelopeBody);

    // Flap (with softly curved edges)
    const hw = ENVELOPE_WIDTH / 2;
    const flapTip = ENVELOPE_HEIGHT * 0.55;
    const flapShape = new THREE.Shape();
    flapShape.moveTo(-hw + 0.1, 0);
    flapShape.quadraticCurveTo(-hw * 0.5, -flapTip * 0.6, 0, -flapTip);
    flapShape.quadraticCurveTo(hw * 0.5, -flapTip * 0.6, hw - 0.1, 0);
    flapShape.lineTo(-hw + 0.1, 0);
    const flapMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(flapShape),
      new THREE.MeshStandardMaterial({
        color: 0xfde2e8, side: THREE.DoubleSide, roughness: 0.65, transparent: true, opacity: 1,
      })
    );
    flapPivot = new THREE.Group();
    flapPivot.position.set(0, ENVELOPE_HEIGHT / 2, ENVELOPE_DEPTH / 2 + 0.002);
    flapPivot.add(flapMesh);
    flapPivot.name = 'flapPivot';
    envelopeGroup.add(flapPivot);

    // Seal group (pink disc + red heart)
    sealGroup = new THREE.Group();
    sealGroup.position.set(0, ENVELOPE_HEIGHT * 0.05, ENVELOPE_DEPTH / 2 + 0.01);

    const sealDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.04, 32),
      new THREE.MeshStandardMaterial({
        color: 0xfda4af, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 1,
      })
    );
    sealDisc.rotation.x = Math.PI / 2;
    sealDisc.castShadow = true;
    sealGroup.add(sealDisc);

    heartMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(createHeartShape(0.13)),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 1,
      })
    );
    heartMesh.position.set(0, 0, 0.025);
    sealGroup.add(heartMesh);
    envelopeGroup.add(sealGroup);

    // Tiny flowers
    envelopeFlowerGroups = [];
    const flowers = [
      { pos: [-1.15, -0.65], color: 0xfda4af, size: 0.04 },
      { pos: [1.2, -0.6], color: 0xc4b5fd, size: 0.038 },
      { pos: [-0.65, 0.7], color: 0xfbbf24, size: 0.033 },
      { pos: [0.75, 0.65], color: 0xfda4af, size: 0.038 },
      { pos: [-1.25, 0.25], color: 0xfecdd3, size: 0.028 },
      { pos: [1.3, 0.18], color: 0xddd6fe, size: 0.032 },
    ];
    flowers.forEach(f => {
      const fg = createTinyFlower(f.color, f.size);
      fg.position.set(f.pos[0], f.pos[1], ENVELOPE_DEPTH / 2 + 0.02);
      envelopeGroup.add(fg);
      envelopeFlowerGroups.push(fg);
    });

    envelopeGroup.position.y = -0.2;
    envelopeGroup.rotation.x = 0.05;
    scene.add(envelopeGroup);
  }

  function createTinyFlower(color, size) {
    const group = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const geo = new THREE.SphereGeometry(size, 6, 4);
      geo.scale(1, 0.4, 1.3);
      const petal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color, roughness: 0.6, transparent: true, opacity: 1,
      }));
      petal.position.set(Math.cos(a) * size * 1.1, Math.sin(a) * size * 1.1, 0);
      petal.rotation.z = a;
      group.add(petal);
    }
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.45, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5, transparent: true, opacity: 1 })
    );
    group.add(center);
    return group;
  }

  function createHeartShape(s) {
    const shape = new THREE.Shape();
    shape.moveTo(0, s * 0.4);
    shape.bezierCurveTo(0, s * 0.8, -s * 0.9, s * 0.8, -s * 0.9, s * 0.3);
    shape.bezierCurveTo(-s * 0.9, -s * 0.2, 0, -s * 0.5, 0, -s * 0.8);
    shape.bezierCurveTo(0, -s * 0.5, s * 0.9, -s * 0.2, s * 0.9, s * 0.3);
    shape.bezierCurveTo(s * 0.9, s * 0.8, 0, s * 0.8, 0, s * 0.4);
    return shape;
  }

  // =============================================
  // Firefly System (2D Canvas)
  // =============================================

  let fireflyCtx, fireflyCanvas;

  function initFireflyCanvas() {
    fireflyCanvas = document.getElementById('firefly-canvas');
    fireflyCtx = fireflyCanvas.getContext('2d');
    resizeFireflyCanvas();
  }

  function resizeFireflyCanvas() {
    if (!fireflyCanvas) return;
    fireflyCanvas.width = window.innerWidth;
    fireflyCanvas.height = window.innerHeight;
  }

  function spawnAmbientFireflies(count) {
    for (let i = 0; i < count; i++) {
      ambientFireflies.push(createFirefly(
        Math.random() * window.innerWidth,
        Math.random() * window.innerHeight,
        false
      ));
    }
  }

  function createFirefly(x, y, isBurst) {
    // Soft white/gold for sunny garden
    const colors = ['#ffffff', '#fef3c7', '#fde68a', '#fcd34d', '#fffbeb', '#e0f2fe'];
    return {
      x, y,
      vx: (Math.random() - 0.5) * (isBurst ? 4 : 0.5),
      vy: (Math.random() - 0.5) * (isBurst ? 4 : 0.5) - (isBurst ? 2 : 0),
      size: isBurst ? (Math.random() * 4 + 3) : (Math.random() * 3 + 1.5),
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: isBurst ? 1 : (Math.random() * 0.5 + 0.2),
      life: isBurst ? 1 : Infinity,
      maxLife: isBurst ? (Math.random() * 3 + 2) : Infinity,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderSpeed: 0.02 + Math.random() * 0.03,
      glowPhase: Math.random() * Math.PI * 2,
      glowSpeed: 1 + Math.random() * 2,
      isBurst,
      trail: [],
      // Spiral (some burst fireflies spiral outward)
      angularVel: isBurst ? (Math.random() - 0.5) * 0.05 : 0,
    };
  }

  function spawnBurstFireflies(count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 5;
      const ff = createFirefly(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 40, true);
      ff.vx = Math.cos(angle) * speed;
      ff.vy = Math.sin(angle) * speed - 1.5;
      ff.size = Math.random() * 5 + 3;
      // Some spiral, some float like embers
      if (Math.random() > 0.6) {
        ff.angularVel = (Math.random() - 0.5) * 0.08;
        ff.vy -= 1; // more upward
      }
      burstFireflies.push(ff);
    }
  }

  function updateFireflies(dt) {
    ambientFireflies.forEach(ff => {
      ff.wanderAngle += (Math.random() - 0.5) * ff.wanderSpeed;
      ff.vx += Math.cos(ff.wanderAngle) * 0.05;
      ff.vy += Math.sin(ff.wanderAngle) * 0.05;
      ff.vx *= 0.98;
      ff.vy *= 0.98;
      ff.x += ff.vx;
      ff.y += ff.vy;
      ff.glowPhase += ff.glowSpeed * dt;
      if (ff.x < -20) ff.x = window.innerWidth + 20;
      if (ff.x > window.innerWidth + 20) ff.x = -20;
      if (ff.y < -20) ff.y = window.innerHeight + 20;
      if (ff.y > window.innerHeight + 20) ff.y = -20;
      ff.alpha = 0.2 + Math.sin(ff.glowPhase) * 0.25;
    });

    for (let i = burstFireflies.length - 1; i >= 0; i--) {
      const ff = burstFireflies[i];
      // Spiral motion
      if (ff.angularVel) {
        const speed = Math.sqrt(ff.vx * ff.vx + ff.vy * ff.vy);
        const a = Math.atan2(ff.vy, ff.vx) + ff.angularVel;
        ff.vx = Math.cos(a) * speed;
        ff.vy = Math.sin(a) * speed;
      }
      ff.wanderAngle += (Math.random() - 0.5) * 0.1;
      ff.vx += Math.cos(ff.wanderAngle) * 0.02;
      ff.vy += Math.sin(ff.wanderAngle) * 0.02 - 0.02;
      ff.vx *= 0.995;
      ff.vy *= 0.995;
      ff.x += ff.vx;
      ff.y += ff.vy;
      ff.life -= dt / ff.maxLife;
      ff.alpha = Math.max(0, ff.life);
      ff.glowPhase += ff.glowSpeed * dt;
      ff.trail.push({ x: ff.x, y: ff.y, alpha: ff.alpha * 0.3 });
      if (ff.trail.length > 12) ff.trail.shift();
      if (ff.life <= 0) burstFireflies.splice(i, 1);
    }
  }

  function renderFireflies() {
    fireflyCtx.clearRect(0, 0, fireflyCanvas.width, fireflyCanvas.height);

    function draw(ff) {
      if (ff.isBurst && ff.trail.length > 1) {
        for (let i = 1; i < ff.trail.length; i++) {
          const t = ff.trail[i], prev = ff.trail[i - 1];
          fireflyCtx.beginPath();
          fireflyCtx.strokeStyle = ff.color;
          fireflyCtx.globalAlpha = (i / ff.trail.length) * t.alpha * 0.5;
          fireflyCtx.lineWidth = ff.size * 0.3;
          fireflyCtx.moveTo(prev.x, prev.y);
          fireflyCtx.lineTo(t.x, t.y);
          fireflyCtx.stroke();
        }
      }
      const glowSize = ff.size * (3 + Math.sin(ff.glowPhase) * 0.5);
      const g = fireflyCtx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, glowSize);
      g.addColorStop(0, ff.color);
      g.addColorStop(0.4, ff.color + '80');
      g.addColorStop(1, ff.color + '00');
      fireflyCtx.beginPath();
      fireflyCtx.fillStyle = g;
      fireflyCtx.globalAlpha = ff.alpha;
      fireflyCtx.arc(ff.x, ff.y, glowSize, 0, Math.PI * 2);
      fireflyCtx.fill();
      fireflyCtx.beginPath();
      fireflyCtx.fillStyle = '#ffffff';
      fireflyCtx.globalAlpha = ff.alpha * 0.8;
      fireflyCtx.arc(ff.x, ff.y, ff.size * 0.4, 0, Math.PI * 2);
      fireflyCtx.fill();
      fireflyCtx.globalAlpha = 1;
    }

    ambientFireflies.forEach(draw);
    burstFireflies.forEach(draw);

    // Draw butterflies
    butterflies.forEach(b => {
      if (b.life <= 0) return;
      fireflyCtx.save();
      fireflyCtx.translate(b.x, b.y);
      fireflyCtx.rotate(Math.atan2(b.vy, b.vx) * 0.3);
      fireflyCtx.globalAlpha = b.alpha;

      const wingFlap = Math.sin(b.wingPhase) * 0.7;
      const s = b.size;

      // Left wing
      fireflyCtx.save();
      fireflyCtx.scale(1, wingFlap);
      fireflyCtx.beginPath();
      fireflyCtx.moveTo(0, 0);
      fireflyCtx.bezierCurveTo(-s * 0.4, -s * 0.8, -s * 1.2, -s * 0.6, -s * 0.9, 0);
      fireflyCtx.bezierCurveTo(-s * 1.0, s * 0.4, -s * 0.3, s * 0.5, 0, 0);
      fireflyCtx.fillStyle = b.color;
      fireflyCtx.fill();
      // Inner wing pattern
      fireflyCtx.beginPath();
      fireflyCtx.moveTo(-s * 0.2, -s * 0.1);
      fireflyCtx.bezierCurveTo(-s * 0.3, -s * 0.4, -s * 0.7, -s * 0.3, -s * 0.5, 0);
      fireflyCtx.fillStyle = b.innerColor;
      fireflyCtx.globalAlpha = b.alpha * 0.5;
      fireflyCtx.fill();
      fireflyCtx.restore();

      // Right wing
      fireflyCtx.save();
      fireflyCtx.scale(1, wingFlap);
      fireflyCtx.beginPath();
      fireflyCtx.moveTo(0, 0);
      fireflyCtx.bezierCurveTo(s * 0.4, -s * 0.8, s * 1.2, -s * 0.6, s * 0.9, 0);
      fireflyCtx.bezierCurveTo(s * 1.0, s * 0.4, s * 0.3, s * 0.5, 0, 0);
      fireflyCtx.fillStyle = b.color;
      fireflyCtx.globalAlpha = b.alpha;
      fireflyCtx.fill();
      fireflyCtx.beginPath();
      fireflyCtx.moveTo(s * 0.2, -s * 0.1);
      fireflyCtx.bezierCurveTo(s * 0.3, -s * 0.4, s * 0.7, -s * 0.3, s * 0.5, 0);
      fireflyCtx.fillStyle = b.innerColor;
      fireflyCtx.globalAlpha = b.alpha * 0.5;
      fireflyCtx.fill();
      fireflyCtx.restore();

      // Body
      fireflyCtx.beginPath();
      fireflyCtx.ellipse(0, 0, s * 0.08, s * 0.25, 0, 0, Math.PI * 2);
      fireflyCtx.fillStyle = b.bodyColor;
      fireflyCtx.globalAlpha = b.alpha;
      fireflyCtx.fill();

      fireflyCtx.restore();
      fireflyCtx.globalAlpha = 1;
    });
  }

  // =============================================
  // Butterflies
  // =============================================

  function spawnButterflies(count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const wingColors = [
      { color: '#f9a8d4', innerColor: '#fce7f3', bodyColor: '#9d174d' },
      { color: '#c4b5fd', innerColor: '#ede9fe', bodyColor: '#5b21b6' },
      { color: '#fbbf24', innerColor: '#fef3c7', bodyColor: '#92400e' },
      { color: '#fda4af', innerColor: '#ffe4e6', bodyColor: '#9f1239' },
      { color: '#93c5fd', innerColor: '#dbeafe', bodyColor: '#1e40af' },
      { color: '#fdba74', innerColor: '#ffedd5', bodyColor: '#9a3412' },
    ];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const speed = 1 + Math.random() * 2.5;
      const palette = wingColors[Math.floor(Math.random() * wingColors.length)];
      butterflies.push({
        x: cx + (Math.random() - 0.5) * 60,
        y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 10 + Math.random() * 14,
        color: palette.color,
        innerColor: palette.innerColor,
        bodyColor: palette.bodyColor,
        alpha: 1,
        life: 1,
        maxLife: 4 + Math.random() * 4,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: 6 + Math.random() * 4,
        wanderAngle: Math.random() * Math.PI * 2,
      });
    }
  }

  function updateButterflies(dt) {
    for (let i = butterflies.length - 1; i >= 0; i--) {
      const b = butterflies[i];
      // Flutter wing
      b.wingPhase += b.wingSpeed * dt;
      // Gentle wandering path
      b.wanderAngle += (Math.random() - 0.5) * 0.15;
      b.vx += Math.cos(b.wanderAngle) * 0.04;
      b.vy += Math.sin(b.wanderAngle) * 0.04 - 0.03;
      b.vx *= 0.99;
      b.vy *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.life -= dt / b.maxLife;
      b.alpha = Math.max(0, Math.min(1, b.life * 2));
      if (b.life <= 0) butterflies.splice(i, 1);
    }
  }

  // =============================================
  // Floating Elements (leaves, butterflies, dandelion seeds)
  // =============================================

  function spawnFloatingElements(count) {
    // Soft light particles (like pollen / dust motes)
    const particleCount = isMobile ? 6 : 14;
    for (let i = 0; i < particleCount; i++) {
      const el = document.createElement('div');
      el.className = 'dandelion-seed';
      el.style.left = Math.random() * 100 + '%';
      el.style.top = '-3%';
      document.body.appendChild(el);
      gsap.set(el, { opacity: 0 });
      gsap.to(el, { opacity: 0.3 + Math.random() * 0.3, duration: 2, delay: Math.random() * 5 });
      animateSeed(el);
    }
  }

  function animateSeed(seed) {
    const duration = 18 + Math.random() * 25;
    const startX = Math.random() * 100;
    gsap.fromTo(seed, {
      left: startX + '%', top: '-3%',
    }, {
      top: '103%',
      left: (startX + (Math.random() - 0.5) * 30) + '%',
      duration, ease: 'none',
      onComplete: () => animateSeed(seed),
    });
  }

  // =============================================
  // Interactions
  // =============================================

  function addEventListeners() {
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';

    // Mouse
    canvas.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasHover);

    // Touch
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    // Resize + orientation
    window.addEventListener('resize', debounce(onWindowResize, 100));
    window.addEventListener('orientationchange', () => setTimeout(onWindowResize, 150));

    document.getElementById('close-letter-btn').addEventListener('click', closeLetter);
    document.getElementById('rsvp-btn').addEventListener('click', handleRSVP);
    document.getElementById('rsvp-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleRSVP();
    });

    // Prevent overscroll on body, allow scroll on letter
    document.body.addEventListener('touchmove', (e) => {
      if (!e.target.closest('.letter-content')) e.preventDefault();
    }, { passive: false });
  }

  function debounce(fn, ms) {
    let timer;
    return function() { clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

  // ---- Mouse drag ----
  function onDragStart(e) {
    if (isEnvelopeOpen || isAnimating) return;
    isDragging = true;
    dragMoved = false;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  }

  function onDragMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    envelopeTargetRotY += dx * 0.008;
    envelopeTargetRotX += dy * 0.004;
    envelopeTargetRotX = Math.max(-0.5, Math.min(0.5, envelopeTargetRotX));
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
  }

  function onDragEnd() { isDragging = false; }

  function onCanvasClick(e) {
    if (dragMoved) return;
    updateMouse(e.clientX, e.clientY);
    checkEnvelopeClick();
  }

  function onCanvasHover(e) {
    if (isDragging) return;
    updateMouse(e.clientX, e.clientY);
    checkEnvelopeHover();
  }

  // ---- Touch ----
  function onTouchStart(e) {
    if (isEnvelopeOpen || isAnimating) return;
    if (e.touches.length === 1) {
      e.preventDefault();
      isDragging = true;
      dragMoved = false;
      touchStartTime = Date.now();
      dragStart.x = e.touches[0].clientX;
      dragStart.y = e.touches[0].clientY;
    }
  }

  function onTouchMove(e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    envelopeTargetRotY += dx * 0.008;
    envelopeTargetRotX += dy * 0.004;
    envelopeTargetRotX = Math.max(-0.5, Math.min(0.5, envelopeTargetRotX));
    dragStart.x = e.touches[0].clientX;
    dragStart.y = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (isDragging && !dragMoved && (Date.now() - touchStartTime < 300)) {
      // Tap detected
      updateMouse(dragStart.x, dragStart.y);
      // Brief scale pulse for touch feedback
      if (!isEnvelopeOpen && !isAnimating) {
        gsap.to(envelopeGroup.scale, { x: 1.08, y: 1.08, z: 1.08, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.out' });
      }
      checkEnvelopeClick();
    }
    isDragging = false;
  }

  function updateMouse(x, y) {
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;
  }

  function checkEnvelopeHover() {
    if (isEnvelopeOpen || isAnimating) return;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(envelopeGroup.children, true).length > 0;
    targetHoverScale = hit ? 1.05 : 1;
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
  }

  function checkEnvelopeClick() {
    if (isEnvelopeOpen || isAnimating) return;
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.intersectObjects(envelopeGroup.children, true).length > 0) {
      openEnvelope();
    }
  }

  // =============================================
  // ENHANCED Envelope Open Animation
  // =============================================

  function openEnvelope() {
    if (isAnimating || isEnvelopeOpen) return;
    isAnimating = true;
    isEnvelopeOpen = true;

    gsap.to('#click-prompt', { opacity: 0, duration: 0.3, onComplete: () => {
      document.getElementById('click-prompt').style.display = 'none';
    }});
    gsap.to('#drag-hint', { opacity: 0, duration: 0.2 });

    if (activeTimeline) activeTimeline.kill();

    const tl = gsap.timeline({ onComplete: () => { isAnimating = false; } });
    activeTimeline = tl;

    // 1. Snap to front-facing
    tl.to(envelopeGroup.rotation, {
      y: 0, x: 0.05, duration: 0.4, ease: 'power2.out',
      onUpdate: () => {
        envelopeTargetRotY = envelopeCurrentRotY = envelopeGroup.rotation.y;
        envelopeTargetRotX = envelopeCurrentRotX = envelopeGroup.rotation.x;
      }
    });

    // 2. Anticipation — wiggle + scale pulse
    tl.to(envelopeGroup.scale, { x: 1.04, y: 1.04, z: 1.04, duration: 0.15, yoyo: true, repeat: 1 }, '+=0.1');
    tl.to(envelopeGroup.rotation, {
      z: 0.05, duration: 0.08, yoyo: true, repeat: 5, ease: 'power1.inOut',
    }, '<');
    tl.set(envelopeGroup.rotation, { z: 0 });
    tl.set(envelopeGroup.scale, { x: 1, y: 1, z: 1 });

    // 3. Seal break — spin + shrink + particle burst + flash
    tl.to(sealGroup.rotation, { z: Math.PI * 2, duration: 0.4, ease: 'power2.in' }, '+=0.05');
    tl.to(sealGroup.scale, { x: 0, y: 0, z: 0, duration: 0.35, ease: 'back.in(2)' }, '<');
    tl.call(() => {
      spawnSealParticles();
      flashLight();
    });

    // 4. Flap opens — two-phase with overshoot
    tl.to(flapPivot.rotation, {
      x: FLAP_ANGLE_OPEN * 0.4, duration: 0.6, ease: 'power2.out',
    }, '+=0.15');
    tl.to(flapPivot.rotation, {
      x: FLAP_ANGLE_OPEN * 1.05, duration: 0.6, ease: 'power2.in',
    });
    tl.to(flapPivot.rotation, {
      x: FLAP_ANGLE_OPEN, duration: 0.3, ease: 'elastic.out(1, 0.6)',
    });

    // 5. Butterfly + firefly burst + golden bloom flash
    tl.call(() => {
      spawnButterflies(isMobile ? 8 : 15);
      spawnBurstFireflies(isMobile ? 20 : 40);
      goldenBloom();
    }, null, '-=0.5');

    // Warm up lighting briefly
    tl.call(() => {
      const flash = new THREE.PointLight(0xfbbf24, 1.5, 12);
      flash.position.set(0, 0, 3);
      scene.add(flash);
      gsap.to(flash, { intensity: 0, duration: 1.5, onComplete: () => scene.remove(flash) });
    }, null, '<');

    // 6. Camera pulls back
    tl.to(camera.position, { z: 7.5, y: 0.6, duration: 1.2, ease: 'power2.inOut' }, '+=0.2');

    // 7. Envelope tilts back and floats up + fade out
    tl.to(envelopeGroup.rotation, { x: 0.6, duration: 1.2, ease: 'power2.in' }, '+=0.1');
    tl.to(envelopeGroup.position, { y: 4, duration: 1.2, ease: 'power2.in' }, '<');
    tl.call(() => fadeEnvelopeMaterials(0, 0.8), null, '<');

    // 8. Show letter
    tl.call(() => {
      envelopeGroup.visible = false;
      document.getElementById('canvas-container').style.zIndex = '-1';
      showLetter();
    }, null, '+=0.3');
  }

  // ---- Seal break particles ----
  function spawnSealParticles() {
    const count = isMobile ? 8 : 15;
    const colors = [0xfda4af, 0xfbbf24, 0xf43f5e, 0xfecdd3, 0xffffff];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 6, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length], transparent: true, opacity: 1, roughness: 0.4,
      });
      const particle = new THREE.Mesh(geo, mat);
      // Start at seal position (world coords)
      particle.position.copy(sealGroup.position);
      particle.position.y += envelopeGroup.position.y;
      scene.add(particle);

      const angle = (i / count) * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      const target = {
        x: particle.position.x + Math.cos(angle) * speed,
        y: particle.position.y + Math.sin(angle) * speed * 0.5 + Math.random() * 1.5,
        z: particle.position.z + (Math.random() - 0.5) * 1.5,
      };

      gsap.to(particle.position, {
        x: target.x, y: target.y, z: target.z,
        duration: 0.8 + Math.random() * 0.5,
        ease: 'power2.out',
      });
      gsap.to(particle.material, {
        opacity: 0, duration: 1, delay: 0.3,
        onComplete: () => {
          scene.remove(particle);
          geo.dispose();
          mat.dispose();
        }
      });
    }
  }

  function flashLight() {
    const flash = new THREE.PointLight(0xffffff, 2, 8);
    flash.position.set(0, 0, 2);
    scene.add(flash);
    gsap.to(flash, { intensity: 0, duration: 0.5, onComplete: () => scene.remove(flash) });
  }

  function goldenBloom() {
    const bloom = document.getElementById('golden-bloom');
    gsap.fromTo(bloom, { opacity: 0 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  function fadeEnvelopeMaterials(targetOpacity, duration) {
    envelopeGroup.traverse(child => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.transparent) gsap.to(mat, { opacity: targetOpacity, duration });
        });
      }
    });
  }

  // ---- Show letter with staggered reveal ----
  function showLetter() {
    const overlay = document.getElementById('letter-overlay');
    const letterContent = overlay.querySelector('.letter-content');
    const closeBtn = document.getElementById('close-letter-btn');

    overlay.classList.add('active');
    // Fade in overlay with a semi-transparent backdrop to sit above the 3D canvas
    gsap.to(overlay, { opacity: 1, backgroundColor: 'rgba(0,0,0,0.4)', duration: 0.8, ease: 'power2.out' });

    // Letter slides up + scales in + subtle rotation
    gsap.fromTo(letterContent, {
      y: window.innerHeight * 0.6, scale: 0.85, rotation: 2,
    }, {
      y: 0, scale: 1, rotation: 0,
      duration: 1.2, ease: 'power3.out', delay: 0.2,
    });

    // Staggered reveal of inner content
    const staggerEls = overlay.querySelectorAll('.letter-stagger');
    gsap.fromTo(staggerEls, {
      opacity: 0, y: 15,
    }, {
      opacity: 1, y: 0,
      duration: 0.5, stagger: 0.08, delay: 0.8, ease: 'power2.out',
    });

    gsap.to(closeBtn, { delay: 1.5, onStart: () => closeBtn.classList.add('active') });

    // Show scroll arrow
    const scrollArrow = document.getElementById('scroll-arrow');
    const scrollTarget = document.getElementById('letter-content');
    gsap.to(scrollArrow, { opacity: 1, duration: 0.5, delay: 1.8 });
    const hideArrowOnScroll = () => {
      gsap.to(scrollArrow, { opacity: 0, duration: 0.3 });
      scrollTarget.removeEventListener('scroll', hideArrowOnScroll);
    };
    scrollTarget.addEventListener('scroll', hideArrowOnScroll);
    spawnBurstFireflies(isMobile ? 10 : 20);
  }

  // ---- Close letter ----
  function closeLetter() {
    const overlay = document.getElementById('letter-overlay');
    const letterContent = overlay.querySelector('.letter-content');
    const closeBtn = document.getElementById('close-letter-btn');

    closeBtn.classList.remove('active');
    gsap.to(letterContent, { y: window.innerHeight, scale: 0.9, duration: 0.8, ease: 'power2.in' });
    gsap.to(overlay, {
      opacity: 0, backgroundColor: 'rgba(0,0,0,0)', duration: 0.6, delay: 0.3,
      onComplete: () => { overlay.classList.remove('active'); resetEnvelope(); }
    });
  }

  // =============================================
  // Reset
  // =============================================

  function resetEnvelope() {
    if (activeTimeline) { activeTimeline.kill(); activeTimeline = null; }

    // Kill tweens
    gsap.killTweensOf(envelopeGroup.position);
    gsap.killTweensOf(envelopeGroup.rotation);
    gsap.killTweensOf(envelopeGroup.scale);
    gsap.killTweensOf(sealGroup.scale);
    gsap.killTweensOf(sealGroup.rotation);
    gsap.killTweensOf(flapPivot.rotation);
    gsap.killTweensOf(camera.position);

    // Reset all materials
    envelopeGroup.traverse(child => {
      if (child.isMesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          gsap.killTweensOf(mat);
          if (mat.transparent) mat.opacity = 1;
        });
      }
    });

    // Restore canvas z-index and visibility
    document.getElementById('canvas-container').style.zIndex = '5';
    envelopeGroup.visible = true;
    envelopeGroup.position.set(0, -0.2, 0);
    envelopeGroup.rotation.set(0.05, 0, 0);
    envelopeGroup.scale.set(1, 1, 1);
    flapPivot.rotation.set(0, 0, 0);
    sealGroup.scale.set(1, 1, 1);
    sealGroup.rotation.set(0, 0, 0);
    camera.position.set(0, 0.3, window.innerWidth < 600 ? 8 : 6);
    camera.lookAt(0, 0, 0);

    envelopeTargetRotY = envelopeCurrentRotY = 0;
    envelopeTargetRotX = envelopeCurrentRotX = 0.05;
    hoverScale = 1;
    targetHoverScale = 1;

    isEnvelopeOpen = false;
    isAnimating = false;

    const prompt = document.getElementById('click-prompt');
    prompt.style.display = '';
    gsap.fromTo(prompt, { opacity: 0 }, { opacity: 1, duration: 0.5 });

    // Reset staggered letter content opacity
    document.querySelectorAll('.letter-stagger').forEach(el => {
      el.style.opacity = '';
      el.style.transform = '';
    });
    gsap.set('.letter-content', { y: '100vh', scale: 1, rotation: 0 });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeFireflyCanvas();
  }

  // =============================================
  // Animation Loop
  // =============================================

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    if (envelopeGroup && !isEnvelopeOpen && !isAnimating) {
      envelopeGroup.position.y = -0.2 + Math.sin(time * 1.2) * 0.06;
      if (!isDragging) envelopeTargetRotY += Math.cos(time * 0.3) * 0.0003;
      envelopeCurrentRotY += (envelopeTargetRotY - envelopeCurrentRotY) * 0.08;
      envelopeCurrentRotX += (envelopeTargetRotX - envelopeCurrentRotX) * 0.08;
      envelopeGroup.rotation.y = envelopeCurrentRotY;
      envelopeGroup.rotation.x = envelopeCurrentRotX;
      hoverScale += (targetHoverScale - hoverScale) * 0.1;
      envelopeGroup.scale.setScalar(hoverScale);
    }

    updateFireflies(dt);
    updateButterflies(dt);
    renderFireflies();
    renderer.render(scene, camera);
  }

  // =============================================
  // RSVP + Google Calendar
  // =============================================

  // ---- CONFIGURATION — Update these with your event details ----
  const EVENT_CONFIG = {
    title: '21st Birthday Celebration',
    // Format: YYYYMMDDTHHMMSS (local time)
    startDate: '20260615T190000',
    endDate:   '20260615T230000',
    location: 'Venue Name, City',
    description: 'You are cordially invited to celebrate this special milestone!',
    // Google Apps Script web app URL — see setup instructions in README
    googleSheetURL: 'https://script.google.com/macros/s/AKfycby2pGbyNS7X8humsgw-XWDzZLXjUfpSq2BmfHLfkVRC73UdwoJvNFemavOiDYUfEUo/exec',
  };

  function handleRSVP() {
    const nameInput = document.getElementById('rsvp-name');
    const btn = document.getElementById('rsvp-btn');
    const status = document.getElementById('rsvp-status');
    const name = nameInput.value.trim();

    if (!name) {
      status.textContent = 'Please enter your name';
      status.className = 'rsvp-status error';
      nameInput.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Added!';

    // Log RSVP to Google Sheets in background
    logRSVP(name);

    // Show tappable calendar link (works in Telegram/in-app browsers)
    const calURL = buildCalendarURL(name);
    status.innerHTML = 'Thank you, ' + name + '!<br>' +
      '<a href="' + calURL + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;margin-top:0.5rem;padding:0.5rem 1.5rem;' +
      'background:linear-gradient(135deg,#4285f4,#357ae8);color:#fff;' +
      'border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9rem;">' +
      'Add to Google Calendar</a>';
    status.className = 'rsvp-status success';
  }

  function logRSVP(name) {
    // If no Google Sheet URL configured, just resolve
    if (!EVENT_CONFIG.googleSheetURL) {
      console.log('RSVP received (no Google Sheet configured):', name);
      return Promise.resolve();
    }

    return fetch(EVENT_CONFIG.googleSheetURL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  function buildCalendarURL(name) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: EVENT_CONFIG.title,
      dates: EVENT_CONFIG.startDate + '/' + EVENT_CONFIG.endDate,
      details: 'RSVP by: ' + name + '\n\n' + EVENT_CONFIG.description,
      location: EVENT_CONFIG.location,
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  // =============================================
  // Start
  // =============================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
