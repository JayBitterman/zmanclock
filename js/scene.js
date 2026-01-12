// ============================================================================
// scene.js - Terrain, Vegetation, Stars, Birds, Weather Effects
// ============================================================================

import { state } from './config.js';
import { calculateSeasonalTime } from './astronomy.js';
import { 
  weatherState, 
  getWeatherCondition, 
  getPrecipitationIntensity,
  getSeason,
  getWindIntensity,
  getClothingType
} from './weather.js';

// ============================================================================
// MEMORY MANAGEMENT CONSTANTS - Prevent runaway memory usage
// ============================================================================
const MAX_CLOUDS = 80;              // Hard cap on cloud elements
const CLOUD_SPAWN_THROTTLE_MS = 500; // Minimum time between cloud spawns
const CLEANUP_INTERVAL_MS = 5000;    // Periodic cleanup interval

// Store references for resize handling
let vegetationGenerated = false;
let lastWeatherFetchForClouds = 0;

// Track spawning and cleanup
let lastCloudSpawnTime = 0;
let cleanupIntervalId = null;

/**
 * Check if time is being accelerated (accessed from state)
 * This helps pause expensive effects during fast-forward
 */
export function getTimeAccelerationFactor() {
  return Math.abs(state.speedMultiplier || 0);
}

/**
 * Start periodic cleanup to prevent memory leaks
 */
