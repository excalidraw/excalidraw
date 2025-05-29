const API_KEY = "AIzaSyAl8YsDNG7AmBzOAgG4YwnQhNJMIjnRL2g"; // Replace with your Google API key
const SEARCH_ENGINE_ID = "8774c779014954b77"; // Replace with your Search Engine ID
const DEFAULT_SEARCH_QUERY = "breakcore art";
const NUM_RESULTS = 10; // Maximum allowed by free tier


/**
 * Fetch images from Google Custom Search API
 * @returns {Promise} Promise resolving to image results
 */
export async function fetchSasukeImages(SEARCH_QUERY = DEFAULT_SEARCH_QUERY, SITE_RESTRICT = false) {
  const baseUrl = "https://www.googleapis.com/customsearch/v1";
  
  
  const paramObj = {
    key: API_KEY,
    cx: SEARCH_ENGINE_ID,
    q: SEARCH_QUERY,
    searchType: "image",
    num: NUM_RESULTS
  };

  // Add site restriction if enabled
  if (SITE_RESTRICT) {
    paramObj.siteSearch = "pinterest.com"; // Add to the regular object
    console.log("🔍 PINTEREST SEARCH ENABLED - siteSearch:", paramObj.siteSearch);
  } else {
    console.log("🌐 GENERAL SEARCH - no site restriction");
  }
  
  console.log("🏗️ Param Object:", paramObj); // Debug: check the object before URLSearchParams
  
  const params = new URLSearchParams(paramObj);
  const url = `${baseUrl}?${params.toString()}`;
  
  console.log("Final URL:", url); // This should now show siteSearch parameter
    
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
        
    const data = await response.json();
    console.log("📊 API Response:", data);
    return processImageResults(data);
  } catch (error) {
    console.error("Error fetching images:", error);
    throw error;
  }
}

/**
 * Process the API response to extract image information
 * @param {Object} data - API response data
 * @returns {Array} Array of processed image objects
 */
export function processImageResults(data) {
  if (!data.items || data.items.length === 0) {
    console.warn("No image results found");
    return [];
  }
  
  return data.items.map(item => ({
    title: item.title,
    link: item.link,
    thumbnail: item.image.thumbnailLink,
    context: item.image.contextLink,
    width: item.image.width,
    height: item.image.height
  }));
}

/**
 * Main function to search for images
 * Browser-compatible version (no file system operations)
 */
export async function searchAndSaveImages(searchQuery = DEFAULT_SEARCH_QUERY, siteRestrict = false) {
  try {
    console.log(`Searching for "${searchQuery}" images...`);
    const images = await fetchSasukeImages(searchQuery, siteRestrict);
    console.log(`Found ${images.length} images`);
    return images;
  } catch (error) {
    console.error("Search operation failed:", error);
    throw error;
  }
}