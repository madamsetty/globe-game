import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { setupGlobeScene } from './canvas-utils.js';

// Asset imports
import logoUrl from "@/img/save-the-children-with-name-logo.png";
import touchImgUrl from "@/img/touchIcon.png";
import infoImgUrl from "@/img/infoIcon.png";
import settingsImgUrl from "@/img/settingsIcon.png";
import quizQuestionImgUrl from "@/img/sample.jpg";
import earthTextureUrl from "@/img/worldMapBlue5400x2700.jpeg";

// Font loading utility
function loadOswaldFont() {
  const oswaldLink = document.createElement('link');
  oswaldLink.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@200;300;400;500;600;700&display=swap&subset=latin,latin-ext';
  oswaldLink.rel = 'stylesheet';
  if (!document.head.querySelector(`link[href="${oswaldLink.href}"]`)) {
    document.head.appendChild(oswaldLink);
  }
}

// Available languages configuration
const availableLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' }
];

// Translation utilities
async function loadTranslations(languageCode) {
  try {
    const loaded = await import(`@/locales/${languageCode}.json`);
    return loaded.default;
  } catch (error) {
    if (languageCode !== 'en') {
      const fallback = await import('@/locales/en.json');
      return fallback.default;
    }
    return {};
  }
}

// Set page language for Google Translate and accessibility
function setPageLanguage(languageCode) {
  // Set html lang attribute
  document.documentElement.lang = languageCode;
  
  // Set meta tag for additional language hint
  let metaLang = document.querySelector('meta[name="language"]');
  if (!metaLang) {
    metaLang = document.createElement('meta');
    metaLang.name = 'language';
    document.head.appendChild(metaLang);
  }
  metaLang.content = languageCode;
  
  // Set meta tag for content language (HTTP equivalent)
  let metaContentLang = document.querySelector('meta[http-equiv="content-language"]');
  if (!metaContentLang) {
    metaContentLang = document.createElement('meta');
    metaContentLang.setAttribute('http-equiv', 'content-language');
    document.head.appendChild(metaContentLang);
  }
  metaContentLang.content = languageCode;
}

// Animation utilities
async function expandMenu(menuBarRef, logoRef, titleRef, isAnimating, isExpanded, isBreathing) {
  if (!menuBarRef.value || !logoRef.value || !titleRef.value || isAnimating.value) return;

  isAnimating.value = true;

  // Get initial positions
  const logoRect = logoRef.value.getBoundingClientRect();
  const titleRect = titleRef.value.getBoundingClientRect();

  // Add expanded class
  isExpanded.value = true;
  
  await nextTick();

  // Get final positions
  const logoRectAfter = logoRef.value.getBoundingClientRect();
  const titleRectAfter = titleRef.value.getBoundingClientRect();

  // Calculate deltas
  const logoDeltaX = logoRect.left - logoRectAfter.left;
  const logoDeltaY = logoRect.top - logoRectAfter.top;
  const titleDeltaX = titleRect.left - titleRectAfter.left;
  const titleDeltaY = titleRect.top - titleRectAfter.top;

  // Set initial transform (start from original position)
  logoRef.value.style.transform = `translate(${logoDeltaX}px, ${logoDeltaY}px)`;
  titleRef.value.style.transform = `translate(${titleDeltaX}px, ${titleDeltaY}px)`;

  // Force reflow
  logoRef.value.offsetHeight;

  // Add transitions
  logoRef.value.style.transition = 'transform 0.8s ease-out';
  titleRef.value.style.transition = 'transform 0.8s ease-out, font-size 0.8s ease-out';

  // Animate to final position
  logoRef.value.style.transform = 'translate(0, 0)';
  titleRef.value.style.transform = 'translate(0, 0)';

  // Clean up after animation
  setTimeout(() => {
    if (logoRef.value && titleRef.value) {
      logoRef.value.style.transition = '';
      logoRef.value.style.transform = '';
      titleRef.value.style.transition = '';
      titleRef.value.style.transform = '';
    }
    isAnimating.value = false;
    isBreathing.value = true;
  }, 800);
}