export function startPeriodicCleanup() {
  if (cleanupIntervalId) return;
  
  cleanupIntervalId = setInterval(() => {
    cleanupOrphanedElements();
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop periodic cleanup
 */
export function stopPeriodicCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Clean up orphaned/excess elements that may have accumulated
 */
function cleanupOrphanedElements() {
  const cloudContainer = document.getElementById('cloud-container');
  if (!cloudContainer) return;
  
  const clouds = cloudContainer.querySelectorAll('.cloud');
  
  // Remove excess clouds beyond the cap
  if (clouds.length > MAX_CLOUDS) {
    const excess = clouds.length - MAX_CLOUDS;
    console.warn(`⚠️ Memory cleanup: Removing ${excess} excess clouds (had ${clouds.length})`);
    
    // Remove oldest clouds (they're at the start of the NodeList)
    for (let i = 0; i < excess; i++) {
      if (clouds[i]) {
        clouds[i].remove();
      }
    }
  }
}

/**
 * 1. GENERATE TERRAIN with grass texture
 */
export function generateTerrain() {
  const svg = document.getElementById('land-svg');
  if (!svg) return;

  const makePath = (startY, amplitude, bumps) => {
    let d = `M 0 100 L 0 ${startY}`;
    let step = 100 / bumps;
    
    for (let i = 0; i < bumps; i++) {
      let x = (i + 1) * step;
      let y = startY + (Math.random() * amplitude - (amplitude / 2));
      d += ` L ${x} ${y}`;
    }
    
    d += ` L 100 100 Z`; 
    return d;
  };

  // Back Layer (Higher horizon)
  document.getElementById('land-back').setAttribute('d', makePath(45, 8, 4)); 
  // Mid Layer
  document.getElementById('land-mid').setAttribute('d', makePath(55, 12, 6));
  // Front Layer (The one the person stands on)
  document.getElementById('land-front').setAttribute('d', makePath(60, 5, 10));
  
  // Add grass blades to the front layer
  addGrassBlades();
}

/**
 * Add grass blade elements for texture
 */
function addGrassBlades() {
  const terrainContainer = document.querySelector('.terrain-container');
  if (!terrainContainer) return;
  
  // Remove existing grass
  terrainContainer.querySelectorAll('.grass-blade').forEach(g => g.remove());
  
  // Add grass blades
  for (let i = 0; i < 60; i++) {
    const blade = document.createElement('div');
    blade.classList.add('grass-blade');
    blade.style.left = `${Math.random() * 100}%`;
    blade.style.bottom = `${38 + Math.random() * 5}%`;
    const height = 1 + Math.random() * 2;
    blade.style.height = `${height}vh`;
    blade.style.animationDelay = `${Math.random() * 2}s`;
    terrainContainer.appendChild(blade);
  }
}

/**
 * 2. GENERATE VEGETATION - Improved trees with branches
 */
export function generateVegetation() {
  const vegLayer = document.getElementById('vegetation-layer');
  
  if (!vegLayer) return;
  
  // Clear existing vegetation
  vegLayer.innerHTML = '';

  // Determine current season for styling
  const season = getSeason(new Date(), state.latitude || 40);

  // Create improved tree SVG with branches
  const createTreeSVG = (season) => {
    const foliageColor = {
      spring: '#4a7c31',
      summer: '#2d5a1c', 
      fall: '#8b4513',
      winter: '#4a4a4a'
    }[season] || '#2d5a1c';
    
    // Winter = no foliage at all (bare branches)
    const foliageOpacity = season === 'winter' ? '0' : '1';
    
    return `
      <svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMax meet">
        <!-- Trunk - extended upward to connect with branches -->
        <path class="trunk" d="M45 150 L45 50 Q48 45 50 40 Q52 45 55 50 L55 150 Z" fill="#3d2817"/>
        <!-- Main branches - all connect to trunk (x=50) at various heights -->
        <path class="branch" d="M50 90 Q35 85 20 90" stroke="#3d2817" stroke-width="4" fill="none"/>
        <path class="branch" d="M50 90 Q65 85 80 90" stroke="#3d2817" stroke-width="4" fill="none"/>
        <path class="branch" d="M50 75 Q30 68 15 75" stroke="#3d2817" stroke-width="3" fill="none"/>
        <path class="branch" d="M50 75 Q70 68 85 75" stroke="#3d2817" stroke-width="3" fill="none"/>
        <path class="branch" d="M50 60 Q35 52 22 58" stroke="#3d2817" stroke-width="2.5" fill="none"/>
        <path class="branch" d="M50 60 Q65 52 78 58" stroke="#3d2817" stroke-width="2.5" fill="none"/>
        <path class="branch" d="M50 48 Q40 42 30 46" stroke="#3d2817" stroke-width="2" fill="none"/>
        <path class="branch" d="M50 48 Q60 42 70 46" stroke="#3d2817" stroke-width="2" fill="none"/>
        <!-- Foliage clusters - hidden in winter -->
        <g class="foliage-group" opacity="${foliageOpacity}">
          <ellipse class="foliage" cx="20" cy="85" rx="16" ry="13" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="80" cy="85" rx="16" ry="13" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="15" cy="70" rx="14" ry="11" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="85" cy="70" rx="14" ry="11" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="22" cy="53" rx="12" ry="10" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="78" cy="53" rx="12" ry="10" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="50" cy="38" rx="20" ry="16" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="35" cy="65" rx="15" ry="12" fill="${foliageColor}"/>
          <ellipse class="foliage" cx="65" cy="65" rx="15" ry="12" fill="${foliageColor}"/>
        </g>
      </svg>
    `;
  };

  // Add 2-3 Trees
  const treePositions = [
    8 + Math.random() * 15,   // Left side: 8-23%
    77 + Math.random() * 18   // Right side: 77-95%
  ];
  
  // Sometimes add a third tree
  if (Math.random() > 0.5) {
    treePositions.push(30 + Math.random() * 8);
  }

  treePositions.forEach((left, i) => {
    const tree = document.createElement('div');
    tree.classList.add('tree', season);
    tree.innerHTML = createTreeSVG(season);
    tree.style.left = `${left}%`;
    
    // Random size variation
    const scale = 0.8 + Math.random() * 0.4;
    tree.style.transform = `scale(${scale})`;
    
    vegLayer.appendChild(tree);
  });

  // Add 4-6 Bushes
  const bushCount = 4 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < bushCount; i++) {
    const bush = document.createElement('div');
    bush.classList.add('bush', season);
    
    // Distribute bushes across screen, avoiding center
    let left;
    if (i < bushCount / 2) {
      left = 3 + Math.random() * 32;
    } else {
      left = 65 + Math.random() * 32;
    }
    
    bush.style.left = `${left}%`;
    bush.style.bottom = `${2 + Math.random() * 6}%`;
    
    // Size variation
    const scale = 0.7 + Math.random() * 0.5;
    bush.style.width = `${6 * scale}vmin`;
    bush.style.height = `${4 * scale}vmin`;
    
    vegLayer.appendChild(bush);
  }

  vegetationGenerated = true;
}

/**
 * Update vegetation season class - only updates colors, not positions
 */
export function updateVegetationSeason() {
  if (!vegetationGenerated) return;
  
  const season = getSeason(state.date || new Date(), state.latitude || 40);
  
  // Define foliage colors by season
  const foliageColors = {
    spring: '#4a7c31',
    summer: '#2d5a1c', 
    fall: '#8b4513',
    winter: '#4a4a4a'
  };
  
  const foliageOpacity = season === 'winter' ? '0' : '1';
  const foliageColor = foliageColors[season] || foliageColors.summer;
  
  // Update tree foliage colors without regenerating positions
  const trees = document.querySelectorAll('.tree');
  trees.forEach(tree => {
    // Update season class
    tree.classList.remove('spring', 'summer', 'fall', 'winter');
    tree.classList.add(season);
    
    // Update foliage colors in the SVG
    const foliageGroup = tree.querySelector('.foliage-group');
    if (foliageGroup) {
      foliageGroup.setAttribute('opacity', foliageOpacity);
    }
    
    const foliageElements = tree.querySelectorAll('.foliage');
    foliageElements.forEach(f => f.setAttribute('fill', foliageColor));
  });
  
  // Update bush colors without regenerating positions
  const bushes = document.querySelectorAll('.bush');
  bushes.forEach(bush => {
    bush.classList.remove('spring', 'summer', 'fall', 'winter');
    bush.classList.add(season);
  });
}

/**
 * 3. INITIALIZE STARS
 */
export function initStars() {
  const sky = document.getElementById('sky-effects');
  if (!sky) return;
  
  // Clear existing stars (but not bird containers)
  sky.querySelectorAll('.star').forEach(s => s.remove());
  
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.classList.add('star');
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 60}%`;
    
    const size = Math.random() * 0.3 + 0.1; 
    star.style.width = `${size}vmin`;
    star.style.height = `${size}vmin`;
    star.style.setProperty('--twinkle-duration', `${Math.random() * 3 + 2}s`);
    star.style.setProperty('--delay', `${Math.random() * 5}s`);
    star.style.setProperty('--star-opacity', `${0.5 + Math.random() * 0.5}`);
    
    sky.appendChild(star);
  }
}

/**
 * 4. BIRD SPAWNING SYSTEM
 * Birds use CSS animations, we randomly spawn them with low frequency
 * FIXED: Use single iteration with animationend event, support bidirectional flight
 */

let lastBirdSpawnTime = 0;
let activeBirdCount = 0;

/**
 * Initialize bird system - set up animation end listeners
 */
export function initBirds() {
  const birdContainers = document.querySelectorAll('.bird-container');
  
  // Start all birds as hidden
  birdContainers.forEach((container) => {
    container.classList.remove('active');
    container.classList.remove('fly-left');
    
    // When a bird completes its flight, hide it
    container.addEventListener('animationend', () => {
      container.classList.remove('active');
      container.classList.remove('fly-left');
      activeBirdCount = Math.max(0, activeBirdCount - 1);
    });
  });
}

/**
 * Try to spawn a bird based on conditions
 * Called periodically from updateSceneVisuals
 */
export function trySpawnBird() {
  const { isDay } = calculateSeasonalTime();
  const condition = getWeatherCondition();
  const now = Date.now();
  
  // Don't spawn at night
  if (!isDay) return;
  
  // Don't spawn in bad weather
  const badWeather = ['rain', 'snow', 'thunderstorm', 'fog'];
  if (badWeather.includes(condition)) return;
  
  // Don't spawn if too windy
  if (weatherState.windSpeed > 40) return;
  
  // Don't spawn if too cold
  if (weatherState.temperature !== null && weatherState.temperature < 0) return;
  
  // Determine spawn frequency based on season
  const season = getSeason(new Date(), state.latitude || 40);
  let baseInterval;
  
  switch (season) {
    case 'summer':
      baseInterval = 90000; // 1.5 minutes
      break;
    case 'spring':
    case 'fall':
      baseInterval = 120000; // 2 minutes
      break;
    case 'winter':
    default:
      baseInterval = 180000; // 3 minutes
  }
  
  // Add randomness: spawn interval is 0.5x to 1.5x the base
  const minInterval = baseInterval * 0.5;
  
  // Check if enough time has passed since last spawn
  if (now - lastBirdSpawnTime < minInterval) return;
  
  // Random chance to spawn (checked every frame, but with low probability)
  const spawnChance = 1000 / baseInterval;
  
  if (Math.random() > spawnChance) return;
  
  // Limit max active birds to 2
  if (activeBirdCount >= 2) return;
  
  // Find an inactive bird container and activate it
  const birdContainers = document.querySelectorAll('.bird-container');
  const inactiveBirds = Array.from(birdContainers).filter(c => !c.classList.contains('active'));
  
  if (inactiveBirds.length > 0) {
    // Pick a random inactive bird
    const bird = inactiveBirds[Math.floor(Math.random() * inactiveBirds.length)];
    
    // Randomly decide direction: 50% chance to fly left
    const flyLeft = Math.random() < 0.5;

    // RESET CLASSES completely before adding new ones
    bird.className = 'bird-container'; 
    
    // Force reflow to restart animation
    void bird.offsetWidth;
    
    if (flyLeft) {
      bird.classList.add('fly-left');
    }
    
    bird.classList.add('active');
    activeBirdCount++;
    lastBirdSpawnTime = now;
  }
}

/**
 * Legacy function for compatibility - now just calls trySpawnBird
 */
export function updateBirdVisibility() {
  trySpawnBird();
}

/**
 * 5. INITIALIZE WEATHER EFFECTS
 */
export function initWeatherEffects() {
  const container = document.getElementById('weather-effects');
  if (!container) return;
  
  // Clear existing
  container.innerHTML = '';
  
  // Add cloud container
  let cloudContainer = document.getElementById('cloud-container');
  if (!cloudContainer) {
    cloudContainer = document.createElement('div');
    cloudContainer.id = 'cloud-container';
    container.appendChild(cloudContainer);
  }
  
  // Add fog layer
  const fogLayer = document.createElement('div');
  fogLayer.classList.add('fog-layer');
  container.appendChild(fogLayer);
  
  // Add rain container
  const rainContainer = document.createElement('div');
  rainContainer.classList.add('rain-container');
  container.appendChild(rainContainer);
  
  /// Pre-create raindrops - more drops for better coverage
  for (let i = 0; i < 200; i++) {
    const drop = document.createElement('div');
    drop.classList.add('raindrop');
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDuration = `${0.4 + Math.random() * 0.4}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    // Vary the size slightly
    const scale = 0.7 + Math.random() * 0.6;
    drop.style.transform = `scaleY(${scale})`;
    drop.style.opacity = 0.6 + Math.random() * 0.4;
    rainContainer.appendChild(drop);
  }
  
  // Add snow container
  const snowContainer = document.createElement('div');
  snowContainer.classList.add('snow-container');
  container.appendChild(snowContainer);
  
  // Pre-create snowflakes
  for (let i = 0; i < 60; i++) {
    const flake = document.createElement('div');
    flake.classList.add('snowflake');
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.animationDuration = `${3 + Math.random() * 4}s`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    const size = 3 + Math.random() * 8;
    flake.style.width = `${size}px`;
    flake.style.height = `${size}px`;
    snowContainer.appendChild(flake);
  }
  
  // Add lightning element
  const lightning = document.createElement('div');
  lightning.classList.add('lightning');
  lightning.id = 'lightning';
  container.appendChild(lightning);
}
// Cloud observer for detecting when clouds exit screen
let cloudObserver = null;

