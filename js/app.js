/**
 * Main application file for Fate/GO Holographic Servant Viewer
 */

document.addEventListener('DOMContentLoaded', async function() {
    // DOM elements
    const cardContainer = document.querySelector('.card-container');
    const effectSelector = document.getElementById('effect-select');
    
    // Application state
    let servants = [];
    let currentEffect = 'standard';
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
            
        } catch (error) {
            console.error('Initialization error:', error);
            showError('Failed to initialize the app. Please try again.');
        }
    };
    
    // Render cards in the container
    const renderCards = () => {
        // Clear the container and card elements array
        cardContainer.innerHTML = '';
        cardElements = [];
        
        // Create and append all cards
        servants.forEach(servant => {
            const card = CardFactory.createCard(servant, currentEffect);
            cardContainer.appendChild(card);
            cardElements.push(card);
        });
    };
    
    // Handle effect type change from the selector
    const handleEffectChange = (e) => {
        currentEffect = e.target.value;
        
        // Save preference for next time
        localStorage.setItem('preferredEffect', currentEffect);
        
        // Update all existing cards with the new effect
        cardElements.forEach(card => {
            if (card.holoEffect) {
                card.holoEffect.setEffectType(currentEffect);
            }
        });
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