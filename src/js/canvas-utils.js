import * as THREE from "three";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene lighting
const SCENE_AMBIENT_LIGHT = 0xFFFFFF;
const SCENE_DIRECTIONAL_LIGHT = 0xFFFFFF;

// Globe configuration constants
const SPHERE_GLOW_COLOR = "#266f9a";
const SPHERE_RADIUS = 4;
const SPHERE_WIDTH_HEIGHT_SEGMENTS = 256;
const MARKERS_RENDER_ORDER = 1000;
const GRADIENT_SPHERE_RENDER_ORDER = 1;
const GLOBE_SPHERE_RENDER_ORDER = 999;
const MAX_SCENE_ZOOM_CLOSER = 19;
const MAX_SCENE_ZOOM_FAR = 26;
const CONSTANT_SPHERE_ROTATION_SPEED = 0.0015;
const SWIPE_DISTANCE_THRESHOLD = 200;
const SWIPE_ACTION_DURATION_THRESHOLD_MS = 300;
const TYPICAL_CLICK_DURATION_MS = 75;

// Performance optimization constants
const TARGET_FPS = 60;
const FRAME_TIME_THRESHOLD = 1000 / TARGET_FPS;

// Exposed state variables
let rotateSphere = true;

/**
 * Creates a Three.js scene with an interactive globe
 * @param {HTMLElement} container - The DOM element to render the scene in
 * @param {Object} options - Configuration options
 * @returns {Object} Object containing scene components and control methods
 */
