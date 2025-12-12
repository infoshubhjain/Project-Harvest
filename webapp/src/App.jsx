import { useState, useEffect } from 'react'

const API_BASE = 'https://infoshubhjain.github.io/Project-Harvest/api'

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
          <h1>🌾 Project Harvest</h1>
          <p>University Dining Nutrition Tracker</p>
        </div>
        <div className="container">
          <div className="loading">Loading dining halls...</div>
        </div>
      </div>
    )
  }

  if (error && diningHalls.length === 0) {
    return (
      <div>
        <div className="header">
          <h1>🌾 Project Harvest</h1>
          <p>University Dining Nutrition Tracker</p>
        </div>
        <div className="container">
          <div className="error">
            <h2>Error</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (selectedHall) {
    return (
      <div>
        <div className="header">
          <h1>🌾 Project Harvest</h1>
          <p>{selectedHall}</p>
        </div>
        <div className="container">
          <button className="back-button" onClick={() => setSelectedHall(null)}>
            ← Back to Dining Halls
          </button>

          <div className="menu-section">
            <h2 style={{ marginBottom: '20px', color: '#2d5016' }}>Menu</h2>

            <div className="menu-filters">
              {getMealTypes().map(type => (
                <button
                  key={type}
                  className={`filter-button ${selectedMealType === type ? 'active' : ''}`}
                  onClick={() => setSelectedMealType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="loading">Loading menu...</div>
            ) : filteredItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666', padding: '40px 0' }}>
                No items found for this meal type.
              </p>
            ) : (
              <div className="menu-items">
                {filteredItems.map((item, index) => (
                  <div key={index} className="menu-item">
                    <div className="item-name">{item.name}</div>
                    <div className="item-meta">
                      <span>🍽️ {item.category || 'N/A'}</span>
                      <span>📏 {item.serving_size || 'N/A'}</span>
                    </div>
                    <div className="nutrition-info">
                      <div className="nutrition-item">
                        <span className="nutrition-label">Calories</span>
                        <span className="nutrition-value">{item.calories || 0}</span>
                      </div>
                      <div className="nutrition-item">
                        <span className="nutrition-label">Protein</span>
                        <span className="nutrition-value">{item.protein || 0}g</span>
                      </div>
                      <div className="nutrition-item">
                        <span className="nutrition-label">Fat</span>
                        <span className="nutrition-value">{item.total_fat || 0}g</span>
                      </div>
                      <div className="nutrition-item">
                        <span className="nutrition-label">Carbs</span>
                        <span className="nutrition-value">{item.total_carbohydrate || 0}g</span>
                      </div>
                      <div className="nutrition-item">
                        <span className="nutrition-label">Fiber</span>
                        <span className="nutrition-value">{item.dietary_fiber || 0}g</span>
                      </div>
                      <div className="nutrition-item">
                        <span className="nutrition-label">Sugar</span>
                        <span className="nutrition-value">{item.sugars || 0}g</span>
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
        <h1>🌾 Project Harvest</h1>
        <p>University Dining Nutrition Tracker</p>
      </div>
      <div className="container">
        <h2 style={{ marginTop: '20px', marginBottom: '10px', color: '#2d5016' }}>
          Dining Halls
        </h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Select a dining hall to view its menu and nutrition information
        </p>

        <div className="dining-halls-grid">
          {diningHalls.map((hall) => (
            <div
              key={hall}
              className="dining-hall-card"
              onClick={() => setSelectedHall(hall)}
            >
              <div className="dining-hall-image"></div>
              <div className="dining-hall-content">
                <h3 className="dining-hall-name">{hall}</h3>
                <p className="dining-hall-info">Click to view menu →</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