/**
 * Initialize the IntersectionObserver for clouds - SINGLETON
 */
function initCloudObserver() {
  if (cloudObserver) return cloudObserver;
  
  cloudObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const cloud = entry.target;
      
      // Track if cloud has ever been visible
      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        cloud.dataset.hasBeenVisible = 'true';
      }
      
      // Only remove if: was visible AND now fully off-screen
      if (cloud.dataset.hasBeenVisible === 'true' && !entry.isIntersecting) {
        // CRITICAL: Unobserve BEFORE removing to prevent memory leak
        cloudObserver.unobserve(cloud);
        
        // Remove from DOM
        cloud.remove();
        
        // Spawn replacement after a delay (debounced)
        scheduleCloudRespawn();
      }
    });
  }, {
    root: null,
    rootMargin: '100px',
    threshold: 0
  });
  
  return cloudObserver;
}

// Debounced cloud respawn to prevent rapid-fire spawning
let cloudRespawnTimeout = null;

function scheduleCloudRespawn() {
  if (cloudRespawnTimeout) return; // Already scheduled
  
  cloudRespawnTimeout = setTimeout(() => {
    cloudRespawnTimeout = null;
    spawnReplacementCloud();
  }, 500); // Respawn at most every 500ms
}

/**
 * Clean up cloud system (call when changing locations or cleaning up)
 */
