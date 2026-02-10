import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV
  ? '/Project-Harvest/api'
  : 'https://infoshubhjain.github.io/Project-Harvest/api'

// For meal-plan requests which need the backend server
const BACKEND_API = import.meta.env.DEV
  ? '/api'
  : 'https://project-harvest-backend.onrender.com/api'

// Use repository images hosted on GitHub raw to ensure availability
const BASE_IMAGES_URL = import.meta.env.DEV
  ? 'https://infoshubhjain.github.io/Project-Harvest/images'
  : 'https://infoshubhjain.github.io/Project-Harvest/images'
const DINING_HALL_IMAGES = {
  'Illinois Street Dining Center (ISR)': `${BASE_IMAGES_URL}/ISR.jpg`,
  'Ikenberry Dining Center (Ike)': `${BASE_IMAGES_URL}/Ikenberry.jpg`,
  'Lincoln Avenue Dining Hall (LAR)': `${BASE_IMAGES_URL}/Allen.jpg`,
  'Pennsylvania Avenue Dining Hall (PAR)': `${BASE_IMAGES_URL}/PAR.webp`,
}

const DINING_HALL_INFO = {
  'Illinois Street Dining Center (ISR)': 'Illinois Street Residence - Main dining room with diverse menu options',
  'Ikenberry Dining Center (Ike)': 'Largest dining hall on campus with multiple stations',
  'Lincoln Avenue Dining Hall (LAR)': 'Allen/LAR - Comfortable atmosphere with quality meals',
  'Pennsylvania Avenue Dining Hall (PAR)': 'Pennsylvania Avenue - Fresh ingredients and healthy choices',
}

// Only display these main dining halls (filter out "Everybody Eats" etc.)
const MAIN_DINING_HALLS = [
  'Ikenberry Dining Center (Ike)',
  'Illinois Street Dining Center (ISR)',
  'Pennsylvania Avenue Dining Hall (PAR)',
  'Lincoln Avenue Dining Hall (LAR)'
]

const GOALS = {
  balanced: { label: '⚖️ Balanced', desc: 'Equal macros' },
  weight_loss: { label: '🔥 Weight Loss', desc: 'High protein' },
  bulking: { label: '💪 Bulking', desc: 'High carbs' },
  keto: { label: '🥑 Keto', desc: 'Low carb' },
}