async function collapseMenu(menuBarRef, logoRef, titleRef, isAnimating, isExpanded, isBreathing) {
  if (!menuBarRef.value || !logoRef.value || !titleRef.value || isAnimating.value) return;
  
  isBreathing.value = false;
  isAnimating.value = true;

  // Get current positions
  const logoRect = logoRef.value.getBoundingClientRect();
  const titleRect = titleRef.value.getBoundingClientRect();

  // Remove expanded class
  isExpanded.value = false;
  
  await nextTick();

  // Get final positions (collapsed)
  const logoRectAfter = logoRef.value.getBoundingClientRect();
  const titleRectAfter = titleRef.value.getBoundingClientRect();

  // Calculate deltas
  const logoDeltaX = logoRect.left - logoRectAfter.left;
  const logoDeltaY = logoRect.top - logoRectAfter.top;
  const titleDeltaX = titleRect.left - titleRectAfter.left;
  const titleDeltaY = titleRect.top - titleRectAfter.top;

  // Set initial transform (start from expanded position)
  logoRef.value.style.transform = `translate(${logoDeltaX}px, ${logoDeltaY}px)`;
  titleRef.value.style.transform = `translate(${titleDeltaX}px, ${titleDeltaY}px)`;

  // Force reflow
  logoRef.value.offsetHeight;

  // Add transitions
  logoRef.value.style.transition = 'transform 0.8s ease-out';
  titleRef.value.style.transition = 'transform 0.8s ease-out';

  // Animate to final position (collapsed/original)
  logoRef.value.style.transform = 'translate(0, 0)';
  titleRef.value.style.transform = 'translate(0, 0)';

  // Clean up after animation
  setTimeout(() => {
    if (logoRef.value && titleRef.value) {
      logoRef.value.style.transition = '';
      logoRef.value.style.transform = '';
      titleRef.value.style.transition = '';
      titleRef.value.style.transform = '';
    }
    isAnimating.value = false;
  }, 800);
}

