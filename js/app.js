/**
 * Main application file for Fate/GO Holographic Servant Viewer
 */

document.addEventListener('DOMContentLoaded', async function() {
    // DOM elements
    const cardContainer = document.querySelector('.card-container');
    const effectSelector = document.getElementById('effect-select');
    const findServantBtn = document.getElementById('find-servant-btn');// Application state
    let servants = [];
    let currentEffect = 'masked-premium';
    let cardElements = [];
    
    // Initialize the application
    const init = async () => {
        try {
            // Load Servant data
            servants = await fateAPI.getServant();
            
            if (servants.length === 0) {
                showError('No Servants found');
                return;
            }
            
            // Get saved effect preference if it exists
            const savedEffect = localStorage.getItem('preferredEffect');
            if (savedEffect) {
                currentEffect = savedEffect;
                if (effectSelector) {
                    effectSelector.value = currentEffect;
                }
            }
            
            // Render all cards
            renderCards();
              // Add event listener to the effect selector
            if (effectSelector) {
                effectSelector.addEventListener('change', handleEffectChange);
            }
            
            // Add event listener to the find servant button
            if (findServantBtn) {
                findServantBtn.addEventListener('click', handleFindServant);
            }
            
        } catch (error) {
            console.error('Initialization error:', error);
            showError('Failed to initialize the app. Please try again.');
        }
    };
      // Render cards in the container
    const renderCards = async () => {
        // Clear the container and card elements array
        cardContainer.innerHTML = '';
        cardElements = [];
        
        // Show loading indicator
        cardContainer.innerHTML = '<div class="loading">Processing card images...</div>';
        
        // Create and append all cards
        for (const servant of servants) {
            const card = await CardFactory.createCard(servant, currentEffect);
            cardContainer.appendChild(card);
            cardElements.push(card);
        }
        
        // Remove loading indicator
        const loading = cardContainer.querySelector('.loading');
        if (loading) {
            loading.remove();
        }
    };
      // Handle effect type change from the selector
    const handleEffectChange = async (e) => {
        currentEffect = e.target.value;
        
        // Save preference for next time
        localStorage.setItem('preferredEffect', currentEffect);
        
        // For masked effects, we need to recreate cards due to image processing
        if (currentEffect.includes('masked') || cardElements.some(card => card.className.includes('masked'))) {
            await renderCards();
        } else {
            // Update all existing cards with the new effect
            cardElements.forEach(card => {
                if (card.holoEffect) {
                    card.holoEffect.setEffectType(currentEffect);
                }
            });
        }    };
    
    // Handle finding a random servant
    const handleFindServant = async () => {
        // Show loading indicator
        cardContainer.innerHTML = '<div class="loading">Finding your servant...</div>';
        
        try {
            const randomServant = await fateAPI.getRandomServant();
            
            if (randomServant) {
                // Replace current servants with the random one
                servants = [randomServant];
                await renderCards();
            } else {
                showError('Failed to find a servant. Please try again.');
            }
        } catch (error) {
            console.error('Error finding random servant:', error);
            showError('Failed to find a servant. Please try again.');
        }
    };
    
    // Show error message
    const showError = (message) => {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        cardContainer.innerHTML = '';
        cardContainer.appendChild(errorElement);
    };
    
    // Initialize the app
    init();
});