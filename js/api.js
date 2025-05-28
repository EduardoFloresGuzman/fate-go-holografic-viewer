/**
 * API module for Fate/GO data
 * Uses the Atlas Academy API patterns
 */

const fateAPI = (() => {
  // Base URLs for Atlas Academy API
  const BASE_API_URL = "https://api.atlasacademy.io/";
  const BASE_ASSET_URL = "https://static.atlasacademy.io/";
  const REGION = "NA"; // North America region

  // Get image URL for a Servant
  const getServantURLImg = (servantId, suffix = "a", version = 1) => {
    return `${BASE_ASSET_URL}${REGION}/CharaGraph/${servantId}/${servantId}${suffix}@${version}.png`;
  };

  // Fetch Servant data from Atlas Academy API
  const fetchServantData = async (servantId) => {
    try {
      // The format for Servant endpoint is /nice/{region}/servant/{id}
      // Adding required query parameters: lore=true&lang=en
      const response = await fetch(
        `${BASE_API_URL}nice/${REGION}/servant/${servantId}?lore=true&lang=en`
      );

      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch Servant data for ID ${servantId}:`, error);
      return null;
    }
  };

  // Get Servants from the API only
  const getServant = async () => {
    // Servant IDs we want to display
    const servantIds = [86]; // Example IDs
    const servants = [];

    // Try to fetch each Servant from the API
    for (const servantId of servantIds) {
      try {
        const servantData = await fetchServantData(servantId);
        console.log(servantData); // Debugging line to check the fetched data
        console.log(servantData.id); // Debugging line to check the Servant ID
        
        // Only add Servants that were successfully fetched from the API
        if (servantData) {
          servants.push({
            id: servantData.id,
            name: servantData.name,
            rarity: servantData.rarity,
            imageURL: getServantURLImg(servantData.id, "b", version = 2),
            effect:
              servantData.skills && servantData.skills[0]
                ? servantData.skills[0].detail
                : "No effect data",
          });
        }
      } catch (error) {
        console.error(`Error processing Servant ${servantId}:`, error);
        // No fallback - if API fails, don't show the Servant
      }
    }

    return servants;
  };

  // Search for Servants by name (for future use)
  const searchServants = async (searchQuery, limit = 10) => {
    try {
      const response = await fetch(
        `${BASE_API_URL}nice/${REGION}/servant/search?name=${encodeURIComponent(
          searchQuery
        )}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`API returned status: ${response.status}`);
      }

      const results = await response.json();
      return results.map((servant) => ({
        id: servant.id,
        name: servant.name,
        rarity: servant.rarity,
        imageURL: getServantURLImg(servant.id),
      }));
    } catch (error) {
      console.error("Error searching Servants:", error);
      return [];
    }
  };

  // Return public methods
  return {
    getServant,
    fetchServantData,
    getServantURLImg,
    searchServants,
  };
})();