export function cleanupClouds() {
  if (cloudRespawnTimeout) {
    clearTimeout(cloudRespawnTimeout);
    cloudRespawnTimeout = null;
  }
  
  const cloudContainer = document.getElementById('cloud-container');
  if (cloudContainer && cloudObserver) {
    // Unobserve all clouds before clearing
    Array.from(cloudContainer.children).forEach(cloud => {
      cloudObserver.unobserve(cloud);
    });
    cloudContainer.innerHTML = '';
  }
}

/**
 * Spawn replacement clouds (enters from upwind edge)
 * FIXED: Added throttling and cap to prevent memory issues during time acceleration
 */
function spawnReplacementCloud() {
  const cloudContainer = document.getElementById('cloud-container');
  if (!cloudContainer) return;
  
  // THROTTLE: Don't spawn too frequently
  const now = Date.now();
  if (now - lastCloudSpawnTime < CLOUD_SPAWN_THROTTLE_MS) {
    return;
  }
  
  // CAP CHECK: Don't exceed maximum clouds
  const currentCloudCount = cloudContainer.querySelectorAll('.cloud').length;
  if (currentCloudCount >= MAX_CLOUDS) {
    return;
  }
  
  // ACCELERATION CHECK: Skip spawning during very fast time (100x)
  const acceleration = getTimeAccelerationFactor();
  if (acceleration >= 100) {
    return; // Don't spawn at all during ultra-fast time
  }
  
  const cloudCover = weatherState.cloudCover ?? 0;
  if (cloudCover === 0) return;
  
  const windSpeed = weatherState.windSpeed ?? 0;
  const windDirection = weatherState.windDirection ?? 0;
  
  // Reduce spawn count during acceleration
  let spawnCount = cloudCover >= 80 ? 3 : (cloudCover >= 50 ? 2 : 1);
  if (acceleration >= 10) {
    spawnCount = 1; // Only spawn 1 at a time during 10x speed
  }
  
  // Don't exceed cap
  const maxToSpawn = Math.min(spawnCount, MAX_CLOUDS - currentCloudCount);
  if (maxToSpawn <= 0) return;
  
  const observer = initCloudObserver();
  
  lastCloudSpawnTime = now;
  
  for (let i = 0; i < maxToSpawn; i++) {
    // Small delay between spawns for more natural appearance
    setTimeout(() => {
      // Double-check cap before each spawn (in case many are queued)
      const count = cloudContainer.querySelectorAll('.cloud').length;
      if (count >= MAX_CLOUDS) return;
      
      const cloud = createCloud(0, 1, cloudCover, windSpeed, windDirection, false);
      cloudContainer.appendChild(cloud);
      observer.observe(cloud);
    }, i * 200);
  }
}

