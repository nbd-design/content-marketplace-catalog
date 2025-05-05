require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchAllCourses() {
  try {
    console.log('Fetching all courses...');
    const params = { 'featured-only': 0 };
    if (process.env.CMP_API_KEY) {
      params.hapikey = process.env.CMP_API_KEY;
    }
    
    const response = await axios.get(
      'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
      { params }
    );
    const data = response.data;
    
    // Get total number of courses
    const totalCourses = data.total || 0;
    const pageSize = 100; // Increased page size to reduce number of requests
    const totalPages = Math.ceil(totalCourses / pageSize);
    
    console.log(`Found ${totalCourses} total courses. Fetching ${totalPages} pages...`);
    
    // Fetch all pages
    let allCourses = [];
    for (let page = 0; page < totalPages; page++) {
      console.log(`Fetching page ${page + 1}/${totalPages}...`);
      const pageParams = {
        ...params,
        page: page,
        page_size: pageSize
      };
      const pageResponse = await axios.get(
        'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
        { params: pageParams }
      );
      const pageData = pageResponse.data;
      const pageItems = pageData.items || [];
      allCourses = [...allCourses, ...pageItems];
      console.log(`Loaded ${pageItems.length} courses from page ${page + 1}. Total so far: ${allCourses.length}`);
    }

    // Create the complete data object
    const completeData = {
      ...data,
      items: allCourses,
      total: allCourses.length
    };

    // Save to public folder
    const publicPath = path.join(__dirname, '../public');
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }

    const filePath = path.join(publicPath, 'courses.json');
    fs.writeFileSync(filePath, JSON.stringify(completeData, null, 2));
    
    console.log(`Successfully saved ${allCourses.length} courses to ${filePath}`);
  } catch (error) {
    console.error('Error fetching courses:', error);
    process.exit(1);
  }
}

fetchAllCourses(); 