export function createGlobeScene(container, options = {}) {
  const {
    showIcosahedron = false,
    showLatLngGrid = false,
    loadBrandingImageMarkers = false,
    enableInteraction = true,
    earthTexture = null,
    onMarkerClick = null
  } = options;

  // Validate container
  if (!container && typeof DEBUG !== 'undefined' && DEBUG) {
    return { cleanup: () => {} };
  }

  // Performance monitoring
  let frameCount = 0;
  let lastFpsTime = 0;
  let currentFps = 60;

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 2000);
  camera.position.set(0, 0, MAX_SCENE_ZOOM_CLOSER);

  const renderer = new THREE.WebGLRenderer({ 
    antialias: window.devicePixelRatio <= 1, // Only enable AA on low-DPI displays
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
    preserveDrawingBuffer: false, // Better performance
    failIfMajorPerformanceCaveat: false
  });
  
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor('#079', 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  
  // Optimize renderer settings for performance
  renderer.shadowMap.enabled = false;
  renderer.physicallyCorrectLights = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.sortObjects = false; // Disable automatic sorting for better performance
  renderer.autoClear = true;
  renderer.autoClearColor = true;
  renderer.autoClearDepth = true;
  renderer.autoClearStencil = true;
  
  container.appendChild(renderer.domElement);

  const canvas = renderer.domElement;
  canvas.style.position = "relative";

  // Controls setup with optimized settings
  let controls = null;
  let composer = null;
  let renderPass = null;
  let outlinePass = null;
  
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = MAX_SCENE_ZOOM_CLOSER;
  controls.maxDistance = MAX_SCENE_ZOOM_FAR;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1; // Increased for snappier response
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.autoRotate = false;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 1.0;
  
  // Simplified post-processing - only add if needed
  const usePostProcessing = window.devicePixelRatio <= 2 && !(/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  
  if (usePostProcessing) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera);
    outlinePass.edgeStrength = 1;
    outlinePass.edgeGlow = 5; // Reduced from 10
    composer.addPass(outlinePass);
  }

  // Create main group for globe components
  const group = new THREE.Group();
  scene.add(group);

  // Optimized lighting setup
  const ambientLight = new THREE.AmbientLight(SCENE_AMBIENT_LIGHT, 3.0);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(SCENE_DIRECTIONAL_LIGHT, 1.5);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = false;
  scene.add(directionalLight);

  // Create gradient glow sphere
  const gradientSphere = createGradientSphere(SPHERE_RADIUS);
  group.add(gradientSphere);

  // Create main globe
  const globe = createGlobe(SPHERE_RADIUS, earthTexture);
  group.add(globe);

  // Add optional features
  if (showIcosahedron) {
    const icosahedron = createIcosahedron(SPHERE_RADIUS + 0.1);
    globe.add(icosahedron);
  }

  if (showLatLngGrid) {
    const gridLines = createLatLongLines(SPHERE_RADIUS + 0.02, 12, 24); // Reduced grid density
    globe.add(gridLines);
    addLatLongLabels(group, SPHERE_RADIUS + 0.5);
  }

  // Interaction setup
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const markers = [];

  // Optimized animation variables
  let sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
  let targetRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
  let isSwiping = false;
  let slowingDown = false;
  let swipeStartX = 0;
  let swipeDistance = 0;
  let swipeActionDuration = 0;
  let lastTime = performance.now();
  
  // Smooth interpolation for rotation speed changes
  const lerp = (start, end, factor) => start + (end - start) * factor;

  // Markers click area threshold
  raycaster.params.Mesh = { threshold: 0.5 };

  // Performance monitoring function
  function updatePerformanceMetrics(currentTime) {
    frameCount++;
    if (currentTime - lastFpsTime >= 1000) {
      currentFps = frameCount;
      frameCount = 0;
      lastFpsTime = currentTime;
    }
  }

  // Optimized event handlers
  function onSwipeStart(event) {
    if (slowingDown) {      
      isSwiping = false;
      swipeDistance = 1;
      targetRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
    } else {
      swipeActionDuration = performance.now();
      isSwiping = true;
      if (event.touches) {
        swipeStartX = event.touches[0].clientX;
      } else {
        swipeStartX = event.clientX;
      }
    }
  }

  function onSwipeMove(event) {
    if (isSwiping) {
      let swipeEndX;
      if (event.touches) {
        swipeEndX = event.touches[0].clientX;
      } else {
        swipeEndX = event.clientX;
      }

      swipeDistance = swipeEndX - swipeStartX;

      if (Math.abs(swipeDistance) > 1) {
        const maxSwipeSpeed = 0.02; // Maximum allowed rotation speed
        const normalizedSwipe = Math.max(-1, Math.min(1, swipeDistance / 300)); // Clamp -1 to 1
        targetRotationSpeed = normalizedSwipe * maxSwipeSpeed;
      }
    }
  }

  function onSwipeEnd(event) {
    swipeActionDuration = performance.now() - swipeActionDuration;
    if (isSwiping && 
        Math.abs(swipeDistance) > SWIPE_DISTANCE_THRESHOLD && 
        swipeActionDuration < SWIPE_ACTION_DURATION_THRESHOLD_MS && 
        swipeActionDuration > TYPICAL_CLICK_DURATION_MS) {
      targetRotationSpeed = swipeDistance * 0.005; // Reduced multiplier
      slowingDown = true;
    } else {
      targetRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
    }
    isSwiping = false;
  }

  function onMouseClick(event) {
    if (!enableInteraction) return;

    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers, false);

    if (intersects.length > 0 && intersects[0].object.userData.isMarker) {
      const marker = intersects[0].object;
      
      if (onMarkerClick) {
        onMarkerClick(marker.userData);
      }
    }
  }

  // Add event listeners with passive option for better performance
  if (enableInteraction) {
    container.addEventListener('mousedown', onSwipeStart, { passive: true });
    container.addEventListener('mousemove', onSwipeMove, { passive: true });
    container.addEventListener('mouseup', onSwipeEnd, { passive: true });
    container.addEventListener('click', onMouseClick);
    container.addEventListener('touchstart', onSwipeStart, { passive: true });
    container.addEventListener('touchmove', onSwipeMove, { passive: true });
    container.addEventListener('touchend', onSwipeEnd, { passive: true });
  }

  let animationId;
  const targetFrameTime = 1000 / TARGET_FPS;
  let accumulator = 0;

  function animate(currentTime) {    
    animationId = requestAnimationFrame(animate);

    if(!rotateSphere) return;
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    accumulator += deltaTime;

    // Optional: log metrics
    updatePerformanceMetrics(currentTime);

    // Only slow down if still above the constant speed
    if (slowingDown) {
      targetRotationSpeed *= 0.9; // Damping factor
      if (targetRotationSpeed <= CONSTANT_SPHERE_ROTATION_SPEED) {
        targetRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
        slowingDown = false;
      }
    }

    // Smooth interpolation
    const smoothingFactor = Math.min(0.25, deltaTime / 1000);
    sphereRotationSpeed = lerp(sphereRotationSpeed, targetRotationSpeed, smoothingFactor);
    if (Math.abs(sphereRotationSpeed) < 0.00001) sphereRotationSpeed = 0;

    // Rotate sphere
    group.rotation.y += sphereRotationSpeed;

    // Controls & rendering
    if (controls) controls.update();
    if (composer && usePostProcessing) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

animate(performance.now());

  // Public API
  return {
    scene,
    camera,
    renderer,
    globe: group,
    addMarker: (lat, lon, name, options = {}) => addMarker(group, markers, lat, lon, name, SPHERE_RADIUS, options),
    getCurrentFps: () => currentFps,
    cleanup: () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (enableInteraction) {
        container.removeEventListener('mousedown', onSwipeStart);
        container.removeEventListener('mousemove', onSwipeMove);
        container.removeEventListener('mouseup', onSwipeEnd);
        container.removeEventListener('click', onMouseClick);
        container.removeEventListener('touchstart', onSwipeStart);
        container.removeEventListener('touchmove', onSwipeMove);
        container.removeEventListener('touchend', onSwipeEnd);
      }
      renderer.dispose();
      if (composer) composer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

/**
 * Creates a gradient glow sphere around the globe
 */
function createGradientSphere(radius) {
  const gradientMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      glowColor: { value: new THREE.Color(SPHERE_GLOW_COLOR) },
      viewVector: { value: new THREE.Vector3(0, 0, 1) },
      intensity: { value: 0.4 }, // Slightly reduced intensity
      fadeStrength: { value: 6 } // Slightly reduced fade strength
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * vec4(vPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform vec3 viewVector;
      uniform float intensity;
      uniform float fadeStrength;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float glow = dot(normalize(vNormal), normalize(viewVector));
        float opacity = pow(1.0 - glow, fadeStrength) * intensity;
        gl_FragColor = vec4(glowColor, opacity);
      }
    `
  });

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.05, SPHERE_WIDTH_HEIGHT_SEGMENTS, SPHERE_WIDTH_HEIGHT_SEGMENTS),
    gradientMaterial
  );
  sphere.renderOrder = GRADIENT_SPHERE_RENDER_ORDER;
  return sphere;
}

/**
 * Creates the main globe with Earth texture
 */
function createGlobe(radius, textureUrl = null) {
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureUrl ? textureLoader.load(textureUrl) : null;
  
  // Optimize texture if provided
  if (earthTexture) {
    earthTexture.generateMipmaps = true;
    earthTexture.minFilter = THREE.LinearMipmapLinearFilter;
    earthTexture.magFilter = THREE.LinearFilter;
    earthTexture.wrapS = THREE.ClampToEdgeWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;
  }
  
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: earthTexture,
    transparent: true,
    opacity: 1,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const earthGeometry = new THREE.SphereGeometry(radius, SPHERE_WIDTH_HEIGHT_SEGMENTS, SPHERE_WIDTH_HEIGHT_SEGMENTS);
  const globe = new THREE.Mesh(earthGeometry, earthMaterial);
  globe.renderOrder = GLOBE_SPHERE_RENDER_ORDER;

  return globe;
}

/**
 * Creates an icosahedron wireframe around the globe
 */
function createIcosahedron(radius) {
  return new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 6), // Reduced subdivision level
    new THREE.MeshStandardMaterial({ color: '#08b', wireframe: true })
  );
}

/**
 * Creates latitude and longitude grid lines
 */
function createLatLongLines(radius, latSteps = 8, lonSteps = 16) { // Reduced from original values
  const positions = [];

  // Latitude lines (horizontal)
  for (let i = 1; i < latSteps; i++) {
    const lat = (i / latSteps) * Math.PI;
    for (let j = 0; j < lonSteps; j++) {
      const lon1 = (j / lonSteps) * 2 * Math.PI;
      const lon2 = ((j + 1) / lonSteps) * 2 * Math.PI;

      const x1 = radius * Math.sin(lat) * Math.cos(lon1);
      const y1 = radius * Math.cos(lat);
      const z1 = radius * Math.sin(lat) * Math.sin(lon1);

      const x2 = radius * Math.sin(lat) * Math.cos(lon2);
      const y2 = radius * Math.cos(lat);
      const z2 = radius * Math.sin(lat) * Math.sin(lon2);

      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }

  // Longitude lines (vertical)
  for (let i = 0; i < lonSteps; i++) {
    const lon = (i / lonSteps) * 2 * Math.PI;
    for (let j = 0; j < latSteps; j++) {
      const lat1 = (j / latSteps) * Math.PI;
      const lat2 = ((j + 1) / latSteps) * Math.PI;

      const x1 = radius * Math.sin(lat1) * Math.cos(lon);
      const y1 = radius * Math.cos(lat1);
      const z1 = radius * Math.sin(lat1) * Math.sin(lon);

      const x2 = radius * Math.sin(lat2) * Math.cos(lon);
      const y2 = radius * Math.cos(lat2);
      const z2 = radius * Math.sin(lat2) * Math.sin(lon);

      positions.push(x1, y1, z1, x2, y2, z2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  return new THREE.LineSegments(geometry, material);
}

/**
 * Adds latitude and longitude labels to the globe
 */
function addLatLongLabels(group, radius) {
  const latLabels = [-60, -30, 0, 30, 60];
  const lonLabels = [-120, -60, 0, 60, 120];

  for (let lat of latLabels) {
    const sprite = makeTextSprite(`${lat}°`, { fontsize: 32, type: "lat" }); // Reduced font size
    const position = latLonToVector3(lat, 0, radius);
    sprite.position.copy(position);
    group.add(sprite);
  }

  for (let lon of lonLabels) {
    const sprite = makeTextSprite(`${lon}°`, { fontsize: 32, type: "lng" }); // Reduced font size
    const position = latLonToVector3(0, lon, radius);
    sprite.position.copy(position);
    group.add(sprite);
  }
}

/**
 * Creates a text sprite for labels
 */
function makeTextSprite(message, parameters = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontface = parameters.fontface || 'Arial';
  const fontsize = parameters.fontsize || 10;
  
  canvas.width = 128; // Reduced from 256
  canvas.height = 64;  // Reduced from 128
  
  context.font = `${fontsize}px ${fontface}`;
  context.fillStyle = parameters.fillStyle || SPHERE_GLOW_COLOR;
  context.textAlign = 'center';
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.5, 1);
  return sprite;
}

/**
 * Converts latitude/longitude to 3D vector position
 */
function latLonToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Adds a marker to the globe at specified coordinates
 */
function addMarker(group, markersArray, lat, lon, name, radius, options = {}) {
  const {
    color = 0xff0000,
    size = 0.10, // Slightly reduced size
    useBrandingImage = false,
    imagePath = 'img/save-the-children-logo.png'
  } = options;

  const position = latLonToVector3(lat, lon, radius + 0.05);
  let marker;

  if (useBrandingImage) {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(imagePath);
    const markerMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const markerGeometry = new THREE.PlaneGeometry(0.8, 0.8); // Slightly reduced size
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.scale.set(0.4, 0.4, 0.4); // Reduced scale
    marker.rotation.x = -Math.PI / 2;
  } else {
    const markerGeometry = new THREE.SphereGeometry(size, 16, 16); // Reduced segments from 16
    const markerMaterial = new THREE.MeshStandardMaterial({ color, emissive: 0x111111,transparent: true,opacity: 1});
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
  }

  marker.position.copy(position);
  marker.userData = {
    isMarker: true,
    name,
    lat,
    lon,
    ...options
  };
  marker.renderOrder = MARKERS_RENDER_ORDER;

  // Add invisible hit area for easy clicking on markers
  const markerHitSize = size*1;
  const hitGeometry = new THREE.SphereGeometry(markerHitSize, 8, 8);
  const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
  hitMesh.position.copy(position);
  hitMesh.userData = marker.userData; // Same data for callback
  hitMesh.renderOrder = MARKERS_RENDER_ORDER;

  group.add(marker);
  group.add(hitMesh);
  markersArray.push(hitMesh);

  return marker;
}

/**
 * Creates a resize handler for the globe scene
 */
export function createGlobeResizeHandler(camera, renderer, container) {
  return function onWindowResize() {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
}

/**
 * Sets up a complete globe scene with automatic cleanup
 */
export function setupGlobeScene(container, options = {}) {
  if (!container) return () => {};

  const globeScene = createGlobeScene(container, options);
  
  const resizeHandler = createGlobeResizeHandler(globeScene.camera, globeScene.renderer, container);
  window.addEventListener("resize", resizeHandler, false);

  // Add some default markers if requested
  if (options.addDefaultMarkers) {
    globeScene.addMarker(-16.8320044663129, -65.57997409031847, "Bolivia");
    globeScene.addMarker(16.871890, 29.662979, "Sudan");
    globeScene.addMarker(31.505688716093005, 34.47440122930478, "Gaza");
    globeScene.addMarker(48.93848108965053, 31.488680986772465, "Ukraine");
    globeScene.addMarker(0.6135656340107651, 37.86454680897832, "Kenya");
    globeScene.addMarker(24.16779844515624, 90.26363590901566, "Bangladesh");
    globeScene.addMarker(33.89401745043521, 64.7245127621119, "Afghanistan");
    globeScene.addMarker(23.756642724639264, -102.58269351651069, "Mexico");
    globeScene.addMarker(28.6139, 77.2088, "Delhi");
  }

  // Return cleanup function
  return { 
    cleanup: () => {
      window.removeEventListener("resize", resizeHandler);
      globeScene.cleanup();
    },
    setRotateSphere: (isEnabled) => {
      rotateSphere = isEnabled;
    },
    getCurrentFps: () => globeScene.getCurrentFps(),
    getQualityLevel: () => globeScene.getQualityLevel ? globeScene.getQualityLevel() : 'optimized'
  };
}