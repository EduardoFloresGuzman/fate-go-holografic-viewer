/**
 * Holographic effects for Fate/GO Servant cards
 * Inspired by the Pokémon Cards CSS Holographic effect
 */

/**
 * Simple spring physics implementation for smooth animations
 */
class Spring {  constructor(initialValue = { x: 0, y: 0 }, config = {}) {
    this.value = { ...initialValue };
    this.target = { ...initialValue };
    this.config = {
      stiffness: config.stiffness || 0.066,
      damping: config.damping || 0.25,
      precision: config.precision || 0.01,
    };
    
    // Initialize velocity for all properties dynamically
    this.velocity = {};
    Object.keys(initialValue).forEach(key => {
      this.velocity[key] = 0;
    });
    
    this.animating = false;
  }
  set(targetValue, options = {}) {
    const soft = options.soft !== false;
    const hard = options.hard === true;

    if (hard) {
      this.value = { ...targetValue };
      this.target = { ...targetValue };
      
      // Reset velocity for all properties
      Object.keys(targetValue).forEach(key => {
        this.velocity[key] = 0;
      });
      
      this.animating = false;
      return;
    }

    this.target = { ...targetValue };

    // Ensure velocity exists for new properties
    Object.keys(targetValue).forEach(key => {
      if (!(key in this.velocity)) {
        this.velocity[key] = 0;
      }
    });

    if (!this.animating && soft) {
      this.animating = true;
      this.tick();
    }
  }

  tick() {
    if (!this.animating) return;

    const dx = this.target.x - this.value.x;
    const dy = this.target.y - this.value.y;

    this.velocity.x += dx * this.config.stiffness;
    this.velocity.y += dy * this.config.stiffness;

    this.velocity.x *= 1 - this.config.damping;
    this.velocity.y *= 1 - this.config.damping;

    this.value.x += this.velocity.x;
    this.value.y += this.velocity.y;

    const isSettled =
      Math.abs(dx) < this.config.precision &&
      Math.abs(dy) < this.config.precision &&
      Math.abs(this.velocity.x) < this.config.precision &&
      Math.abs(this.velocity.y) < this.config.precision;

    if (isSettled) {
      this.value = { ...this.target };
      this.velocity = { x: 0, y: 0 };
      this.animating = false;
      return;
    }

    requestAnimationFrame(() => this.tick());
  }
}

/**
 * Math helper functions
 */
const MathHelpers = {
  clamp: (value, min = 0, max = 100) => Math.min(max, Math.max(min, value)),

  round: (value, precision = 1) => {
    return Math.round(value * precision) / precision;
  },

  adjust: (value, fromMin, fromMax, toMin, toMax) => {
    return toMin + (toMax - toMin) * ((value - fromMin) / (fromMax - fromMin));
  },

  distanceFromCenter: (x, y) => {
    const dx = x - 50;
    const dy = y - 50;
    return Math.sqrt(dx * dx + dy * dy) / 50;
  },
};

