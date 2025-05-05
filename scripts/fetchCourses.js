require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchAllCourses() {
  try {
    console.log('Fetching all courses...');
    const params = { 
      'featured-only': 0,
      'page_size': 100
    };
    if (process.env.CMP_API_KEY) {
      params.hapikey = process.env.CMP_API_KEY;
    }
    
    // First, get the total count
    const initialResponse = await axios.get(
      'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
      { params: { ...params, page: 0 } }
    );
    
    const totalCourses = initialResponse.data.total || 0;
    console.log(`Total courses available: ${totalCourses}`);
    
    // Calculate total pages needed
    const pageSize = 100;
    const totalPages = Math.ceil(totalCourses / pageSize);
    console.log(`Will fetch ${totalPages} pages with ${pageSize} items per page`);
    
    // Fetch all pages
    let allCourses = [];
    let currentPage = 0;
    
    while (currentPage < totalPages) {
      try {
        console.log(`\nFetching page ${currentPage + 1}/${totalPages}...`);
        const pageParams = {
          ...params,
          page: currentPage
        };
        
        const pageResponse = await axios.get(
          'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
          { params: pageParams }
        );
        
        const pageData = pageResponse.data;
        const pageItems = pageData.items || [];
        
        console.log(`Page ${currentPage + 1} response:`, {
          total: pageData.total,
          page_size: pageData.page_size,
          items_received: pageItems.length,
          first_item_id: pageItems[0]?.id,
          last_item_id: pageItems[pageItems.length - 1]?.id
        });
        
        if (pageItems.length === 0) {
          console.log('No items received for this page, stopping pagination');
          break;
        }
        
        allCourses = [...allCourses, ...pageItems];
        console.log(`Total courses collected so far: ${allCourses.length}`);
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        currentPage++;
      } catch (error) {
        console.error(`Error fetching page ${currentPage + 1}:`, error.message);
        // If we get an error, wait longer and try again
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }
    }

    // Verify no duplicate IDs
    const courseIds = new Set(allCourses.map(course => course.id));
    console.log('\nVerification:');
    console.log(`Total unique course IDs: ${courseIds.size}`);
    console.log(`Total courses collected: ${allCourses.length}`);
    
    if (courseIds.size !== allCourses.length) {
      console.log('WARNING: Duplicate courses detected!');
      // Remove duplicates
      allCourses = Array.from(new Map(allCourses.map(course => [course.id, course])).values());
      console.log(`After removing duplicates: ${allCourses.length} courses`);
    }

    // Create the complete data object
    const completeData = {
      ...initialResponse.data,
      items: allCourses,
      total: allCourses.length,
      page_size: pageSize,
      current_page: 0
    };

    // Save to public folder
    const publicPath = path.join(__dirname, '../public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }

    const filePath = path.join(publicPath, 'courses.json');
    fs.writeFileSync(filePath, JSON.stringify(completeData, null, 2));
    
    console.log(`\nSuccessfully saved ${allCourses.length} courses to ${filePath}`);
    
    // Verify the saved file
    const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('Verification of saved file:', {
      total_courses: savedData.total,
      items_length: savedData.items.length,
      first_item_id: savedData.items[0]?.id,
      last_item_id: savedData.items[savedData.items.length - 1]?.id
    });
  } catch (error) {
    console.error('Error in fetchAllCourses:', error);
    process.exit(1);
  }
}

fetchAllCourses(); 