// Meal Builder Component
function MealBuilder({ diningHall, onBack }) {
  const [calories, setCalories] = useState('600')
  const [protein, setProtein] = useState('40')
  const [mealType, setMealType] = useState('Lunch') // Default to Lunch as it usually has most data
  const [goal, setGoal] = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [mealPlan, setMealPlan] = useState(null)

  // Initialize meal type based on current time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 10) setMealType('Breakfast')
    else if (hour < 15) setMealType('Lunch')
    else setMealType('Dinner')
  }, [])

  async function generateMealPlanLocal(targetCals, targetProt, currentMealType, currentGoal) {
    console.log('Running client-side meal generator fallback...')

    // 1. Fetch menu data if we don't have it
    let items = []
    try {
      const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
      const response = await fetch(`${API_BASE}/${filename}.json`)
      if (!response.ok) throw new Error('Could not load menu for local generation')
      const data = await response.json()
      items = data.foods || []
    } catch (e) {
      console.error('Local generation failed to load data:', e)
      throw new Error('Could not load menu data for offline generation.')
    }

    // 2. Filter by meal type and selected date
    const dateToFilter = selectedDate || (items.length > 0 ? items[0].date : '')
    const pool = items.filter(item =>
      item.meal_type === currentMealType &&
      (!dateToFilter || item.date === dateToFilter)
    )

    if (pool.length === 0) {
      throw new Error(`No items found for ${currentMealType} on ${dateToFilter} at this dining hall.`)
    }

    // 3. Simple greedy randomized selection
    let selected = []
    let currentCals = 0
    let currentProt = 0
    let currentCarbs = 0
    let currentFat = 0

    // Shuffle the pool for variety
    const shuffled = [...pool].sort(() => Math.random() - 0.5)

    // Pick items until we hit ~target calories
    for (const item of shuffled) {
      const itemCals = item.calories || 0
      if (currentCals + itemCals <= targetCals + 50) {
        selected.push({
          name: item.name,
          category: item.category || 'N/A',
          servings: 1,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.total_carbohydrate || 0,
          fat: item.total_fat || 0
        })
        currentCals += item.calories || 0
        currentProt += item.protein || 0
        currentCarbs += item.total_carbohydrate || 0
        currentFat += item.total_fat || 0
      }
      if (currentCals >= targetCals - 50) break
    }

    if (selected.length === 0) {
      throw new Error('Could not build a meal within the calorie limit.')
    }

    const totalMacros = currentProt * 4 + currentCarbs * 4 + currentFat * 9

    return {
      dining_hall: diningHall,
      meal_type: currentMealType,
      target_calories: targetCals,
      target_protein: targetProt,
      goal: GOALS[currentGoal]?.label || currentGoal,
      items: selected,
      totals: {
        calories: currentCals,
        protein: currentProt,
        carbs: currentCarbs,
        fat: currentFat,
        protein_percent: totalMacros > 0 ? Math.round((currentProt * 4 / totalMacros) * 100) : 0,
        carb_percent: totalMacros > 0 ? Math.round((currentCarbs * 4 / totalMacros) * 100) : 0,
        fat_percent: totalMacros > 0 ? Math.round((currentFat * 9 / totalMacros) * 100) : 0
      },
      meets_target: Math.abs(currentCals - targetCals) < 100,
      meets_protein_target: currentProt >= targetProt - 5,
      is_offline: true
    }
  }

  async function generateMealPlan() {
    try {
      setLoading(true)
      setError(null)

      const calVal = parseInt(calories) || 600
      const protVal = parseInt(protein) || 40

      const params = new URLSearchParams({
        calories: calVal.toString(),
        dining_hall: diningHall,
        protein: protVal.toString(),
        goal: goal,
        meal_type: mealType,
        date: selectedDate !== 'All' ? selectedDate : ''
      })

      const fetchUrl = `${BACKEND_API}/meal-plan?${params}`
      console.log('Fetching meal plan from:', fetchUrl)

      let data
      try {
        const response = await fetch(fetchUrl)

        if (!response.ok) {
          let errorMsg = 'Failed to generate meal plan'
          try {
            const errData = await response.json()
            errorMsg = errData.error || errorMsg
          } catch (e) {
            errorMsg = `Error ${response.status}: ${response.statusText}`
          }
          throw new Error(errorMsg)
        }

        data = await response.json()
      } catch (fetchErr) {
        console.warn('Backend fetch failed, falling back to local generator:', fetchErr)
        data = await generateMealPlanLocal(calVal, protVal, mealType, goal)
      }

      if (data.error) {
        throw new Error(data.error)
      }

      setMealPlan(data)
    } catch (err) {
      console.error('Meal generation error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <div className="logo">🌾</div>
          <div>
            <h1>Project Harvest</h1>
            <p>Build Your Perfect Meal</p>
          </div>
        </div>
      </div>
      <div className="container">
        <button className="back-button" onClick={onBack}>
          <span>←</span> Back to Dining Halls
        </button>

        <div className="meal-builder-header">
          <h2>🍽️ Meal Builder</h2>
          <p className="meal-builder-subtitle">{diningHall}</p>
        </div>

        <div className="meal-builder-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="calories">🔥 Target Calories</label>
              <input
                id="calories"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 600"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="protein">💪 Target Protein (g)</label>
              <input
                id="protein"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 40"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>🌅 Meal Type</label>
            <div className="goal-buttons">
              {['Breakfast', 'Lunch', 'Dinner'].map(type => (
                <button
                  key={type}
                  className={`goal-button ${mealType === type ? 'active' : ''}`}
                  onClick={() => setMealType(type)}
                >
                  {type === 'Breakfast' ? '🌅 ' : type === 'Lunch' ? '☀️ ' : '🌙 '}
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>🎯 Nutrition Goal</label>
            <div className="goal-buttons">
              {Object.entries(GOALS).map(([key, { label, desc }]) => (
                <button
                  key={key}
                  className={`goal-button ${goal === key ? 'active' : ''}`}
                  onClick={() => setGoal(key)}
                  title={desc}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="generate-button"
            onClick={generateMealPlan}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Generating...
              </>
            ) : (
              '✨ Generate Meal Plan'
            )}
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <span>⚠️</span> {error}
          </div>
        )}

        {mealPlan && (
          <div className="meal-plan-results">
            <div className="results-header">
              <h3>Your Personalized Meal</h3>
              <div className="meal-meta">
                {mealPlan.is_offline && <span className="meta-badge offline" style={{ backgroundColor: '#666' }}>Offline Mode</span>}
                <span className="meta-badge">{mealPlan.meal_type}</span>
                <span className="meta-badge goal">{mealPlan.goal}</span>
              </div>
            </div>

            <div className="meal-items">
              {mealPlan.items.map((item, index) => (
                <div key={index} className="meal-plan-item">
                  <div className="item-main">
                    <span className="item-servings">{item.servings}×</span>
                    <span className="item-name">{item.name}</span>
                  </div>
                  <div className="item-macros">
                    <span className="macro cal">{Math.round(item.calories)} cal</span>
                    <span className="macro protein">{Math.round(item.protein)}g P</span>
                    <span className="macro carbs">{Math.round(item.carbs)}g C</span>
                    <span className="macro fat">{Math.round(item.fat)}g F</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="meal-totals">
              <h4>📊 Meal Totals</h4>
              <div className="totals-grid">
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.totals.calories)}</span>
                  <span className="total-label">Calories</span>
                  <span className={`target-badge ${mealPlan.meets_target ? 'met' : 'missed'}`}>
                    Target: {mealPlan.target_calories}
                  </span>
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.totals.protein)}g</span>
                  <span className="total-label">Protein</span>
                  {mealPlan.target_protein && (
                    <span className={`target-badge ${mealPlan.meets_protein_target ? 'met' : 'missed'}`}>
                      Target: {mealPlan.target_protein}g
                    </span>
                  )}
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.totals.carbs)}g</span>
                  <span className="total-label">Carbs</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.totals.fat)}g</span>
                  <span className="total-label">Fat</span>
                </div>
              </div>

              <div className="macro-breakdown">
                <div className="macro-bar">
                  <div
                    className="macro-segment protein"
                    style={{ width: `${mealPlan.totals.protein_percent}%` }}
                    title={`Protein: ${mealPlan.totals.protein_percent}%`}
                  ></div>
                  <div
                    className="macro-segment carbs"
                    style={{ width: `${mealPlan.totals.carb_percent}%` }}
                    title={`Carbs: ${mealPlan.totals.carb_percent}%`}
                  ></div>
                  <div
                    className="macro-segment fat"
                    style={{ width: `${mealPlan.totals.fat_percent}%` }}
                    title={`Fat: ${mealPlan.totals.fat_percent}%`}
                  ></div>
                </div>
                <div className="macro-legend">
                  <span><span className="legend-dot protein"></span> Protein {mealPlan.totals.protein_percent}%</span>
                  <span><span className="legend-dot carbs"></span> Carbs {mealPlan.totals.carb_percent}%</span>
                  <span><span className="legend-dot fat"></span> Fat {mealPlan.totals.fat_percent}%</span>
                </div>
              </div>
            </div>

            <button className="regenerate-button" onClick={generateMealPlan} disabled={loading}>
              🔄 Generate Another Meal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const [diningHalls, setDiningHalls] = useState([])
  const [selectedHall, setSelectedHall] = useState(null)
  const [mealBuilderHall, setMealBuilderHall] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const [selectedDate, setSelectedDate] = useState('All')
  const [selectedMealType, setSelectedMealType] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [imageFallbacks, setImageFallbacks] = useState({})

  useEffect(() => {
    loadDiningHalls()
  }, [])

  useEffect(() => {
    if (selectedHall) {
      loadMenu(selectedHall)
    }
  }, [selectedHall])

  useEffect(() => {
    let filtered = menuItems
    if (selectedMealType !== 'All') {
      filtered = filtered.filter(item => item.meal_type === selectedMealType)
    }
    if (selectedDate !== 'All') {
      filtered = filtered.filter(item => item.date === selectedDate)
    }
    setFilteredItems(filtered)
  }, [selectedMealType, selectedDate, menuItems])

  async function loadDiningHalls() {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/dining-halls.json`)
      if (!response.ok) throw new Error('Failed to load dining halls')
      const data = await response.json()
      // Filter to only show main dining halls in the preferred order
      const filtered = MAIN_DINING_HALLS.filter(hall =>
        (data.dining_halls || []).includes(hall)
      )
      setDiningHalls(filtered.length > 0 ? filtered : data.dining_halls || [])
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

      // Extract unique dates
      const dates = [...new Set((data.foods || []).map(item => item.date))]
      setAvailableDates(dates)
      if (dates.length > 0) {
        setSelectedDate(dates[0]) // Default to most recent date
      } else {
        setSelectedDate('All')
      }

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

  // Show Meal Builder view
  if (mealBuilderHall) {
    return (
      <MealBuilder
        diningHall={mealBuilderHall}
        onBack={() => setMealBuilderHall(null)}
      />
    )
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
              <div className="filter-group">
                <span className="filter-label">📅 Date:</span>
                <select
                  className="date-select"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  <option value="All">All Dates</option>
                  {availableDates.map(date => (
                    <option key={date} value={date}>{date}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">🍽️ Meal:</span>
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
            >
              <div className="dining-hall-image" onClick={() => setSelectedHall(hall)}>
                <img
                  src={DINING_HALL_IMAGES[hall]}
                  alt={hall}
                  onError={(e) => { e.target.onerror = null; e.target.src = `${BASE_IMAGES_URL}/Logo.png`; setImageFallbacks(prev => ({ ...prev, [hall]: true })); }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {imageFallbacks[hall] && (
                  <div style={{ position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 6px', borderRadius: 4, fontSize: 12 }}>
                    Using fallback image
                  </div>
                )}
                <div className="image-overlay"></div>
              </div>
              <div className="dining-hall-content">
                <h3 className="dining-hall-name">{hall}</h3>
                <p className="dining-hall-info">{DINING_HALL_INFO[hall]}</p>
                <div className="card-buttons">
                  <button className="view-menu-button" onClick={() => setSelectedHall(hall)}>
                    View Menu →
                  </button>
                  <button className="build-meal-button" onClick={() => setMealBuilderHall(hall)}>
                    ✨ Build My Meal
                  </button>
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
