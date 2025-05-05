require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchCourses() {
  try {
    const params = { 'featured-only': 0 };
    if (process.env.CMP_API_KEY) {
      params.hapikey = process.env.CMP_API_KEY;
    }
    console.log('Fetching courses for static JSON...');
    const response = await axios.get(
      'https://d2uj9jw4vo3cg6.cloudfront.net/V1/storeview/default/search/products',
      { params }
    );
    const data = response.data;
    const filePath = path.resolve(__dirname, '..', 'public', 'courses.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Wrote ${Array.isArray(data.items) ? data.items.length : 0} courses to public/courses.json`);
  } catch (error) {
    console.error('Error fetching courses for static JSON:', error.message);
    process.exit(1);
  }
}

fetchCourses(); 