/**
 * Create a single cloud element
 * Clouds start OFF-SCREEN and drift across based on wind
 */
function createCloud(index, totalClouds, cloudCover, windSpeed, windDirection, stagger = false) {
  const cloud = document.createElement('div');
  cloud.classList.add('cloud');
  
  // Layer assignment for depth
  const layerRoll = Math.random();
  if (layerRoll < 0.3) {
    cloud.classList.add('layer-back');
  } else if (layerRoll < 0.7) {
    cloud.classList.add('layer-mid');
  } else {
    cloud.classList.add('layer-front');
  }
  
  // Size - bigger clouds for better coverage
  const baseWidth = 25 + Math.random() * 40;
  const baseHeight = 15 + Math.random() * 25;
  const sizeMultiplier = cloudCover > 70 ? 1.8 : (cloudCover > 40 ? 1.4 : 1.0);
  
  cloud.style.width = `${baseWidth * sizeMultiplier}vw`;
  cloud.style.height = `${baseHeight * sizeMultiplier}vh`;
  
  // Wind calculations
  // Wind direction = where wind comes FROM (meteorological convention)
  // 0°=N, 90°=E, 180°=S, 270°=W
  const windRad = (windDirection || 0) * Math.PI / 180;
  
  // Unit vector: where wind comes FROM (-1 to +1)
  const fromEast = Math.sin(windRad);
  const fromNorth = Math.cos(windRad);
  
  // Travel direction (opposite of wind source)
  const travelDirX = -fromEast; // positive = rightward
  const travelDirY = -fromNorth; // positive = downward (screen coords)
  
  // Cloud dimensions
  const cloudW = baseWidth * sizeMultiplier;
  const cloudH = baseHeight * sizeMultiplier;
  const margin = 5;
  
  // Screen bounds
  const screenW = 100;
  const skyH = 55; // visible sky height
  
  // Determine upwind edges
  const upwindEdges = [];
  if (fromNorth > 0.1) upwindEdges.push('top');
  if (fromNorth < -0.1) upwindEdges.push('bottom');
  if (fromEast > 0.1) upwindEdges.push('right');
  if (fromEast < -0.1) upwindEdges.push('left');
  
  // Default for calm wind
  if (upwindEdges.length === 0) {
    upwindEdges.push('top');
  }
  
  // Pick random upwind edge
  const edge = upwindEdges[Math.floor(Math.random() * upwindEdges.length)];
  
  let startX, startY;
  
  // Spawn position: must be off-screen AND positioned so travel path crosses visible area
  // Key insight: if traveling left, spawn must be RIGHT of where we want coverage
  //              if traveling right, spawn must be LEFT of where we want coverage
  
  switch (edge) {
    case 'top':
      startY = -(cloudH + margin + Math.random() * 10);
      if (travelDirX < -0.1) {
        // Traveling left: spawn from right side to ensure path crosses screen
        // Range: from 0 to well past right edge
        startX = Math.random() * (screenW + cloudW + 50);
      } else if (travelDirX > 0.1) {
        // Traveling right: spawn from left side
        // Range: from well past left edge to screenW
        startX = -(cloudW + 50) + Math.random() * (screenW + cloudW + 50);
      } else {
        // Mostly vertical: full spread
        startX = -cloudW + Math.random() * (screenW + cloudW * 2);
      }
      break;
      
    case 'bottom':
      startY = skyH + margin + Math.random() * 10;
      if (travelDirX < -0.1) {
        startX = Math.random() * (screenW + cloudW + 50);
      } else if (travelDirX > 0.1) {
        startX = -(cloudW + 50) + Math.random() * (screenW + cloudW + 50);
      } else {
        startX = -cloudW + Math.random() * (screenW + cloudW * 2);
      }
      break;
      
    case 'right':
      startX = screenW + margin + Math.random() * 10;
      if (travelDirY < -0.1) {
        // Traveling up: spawn from lower part to cross screen
        startY = Math.random() * (skyH + cloudH + 30);
      } else if (travelDirY > 0.1) {
        // Traveling down: spawn from upper part
        startY = -(cloudH + 30) + Math.random() * (skyH + cloudH + 30);
      } else {
        // Mostly horizontal: full vertical spread
        startY = -cloudH + Math.random() * (skyH + cloudH * 2);
      }
      break;
      
    case 'left':
      startX = -(cloudW + margin + Math.random() * 10);
      if (travelDirY < -0.1) {
        startY = Math.random() * (skyH + cloudH + 30);
      } else if (travelDirY > 0.1) {
        startY = -(cloudH + 30) + Math.random() * (skyH + cloudH + 30);
      } else {
        startY = -cloudH + Math.random() * (skyH + cloudH * 2);
      }
      break;
  }
  
  // Calculate travel distance: be GENEROUS - IntersectionObserver handles actual removal
  // We just need to ensure the cloud keeps moving well past the screen edge
  let travelX, travelY;
  
  // Always travel far enough to definitely exit, plus extra buffer
  const travelBuffer = 50;
  
  if (travelDirX < -0.1) {
    // Traveling left: need to clear left edge (x < -cloudW)
    travelX = -startX - cloudW - travelBuffer;
  } else if (travelDirX > 0.1) {
    // Traveling right: need to clear right edge (x > screenW)
    travelX = screenW - startX + cloudW + travelBuffer;
  } else {
    travelX = travelDirX * 30;
  }
  
  if (travelDirY > 0.1) {
    // Traveling down: need to clear bottom of sky
    travelY = skyH - startY + cloudH + travelBuffer;
  } else if (travelDirY < -0.1) {
    // Traveling up: need to clear top edge (y < -cloudH)
    travelY = -startY - cloudH - travelBuffer;
  } else {
    travelY = travelDirY * 30;
  }
  
  cloud.style.left = `${startX}%`;
  cloud.style.top = `${startY}%`;
  cloud.style.setProperty('--cloud-move-x', `${travelX}%`);
  cloud.style.setProperty('--cloud-move-y', `${travelY}%`);
  
  // Animation speed based on wind
  const baseSpeed = Math.max(30, 100 - (windSpeed || 0) * 1.5);
  const layerSpeedMod = layerRoll < 0.3 ? 1.3 : (layerRoll < 0.7 ? 1.0 : 0.7);
  const duration = baseSpeed * layerSpeedMod;
  
  cloud.style.setProperty('--cloud-speed', `${duration}s`);
  
  // Stagger clouds across their journey on initial load
  if (stagger) {
    cloud.style.animationDelay = `${-Math.random() * duration}s`;
  } else {
    cloud.style.animationDelay = '0s';
  }
  
  return cloud;
}

