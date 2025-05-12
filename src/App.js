import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    fieldsOfStudy: [],
    programQualifications: [],
    sponsors: [],
    jurisdictions: [],
    price: null,
    credits: null
  });

  const [availableFilters, setAvailableFilters] = useState({
    fieldsOfStudy: [],
    programQualifications: [],
    sponsors: [],
    jurisdictions: [],
    price: { max: 279 },
    credits: { max: 0 }
  });

  const [expandedFilters, setExpandedFilters] = useState({
    fieldsOfStudy: false,
    programQualifications: false,
    sponsors: false,
    jurisdictions: false,
    price: false,
    credits: false
  });

  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // List of US states and territories
  const US_STATES = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming', 'District of Columbia', 'Puerto Rico', 'Guam', 'American Samoa',
    'U.S. Virgin Islands', 'Northern Mariana Islands'
  ];

  const coursesPerPage = 18;

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Loading courses from static JSON...');
        const baseUrl = window.location.href.includes('github.io') 
          ? 'https://nbd-design.github.io/content-marketplace-catalog'
          : '';
        const url = `${baseUrl}/courses.json`;
        console.log('Fetching courses from:', url);
        const response = await axios.get(url);
        console.log('Raw API response:', response.data);
        
        // Extract filters
        const fieldsOfStudyFilter = response.data.filters?.find(f => f.attribute_code === 'lcv_fields_of_study');
        const programQualFilter = response.data.filters?.find(f => f.attribute_code === 'lcv_program_qualifications');
        const priceFilter = response.data.filters?.find(f => f.attribute_code === 'price');
        
        // Get unique vendors from courses
        const vendors = Array.from(new Set(response.data.items
          .filter(item => item.vendor?.name)
          .map(item => item.vendor.name)))
          .map(name => ({
            id: response.data.items.find(item => item.vendor?.name === name)?.vendor?.id,
            value: name,
            count: response.data.items.filter(course => course.vendor?.name === name).length
          }))
          .sort((a, b) => b.count - a.count); // Sort by count descending
        
        // Extract jurisdictions from course data
        const jurisdictions = US_STATES.map(state => {
          const count = response.data.items.filter(item => {
            const searchText = [
              item.name,
              item.short_description,
              ...(item.attributes || []).map(attr => attr.option_value || '')
            ].join(' ').toLowerCase();
            return searchText.includes(state.toLowerCase());
          }).length;
          return {
            id: state,
            value: state,
            count
          };
        }).filter(j => j.count > 0)
          .sort((a, b) => b.count - a.count);

        // Calculate max credits
        const maxCredits = Math.ceil(Math.max(...response.data.items
          .map(item => {
            const creditsAttr = item.attributes?.find(attr => attr.code === 'lcv_total_credits');
            return creditsAttr?.option_value ? parseFloat(creditsAttr.option_value) / 50 : 0;
          })
          .filter(credits => !isNaN(credits))));

        setAvailableFilters(prev => ({
          ...prev,
          fieldsOfStudy: fieldsOfStudyFilter?.items || [],
          programQualifications: programQualFilter?.items || [],
          sponsors: vendors,
          price: priceFilter?.items || { max: 279 },
          jurisdictions,
          credits: { max: maxCredits }
        }));

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
          const programQualsAttr = attributes.find(attr => attr.code === 'lcv_program_qualifications_value');
          
          // Format CPE credits
          let formattedCredits = '';
          if (creditsAttr?.option_value) {
            const rawCredits = parseFloat(creditsAttr.option_value);
            if (!isNaN(rawCredits)) {
              const calculatedCredits = rawCredits / 50;
              formattedCredits = calculatedCredits.toFixed(3).replace(/\.?0+$/, '');
              if (formattedCredits.endsWith('.')) {
                formattedCredits = formattedCredits.slice(0, -1);
              }
            }
          }
          
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
            deliveryMethod: deliveryMethodAttr?.option_value || '',
            length: lengthAttr?.option_value || '',
            credits: formattedCredits,
            rawCredits: creditsAttr?.option_value || '',
            sku: item.sku,
            urlKey: item.url_key,
            productType: item.product_type,
            vendor: {
              id: item.vendor?.id,
              name: item.vendor?.name,
              logo: item.vendor?.logo_src,
              link: item.vendor?.link
            },
            programQualifications: programQualsAttr?.option_value ? [programQualsAttr.option_value] : []
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

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const toggleFilterSection = (section) => {
    setExpandedFilters(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleCheckboxChange = (filterType, value) => {
    setFilters(prev => {
      const currentValues = prev[filterType] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return {
        ...prev,
        [filterType]: newValues
      };
    });
    setCurrentPage(1);
  };

  const filteredCourses = courses.filter(course => {
    // Search term filter
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      const titleMatch = course.title?.toLowerCase().includes(lower) || false;
      const descriptionMatch = course.description?.toLowerCase().includes(lower) || false;
      if (!titleMatch && !descriptionMatch) return false;
    }

    // Fields of Study filter
    if (filters.fieldsOfStudy.length > 0) {
      if (!course.category || !filters.fieldsOfStudy.includes(course.category)) {
        return false;
      }
    }

    // Program Qualifications filter
    if (filters.programQualifications.length > 0) {
      const courseQualifications = course.programQualifications || [];
      if (!filters.programQualifications.some(q => courseQualifications.includes(q))) {
        return false;
      }
    }

    // Sponsor filter
    if (filters.sponsors.length > 0) {
      if (!course.vendor?.name || !filters.sponsors.includes(course.vendor.name)) {
        return false;
      }
    }

    // Price filter
    if (filters.price !== null && filters.price > 0) {
      if (!course.price || course.price > filters.price) {
        return false;
      }
    }

    // Jurisdiction filter
    if (filters.jurisdictions.length > 0) {
      const courseText = [
        course.title,
        course.description,
        course.category,
        course.level,
        course.deliveryMethod,
        ...course.programQualifications
      ].join(' ').toLowerCase();

      if (!filters.jurisdictions.some(state => 
        courseText.includes(state.toLowerCase())
      )) {
        return false;
      }
    }

    // Credits filter
    if (filters.credits !== null && filters.credits > 0) {
      const courseCredits = course.rawCredits ? Math.ceil(parseFloat(course.rawCredits) / 50) : 0;
      if (courseCredits < filters.credits) {
        return false;
      }
    }

    return true;
  });

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
              <h2 className="text-2xl font-bold mb-2">{selectedCourse.title}</h2>
              {selectedCourse.instructor && (
                <p className="text-gray-600 mb-4">Provider: {selectedCourse.instructor}</p>
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
              {selectedCourse.credits && (
                <span className="inline-block bg-amber-100 text-amber-800 text-sm px-2 py-1 rounded ml-2">
                  {selectedCourse.credits} CPE Credits
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
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-400">Not an LCvista user, get in touch with our team to get started.</p>
                  <button
                    onClick={() => window.open('https://www.lcvista.com/contact', '_blank')}
                    className="bg-[#344C4D] hover:bg-[#233333] text-[#C4E51A] px-6 py-2 rounded-full"
                  >
                    Get Started
                  </button>
                  <button
                onClick={closeDetails}
                className=" bg-gray-200 px-4 py-2 rounded-full hover:bg-gray-300"
              >
                Browse More Courses
              </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Mobile Filter Button */}
            <button
              onClick={() => setIsFilterMenuOpen(true)}
              className="lg:hidden fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-40 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filters</span>
            </button>

            {/* Mobile Filter Menu Backdrop */}
            {isFilterMenuOpen && (
              <div
                className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={() => setIsFilterMenuOpen(false)}
              />
            )}

            {/* Filter Sidebar - Desktop */}
            <div className="hidden lg:block w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow p-4 sticky top-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Filters</h3>
                  <button
                    onClick={() => setFilters({
                      fieldsOfStudy: [],
                      programQualifications: [],
                      sponsors: [],
                      jurisdictions: [],
                      price: null,
                      credits: null
                    })}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </button>
                </div>
                
                {/* Fields of Study Filter */}
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => toggleFilterSection('fieldsOfStudy')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Fields of Study</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.fieldsOfStudy ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.fieldsOfStudy && (
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {availableFilters.fieldsOfStudy.map((field) => (
                        <label key={field.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.fieldsOfStudy.includes(field.value)}
                            onChange={() => handleCheckboxChange('fieldsOfStudy', field.value)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{field.value}</span>
                          <span className="text-gray-500 text-xs">({field.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Program Qualifications Filter */}
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => toggleFilterSection('programQualifications')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Program Qualifications</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.programQualifications ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.programQualifications && (
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {availableFilters.programQualifications.map((qual) => (
                        <label key={qual.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.programQualifications.includes(qual.value)}
                            onChange={() => handleCheckboxChange('programQualifications', qual.value)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{qual.value}</span>
                          <span className="text-gray-500 text-xs">({qual.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sponsor Filter */}
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => toggleFilterSection('sponsors')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Sponsor</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.sponsors ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.sponsors && (
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {availableFilters.sponsors.map((sponsor) => (
                        <label key={sponsor.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.sponsors.includes(sponsor.value)}
                            onChange={() => handleCheckboxChange('sponsors', sponsor.value)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{sponsor.value}</span>
                          <span className="text-gray-500 text-xs">({sponsor.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Jurisdiction Filter */}
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => toggleFilterSection('jurisdictions')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Jurisdictions</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.jurisdictions ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.jurisdictions && (
                    <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                      {availableFilters.jurisdictions.map((jurisdiction) => (
                        <label key={jurisdiction.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filters.jurisdictions.includes(jurisdiction.value)}
                            onChange={() => handleCheckboxChange('jurisdictions', jurisdiction.value)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{jurisdiction.value}</span>
                          <span className="text-gray-500 text-xs">({jurisdiction.count})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Credits Filter */}
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <button
                    onClick={() => toggleFilterSection('credits')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Minimum Credits</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.credits ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.credits && (
                    <div className="mt-4">
                      <input
                        type="range"
                        min="0"
                        max={availableFilters.credits.max}
                        value={filters.credits || 0}
                        onChange={(e) => handleFilterChange('credits', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>0</span>
                        <span>{filters.credits || 0}</span>
                        <span>{availableFilters.credits.max}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-center">
                        CPE Credits
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Range Filter */}
                <div className="mb-4">
                  <button
                    onClick={() => toggleFilterSection('price')}
                    className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                  >
                    <span>Maximum Price</span>
                    <svg
                      className={`w-5 h-5 transform transition-transform ${expandedFilters.price ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFilters.price && (
                    <div className="mt-4">
                      <input
                        type="range"
                        min="0"
                        max={availableFilters.price.max}
                        value={filters.price || 0}
                        onChange={(e) => handleFilterChange('price', parseInt(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-gray-600 mt-2">
                        <span>$0</span>
                        <span>${filters.price || 0}</span>
                        <span>${availableFilters.price.max}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Sidebar - Mobile */}
            <div
              className={`lg:hidden fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
                isFilterMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="h-full flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Filters</h3>
                  <button
                    onClick={() => setIsFilterMenuOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Fields of Study Filter */}
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <button
                      onClick={() => toggleFilterSection('fieldsOfStudy')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Fields of Study</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.fieldsOfStudy ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.fieldsOfStudy && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {availableFilters.fieldsOfStudy.map((field) => (
                          <label key={field.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filters.fieldsOfStudy.includes(field.value)}
                              onChange={() => handleCheckboxChange('fieldsOfStudy', field.value)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{field.value}</span>
                            <span className="text-gray-500 text-xs">({field.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Program Qualifications Filter */}
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <button
                      onClick={() => toggleFilterSection('programQualifications')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Program Qualifications</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.programQualifications ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.programQualifications && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {availableFilters.programQualifications.map((qual) => (
                          <label key={qual.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filters.programQualifications.includes(qual.value)}
                              onChange={() => handleCheckboxChange('programQualifications', qual.value)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{qual.value}</span>
                            <span className="text-gray-500 text-xs">({qual.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sponsor Filter */}
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <button
                      onClick={() => toggleFilterSection('sponsors')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Sponsor</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.sponsors ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.sponsors && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {availableFilters.sponsors.map((sponsor) => (
                          <label key={sponsor.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filters.sponsors.includes(sponsor.value)}
                              onChange={() => handleCheckboxChange('sponsors', sponsor.value)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{sponsor.value}</span>
                            <span className="text-gray-500 text-xs">({sponsor.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Jurisdiction Filter */}
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <button
                      onClick={() => toggleFilterSection('jurisdictions')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Jurisdictions</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.jurisdictions ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.jurisdictions && (
                      <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                        {availableFilters.jurisdictions.map((jurisdiction) => (
                          <label key={jurisdiction.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filters.jurisdictions.includes(jurisdiction.value)}
                              onChange={() => handleCheckboxChange('jurisdictions', jurisdiction.value)}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-700">{jurisdiction.value}</span>
                            <span className="text-gray-500 text-xs">({jurisdiction.count})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Credits Filter */}
                  <div className="mb-4 border-b border-gray-200 pb-4">
                    <button
                      onClick={() => toggleFilterSection('credits')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Minimum Credits</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.credits ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.credits && (
                      <div className="mt-4">
                        <input
                          type="range"
                          min="0"
                          max={availableFilters.credits.max}
                          value={filters.credits || 0}
                          onChange={(e) => handleFilterChange('credits', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-600 mt-2">
                          <span>0</span>
                          <span>{filters.credits || 0}</span>
                          <span>{availableFilters.credits.max}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          CPE Credits
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Price Range Filter */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleFilterSection('price')}
                      className="w-full flex justify-between items-center text-left font-medium text-gray-700 hover:text-gray-900"
                    >
                      <span>Maximum Price</span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expandedFilters.price ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedFilters.price && (
                      <div className="mt-4">
                        <input
                          type="range"
                          min="0"
                          max={availableFilters.price.max}
                          value={filters.price || 0}
                          onChange={(e) => handleFilterChange('price', parseInt(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-600 mt-2">
                          <span>$0</span>
                          <span>${filters.price || 0}</span>
                          <span>${availableFilters.price.max}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 border-t">
                  <button
                    onClick={() => {
                      setFilters({
                        fieldsOfStudy: [],
                        programQualifications: [],
                        sponsors: [],
                        jurisdictions: [],
                        price: null,
                        credits: null
                      });
                      setIsFilterMenuOpen(false);
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Course Grid */}
            <div className="flex-1">
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
                            {course.credits && (
                              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium">
                                {course.credits} CPE
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center">
                              {course.price ? (
                                <p className="font-bold text-green-600">${course.price.toFixed(2)}</p>
                              ) : (
                                <p className="font-bold text-green-600">Free</p>
                              )}
                            </div>
                            <div className="flex items-center">
                              {course.length && (
                                <span className="text-sm text-gray-600">
                                  {course.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {renderPagination()}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 