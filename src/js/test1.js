import * as THREE from "three";
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Globe configuration constants
const SPHERE_RADIUS = 4;
const SPHERE_WIDTH_HEIGHT_SEGMENTS = 64;
const MARKERS_RENDER_ORDER = 1000;
const GRADIENT_SPHERE_RENDER_ORDER = 1;
const GLOBE_SPHERE_RENDER_ORDER = 999;
const MAX_SCENE_ZOOM_CLOSER = 14;
const MAX_SCENE_ZOOM_FAR = 25;
const CONSTANT_SPHERE_ROTATION_SPEED = 0.25;
const SWIPE_DISTANCE_THRESHOLD = 200;
const SWIPE_ACTION_DURATION_THRESHOLD_MS = 150;
const TYPICAL_CLICK_DURATION_MS = 100;

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
  if (!container) {
    console.error('❌ No container provided to createGlobeScene');
    return { cleanup: () => {} };
  }

  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 2000);
  camera.position.set(0, 0, MAX_SCENE_ZOOM_CLOSER);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  console.log("Renderer size:", container.clientWidth, container.clientHeight);
  renderer.setClearColor('#079', 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  
  // FIX: Append to the provided container instead of document.body
  container.appendChild(renderer.domElement);

  const canvas = renderer.domElement;
  canvas.style.position = "relative";
  // FIX: Remove the marginTop that was pushing the canvas down
  // canvas.style.marginTop = `50px`;

  // Controls setup (if OrbitControls is available)
  let controls = null;
  let composer = null;
  let renderPass = null;
  let outlinePass = null;
  
  // Set maximum zooming levels
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = MAX_SCENE_ZOOM_CLOSER;  // Minimum zoom in
  controls.maxDistance = MAX_SCENE_ZOOM_FAR; // Maximum zoom out
  
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera);
  composer.addPass(outlinePass);

  outlinePass.edgeStrength = 1;
  outlinePass.edgeGlow = 10;

  // Create main group for globe components
  const group = new THREE.Group();
  scene.add(group); // FIX: Add group to scene

  // Add ambient light
  const ambientLight = new THREE.AmbientLight("#ffffff", 2.8);
  scene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight("#ffffff", 2.5);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  // Create gradient glow sphere
  const gradientSphere = createGradientSphere(SPHERE_RADIUS);
  group.add(gradientSphere);

  // Create main globe
  const globe = createGlobe(SPHERE_RADIUS, earthTexture);
  group.add(globe);

  console.log("Group with globe:", group);

  // Add icosahedron if requested
  if (showIcosahedron) {
    const icosahedron = createIcosahedron(SPHERE_RADIUS + 0.1);
    globe.add(icosahedron);
  }

  // Add lat/lng grid if requested
  if (showLatLngGrid) {
    const gridLines = createLatLongLines(SPHERE_RADIUS + 0.02, 18, 36);
    globe.add(gridLines);
    addLatLongLabels(group, SPHERE_RADIUS + 0.5);
  }

  // Interaction setup
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const markers = [];
  const selectedObjects = [];

  // Animation variables
  let sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
  let rotateSphere = true;
  let isSwiping = false;
  let slowingDown = false;
  let swipeStartX = 0;
  let swipeDistance = 0;
  let swipeActionDuration = 0;
  let lastFrameTime = 0;

  // Event handlers
  function onSwipeStart(event) {
    if (slowingDown) {
      isSwiping = false;
      swipeDistance = 1;
      sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
    } else {
      swipeActionDuration = new Date().getTime();
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
        sphereRotationSpeed = swipeDistance * 0.001;
      }
    }
  }

  function onSwipeEnd(event) {
    swipeActionDuration = new Date().getTime() - swipeActionDuration;
    if (isSwiping && 
        Math.abs(swipeDistance) > SWIPE_DISTANCE_THRESHOLD && 
        swipeActionDuration < SWIPE_ACTION_DURATION_THRESHOLD_MS && 
        swipeActionDuration > TYPICAL_CLICK_DURATION_MS) {
      sphereRotationSpeed = swipeDistance / 5;
      isSwiping = false;
      slowingDown = true;
    } else {
      sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
    }
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
      rotateSphere = false;
      
      if (onMarkerClick) {
        onMarkerClick(marker.userData);
      }
    }
  }

  // Add event listeners if interaction is enabled
  if (enableInteraction) {
    container.addEventListener('mousedown', onSwipeStart);
    container.addEventListener('mousemove', onSwipeMove);
    container.addEventListener('mouseup', onSwipeEnd);
    container.addEventListener('click', onMouseClick);
    container.addEventListener('touchstart', onSwipeStart);
    container.addEventListener('touchmove', onSwipeMove);
    container.addEventListener('touchend', onSwipeEnd);
  }

  // Animation loop
  let animationId;
  function animate(time) {
    animationId = requestAnimationFrame(animate);

    const deltaFromLastFrame = (time - lastFrameTime) / 5000 || 0.016; // Fallback for first frame
    lastFrameTime = time;

    if (rotateSphere || slowingDown) {
      if (controls) controls.update();

      if (sphereRotationSpeed <= CONSTANT_SPHERE_ROTATION_SPEED) {
        sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
      }

      group.rotation.y += sphereRotationSpeed * deltaFromLastFrame;

      if (slowingDown) {
        sphereRotationSpeed -= (1 + (sphereRotationSpeed * 0.00005));
        if (sphereRotationSpeed <= CONSTANT_SPHERE_ROTATION_SPEED) {
          sphereRotationSpeed = CONSTANT_SPHERE_ROTATION_SPEED;
          slowingDown = false;
        }
      }
    }

    // FIX: Use composer if available, otherwise use regular renderer
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  animate();

  // Public API
  return {
    scene,
    camera,
    renderer,
    globe: group,
    addMarker: (lat, lon, name, options = {}) => addMarker(group, markers, lat, lon, name, SPHERE_RADIUS, options),
    setRotationEnabled: (enabled) => { rotateSphere = enabled; },
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
      glowColor: { value: new THREE.Color(0x0953f1) },
      viewVector: { value: new THREE.Vector3(0, 0, 1) },
      intensity: { value: 0.55 },
      fadeStrength: { value: 4.0 }
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
  
  console.log("Earth texture loaded:", earthTexture);
  
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: "#2233aa",
    map: earthTexture,
    transparent: true,
    opacity: 1
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
    new THREE.IcosahedronGeometry(radius, 10),
    new THREE.MeshStandardMaterial({ color: '#08b', wireframe: true })
  );
}