/**
 * Update cloud cover - only regenerates on location change or significant weather change
 * FIXED: Enforces MAX_CLOUDS cap
 */
function updateCloudCover(forceRegenerate = false) {
  const cloudContainer = document.getElementById('cloud-container');
  if (!cloudContainer) return;
  
  const cloudCover = weatherState.cloudCover ?? 0;
  const windSpeed = weatherState.windSpeed ?? 0;
  const windDirection = weatherState.windDirection ?? 0;
  
  // Only regenerate on force (location change) or if container is empty and we have clouds to show
  const isEmpty = cloudContainer.children.length === 0;
  const shouldHaveClouds = cloudCover > 0;
  
  if (!forceRegenerate && !(isEmpty && shouldHaveClouds)) {
    return;
  }
  
  // Clear existing
  cloudContainer.innerHTML = '';
  
  if (cloudCover === 0) return;
  
  // Scale cloud count based on coverage - but respect MAX_CLOUDS cap
  // Low coverage (0-30%): up to 25 clouds
  // Medium coverage (30-70%): up to 50 clouds
  // High coverage (70-100%): up to MAX_CLOUDS
  let targetCount;
  if (cloudCover <= 30) {
    targetCount = Math.ceil((cloudCover / 30) * 25);
  } else if (cloudCover <= 70) {
    targetCount = 25 + Math.ceil(((cloudCover - 30) / 40) * 25);
  } else {
    targetCount = 50 + Math.ceil(((cloudCover - 70) / 30) * (MAX_CLOUDS - 50));
  }
  
  // ENFORCE CAP
  targetCount = Math.min(targetCount, MAX_CLOUDS);
  
  // Set opacity based on coverage
  const baseOpacity = 0.5 + (cloudCover / 100) * 0.5;
  document.documentElement.style.setProperty('--cloud-base-opacity', baseOpacity);
  
  // Initialize observer
  const observer = initCloudObserver();
  
  // Create clouds - stagger on force regenerate (location change)
  for (let i = 0; i < targetCount; i++) {
    const cloud = createCloud(i, targetCount, cloudCover, windSpeed, windDirection, forceRegenerate);
    cloudContainer.appendChild(cloud);
    observer.observe(cloud);
  }
}

