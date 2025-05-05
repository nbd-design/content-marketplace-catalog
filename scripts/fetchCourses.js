require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchAllCourses() {
  try {
    console.log('Fetching all courses...');
    
    // First, get the total count
    console.log('\nMaking initial API request...');
    const initialResponse = await axios.get(
      'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
      { 
        params: { 
          'featured-only': 0,
          'page_size': 20,
          'page': 1 // Start from page 1 since page 0 returns the same data
        }
      }
    );
    
    const totalCourses = initialResponse.data.total || 0;
    const pageSize = 20; // Use fixed page size
    console.log('\nAPI Response Details:', {
      total: initialResponse.data.total,
      items_received: initialResponse.data.items?.length,
      first_item: initialResponse.data.items?.[0] ? {
        id: initialResponse.data.items[0].id,
        sku: initialResponse.data.items[0].sku,
        name: initialResponse.data.items[0].name
      } : null,
      last_item: initialResponse.data.items?.[initialResponse.data.items.length - 1] ? {
        id: initialResponse.data.items[initialResponse.data.items.length - 1].id,
        sku: initialResponse.data.items[initialResponse.data.items.length - 1].sku,
        name: initialResponse.data.items[initialResponse.data.items.length - 1].name
      } : null
    });

    // Calculate total pages needed
    const totalPages = Math.ceil(totalCourses / pageSize);
    console.log(`\nPagination Details:`);
    console.log(`Total courses reported by API: ${totalCourses}`);
    console.log(`Page size: ${pageSize}`);
    console.log(`Calculated total pages: ${totalPages}`);

    // Start with the items from the initial response
    let allCourses = initialResponse.data.items || [];
    console.log(`\nStarting with ${allCourses.length} courses from initial response`);
    
    // Track pages we've requested
    let requestedPages = new Set([1]); // Mark page 1 as already requested
    let failedPages = new Set();
    const MAX_RETRIES = 3;
    
    // Fetch remaining pages, starting from page 2 since we already have page 1
    let currentPage = 2;
    
    while (currentPage <= totalPages) {
      let retryCount = 0;
      let success = false;
      
      // Check if we've already requested this page
      if (requestedPages.has(currentPage)) {
        console.error(`ERROR: Page ${currentPage} was already requested! Skipping...`);
        currentPage++;
        continue;
      }
      
      while (retryCount < MAX_RETRIES && !success) {
        try {
          console.log(`\nFetching page ${currentPage}/${totalPages} (Attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          const pageParams = {
            'featured-only': 0,
            'page_size': pageSize,
            'page': currentPage
          };
          
          console.log('Request params:', pageParams);
          requestedPages.add(currentPage); // Mark this page as requested
          
          const pageResponse = await axios.get(
            'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
            { params: pageParams }
          );
          
          const pageData = pageResponse.data;
          const pageItems = pageData.items || [];
          
          // Log page details
          console.log(`\nPage ${currentPage} Details:`, {
            requested_page: currentPage,
            received_page: pageData.current_page,
            items_received: pageItems.length,
            total_so_far: allCourses.length,
            expected_total: totalCourses,
            first_item: pageItems[0] ? {
              id: pageItems[0].id,
              sku: pageItems[0].sku,
              name: pageItems[0].name
            } : null,
            last_item: pageItems[pageItems.length - 1] ? {
              id: pageItems[pageItems.length - 1].id,
              sku: pageItems[pageItems.length - 1].sku,
              name: pageItems[pageItems.length - 1].name
            } : null
          });
          
          if (pageItems.length === 0) {
            console.log('No items received for this page, will retry...');
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 5000 * (retryCount + 1)));
            continue;
          }
          
          // Check for duplicate items in this page
          const pageSkus = new Set(pageItems.map(item => item.sku));
          if (pageSkus.size !== pageItems.length) {
            console.warn(`WARNING: Page ${currentPage} contains duplicate SKUs!`);
            console.warn(`Items in page: ${pageItems.length}, Unique SKUs: ${pageSkus.size}`);
          }
          
          // Check for duplicates with existing items
          const existingSkus = new Set(allCourses.map(course => course.sku));
          const duplicatesInPage = pageItems.filter(item => existingSkus.has(item.sku));
          if (duplicatesInPage.length > 0) {
            console.warn(`WARNING: Page ${currentPage} contains ${duplicatesInPage.length} items that already exist in our collection!`);
            console.warn('Duplicate SKUs:', duplicatesInPage.map(item => item.sku));
          }
          
          allCourses = [...allCourses, ...pageItems];
          console.log(`Total courses collected so far: ${allCourses.length}`);
          success = true;
          
          // Add a small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error fetching page ${currentPage} (Attempt ${retryCount + 1}/${MAX_RETRIES}):`, error.message);
          if (error.response) {
            console.error('Error response:', {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            });
          }
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            console.log(`Waiting ${5 * retryCount} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 5000 * retryCount));
          } else {
            failedPages.add(currentPage);
          }
        }
      }
      
      if (!success) {
        console.error(`Failed to fetch page ${currentPage} after ${MAX_RETRIES} attempts`);
      }
      
      currentPage++;
    }
    
    if (failedPages.size > 0) {
      console.error('\nFailed to fetch the following pages:', Array.from(failedPages));
    }
    
    console.log('\nFinal Results:');
    console.log(`Total courses collected: ${allCourses.length}`);
    console.log(`Expected courses: ${totalCourses}`);
    console.log(`Difference: ${allCourses.length - totalCourses}`);
    
    // Save all courses to public/courses.json with the correct structure
    const outputData = {
      items: allCourses,
      filters: initialResponse.data.filters || [],
      total: totalCourses
    };
    
    const outputPath = path.join(process.cwd(), 'public', 'courses.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\nSaved ${allCourses.length} courses to ${outputPath}`);
    
  } catch (error) {
    console.error('Error fetching courses:', error);
    process.exit(1);
  }
}

fetchAllCourses(); 