/**
 * Holographic effects for Fate/GO Servant cards
 * Inspired by the Pokémon Cards CSS Holographic effect
 */

/**
 * Simple spring physics implementation for smooth animations
 */
class Spring {
    constructor(initialValue = { x: 0, y: 0 }, config = {}) {
        this.value = { ...initialValue };
        this.target = { ...initialValue };
        this.config = {
            stiffness: config.stiffness || 0.066,
            damping: config.damping || 0.25,
            precision: config.precision || 0.01
        };
        this.velocity = { x: 0, y: 0 };
        this.animating = false;
    }
    
    set(targetValue, options = {}) {
        const soft = options.soft !== false;
        const hard = options.hard === true;
        
        if (hard) {
            this.value = { ...targetValue };
            this.target = { ...targetValue };
            this.velocity = { x: 0, y: 0 };
            this.animating = false;
            return;
        }
        
        this.target = { ...targetValue };
        
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
        
        this.velocity.x *= (1 - this.config.damping);
        this.velocity.y *= (1 - this.config.damping);
        
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
    }
};

class HolographicEffect {
    static CONFIG = {
        ROTATION: {
            MAX_ANGLE: 26,
            INNER_FACTOR: -0.1
        },
        PERSPECTIVE: {
            DEFAULT: 1500,
            ACTIVE: 1800
        },
        SCALE: {
            DEFAULT: 1.0,
            ACTIVE: 1.03,
            POPOVER: 1.75  // Scale factor for popped-up cards
        },
        TRANSITION: {
            DEFAULT: 'transform 0.2s cubic-bezier(0.13, 0.53, 0.38, 0.97)',
            SPRING: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            INNER_SPRING: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.175)',
            BACKGROUND: 'background-position 0.1s ease-out'
        },
        REFLECTION: {
            POSITION_MULTIPLIER: 400
        },
        GLOW: {
            BASE_SIZE: 60,
            SPEED_FACTOR: 2,
            MAX_SIZE_INCREASE: 20
        },
        CLEANUP: {
            GALAXY_DELAY: 100,
            STYLE_REMOVAL_DELAY: 50
        },
        SPRING: {
            INTERACT: { stiffness: 0.066, damping: 0.25 },
            SNAP: { stiffness: 0.01, damping: 0.06 },
            POPOVER: { stiffness: 0.033, damping: 0.45 }  // Spring settings for popover animation
        }
    };

    constructor(card, effectType = 'standard') {
        this.card = card;
        this.inner = card.querySelector('.card-inner');
        this.overlay = card.querySelector('.holo-overlay');
        this.reflection = card.querySelector('.holo-reflection');
        this.diffraction = card.querySelector('.holo-diffraction');
        this.glow = card.querySelector('.holo-glow');
        this.sparkle = card.querySelector('.holo-sparkle');
        
        this.timeoutIds = [];
        this.isPopped = false;
        this.hasBeenPopped = false;
        this.originalPosition = null;
        
        // Add overlay styles to ensure it doesn't block interactions
        this.ensureOverlayStyles();
        
        this.setEffectType(effectType);
        
        this.springs = {
            rotate: new Spring({ x: 0, y: 0 }, HolographicEffect.CONFIG.SPRING.INTERACT),
            glare: new Spring({ x: 50, y: 50, o: 0 }, HolographicEffect.CONFIG.SPRING.INTERACT),
            background: new Spring({ x: 50, y: 50 }, HolographicEffect.CONFIG.SPRING.INTERACT)
        };
        
        this.animationFrameId = null;
        
        this.setupEventListeners();
    }
    
    ensureOverlayStyles() {
        // Add custom styles to ensure overlays don't block interactions
        const overlayStyle = this.ensureCleanupStyle('overlay-interaction-fix', `
            .card-popped::before {
                pointer-events: none !important;
            }
            .card.popped {
                pointer-events: auto !important;
                z-index: 1001 !important;
            }
        `);
    }
    
    setupEventListeners() {
        this.card.addEventListener('mouseenter', () => this.activateCard());
        this.card.addEventListener('mouseleave', () => this.deactivateCard());
        this.card.addEventListener('mousemove', (e) => this.moveCard(e));
        this.card.addEventListener('click', (e) => this.handleCardClick(e));
        
        this.card.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.activateCard();
        });
        
        this.card.addEventListener('touchend', () => {
            this.deactivateCard();
        });
        
        this.card.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                e.preventDefault();
                const touch = e.touches[0];
                this.moveCard({
                    type: 'touchmove',
                    touches: e.touches,
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });
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
        
        const styleElement = document.createElement('style');
        styleElement.id = id;
        styleElement.textContent = cssText;
        document.head.appendChild(styleElement);
        
        return styleElement;
    }
    
    setEffectType(effectType) {
        this.resetElements();
        
        this.card.classList.remove(
            'effect-standard', 
            'effect-galaxy', 
            'effect-radial', 
            'effect-fullart',
            'effect-premium'
        );
        
        const galaxyCleanupStyle = this.ensureCleanupStyle('galaxy-cleanup-style', `
            .card-inner::before {
                opacity: 0 !important;
                animation: none !important;
                background: none !important;
                filter: none !important;
            }
            .holo-sparkle {
                color: initial !important;
                filter: none !important;
            }
            .holo-overlay {
                background: initial !important;
            }
        `);
        
        this.triggerReflow([this.inner, this.overlay, this.sparkle]);
        
        this.setManagedTimeout(() => {
            if (document.head.contains(galaxyCleanupStyle)) {
                document.head.removeChild(galaxyCleanupStyle);
            }
        }, HolographicEffect.CONFIG.CLEANUP.GALAXY_DELAY);
        
        this.card.classList.add(`effect-${effectType}`);
        
        this.restartAnimations();
    }
    
    triggerReflow(elements) {
        elements.forEach(element => {
            if (element) {
                element.offsetHeight;
            }
        });
    }
    
    resetElements() {
        if (this.overlay) {
            this.overlay.style.animation = 'none';
            this.overlay.style.background = '';
            this.overlay.style.backgroundPosition = '';
            this.triggerReflow([this.overlay]);
        }
        
        if (this.reflection) {
            this.reflection.style.animation = 'none';
            this.reflection.style.backgroundPosition = '0% 0%';
            this.triggerReflow([this.reflection]);
        }
        
        if (this.diffraction) {
            this.diffraction.style.animation = 'none';
            this.triggerReflow([this.diffraction]);
        }
        
        if (this.glow) {
            this.glow.style.animation = 'none';
            this.glow.style.background = '';
            this.triggerReflow([this.glow]);
        }
        
        if (this.sparkle) {
            this.sparkle.style.animation = 'none';
            this.sparkle.style.color = '';
            this.sparkle.style.filter = '';
            this.triggerReflow([this.sparkle]);
        }
        
        if (this.card) {
            this.card.style.transform = `perspective(${HolographicEffect.CONFIG.PERSPECTIVE.DEFAULT}px)`;
        }
        
        if (this.inner) {
            this.inner.style.transform = '';
        }
        
        const cleanupStyle = this.ensureCleanupStyle('global-cleanup-style', `
            .card-inner::before,
            .card-inner::after {
                animation: none !important;
                opacity: 0 !important;
                background: none !important;
                filter: none !important;
                content: "" !important;
            }
        `);
        
        this.triggerReflow([this.inner]);
        
        this.setManagedTimeout(() => {
            if (document.head.contains(cleanupStyle)) {
                document.head.removeChild(cleanupStyle);
            }
        }, HolographicEffect.CONFIG.CLEANUP.STYLE_REMOVAL_DELAY);
    }
    
    restartAnimations() {
        this.setManagedTimeout(() => {
            if (this.overlay) this.overlay.style.animation = '';
            if (this.reflection) this.reflection.style.animation = '';
            if (this.diffraction) this.diffraction.style.animation = '';
            if (this.glow) this.glow.style.animation = '';
            if (this.sparkle) this.sparkle.style.animation = '';
            
            if (this.card.classList.contains('effect-galaxy') && this.inner) {
                const galaxyAnimStyle = this.ensureCleanupStyle('galaxy-animation-style', `
                    .effect-galaxy.active .card-inner::before {
                        opacity: 1;
                        animation: galaxy-rotate 14s linear infinite;
                    }
                `);
            }
            
            if (this.card.classList.contains('effect-premium') && this.sparkle) {
                this.sparkle.style.animation = 'sparkle-premium 7s linear infinite';
            }
        }, HolographicEffect.CONFIG.CLEANUP.STYLE_REMOVAL_DELAY);
    }
    
    activateCard() {
        this.card.classList.add('active');
    }
    
    deactivateCard() {
        this.card.classList.remove('active');
        
        Object.assign(this.springs.rotate.config, HolographicEffect.CONFIG.SPRING.SNAP);
        Object.assign(this.springs.glare.config, HolographicEffect.CONFIG.SPRING.SNAP);
        Object.assign(this.springs.background.config, HolographicEffect.CONFIG.SPRING.SNAP);
        
        this.springs.rotate.set({ x: 0, y: 0 });
        this.springs.glare.set({ x: 50, y: 50, o: 0 });
        this.springs.background.set({ x: 50, y: 50 });
        
        this.card.style.transition = HolographicEffect.CONFIG.TRANSITION.SPRING;
        this.card.style.transform = `perspective(${HolographicEffect.CONFIG.PERSPECTIVE.DEFAULT}px) rotateY(0) rotateX(0) scale(${HolographicEffect.CONFIG.SCALE.DEFAULT})`;
        
        if (this.inner) {
            this.inner.style.transition = HolographicEffect.CONFIG.TRANSITION.INNER_SPRING;
            this.inner.style.transform = 'rotateY(0) rotateX(0)';
        }
        
        if (this.reflection) {
            this.reflection.style.transition = 'background-position 0.4s ease-out';
            this.reflection.style.backgroundPosition = '0% 0%';
        }
        
        if (!this.animationFrameId) {
            this.animateCard();
        }
        
        this.setManagedTimeout(() => {
            this.card.style.transition = HolographicEffect.CONFIG.TRANSITION.DEFAULT;
            
            if (this.inner) {
                this.inner.style.transition = 'transform 0.15s cubic-bezier(0.13, 0.53, 0.38, 0.97)';
            }
            
            if (this.reflection) {
                this.reflection.style.transition = HolographicEffect.CONFIG.TRANSITION.BACKGROUND;
            }
        }, 500);
    }
    
    moveCard(e) {
        // Skip mouse movement effects if the card is in popped state
        if (this.isPopped) return;
        
        if (!this.card.classList.contains('active')) return;
        
        const rect = this.card.getBoundingClientRect();
        
        let mouseX, mouseY;
        
        if (e.type === 'touchmove') {
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        } else {
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        }
        
        mouseX = MathHelpers.clamp(mouseX, 0, rect.width);
        mouseY = MathHelpers.clamp(mouseY, 0, rect.height);
        
        const percentX = MathHelpers.round((mouseX / rect.width) * 100);
        const percentY = MathHelpers.round((mouseY / rect.height) * 100);
        
        const centerX = percentX - 50;
        const centerY = percentY - 50;
        
        this.updateSprings(
            {
                x: MathHelpers.adjust(percentX, 0, 100, 35, 65),
                y: MathHelpers.adjust(percentY, 0, 100, 35, 65)
            },
            {
                x: MathHelpers.round(-(centerY / 2.5)),
                y: MathHelpers.round(centerX / 3)
            },
            {
                x: percentX,
                y: percentY,
                o: 1
            }
        );
        
        this.updateCardTransform();
        
        if (!this.animationFrameId) {
            this.animateCard();
        }
    }
    
    updateSprings(background, rotate, glare) {
        Object.assign(this.springs.background.config, HolographicEffect.CONFIG.SPRING.INTERACT);
        Object.assign(this.springs.rotate.config, HolographicEffect.CONFIG.SPRING.INTERACT);
        Object.assign(this.springs.glare.config, HolographicEffect.CONFIG.SPRING.INTERACT);
        
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
        const background = this.springs.background.value;
        
        this.card.style.transform = `
            perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
            rotateX(${rotate.x}deg)
            rotateY(${rotate.y}deg)
            scale(${HolographicEffect.CONFIG.SCALE.ACTIVE})
        `;
        
        if (this.inner) {
            const innerFactorX = rotate.x * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
            const innerFactorY = rotate.y * HolographicEffect.CONFIG.ROTATION.INNER_FACTOR;
            this.inner.style.transform = `rotateX(${innerFactorX}deg) rotateY(${innerFactorY}deg)`;
        }
        
        if (this.card.classList.contains('effect-standard')) {
            return;
        }
        
        this.applyVisualEffects(glare, background);
    }
    
    applyVisualEffects(glare, background) {
        if (this.reflection) {
            const multiplier = HolographicEffect.CONFIG.REFLECTION.POSITION_MULTIPLIER;
            const posX = background.x * (multiplier / 100);
            const posY = background.y * (multiplier / 100);
            this.reflection.style.backgroundPosition = `${posX}% ${posY}%`;
        }
        
        if (this.glow) {
            const distanceFromCenter = MathHelpers.distanceFromCenter(glare.x, glare.y);
            const glowSize = HolographicEffect.CONFIG.GLOW.BASE_SIZE + 
                (distanceFromCenter * HolographicEffect.CONFIG.GLOW.MAX_SIZE_INCREASE);
            
            this.glow.style.background = `radial-gradient(
                circle at ${glare.x}% ${glare.y}%, 
                rgba(255, 255, 255, ${0.6 + (distanceFromCenter * 0.4)}) 0%, 
                rgba(255, 255, 255, 0) ${glowSize}%
            )`;
        }
        
        if (this.card.classList.contains('effect-galaxy')) {
            this.updateGalaxyEffect(glare.x, glare.y);
        }
    }
    
    sparkleEffect(e) {
        if (!this.sparkle) return;
        
        this.sparkle.style.animation = 'none';
        this.triggerReflow([this.sparkle]);
        
        const rect = this.card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.sparkle.style.backgroundPosition = `${x}px ${y}px`;
        this.sparkle.style.animation = 'sparkle 0.8s ease forwards';
    }
    
    setCenter() {
        const rect = this.card.getBoundingClientRect();
        const viewWidth = document.documentElement.clientWidth;
        const viewHeight = document.documentElement.clientHeight;
        
        const deltaX = Math.round(viewWidth / 2 - rect.x - rect.width / 2);
        const deltaY = Math.round(viewHeight / 2 - rect.y - rect.height / 2);
        
        this.translateCard(deltaX, deltaY);
    }
    
    translateCard(x, y) {
        if (!this.card) return;
        
        if (!this.springs.translate) {
            this.springs.translate = new Spring({ x: 0, y: 0 }, HolographicEffect.CONFIG.SPRING.POPOVER);
        }
        
        this.springs.translate.set({ x, y });
        
        const applyTranslation = () => {
            if (!this.springs.translate.animating) {
                cancelAnimationFrame(this._translateFrameId);
                this._translateFrameId = null;
                return;
            }
            
            const translate = this.springs.translate.value;
            this.card.style.transform = `translate3d(${translate.x}px, ${translate.y}px, 0.1px) ${this.card.style.transform.replace(/translate3d\([^)]+\)/g, '')}`;
            
            this._translateFrameId = requestAnimationFrame(applyTranslation);
        };
        
        if (!this._translateFrameId) {
            this._translateFrameId = requestAnimationFrame(applyTranslation);
        }
    }
    
    popCard() {
        if (this.isPopped) return;
        
        this.isPopped = true;
        this.card.classList.add('popped');
        
        // Save current position
        this.originalPosition = {
            left: this.card.style.left,
            top: this.card.style.top,
            zIndex: this.card.style.zIndex,
            transform: this.card.style.transform
        };
        
        // Set card to highest z-index
        this.card.style.zIndex = '1000';
        
        // Prepare for animation
        document.body.classList.add('card-popped');
        
        // Center the card on screen with improved animation
        this.centerCardOnScreen();
        
        // Add enhanced sparkle effect
        if (this.sparkle) {
            this.sparkle.style.animation = 'sparkle-pop 1.2s ease-out forwards';
        }
        
        // Apply a 360-degree rotation animation for first pop
        if (!this.hasBeenPopped) {
            // Create spring for rotation animation if it doesn't exist
            if (!this.springs.rotateFlip) {
                this.springs.rotateFlip = new Spring({ x: 0, y: 0 }, HolographicEffect.CONFIG.SPRING.POPOVER);
            }
            
            // Configure the spring for a smooth rotation
            Object.assign(this.springs.rotateFlip.config, {
                stiffness: 0.025,
                damping: 0.5
            });
            
            // Set target rotation (full flip on Y axis)
            this.springs.rotateFlip.set({ x: 0, y: 360 });
            
            // Apply the rotation animation
            const applyRotation = () => {
                if (!this.springs.rotateFlip.animating) {
                    cancelAnimationFrame(this._rotateFrameId);
                    this._rotateFrameId = null;
                    return;
                }
                
                const rotate = this.springs.rotateFlip.value;
                this.card.style.transform = `
                    perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
                    translate3d(${this._centerDeltaX || 0}px, ${this._centerDeltaY || 0}px, 50px)
                    rotateY(${rotate.y}deg)
                    scale(${HolographicEffect.CONFIG.SCALE.POPOVER})
                `;
                
                this._rotateFrameId = requestAnimationFrame(applyRotation);
            };
            
            if (!this._rotateFrameId) {
                this._rotateFrameId = requestAnimationFrame(applyRotation);
            }
            
            this.hasBeenPopped = true;
        } else {
            // For subsequent pops, just use a simple scaling effect
            this.card.style.transform = `
                perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
                translate3d(${this._centerDeltaX || 0}px, ${this._centerDeltaY || 0}px, 50px)
                scale(${HolographicEffect.CONFIG.SCALE.POPOVER})
            `;
        }
        
        // Add event listener to close card when clicking outside
        // But with a slight delay to prevent immediate closing
        if (this._closeOnClickOutside) {
            document.removeEventListener('click', this._closeOnClickOutside);
        }
        
        this.setManagedTimeout(() => {
            this._closeOnClickOutside = (e) => {
                if (!this.card.contains(e.target) && this.isPopped) {
                    this.unpopCard();
                }
            };
            document.addEventListener('click', this._closeOnClickOutside);
        }, 500); // Short delay to prevent immediate closing
    }
    
    unpopCard() {
        if (!this.isPopped) return;
        
        this.isPopped = false;
        this.card.classList.remove('popped');
        
        // Remove the overlay background
        document.body.classList.remove('card-popped');
        
        // Remove click outside listener if it exists
        if (this._closeOnClickOutside) {
            document.removeEventListener('click', this._closeOnClickOutside);
            this._closeOnClickOutside = null;
        }
        
        // Reset the hasBeenPopped flag to allow the popup animation to play again
        this.hasBeenPopped = false;
        
        // Create a smooth animation to return to original position
        if (!this.springs.returnTransform) {
            this.springs.returnTransform = new Spring({ 
                x: 0, 
                y: 0, 
                scale: HolographicEffect.CONFIG.SCALE.POPOVER 
            }, HolographicEffect.CONFIG.SPRING.POPOVER);
        }
        
        // Configure return transform spring with faster settings
        Object.assign(this.springs.returnTransform.config, {
            stiffness: 0.07,  // Increased from 0.03 for faster animation
            damping: 0.55     // Adjusted for smoother return
        });
        
        // Set target to default scale
        this.springs.returnTransform.set({ 
            x: 0, 
            y: 0, 
            scale: HolographicEffect.CONFIG.SCALE.DEFAULT 
        });
        
        // Apply the return animation
        const applyReturnAnimation = () => {
            if (!this.springs.returnTransform.animating) {
                cancelAnimationFrame(this._returnFrameId);
                this._returnFrameId = null;
                
                // When animation completes, reset the card's styles
                if (this.originalPosition) {
                    this.card.style.left = this.originalPosition.left;
                    this.card.style.top = this.originalPosition.top;
                    this.card.style.zIndex = this.originalPosition.zIndex || '';
                    this.card.style.transform = this.originalPosition.transform || '';
                }
                
                // Ensure the card is ready for new interactions
                this.activateCard();
                
                return;
            }
            
            const returnValues = this.springs.returnTransform.value;
            
            // Apply the animated transform
            this.card.style.transform = `
                perspective(${HolographicEffect.CONFIG.PERSPECTIVE.DEFAULT}px)
                translate3d(${returnValues.x}px, ${returnValues.y}px, 0px)
                scale(${returnValues.scale})
            `;
            
            this._returnFrameId = requestAnimationFrame(applyReturnAnimation);
        };
        
        if (!this._returnFrameId) {
            this._returnFrameId = requestAnimationFrame(applyReturnAnimation);
        }
        
        // Reset spring to normal interaction mode immediately
        Object.assign(this.springs.rotate.config, HolographicEffect.CONFIG.SPRING.INTERACT);
    }
    
    centerCardOnScreen() {
        const rect = this.card.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Store these values for use in animations
        this._centerDeltaX = Math.round(viewportWidth / 2 - rect.left - rect.width / 2);
        this._centerDeltaY = Math.round(viewportHeight / 2 - rect.top - rect.height / 2);
        
        this.card.style.transition = HolographicEffect.CONFIG.TRANSITION.SPRING;
        this.card.style.transform = `
            perspective(${HolographicEffect.CONFIG.PERSPECTIVE.ACTIVE}px)
            translate3d(${this._centerDeltaX}px, ${this._centerDeltaY}px, 0.1px)
            scale(${HolographicEffect.CONFIG.SCALE.POPOVER})
        `;
    }
    
    handleCardClick(e) {
        // Prevent event bubbling to avoid triggering other elements
        e.stopPropagation();
        
        // First trigger the sparkle effect
        this.sparkleEffect(e);
        
        // Then handle the popover animation
        if (this.isPopped) {
            this.unpopCard();
        } else {
            this.popCard();
        }
    }
    
    updateGalaxyEffect(x, y) {
        if (!this.overlay) return;
        
        // Calculate positions for the gradients based on mouse position
        const mainPosX = x;
        const mainPosY = y;
        
        // Create offset positions for secondary gradients
        const gradPos1X = Math.min(100, Math.max(0, mainPosX - 20));
        const gradPos1Y = Math.min(100, Math.max(0, mainPosY - 10));
        const gradPos2X = Math.min(100, Math.max(0, mainPosX + 20));
        const gradPos2Y = Math.min(100, Math.max(0, mainPosY + 10));
        
        // Apply the background with mouse-following gradients
        this.overlay.style.background = `
            radial-gradient(circle at ${mainPosX}% ${mainPosY}%, rgba(255, 255, 255, 0.3) 10%, rgba(255, 255, 255, 0) 45%),
            radial-gradient(circle at ${gradPos1X}% ${gradPos1Y}%, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0) 50%),
            radial-gradient(circle at ${gradPos2X}% ${gradPos2Y}%, rgba(148, 0, 211, 0.2) 0%, rgba(148, 0, 211, 0) 50%)
        `;
        
        // Change star color based on mouse position
        if (this.sparkle) {
            // Calculate colors based on mouse position
            const hue = Math.floor(x * 360); // 0-360 based on X position
            const saturation = 80 + Math.floor(y * 20); // 80-100% based on Y position
            const lightness = 50 + Math.floor((x + y) / 2 * 20); // 50-70% based on combined position
            
            // Apply color to stars
            this.sparkle.style.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            
            // Add a glow effect that matches the star color
            this.sparkle.style.filter = `drop-shadow(0 0 3px hsla(${hue}, ${saturation}%, ${lightness}%, 0.8))`;
        }
    }
    
    destroy() {
        // Clean up any popped card state
        if (this.isPopped) {
            this.unpopCard();
        }
        
        // Properly remove event listeners by using stored function references
        this._activateCardHandler = this._activateCardHandler || (() => this.activateCard());
        this._deactivateCardHandler = this._deactivateCardHandler || (() => this.deactivateCard());
        this._moveCardHandler = this._moveCardHandler || ((e) => this.moveCard(e));
        this._handleCardClickHandler = this._handleCardClickHandler || ((e) => this.handleCardClick(e));
        this._touchStartHandler = this._touchStartHandler || ((e) => { e.preventDefault(); this.activateCard(); });
        this._touchEndHandler = this._touchEndHandler || (() => this.deactivateCard());
        this._touchMoveHandler = this._touchMoveHandler || ((e) => {
            if (e.touches.length > 0) {
                e.preventDefault();
                const touch = e.touches[0];
                this.moveCard({
                    type: 'touchmove',
                    touches: e.touches,
                    clientX: touch.clientX,
                    clientY: touch.clientY
                });
            }
        });
        
        this.card.removeEventListener('mouseenter', this._activateCardHandler);
        this.card.removeEventListener('mouseleave', this._deactivateCardHandler);
        this.card.removeEventListener('mousemove', this._moveCardHandler);
        this.card.removeEventListener('click', this._handleCardClickHandler);
        this.card.removeEventListener('touchstart', this._touchStartHandler);
        this.card.removeEventListener('touchend', this._touchEndHandler);
        this.card.removeEventListener('touchmove', this._touchMoveHandler);
        
        // Remove click outside listener if it exists
        if (this._closeOnClickOutside) {
            document.removeEventListener('click', this._closeOnClickOutside);
            this._closeOnClickOutside = null;
        }
        
        // Cancel all animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        if (this._translateFrameId) {
            cancelAnimationFrame(this._translateFrameId);
            this._translateFrameId = null;
        }
        
        if (this._scaleFrameId) {
            cancelAnimationFrame(this._scaleFrameId);
            this._scaleFrameId = null;
        }
        
        if (this._rotateFrameId) {
            cancelAnimationFrame(this._rotateFrameId);
            this._rotateFrameId = null;
        }
        
        if (this._returnFrameId) {
            cancelAnimationFrame(this._returnFrameId);
            this._returnFrameId = null;
        }
        
        // Clear all timeouts
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
        
        // Remove all custom styles
        ['galaxy-cleanup-style', 'global-cleanup-style', 'galaxy-animation-style', 'overlay-interaction-fix'].forEach(id => {
            const element = document.getElementById(id);
            if (element && document.head.contains(element)) {
                document.head.removeChild(element);
            }
        });
        
        // Clear references
        this.springs = null;
        this.originalPosition = null;
    }
}

// Card Factory for creating holographic cards
class CardFactory {
    static createCard(servantData, effectType = 'standard') {
        const card = document.createElement('div');
        card.className = `card effect-${effectType}`;
        card.dataset.id = servantData.id;
        
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-face">
                    <img class="card-image" src="${servantData.imageURL}" alt="${servantData.name}">
                    <div class="holo-overlay"></div>
                    <div class="holo-sparkle"></div>
                    <div class="holo-reflection"></div>
                    <div class="holo-diffraction"></div>
                    <div class="holo-glow"></div>
                    <div class="card-info">
                        <div class="card-name">${servantData.name}</div>
                        <div class="card-rarity">${'★'.repeat(servantData.rarity)}</div>
                    </div>
                </div>
            </div>
        `;
        
        const effect = new HolographicEffect(card, effectType);
        
        card.holoEffect = effect;
        
        return card;
    }
}