class HolographicEffect {
  static CONFIG = {
    ROTATION: {
      MAX_ANGLE: 26,
      INNER_FACTOR: -0.1,
    },    PERSPECTIVE: {
      DEFAULT: 1200,
      ACTIVE: 1400,
    },
    SCALE: {
      DEFAULT: 1.0,
      ACTIVE: 1.02,
    },    TRANSITION: {
      DEFAULT: "transform 0.15s cubic-bezier(0.23, 1, 0.32, 1)",
      SPRING: "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      INNER_SPRING: "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.175)",
      BACKGROUND: "background-position 0.08s ease-out",
    },
    REFLECTION: {
      POSITION_MULTIPLIER: 400,
    },
    GLOW: {
      BASE_SIZE: 60,
      SPEED_FACTOR: 2,
      MAX_SIZE_INCREASE: 20,
    },
    CLEANUP: {
      GALAXY_DELAY: 100,
      STYLE_REMOVAL_DELAY: 50,
    },    SPRING: {
      INTERACT: { stiffness: 0.066, damping: 0.25 }, // Smooth and natural
      SNAP: { stiffness: 0.01, damping: 0.06 }, // Gentle return to neutral
    },
    MOBILE: {
      // Simplified effects for mobile devices
      REDUCED_COMPLEXITY: true,
      LOWER_FRAME_RATE: 30, // Target 30fps instead of 60fps
      SIMPLIFIED_GRADIENTS: true,
    },
  };

  // Detect mobile device
  static isMobileDevice() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      (window.innerWidth <= 768 && "ontouchstart" in window)
    );
  }

  constructor(card, effectType = "masked-premium") {
    this.card = card;
    this.inner = card.querySelector(".card-inner");
    this.overlay = card.querySelector(".holo-overlay");
    this.reflection = card.querySelector(".holo-reflection");
    this.glow = card.querySelector(".holo-glow");

    this.timeoutIds = [];
    this.isMobile = HolographicEffect.isMobileDevice();
    this.lastFrameTime = 0;
    this.targetFrameTime = this.isMobile ? 1000 / 30 : 1000 / 60; // 30fps on mobile, 60fps on desktop

    // Initialize CSS variables for effects that use them
    this.initializeCSSVariables();

    // Add overlay styles to ensure it doesn't block interactions
    this.ensureOverlayStyles();

    this.setEffectType(effectType);

    this.springs = {
      rotate: new Spring(
        { x: 0, y: 0 },
        HolographicEffect.CONFIG.SPRING.INTERACT
      ),
      glare: new Spring(
        { x: 50, y: 50, o: 0 },
        HolographicEffect.CONFIG.SPRING.INTERACT
      ),
      background: new Spring(
        { x: 50, y: 50 },
        HolographicEffect.CONFIG.SPRING.INTERACT
      ),
    };

    this.animationFrameId = null;
    this.setupEventListeners();
  }

  // Initialize CSS variables needed for certain effects
  initializeCSSVariables() {
    this.card.style.setProperty("--pointer-x", "50%");
    this.card.style.setProperty("--pointer-y", "50%");
    this.card.style.setProperty("--pointer-from-center", "0");
    this.card.style.setProperty("--pointer-from-left", "0.5");
    this.card.style.setProperty("--pointer-from-top", "0.5");
  }

  ensureOverlayStyles() {
    // Add custom styles to ensure overlays don't block interactions
    const overlayStyle = this.ensureCleanupStyle(
      "overlay-interaction-fix",
      `
            .card {
                pointer-events: auto !important;
            }
        `
    );
  }  setupEventListeners() {
    // Enhanced debouncing for better mobile performance
    let moveTimeout;
    let lastMoveTime = 0;
    const moveThrottle = this.isMobile ? 12 : 6; // ~83fps desktop, ~50fps mobile

    const handlePointerMove = (e) => {
      const now = performance.now();

      // Throttle based on device capability
      if (now - lastMoveTime < moveThrottle) {
        return;
      }

      // Cancel previous timeout
      if (moveTimeout) {
        cancelAnimationFrame(moveTimeout);
      }

      lastMoveTime = now;

      // Schedule next update with frame timing
      moveTimeout = requestAnimationFrame(() => {
        this.moveCard(e);
      });
    };

    const handlePointerEnter = () => this.activateCard();
    const handlePointerLeave = () => {
      // Clear any pending movement updates
      if (moveTimeout) {
        cancelAnimationFrame(moveTimeout);
      }
      this.deactivateCard();
    };

    // Use passive listeners for better scroll performance
    this.card.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    this.card.addEventListener("pointerenter", handlePointerEnter, {
      passive: true,
    });
    this.card.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    });

    // Store listeners for cleanup
    this.eventListeners = {
      pointermove: handlePointerMove,
      pointerenter: handlePointerEnter,
      pointerleave: handlePointerLeave,
    };
  }

  setManagedTimeout(callback, delay) {
    const id = setTimeout(() => {
      callback();
      const index = this.timeoutIds.indexOf(id);
      if (index > -1) this.timeoutIds.splice(index, 1);
    }, delay);
    this.timeoutIds.push(id);
    return id;
  }

  ensureCleanupStyle(id, cssText) {
    const existingStyle = document.getElementById(id);
    if (existingStyle) {
      document.head.removeChild(existingStyle);
    }

    const styleElement = document.createElement("style");
    styleElement.id = id;
    styleElement.textContent = cssText;
    document.head.appendChild(styleElement);

    return styleElement;
  }

  setEffectType(effectType) {
    this.resetElements(); // Remove any existing effect classes
    this.card.classList.remove(
      "effect-masked-premium",
      "effect-masked-rainbow",
      "effect-cosmos"
    );

    // Set the correct effect class
    this.card.classList.add(`effect-${effectType}`);

    this.restartAnimations();
  }

  triggerReflow(elements) {
    elements.forEach((element) => {
      if (element) {
        element.offsetHeight;
      }
    });
  }

  resetElements() {
    if (this.overlay) {
      this.overlay.style.animation = "none";
      this.overlay.style.background = "";
      this.overlay.style.backgroundPosition = "";
      this.triggerReflow([this.overlay]);
    }
    if (this.reflection) {
      this.reflection.style.animation = "none";
      this.reflection.style.backgroundPosition = "0% 0%";
      this.triggerReflow([this.reflection]);
    }

    if (this.glow) {
      this.glow.style.animation = "none";
      this.glow.style.background = "";
      this.triggerReflow([this.glow]);
    }

    if (this.card) {
      this.card.style.transform = `perspective(${HolographicEffect.CONFIG.PERSPECTIVE.DEFAULT}px)`;
    }

    if (this.inner) {
      this.inner.style.transform = "";
    }

    const cleanupStyle = this.ensureCleanupStyle(
      "global-cleanup-style",
      `
            .card-inner::before,
            .card-inner::after {
                animation: none !important;
                opacity: 0 !important;
                background: none !important;
                filter: none !important;
                content: "" !important;
            }
        `
    );

    this.triggerReflow([this.inner]);

    this.setManagedTimeout(() => {
      if (document.head.contains(cleanupStyle)) {
        document.head.removeChild(cleanupStyle);
      }
    }, HolographicEffect.CONFIG.CLEANUP.STYLE_REMOVAL_DELAY);
  }

  restartAnimations() {
    this.setManagedTimeout(() => {
      if (this.overlay) this.overlay.style.animation = "";
      if (this.reflection) this.reflection.style.animation = "";
      if (this.glow) this.glow.style.animation = "";
    }, HolographicEffect.CONFIG.CLEANUP.STYLE_REMOVAL_DELAY);
  }

  activateCard() {
    this.card.classList.add("active");
  }

  deactivateCard() {
    this.card.classList.remove("active");

    Object.assign(
      this.springs.rotate.config,
      HolographicEffect.CONFIG.SPRING.SNAP
    );
    Object.assign(
      this.springs.glare.config,
      HolographicEffect.CONFIG.SPRING.SNAP
    );
    Object.assign(
      this.springs.background.config,
      HolographicEffect.CONFIG.SPRING.SNAP
    );

    this.springs.rotate.set({ x: 0, y: 0 });
    this.springs.glare.set({ x: 50, y: 50, o: 0 });
    this.springs.background.set({ x: 50, y: 50 });    this.card.style.transition = HolographicEffect.CONFIG.TRANSITION.SPRING;
    this.card.style.transform = `perspective(${HolographicEffect.CONFIG.PERSPECTIVE.DEFAULT}px) rotateY(0) rotateX(0) scale(${HolographicEffect.CONFIG.SCALE.DEFAULT})`;

    if (this.inner) {
      this.inner.style.transition =
        HolographicEffect.CONFIG.TRANSITION.INNER_SPRING;
      this.inner.style.transform = "rotateY(0) rotateX(0)";
    }

    if (this.reflection) {
      this.reflection.style.transition = "background-position 0.5s ease-out";
      this.reflection.style.backgroundPosition = "50% 50%";
    }

    if (!this.animationFrameId) {
      this.animateCard();
    }    this.setManagedTimeout(() => {
      this.card.style.transition = HolographicEffect.CONFIG.TRANSITION.DEFAULT;

      if (this.inner) {
        this.inner.style.transition =
          "transform 0.12s cubic-bezier(0.23, 1, 0.32, 1)";
      }

      if (this.reflection) {
        this.reflection.style.transition =
          HolographicEffect.CONFIG.TRANSITION.BACKGROUND;
      }
    }, 600);
  }
  moveCard(e) {
    if (!this.card.classList.contains("active")) return;

    const rect = this.card.getBoundingClientRect();

    let mouseX, mouseY;

    // Fix touch event handling
    if (e.type === "touchmove" && e.touches && e.touches.length > 0) {
      mouseX = e.touches[0].clientX - rect.left;
      mouseY = e.touches[0].clientY - rect.top;
    } else {
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    }

    mouseX = MathHelpers.clamp(mouseX, 0, rect.width);
    mouseY = MathHelpers.clamp(mouseY, 0, rect.height);    const percentX = MathHelpers.round((mouseX / rect.width) * 100);
    const percentY = MathHelpers.round((mouseY / rect.height) * 100);

    // Improved center calculation for more natural rotation
    const centerX = (percentX - 50) / 50; // Normalize to -1 to 1
    const centerY = (percentY - 50) / 50; // Normalize to -1 to 1
    
    // Calculate distance from center for intensity scaling
    const distanceFromCenter = Math.sqrt(centerX * centerX + centerY * centerY);
    const intensityScale = Math.min(distanceFromCenter * 0.8, 1); // Softer intensity curve

    // More natural rotation mapping with easing
    const maxRotation = this.isMobile ? 
      HolographicEffect.CONFIG.ROTATION.MAX_ANGLE * 0.5 : // Moderate for mobile
      HolographicEffect.CONFIG.ROTATION.MAX_ANGLE * 0.7;  // More for desktop
    
    // Apply easing function for smoother rotation
    const easeRotationX = centerY * -1 * maxRotation * Math.pow(intensityScale, 0.8);
    const easeRotationY = centerX * maxRotation * Math.pow(intensityScale, 0.8);

    const rotateX = MathHelpers.clamp(easeRotationX, -maxRotation, maxRotation);
    const rotateY = MathHelpers.clamp(easeRotationY, -maxRotation, maxRotation);    this.updateSprings(
      {
        x: MathHelpers.adjust(percentX, 0, 100, 25, 75),
        y: MathHelpers.adjust(percentY, 0, 100, 25, 75),
      },
      {
        x: MathHelpers.round(rotateX, 100),
        y: MathHelpers.round(rotateY, 100),
      },
      {
        x: percentX,
        y: percentY,
        o: Math.min(distanceFromCenter, 1),
      }
    );

    // Don't call updateCardTransform here - let the animation loop handle it
    if (!this.animationFrameId) {
      this.animateCard();
    }
  }

  updateSprings(background, rotate, glare) {
    Object.assign(
      this.springs.background.config,
      HolographicEffect.CONFIG.SPRING.INTERACT
    );
    Object.assign(
      this.springs.rotate.config,
      HolographicEffect.CONFIG.SPRING.INTERACT
    );
    Object.assign(
      this.springs.glare.config,
      HolographicEffect.CONFIG.SPRING.INTERACT
    );

    this.springs.background.set(background);
    this.springs.rotate.set(rotate);
    this.springs.glare.set(glare);
  }

  animateCard() {
    this.updateCardTransform();

    const isAnimating =
      this.springs.rotate.animating ||
      this.springs.glare.animating ||
      this.springs.background.animating;

    if (isAnimating) {
      this.animationFrameId = requestAnimationFrame(() => this.animateCard());
    } else {
      this.animationFrameId = null;
    }
  }
  updateCardTransform() {
    const rotate = this.springs.rotate.value;
    const glare = this.springs.glare.value;
    const background = this.springs.background.value;    // Simplified transforms for mobile devices
    if (this.isMobile) {
      // Moderate rotation reduction for mobile (75% instead of 50%)
      const mobileRotateX = rotate.x * 0.75;
      const mobileRotateY = rotate.y * 0.75;

      this.card.style.transform = `
        perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
        rotateX(${mobileRotateX}deg)
        rotateY(${mobileRotateY}deg)
        scale(1.01)
      `;

      if (this.inner) {
        const innerFactorX =
          mobileRotateX * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
        const innerFactorY =
          mobileRotateY * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
        this.inner.style.transform = `rotateX(${innerFactorX}deg) rotateY(${innerFactorY}deg)`;
      }
    } else {
      // Full effects for desktop
      this.card.style.transform = `
            perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
            rotateX(${rotate.x}deg)
            rotateY(${rotate.y}deg)
            scale(${HolographicEffect.CONFIG.SCALE.ACTIVE})
        `;

      if (this.inner) {
        const innerFactorX =
          rotate.x * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
        const innerFactorY =
          rotate.y * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
        this.inner.style.transform = `rotateX(${innerFactorX}deg) rotateY(${innerFactorY}deg)`;
      }
    }

    this.applyVisualEffects(glare, background);
  }
  applyVisualEffects(glare, background) {
    // Update CSS variables for effects that use them (like masked-secret-rare)
    const distanceFromCenter = MathHelpers.distanceFromCenter(glare.x, glare.y);
    this.card.style.setProperty("--pointer-x", `${glare.x}%`);
    this.card.style.setProperty("--pointer-y", `${glare.y}%`);
    this.card.style.setProperty("--pointer-from-center", distanceFromCenter);
    this.card.style.setProperty("--pointer-from-left", glare.x / 100);
    this.card.style.setProperty("--pointer-from-top", glare.y / 100);

    // Simplified effects for mobile devices
    if (this.isMobile) {
      // Reduce reflection complexity on mobile
      if (this.reflection) {
        const multiplier =
          HolographicEffect.CONFIG.REFLECTION.POSITION_MULTIPLIER * 0.5; // Reduce intensity
        const posX = background.x * (multiplier / 100);
        const posY = background.y * (multiplier / 100);
        this.reflection.style.backgroundPosition = `${posX}% ${posY}%`;
      }

      // Simplify glow effect on mobile
      if (this.glow) {
        const glowSize = HolographicEffect.CONFIG.GLOW.BASE_SIZE; // Fixed size, no animation
        this.glow.style.background = `radial-gradient(
          circle at ${glare.x}% ${glare.y}%, 
          rgba(255, 255, 255, 0.3) 0%, 
          rgba(255, 255, 255, 0) ${glowSize}%
        )`;
      }
    } else {
      // Full effects for desktop
      if (this.reflection) {
        const multiplier =
          HolographicEffect.CONFIG.REFLECTION.POSITION_MULTIPLIER;
        const posX = background.x * (multiplier / 100);
        const posY = background.y * (multiplier / 100);
        this.reflection.style.backgroundPosition = `${posX}% ${posY}%`;
      }

      if (this.glow) {
        const glowSize =
          HolographicEffect.CONFIG.GLOW.BASE_SIZE +
          distanceFromCenter * HolographicEffect.CONFIG.GLOW.MAX_SIZE_INCREASE;

        this.glow.style.background = `radial-gradient(
          circle at ${glare.x}% ${glare.y}%, 
          rgba(255, 255, 255, ${0.6 + distanceFromCenter * 0.4}) 0%, 
          rgba(255, 255, 255, 0) ${glowSize}%
        )`;
      }
    }
  }
  destroy() {
    // Remove event listeners properly
    if (this.eventListeners) {
      this.card.removeEventListener(
        "pointermove",
        this.eventListeners.pointermove
      );
      this.card.removeEventListener(
        "pointerenter",
        this.eventListeners.pointerenter
      );
      this.card.removeEventListener(
        "pointerleave",
        this.eventListeners.pointerleave
      );
    }

    // Cancel all animation frames
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear all timeouts
    this.timeoutIds.forEach((id) => clearTimeout(id));
    this.timeoutIds = [];

    // Remove all custom styles
    [
      "galaxy-cleanup-style",
      "global-cleanup-style",
      "galaxy-animation-style",
      "overlay-interaction-fix",
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element && document.head.contains(element)) {
        document.head.removeChild(element);
      }
    });

    // Clear references
    this.springs = null;
    this.eventListeners = null;
  }
}

