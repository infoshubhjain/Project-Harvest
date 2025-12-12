import { useState, useEffect } from 'react'

const API_BASE = 'https://infoshubhjain.github.io/Project-Harvest/api'

// Real UIUC dining hall images
const DINING_HALL_IMAGES = {
  'ISR': 'https://housing.illinois.edu/~/media/Images/Housing/Dining/DiningHalls/ISR/ISR-Dining-03.ashx',
  'Ikenberry Dining Center': 'https://housing.illinois.edu/~/media/Images/Housing/Dining/DiningHalls/Ikenberry/Ikenberry-Dining-01.ashx',
  'LAR': 'https://housing.illinois.edu/~/media/Images/Housing/Dining/DiningHalls/LAR/LAR-Dining-02.ashx',
  'PAR': 'https://housing.illinois.edu/~/media/Images/Housing/Dining/DiningHalls/PAR/PAR-Dining-01.ashx'
}

const DINING_HALL_INFO = {
  'ISR': 'Illinois Street Residence Hall - Main dining room with diverse menu options',
  'Ikenberry Dining Center': 'Largest dining hall on campus with multiple stations',
  'LAR': 'Lincoln Avenue Residence - Comfortable atmosphere with quality meals',
  'PAR': 'Pennsylvania Avenue Residence - Fresh ingredients and healthy choices'
}

function App() {
  const [diningHalls, setDiningHalls] = useState([])
  const [selectedHall, setSelectedHall] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [selectedMealType, setSelectedMealType] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDiningHalls()
  }, [])

  useEffect(() => {
    if (selectedHall) {
      loadMenu(selectedHall)
    }
  }, [selectedHall])

  useEffect(() => {
    if (selectedMealType === 'All') {
      setFilteredItems(menuItems)
    } else {
      setFilteredItems(menuItems.filter(item => item.meal_type === selectedMealType))
    }
  }, [selectedMealType, menuItems])

  async function loadDiningHalls() {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/dining-halls.json`)
      if (!response.ok) throw new Error('Failed to load dining halls')
      const data = await response.json()
      setDiningHalls(data.dining_halls || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMenu(hallName) {
    try {
      setLoading(true)
      const filename = hallName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
      const response = await fetch(`${API_BASE}/${filename}.json`)
      if (!response.ok) throw new Error(`Failed to load menu for ${hallName}`)
      const data = await response.json()
      setMenuItems(data.foods || [])
      setFilteredItems(data.foods || [])
      setSelectedMealType('All')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getMealTypes() {
    const types = [...new Set(menuItems.map(item => item.meal_type))]
    return ['All', ...types.sort()]
  }

  if (loading && diningHalls.length === 0) {
    return (
      <div>
        <div className="header">
          <div className="header-content">
            <div className="logo">🌾</div>
            <div>
              <h1>Project Harvest</h1>
              <p>University of Illinois Dining Nutrition Tracker</p>
            </div>
          </div>
        </div>
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading dining halls...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && diningHalls.length === 0) {
    return (
      <div>
        <div className="header">
          <div className="header-content">
            <div className="logo">🌾</div>
            <div>
              <h1>Project Harvest</h1>
              <p>University of Illinois Dining Nutrition Tracker</p>
            </div>
          </div>
        </div>
        <div className="container">
          <div className="error">
            <h2>⚠️ Error Loading Data</h2>
            <p>{error}</p>
            <button className="retry-button" onClick={loadDiningHalls}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (selectedHall) {
    return (
      <div>
        <div className="header">
          <div className="header-content">
            <div className="logo">🌾</div>
            <div>
              <h1>Project Harvest</h1>
              <p>{selectedHall}</p>
            </div>
          </div>
        </div>
        <div className="container">
          <button className="back-button" onClick={() => setSelectedHall(null)}>
            <span>←</span> Back to Dining Halls
          </button>

          <div className="menu-section">
            <div className="menu-header">
              <h2>Today's Menu</h2>
              <p className="menu-subtitle">{filteredItems.length} items available</p>
            </div>

            <div className="menu-filters">
              {getMealTypes().map(type => (
                <button
                  key={type}
                  className={`filter-button ${selectedMealType === type ? 'active' : ''}`}
                  onClick={() => setSelectedMealType(type)}
                >
                  {type === 'All' && '🍽️ '}
                  {type === 'Breakfast' && '🌅 '}
                  {type === 'Lunch' && '☀️ '}
                  {type === 'Dinner' && '🌙 '}
                  {type}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading menu...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <p>No items found for {selectedMealType === 'All' ? 'this dining hall' : selectedMealType}</p>
              </div>
            ) : (
              <div className="menu-items">
                {filteredItems.map((item, index) => (
                  <div key={index} className="menu-item">
                    <div className="item-header">
                      <div className="item-name">{item.name}</div>
                      <div className="calories-badge">{item.calories || 0} cal</div>
                    </div>
                    <div className="item-meta">
                      <span className="meta-tag">🍽️ {item.category || 'N/A'}</span>
                      <span className="meta-tag">📏 {item.serving_size || 'N/A'}</span>
                    </div>
                    <div className="nutrition-grid">
                      <div className="nutrition-item protein">
                        <span className="nutrition-label">Protein</span>
                        <span className="nutrition-value">{item.protein || 0}g</span>
                      </div>
                      <div className="nutrition-item carbs">
                        <span className="nutrition-label">Carbs</span>
                        <span className="nutrition-value">{item.total_carbohydrate || 0}g</span>
                      </div>
                      <div className="nutrition-item fat">
                        <span className="nutrition-label">Fat</span>
                        <span className="nutrition-value">{item.total_fat || 0}g</span>
                      </div>
                      <div className="nutrition-item fiber">
                        <span className="nutrition-label">Fiber</span>
                        <span className="nutrition-value">{item.dietary_fiber || 0}g</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <div className="logo">🌾</div>
          <div>
            <h1>Project Harvest</h1>
            <p>University of Illinois Dining Nutrition Tracker</p>
          </div>
        </div>
      </div>
      <div className="container">
        <div className="page-header">
          <h2>Choose Your Dining Hall</h2>
          <p className="subtitle">Select a dining hall to view today's menu and nutrition information</p>
        </div>

        <div className="dining-halls-grid">
          {diningHalls.map((hall) => (
            <div
              key={hall}
              className="dining-hall-card"
              onClick={() => setSelectedHall(hall)}
            >
              <div
                className="dining-hall-image"
                style={{
                  backgroundImage: `url(${DINING_HALL_IMAGES[hall]})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div className="image-overlay"></div>
              </div>
              <div className="dining-hall-content">
                <h3 className="dining-hall-name">{hall}</h3>
                <p className="dining-hall-info">{DINING_HALL_INFO[hall]}</p>
                <div className="view-menu-button">
                  View Menu →
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
