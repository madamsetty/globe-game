<template>
  <div
    id="landing"
    @mousemove="handleUserActivity"
    @touchstart="handleUserActivity"
    @keydown="handleUserActivity"
    @click="handleUserActivity"
    tabindex="0"
  >
    <div class="menu-bar" :class="{ expanded: isExpanded }" ref="menuBarRef">
      <img :src="logoUrl" class="logo" ref="logoRef" />
      <h1 class="title" :class="{ breathing: isBreathing }" ref="titleRef">{{ t('title') }}</h1>
      <div id="touchSwipeHint" class="touch-screen-hint" :class="{ show: isExpanded }">
        <img id="touchIcon" :src="touchImgUrl" alt="Touch screen to play" />
        <span ref="touchSwipeHintRef">{{ t('touchSwipeHint') }}</span>
      </div>
    </div>

    <div
      id="globe-container"
      ref="threeContainer"
      class="three-container"
    ></div>

    <div class="sidebar-icons">
      <button @click="toggleLanguage" :title="t('selectLanguage')">{{ currentLanguage }}</button>
      <img @click="toggleInfo" :src="infoImgUrl" :title="t('info')" />
      <img @click="toggleSettings" :src="settingsImgUrl" :title="t('settings')" v-if="showSettingsButton"/>
    </div>

    <div class="overlay" v-if="showInfo">
      <div class="overlay-content info-container">
        <button class="close" @click="toggleInfo">✖</button>
        <!-- Left Menu -->
        <div class="info-menu">
          <button @click="setActiveInfoTab('about')" :class="{ active: activeInfoTab === 'about' }">About</button>
          <button @click="setActiveInfoTab('licenses')" :class="{ active: activeInfoTab === 'licenses' }">Licenses</button>
        </div>

        <!-- Right Content -->
        <div class="info-content">
          <div v-if="activeInfoTab === 'about'">
            <p>{{ t('aboutContent') }}</p>
          </div>
          <div v-if="activeInfoTab === 'licenses'">
            <p>{{ t('mitLicense') }}</p>
            <p>{{ t('mitCopyright') }}</p>
            <p>{{ t('mitLicenseText') }}</p>            
          </div>
        </div>
      </div>
    </div>

    <div class="overlay" v-if="showSettings">
        <div class="overlay-content">
          <button class="close" @click="toggleSettings">✖</button>
          <h3>{{ t('settingsTitle') }}</h3>
          <p>{{ t('settingsContent') }}</p>
        </div>
    </div>

    <div class="overlay" v-if="showLanguageSelector">
      <div class="overlay-content language-selector">
        <button class="close" @click="showLanguageSelector = false">✖</button>
        <h3>{{ t('selectLanguage') }}</h3>
        <div class="language-options">
          <HapticButton 
            v-for="lang in availableLanguages" 
            :key="lang.code"
            @click="changeLanguage(lang.code)"
            :class="{ active: currentLanguage === lang.code }"
            class="language-option"
          >
            {{ lang.name }}
          </HapticButton>
        </div>
      </div>
    </div>

    <div class="sphere-overlay" v-if="sphereOverlay">
      <div class="sphere-content">
        <button class="close" @click="closeSphereOverlay">✖</button>
        <h1>{{ overlayData?.title }}</h1>
        <div class="content">
          <div class="text">
            <p>{{ overlayData?.question }}</p>
            <p>{{ overlayData?.description }} {{ overlayData?.details }}</p>
            <div class="buttons">
              <HapticButton>{{ overlayData?.optionA }}</HapticButton>
              <HapticButton>{{ overlayData?.optionB }}</HapticButton>
              <HapticButton>{{ overlayData?.optionC }}</HapticButton>
              <HapticButton>{{ overlayData?.optionD }}</HapticButton>
            </div>
          </div>
                  </div>
          <div class="media">
            <template v-if="isYouTube(overlayData.mediaUrl)">
              <iframe
                width="560"
                height="315"
                :src="getYouTubeEmbedUrl(overlayData.mediaUrl)"
                title="YouTube video player"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen
              ></iframe>
            </template>
            <template v-else-if="isVideo(overlayData.mediaUrl)">
              <video controls :src="overlayData.mediaUrl" />
            </template>
            <template v-else>
              <img :src="getImageSrc(overlayData.mediaUrl)" :alt="overlayData.title" />
            </template>
          </div>   
      </div>
    </div>
  </div>
</template>

<script setup>
import { useAppLogic } from './js/app.js';
import { setupGlobeScene } from './js/canvas-utils.js';
import HapticButton from './comps/HapticButton.vue';
import { ref } from 'vue';

const container = document.getElementById('globe-container');

const cleanup = setupGlobeScene(container, {
  showIcosahedron: true,
  showLatLngGrid: true,
  addDefaultMarkers: true,
  enableInteraction: true,
  onMarkerClick: (markerData) => {
    // Handle marker click (show quiz, info, etc.)
  }
});

const activeInfoTab = ref('about');

function setActiveInfoTab(tab) {
  activeInfoTab.value = tab;
}

// Use the composable function to get all needed functionality
const {
  // Refs
  threeContainer,
  menuBarRef,
  logoRef,
  titleRef,
  touchSwipeHintRef,
  
  // State
  showSettingsButton,
  showInfo,
  showSettings,
  sphereOverlay,
  showLanguageSelector,
  isExpanded,
  isAnimating,
  isBreathing,
  currentLanguage,
  
  // Assets
  logoUrl,
  touchImgUrl,
  infoImgUrl,
  settingsImgUrl,
  quizQuestionImg,
  
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
} = useAppLogic();
</script>