/**
 * Force cloud regeneration (called on location change)
 */
export function forceCloudUpdate() {
  updateCloudCover(true);
}

/**
 * 6. UPDATE WEATHER EFFECTS based on current weather state
 * @param {number} sunElevation - Sun elevation in degrees (for cloud brightness)
 */
export function updateWeatherEffects(sunElevation = null) {
  const root = document.documentElement;
  const sky = document.getElementById('sky-effects');
  const cloudCover = weatherState.cloudCover || 0;

  // Set wind intensity for vegetation animation
  root.style.setProperty('--wind-intensity', getWindIntensity());

  // Precipitation visibility based on weather condition
  const condition = getWeatherCondition();
  const precipIntensity = getPrecipitationIntensity();
  
  // Rain opacity: show for rain, drizzle, and thunderstorms
  let rainOpacity = 0;
  if (condition === 'rain' || condition === 'thunderstorm') {
    rainOpacity = precipIntensity === 3 ? 1.0 : 
                  precipIntensity === 2 ? 0.7 : 
                  precipIntensity === 1 ? 0.4 : 0.5; // default for thunderstorm
  }
  root.style.setProperty('--rain-opacity', rainOpacity);
  
  // Snow opacity
  let snowOpacity = 0;
  if (condition === 'snow') {
    snowOpacity = precipIntensity === 3 ? 1.0 : 
                  precipIntensity === 2 ? 0.7 : 0.4;
  }
  root.style.setProperty('--snow-opacity', snowOpacity);
  
  // Fog opacity
  let fogOpacity = 0;
  if (condition === 'fog') {
    fogOpacity = 0.6;
  }
  root.style.setProperty('--fog-opacity', fogOpacity);
  
  // Weather dimming for heavy/stormy conditions
  // This dims the scene but should NOT exceed night darkness
  // Night terrain brightness minimum is ~0.35, so we cap weather dim above that
  let weatherDim = 1.0; // 1.0 = no dimming
  
  if (condition === 'thunderstorm') {
    weatherDim = 0.65; // Significant dimming for storms
  } else if (condition === 'overcast' || precipIntensity === 3) {
    weatherDim = 0.75; // Heavy overcast or heavy precip
  } else if (condition === 'rain' || condition === 'snow' || precipIntensity === 2) {
    weatherDim = 0.85; // Moderate dimming
  } else if (condition === 'fog') {
    weatherDim = 0.80; // Fog dims things
  }
  
  root.style.setProperty('--weather-dim', weatherDim);

  
  // Try to generate clouds if needed (won't regenerate if already have some)
  updateCloudCover(false);
  
  // Cloud brightness - based on sun elevation, weather severity, and cloud density
  let cloudBrightness = 1.0;
  
  // Base brightness from sun elevation
  if (sunElevation !== null) {
    if (sunElevation > 10) {
      cloudBrightness = 1.0;
    } else if (sunElevation > 0) {
      // Gentle dimming during golden hour: 1.0 → 0.85
      cloudBrightness = 1.0 - ((10 - sunElevation) / 10) * 0.15;
    } else if (sunElevation > -6) {
      // Civil twilight: 0.85 → 0.65
      cloudBrightness = 0.85 - ((0 - sunElevation) / 6) * 0.20;
    } else if (sunElevation > -12) {
      // Nautical twilight: 0.65 → 0.45
      cloudBrightness = 0.65 - ((-6 - sunElevation) / 6) * 0.20;
    } else {
      // Night: 0.45
      cloudBrightness = 0.45;
    }
  }
  
  // Weather severity dimming (heavy events darken clouds)
  let weatherCloudDim = 1.0;
  
  if (condition === 'thunderstorm') {
    weatherCloudDim = 0.55; // Storm clouds are dark
  } else if (precipIntensity === 3 || condition === 'overcast') {
    weatherCloudDim = 0.7; // Heavy precip or overcast
  } else if (precipIntensity === 2) {
    weatherCloudDim = 0.8; // Moderate precip
  } else if (condition === 'fog') {
    weatherCloudDim = 0.85;
  }
  
  // Cloud density dimming (90-100% coverage = clouds block each other's light)
  let densityDim = 1.0;
  if (cloudCover >= 90) {
    // 90% → 0.85, 100% → 0.7
    densityDim = 0.85 - ((cloudCover - 90) / 10) * 0.15;
  } else if (cloudCover >= 70) {
    // 70% → 0.95, 90% → 0.85
    densityDim = 0.95 - ((cloudCover - 70) / 20) * 0.10;
  }
  
  // Combine all factors, but don't go darker than night clouds (0.4)
  const finalCloudBrightness = Math.max(0.4, cloudBrightness * weatherCloudDim * densityDim);
  
  root.style.setProperty('--cloud-brightness', finalCloudBrightness);
  
  // Night mode for blue-tinted clouds (only in deep night)
  if (sunElevation !== null && sunElevation < -12) {
    root.setAttribute('data-time', 'night');
  } else {
    root.removeAttribute('data-time');
  }
  
  // Star dimming based on cloud cover
  const cloudOpacity = Math.min(1, cloudCover / 100);
  root.style.setProperty('--cloud-opacity', cloudOpacity);
  
  if (cloudOpacity > 0.3) {
    sky?.classList.add('cloudy');
    root.style.setProperty('--star-dim-factor', 1 - (cloudOpacity * 0.7));
  } else {
    sky?.classList.remove('cloudy');
    root.style.setProperty('--star-dim-factor', 1);
  }
  // Check for lightning
  updateLightningSystem();
}