// Main composable function
export function useAppLogic() {
  // Load font
  loadOswaldFont();

  // Template refs
  const threeContainer = ref(null);
  const menuBarRef = ref(null);
  const logoRef = ref(null);
  const titleRef = ref(null);
  const touchSwipeHintRef = ref(null);

  // State
  const showInfo = ref(false);
  const showSettings = ref(false);
  const sphereOverlay = ref(false);
  const showLanguageSelector = ref(false);
  const isExpanded = ref(false);
  const isAnimating = ref(false);
  const isBreathing = ref(false);
  let rotateSphere = null;

  // Language state
  const currentLanguage = ref(localStorage.getItem('selectedLanguage') || 'en');
  const translations = ref({});

  // Three.js variables
  let threeJsCleanup = null;
  let idleTimer = null;

  // Timers
  let idelScreenTriggerMs = 60000;

  // Assets
  const assets = {
    logoUrl,
    touchImgUrl,
    infoImgUrl,
    settingsImgUrl,
    quizQuestionImg: ref(quizQuestionImgUrl),
    earthTextureUrl
  };

  // Translation function
  const t = (key) => {
    return translations.value[key] || key;
  };

  // Marker overlay data
  const overlayData = ref({
    title: '',
    question: '',
    description: '',
    details: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    mediaUrl: ''
  });

  // Language functions
  async function changeLanguage(languageCode) {
    currentLanguage.value = languageCode;
    localStorage.setItem('selectedLanguage', languageCode);
    translations.value = await loadTranslations(languageCode);
    
    // Set page language for Google Translate and accessibility
    setPageLanguage(languageCode);
  }

  function toggleLanguage() {
    if (showLanguageSelector.value || (!isExpanded.value && !isAnimating.value)) {
      showLanguageSelector.value = !showLanguageSelector.value;
    }
  }

  // Activity handling
  function handleUserActivity() {    
    // If menu is expanded, collapse it immediately
    if (isExpanded.value && !isAnimating.value) {
      collapseMenu(menuBarRef, logoRef, titleRef, isAnimating, isExpanded, isBreathing);
    }
    
    // Clear existing timer
    clearTimeout(idleTimer);
    
    // Start new idle timer
    idleTimer = setTimeout(() => {
      if (!isExpanded.value && !isAnimating.value) {
        showInfo.value = false;
        showSettings.value = false;
        showLanguageSelector.value = false;
        closeSphereOverlay();
        expandMenu(menuBarRef, logoRef, titleRef, isAnimating, isExpanded, isBreathing);
      }
    }, idelScreenTriggerMs);
  }

  // Overlay functions
  function toggleInfo() {
    if (showInfo.value || (!isExpanded.value && !isAnimating.value)) {
      showInfo.value = !showInfo.value;
    }
  }

  function toggleSettings() {
    if (showSettings.value || (!isExpanded.value && !isAnimating.value)) {
      showSettings.value = !showSettings.value;
    }
  }

  function closeSphereOverlay() {
    sphereOverlay.value = false;
    rotateSphere(true);
  }

  async function openSphereOverlay(city, languageCode) {
    try {
      const response = await fetch(`/data/${languageCode}-quiz.json`);
      const data = await response.json();
      console.log(data);
      console.log("city title:", data[city].title);
      if (data[city]) {
        overlayData.value = {
          title: data[city].title || '',
          question: data[city].question || '',
          description: data[city].description || '',
          details: data[city].details || '',
          optionA: data[city].optionA || '',
          optionB: data[city].optionB || '',
          optionC: data[city].optionC || '',
          optionD: data[city].optionD || '',
          mediaUrl: data[city].mediaUrl || ''
        };
        sphereOverlay.value = true;
        if (rotateSphere) rotateSphere(false);
      } else {
        console.warn(`No content found for city: ${city}`);
      }
    } catch (err) {
      console.error('Error loading overlay data:', err);
    }
  }

  function isVideo(url) {
    return /\.(mp4|webm|ogg)$/i.test(url);
  }

  function isYouTube(url) {
    console.log("isYouTube():", url);
    return /youtu\.?be/.test(url);
  }

  function getYouTubeEmbedUrl(url) {
    console.log("getYouTubeEmbedUrl():", url);
    const videoId = extractYouTubeId(url);
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function extractYouTubeId(url) {
    console.log("extractYouTubeId():", url);
    const regExp = /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[1].length === 11 ? match[1] : null;
  }

  function getImageSrc(url) {
    console.log("getImageSrc():", url);

    if (!url || typeof url !== 'string') {
      console.warn("Invalid image URL:", url);
      return '';
    }

    // If it's a full URL (http or https), return it directly
    if (/^https?:\/\//.test(url)) {
      console.log("External image URL:", url);
      return url;
    }

    // Assume it's a filename in /public/img/
    const localUrl = `img/${url}`;
    console.log("Local image URL:", localUrl);
    return localUrl;
  }

  // Lifecycle
  onMounted(async () => {    
    // Load translations for current language
    translations.value = await loadTranslations(currentLanguage.value);
    
    // Set initial page language
    setPageLanguage(currentLanguage.value);
    
    const container = threeContainer.value;

    // Setup Three.js scene
    try {
      threeJsCleanup = setupGlobeScene(container, {
      addDefaultMarkers: true,
      enableInteraction: true,
      earthTexture: assets.earthTextureUrl,
      onMarkerClick: (markerData) => {
        console.log('Marker clicked:', markerData);
        openSphereOverlay(markerData.name, currentLanguage.value);
      }
    });    
    } catch (error) {
      console.error('Error setting up Three.js scene:', error);
    }

    rotateSphere = threeJsCleanup.setRotateSphere;

    // Start the idle timer
    handleUserActivity();
  });

  onBeforeUnmount(() => {
    console.log('Component unmounting');
    clearTimeout(idleTimer);
    
    // Cleanup Three.js resources
    if (threeJsCleanup) {
      threeJsCleanup();
    }
  });

  return {
    // Refs
    threeContainer,
    menuBarRef,
    logoRef,
    titleRef,
    touchSwipeHintRef,
    
    // State
    showInfo,
    showSettings,
    sphereOverlay,
    showLanguageSelector,
    isExpanded,
    isAnimating,
    isBreathing,
    currentLanguage,
    
    // Assets
    ...assets,
    
    // Data
    availableLanguages,
    overlayData,
    
    // Functions
    t,
    changeLanguage,
    toggleLanguage,
    handleUserActivity,
    toggleInfo,
    toggleSettings,
    openSphereOverlay,
    closeSphereOverlay,
    isVideo,
    isYouTube,
    getYouTubeEmbedUrl,
    extractYouTubeId,
    getImageSrc
  };
}