// Card Factory for creating holographic cards
class CardFactory {
  static async createCard(servantData, effectType = "masked-premium") {
    const card = document.createElement("div");
    card.className = `card effect-${effectType}`;
    card.dataset.id = servantData.id; // Create base card structure
    card.innerHTML = `
            <div class="card-inner">
                <div class="card-face">
                    <img class="card-image" src="${
                      servantData.imageURL
                    }" alt="${servantData.name}">
                    <div class="character-layer"></div>
                    <div class="holo-overlay"></div>
                    <div class="holo-reflection"></div> Take a not of this!
                    <div class="holo-sparkle"></div>
                    <div class="holo-diffraction"></div>
                    <div class="holo-glow"></div>
                    <div class="card-info">
                        <div class="card-name">${servantData.name}</div>
                        <div class="card-rarity">${"★".repeat(
                          servantData.rarity
                        )}</div>
                    </div>
                </div>
            </div>
        `;

    // For masked effects, process the image
    if (effectType.includes("masked")) {
      try {
        await this.applyImageMasking(card, servantData.imageURL);
      } catch (error) {
        console.error("Error applying image masking:", error);
        // Fallback to regular effect if masking fails
        card.className = `card effect-masked-premium`;
      }
    }

    const effect = new HolographicEffect(card, effectType);

    card.holoEffect = effect;

    return card;
  }

