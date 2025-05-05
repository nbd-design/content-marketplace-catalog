import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Mock data for testing
const mockCourses = [
  {
    id: 1,
    title: "Introduction to Web Development",
    description: "Learn the basics of web development including HTML, CSS, and JavaScript.",
    instructor: "John Doe",
    price: 49.99,
    level: "Beginner",
    category: "Web Development"
  },
  {
    id: 2,
    title: "Advanced React Patterns",
    description: "Master advanced React patterns and best practices for building scalable applications.",
    instructor: "Jane Smith",
    price: 79.99,
    level: "Advanced",
    category: "Frontend Development"
  },
  {
    id: 3,
    title: "Node.js Backend Development",
    description: "Build robust backend services using Node.js and Express.",
    instructor: "Mike Johnson",
    price: 69.99,
    level: "Intermediate",
    category: "Backend Development"
  }
];

function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    sponsors: [],
    fieldsOfStudy: [],
    programQualifications: []
  });
  const coursesPerPage = 18;

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Loading courses from static JSON...');
        // Use the correct path for GitHub Pages
        const baseUrl = window.location.href.includes('github.io') 
          ? 'https://nbd-design.github.io/content-marketplace-catalog'
          : '';
        const url = `${baseUrl}/courses.json`;
        console.log('Fetching courses from:', url);
        const response = await axios.get(url);
        console.log('Raw API response:', response.data);
        
        // Extract filters
        const sponsorFilter = response.data.filters?.find(f => f.attribute_code === 'lcv_sponsor');
        const fieldsOfStudyFilter = response.data.filters?.find(f => f.attribute_code === 'lcv_fields_of_study');
        const programQualFilter = response.data.filters?.find(f => f.attribute_code === 'lcv_program_qualifications');
        
        setFilters({
          sponsors: sponsorFilter?.items || [],
          fieldsOfStudy: fieldsOfStudyFilter?.items || [],
          programQualifications: programQualFilter?.items || []
        });

        // Get all courses from the static JSON file
        const allCourses = response.data.items || [];
        console.log(`Loaded ${allCourses.length} total courses from static JSON`);
        console.log('First course sample:', allCourses[0]);
        
        // Map raw items to our UI's Course shape
        const mappedCourses = allCourses.map(item => {
          const attributes = item.attributes || [];
          
          // Find all relevant attributes
          const categoryAttr = attributes.find(attr => attr.code === 'lcv_fields_of_study_value');
          const levelAttr = attributes.find(attr => attr.code === 'lcv_level');
          const deliveryMethodAttr = attributes.find(attr => attr.code === 'lcv_delivery_method');
          const lengthAttr = attributes.find(attr => attr.code === 'lcv_length');
          const creditsAttr = attributes.find(attr => attr.code === 'lcv_total_credits');
          
          const courseData = {
            id: item.id,
            title: item.name,
            description: item.short_description
              ? item.short_description.replace(/<[^>]+>/g, ' ')
              : '',
            instructor: item.vendor?.name || 'Unknown Provider',
            category: categoryAttr?.option_value || '',
            level: levelAttr?.option_value || '',
            price: item.prices_unformatted?.price || 0,
            imageUrl: item.image_url || 'https://via.placeholder.com/400x300?text=No+Image+Available',
            // Additional course details
            deliveryMethod: deliveryMethodAttr?.option_value || '',
            length: lengthAttr?.option_value || '',
            credits: creditsAttr?.option_value || '',
            sku: item.sku,
            urlKey: item.url_key,
            productType: item.product_type,
            vendor: {
              id: item.vendor?.id,
              name: item.vendor?.name,
              logo: item.vendor?.logo_src,
              link: item.vendor?.link
            }
          };

          return courseData;
        });

        console.log('Mapped courses:', mappedCourses.length);
        console.log('First mapped course sample:', mappedCourses[0]);
        setCourses(mappedCourses);
      } catch (error) {
        console.error('Error loading courses from static JSON:', error);
        console.error('Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        setError('Unable to load course data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Log courses state changes
  useEffect(() => {
    console.log('Courses state updated:', courses);
  }, [courses]);

  const filteredCourses = searchTerm.trim()
    ? courses.filter(course => {
        if (!course) return false;
        const lower = searchTerm.toLowerCase();
        const titleMatch = course.title
          ? course.title.toLowerCase().includes(lower)
          : false;
        const descriptionMatch = course.description
          ? course.description.toLowerCase().includes(lower)
          : false;
        return titleMatch || descriptionMatch;
      })
    : courses;

  // Calculate pagination
  const indexOfLastCourse = currentPage * coursesPerPage;
  const indexOfFirstCourse = indexOfLastCourse - coursesPerPage;
  const currentCourses = filteredCourses.slice(indexOfFirstCourse, indexOfLastCourse);
  const totalPages = Math.ceil(filteredCourses.length / coursesPerPage);

  // Log filtered and paginated results
  useEffect(() => {
    console.log('Filtered courses:', filteredCourses);
    console.log('Current page courses:', currentCourses);
    console.log('Pagination info:', {
      currentPage,
      totalPages,
      indexOfFirstCourse,
      indexOfLastCourse,
      totalCourses: filteredCourses.length
    });
  }, [filteredCourses, currentCourses, currentPage, totalPages, indexOfFirstCourse, indexOfLastCourse]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const viewCourseDetails = (course) => {
    setSelectedCourse(course);
  };

  const closeDetails = () => {
    setSelectedCourse(null);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo(0, 0); // Scroll to top when changing pages
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex justify-center items-center space-x-2 mt-8">
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          «
        </button>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          ‹
        </button>
        
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-3 py-1 border rounded-lg hover:bg-gray-100"
            >
              1
            </button>
            {startPage > 2 && <span className="px-2">...</span>}
          </>
        )}

        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => handlePageChange(number)}
            className={`px-3 py-1 border rounded-lg ${
              currentPage === number
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {number}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-2">...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-3 py-1 border rounded-lg hover:bg-gray-100"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          ›
        </button>
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          »
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="bg-white shadow-xl/50 p-4 mb-8 rounded-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-900">Content Marketplace Catalog</h1>
          <div className="w-1/3">
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-12">
            <div className="spinner"></div>
            <p className="mt-2 text-gray-600">Loading courses...</p>
          </div>
        ) : selectedCourse ? (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <button
                onClick={closeDetails}
                className="mb-4 bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
              >
                ← Back to Catalog
              </button>
              <h2 className="text-2xl font-bold mb-2">{selectedCourse.title}</h2>
              {selectedCourse.instructor && (
                <p className="text-gray-600 mb-4">Instructor: {selectedCourse.instructor}</p>
              )}
              {selectedCourse.category && (
                <span className="inline-block bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded mr-2">
                  {selectedCourse.category}
                </span>
              )}
              {selectedCourse.level && (
                <span className="inline-block bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
                  {selectedCourse.level}
                </span>
              )}
              <p className="my-4">{selectedCourse.description}</p>
              <div className="flex justify-between mt-6 pt-4 border-t">
                <div>
                  {selectedCourse.price ? (
                    <p className="text-xl font-bold text-green-600">${selectedCourse.price.toFixed(2)}</p>
                  ) : (
                    <p className="text-xl font-bold text-green-600">Free</p>
                  )}
                </div>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  Enroll Now
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Available Courses</h2>
              <p className="text-gray-600">
                Showing {indexOfFirstCourse + 1}-{Math.min(indexOfLastCourse, filteredCourses.length)} of {filteredCourses.length} courses
              </p>
            </div>
            {filteredCourses.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-12 text-center">
                <p className="text-gray-600">No courses found. Try adjusting your search.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {currentCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => viewCourseDetails(course)}
                    >
                      <div className="h-48 relative overflow-hidden">
                        <img 
                          src={course.imageUrl}
                          alt={course.title}
                          className="w-full h-full object-cover transition-opacity duration-300"
                          onError={(e) => {
                            console.log(`Image error for course ${course.id}:`, course.imageUrl);
                            e.target.onerror = null; // Prevent infinite loop
                            e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                          }}
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-lg mb-1 text-gray-900">{course.title}</h3>
                        {course.instructor && (
                          <p className="text-sm text-gray-600 mb-2">By {course.instructor}</p>
                        )}
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {course.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {course.category && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {course.category}
                            </span>
                          )}
                          {course.level && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              {course.level}
                            </span>
                          )}
                          {course.deliveryMethod && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {course.deliveryMethod}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          {course.price ? (
                            <p className="font-bold text-green-600">${course.price.toFixed(2)}</p>
                          ) : (
                            <p className="font-bold text-green-600">Free</p>
                          )}
                          {course.length && (
                            <span className="text-sm text-gray-600">
                              {course.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {renderPagination()}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App; 