/**
 * Trigger lightning flash effect - brightens EVERYTHING
 * FIXED: Track nested timeouts to prevent accumulation
 */
let lightningTimeout = null;

function triggerLightning() {
  const root = document.documentElement;
  
  root.classList.add('lightning-flash');
  
  setTimeout(() => {
    root.classList.remove('lightning-flash');
  }, 100);
  
  // Random double-flash
  if (Math.random() > 0.5) {
    setTimeout(() => {
      root.classList.add('lightning-flash');
      setTimeout(() => {
        root.classList.remove('lightning-flash');
      }, 80);
    }, 150);
  }
}

function checkForLightning() {
  const condition = getWeatherCondition();
  
  if (condition !== 'thunderstorm') {
    // Stop lightning
    if (lightningTimeout) {
      clearTimeout(lightningTimeout);
      lightningTimeout = null;
    }
    return;
  }
  
  // Schedule next strike: 5-20 seconds
  const nextStrike = 5000 + Math.random() * 15000;
  
  lightningTimeout = setTimeout(() => {
    lightningTimeout = null; // Clear reference BEFORE triggering
    triggerLightning();
    checkForLightning(); // Schedule next
  }, nextStrike);
}

export function updateLightningSystem() {
  const condition = getWeatherCondition();
  
  if (condition === 'thunderstorm' && !lightningTimeout) {
    checkForLightning();
  } else if (condition !== 'thunderstorm' && lightningTimeout) {
    clearTimeout(lightningTimeout);
    lightningTimeout = null;
  }
}

/**
 * 7. UPDATE PERSON CLOTHING based on temperature
 */
export function updatePersonClothing() {
  const person = document.querySelector('.person');
  if (!person) return;
  
  const clothing = getClothingType();
  
  // Remove existing clothing classes
  person.classList.remove('sweater', 'winter-coat');
  
  // Add appropriate class
  if (clothing === 'sweater') {
    person.classList.add('sweater');
  } else if (clothing === 'winter_coat') {
    person.classList.add('winter-coat');
  }
}

/**
 * 8. UPDATE SCENE VISUALS (called from main loop)
 * FIXED: Stars only visible between ר' תם and עלות
 * FIXED: Respects time acceleration to reduce CPU/memory usage
 */
let cleanupStarted = false;

export function updateSceneVisuals(elevation) {
  // Start periodic cleanup on first call
  if (!cleanupStarted) {
    startPeriodicCleanup();
    cleanupStarted = true;
  }
  
  const sky = document.getElementById('sky-effects');
  const acceleration = getTimeAccelerationFactor();
  
  // Use state.sunTimes which are already offset to the target location
  const rTam = state.sunTimes["ר' תם"];
  const alos = state.sunTimes['עלות'];
  const now = state.date;
  
  let starsVisible = false;
  
  if (rTam && alos) {
    // If it's after Tzeit or before Alos, it's night
    // Handle the midnight crossover by checking both conditions
    if (now >= rTam || now < alos) {
      starsVisible = true;
    }
  } else {
    starsVisible = elevation < -8;
  }
  
  if (starsVisible) {
    sky?.classList.add('night-mode');
  } else {
    sky?.classList.remove('night-mode');
  }
  
  // Skip expensive effects during very fast time (100x)
  if (acceleration < 100) {
    updateWeatherEffects(elevation);
  }
  
  // Birds only spawn in real-time or slow speeds
  if (acceleration <= 10) {
    trySpawnBird();
  }

  // Reference the navigated state.date for seasonal/clothing updates
  // Increase probability during acceleration so it updates reasonably
  const updateChance = acceleration >= 10 ? 0.02 : 0.002;
  if (Math.random() < updateChance) {
    updateVegetationSeason();
    updatePersonClothing();
  }
}

/**
 * Handle window resize - regenerate vegetation
 */
export function handleResize() {
  if (vegetationGenerated) {
    generateVegetation();
    addGrassBlades();
  }
}

window.addEventListener('resize', handleResize);