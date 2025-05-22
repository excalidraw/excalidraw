// googleImgSearch.js - Script to search for Sasuke Uchiha images

// Configuration - REPLACE THESE WITH YOUR ACTUAL CREDENTIALS
const API_KEY = "AIzaSyAl8YsDNG7AmBzOAgG4YwnQhNJMIjnRL2g"; // Replace with your Google API key
const SEARCH_ENGINE_ID = "8774c779014954b77"; // Replace with your Search Engine ID
const SEARCH_QUERY = "breakcore art";
const NUM_RESULTS = 10; // Maximum allowed by free tier
const path = require('path');

/**
 * Fetch images from Google Custom Search API
 * @returns {Promise} Promise resolving to image results
 */
async function fetchSasukeImages() {
  const baseUrl = "https://www.googleapis.com/customsearch/v1";
  const params = new URLSearchParams({
    key: API_KEY,
    cx: SEARCH_ENGINE_ID,
    q: SEARCH_QUERY,
    searchType: "image",
    num: NUM_RESULTS
  });

  const url = `${baseUrl}?${params.toString()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }
    
    const data = await response.json();
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
function processImageResults(data) {
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
 * Main function to search and save images
 */
async function searchAndSaveImages() {
  try {
    console.log(`Searching for "${SEARCH_QUERY}" images...`);
    const images = await fetchSasukeImages();
    console.log(`Found ${images.length} images`);
    
    // Save the results to a file
    const fs = require('fs');
    const outputDir = '/Users/CEC/Documents/RabbitHole/excalidraw/scripts';
    fs.writeFileSync(
      path.join(outputDir, 'breakcore_images.json'), 
      JSON.stringify(images, null, 2),
      'utf8'
    );
    
    // Also create a file with just the image URLs for easy access
    const imageUrls = images.map(img => img.link);
    fs.writeFileSync(
      path.join(outputDir,'breakcore_image_urls.json'),
      JSON.stringify(imageUrls, null, 2),
      'utf8'
    );
    
    console.log("Results saved to breakcore.json and breakcore_image_urls.json");
    return images;
  } catch (error) {
    console.error("Search and save operation failed:", error);
  }
}


if (require.main === module) {
  searchAndSaveImages();
}


module.exports = {
  fetchSasukeImages,
  processImageResults,
  searchAndSaveImages
};