  static async applyImageMasking(card, imageURL) {
    const processedImage = await ImageProcessor.processCardImage(imageURL, {
      threshold: 0.2, // Adjusted threshold for better masking
      blurRadius: 2, // Increased blur radius for smoother edges
      dilateSize: 4, // Increased dilate size for more pronounced masks
      featherEdge: 6,
    });

    if (!processedImage) {
      throw new Error("Failed to process image");
    }

    const { characterMask, backgroundMask, dimensions } = processedImage;
    console.log("processedImage", processedImage);

    // Create mask data URLs
    const characterMaskURL = ImageProcessor.createMaskDataURL(
      characterMask,
      dimensions.width,
      dimensions.height
    );
    const backgroundMaskURL = ImageProcessor.createMaskDataURL(
      backgroundMask,
      dimensions.width,
      dimensions.height
    ); // Apply masks to respective elements
    const characterLayer = card.querySelector(".character-layer");
    const holoOverlay = card.querySelector(".holo-overlay");
    const holoReflection = card.querySelector(".holo-reflection");
    const holoSparkle = card.querySelector(".holo-sparkle");
    const holoGlow = card.querySelector(".holo-glow");

    // Apply character mask to the character layer
    if (characterLayer) {
      // Character layer shows original image with character mask
      characterLayer.style.backgroundImage = `url(${imageURL})`;
      characterLayer.style.webkitMaskImage = `url(${characterMaskURL})`;
      characterLayer.style.maskImage = `url(${characterMaskURL})`;
    } // Apply background mask to holographic effects
    [holoOverlay, holoReflection, holoSparkle, holoGlow].forEach((element) => {
      if (element) {
        element.style.webkitMaskImage = `url(${backgroundMaskURL})`;
        element.style.maskImage = `url(${backgroundMaskURL})`;
      }
    });

    // Store masks for potential future use
    card.dataset.characterMask = characterMaskURL;
    card.dataset.backgroundMask = backgroundMaskURL;
  }
}