/**
 * Creates latitude and longitude grid lines
 */
function createLatLongLines(radius, latSteps = 10, lonSteps = 20) {
  const positions = [];

  // Latitude lines (horizontal)
  for (let i = 1; i < latSteps; i++) {
    const lat = (i / latSteps) * Math.PI;
    for (let j = 0; j <= lonSteps; j++) {
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
    const sprite = makeTextSprite(`${lat}°`, { fontsize: 40, type: "lat" });
    const position = latLonToVector3(lat, 0, radius);
    sprite.position.copy(position);
    group.add(sprite);
  }

  for (let lon of lonLabels) {
    const sprite = makeTextSprite(`${lon}°`, { fontsize: 40, type: "lng" });
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
  const fontsize = parameters.fontsize || 32;
  
  canvas.width = 256;
  canvas.height = 128;
  
  context.font = `${fontsize}px ${fontface}`;
  context.fillStyle = parameters.fillStyle || 'white';
  context.textAlign = 'center';
  context.fillText(message, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.75, 1);
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
    size = 0.1,
    useBrandingImage = false,
    imagePath = 'img/save-the-children-logo.png'
  } = options;

  const position = latLonToVector3(lat, lon, radius + 0.05);
  let marker;

  if (useBrandingImage) {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(imagePath);
    const markerMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const markerGeometry = new THREE.PlaneGeometry(1, 1);
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.scale.set(0.5, 0.5, 0.5);
    marker.rotation.x = -Math.PI / 2;
  } else {
    const markerGeometry = new THREE.SphereGeometry(size, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color });
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

  group.add(marker);
  markersArray.push(marker);

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

  console.log("Container found. Creating GlobeScene");

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
  }

  // Return cleanup function
  return function cleanup() {
    window.removeEventListener("resize", resizeHandler);
    globeScene.cleanup();
  };
}

// Legacy compatibility - keep original functions for backward compatibility
export function createThreeJsScene(container) {
  console.warn('createThreeJsScene is deprecated. Use createGlobeScene instead.');
  return createGlobeScene(container);
}

export function createResizeHandler(camera, renderer, container) {
  console.warn('createResizeHandler is deprecated. Use createGlobeResizeHandler instead.');
  return createGlobeResizeHandler(camera, renderer, container);
}

export function createAnimationLoop(renderer, scene, camera, sphere) {
  console.warn('createAnimationLoop is deprecated. Animation is now handled internally.');
  let animationId;
  
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (sphere) sphere.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  
  return { 
    animate, 
    getAnimationId: () => animationId 
  };
}

export function cleanupThreeJs(renderer, container, animationId) {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  if (renderer) {
    renderer.dispose();
    if (container && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }
}

export function setupThreeJsScene(container, onSetup) {
  console.warn('setupThreeJsScene is deprecated. Use setupGlobeScene instead.');
  return setupGlobeScene(container, { 
    onMarkerClick: onSetup ? (data) => onSetup({ markerData: data }) : null 
  });
}