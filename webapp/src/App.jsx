import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.DEV
  ? '/Project-Harvest/api'
  : 'https://infoshubhjain.github.io/Project-Harvest/api'


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
  const [isVegetarian, setIsVegetarian] = useState(false)
  const [isVegan, setIsVegan] = useState(false)

  const [availableDates, setAvailableDates] = useState([])
  const [menuItems, setMenuItems] = useState([])

  // Initialize meal type based on current time
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 10) setMealType('Breakfast')
    else if (hour < 15) setMealType('Lunch')
    else setMealType('Dinner')
  }, [])

  // Fetch menu data on mount to populate dates
  useEffect(() => {
    async function fetchMenuData() {
      try {
        const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const response = await fetch(`${API_BASE}/${filename}.json`)
        if (!response.ok) throw new Error('Could not load menu data')
        const data = await response.json()
        const items = data.foods || []
        setMenuItems(items)

        // Extract and sort dates
        const dates = [...new Set(items.map(item => item.date))]
        dates.sort((a, b) => new Date(a) - new Date(b))

        setAvailableDates(dates)
        if (dates.length > 0) {
          setSelectedDate(dates[0])
        }
      } catch (e) {
        console.error('Failed to load menu data in builder:', e)
      }
    }
    fetchMenuData()
  }, [diningHall])

  // --- CLient-Side Meal Logic ---

  // Dietary Constants
  const MEAT_KEYWORDS = [
    'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna',
    'shrimp', 'crab', 'lobster', 'lamb', 'veal', 'bacon', 'ham',
    'sausage', 'pepperoni', 'salami', 'steak', 'burger', 'meatball',
    'wings', 'clams', 'oyster'
  ]

  const DAIRY_EGG_KEYWORDS = [
    'milk', 'cheese', 'cream', 'yogurt', 'butter', 'egg', 'whey',
    'casein', 'honey', 'mayonnaise', 'gelato', 'custard', 'alfredo',
    'ranch', 'caesar'
  ]

  function filterByDietaryRestrictions(items, vegetarian, vegan) {
    if (!vegetarian && !vegan) return items

    return items.filter(item => {
      const name = (item.name || '').toLowerCase()
      const category = (item.category || '').toLowerCase()

      // 1. Filter out meat (for both Veg and Vegan)
      const hasMeat = MEAT_KEYWORDS.some(keyword => name.includes(keyword)) ||
        /meat|fish|poultry/.test(category)
      if (hasMeat) return false

      // 2. Filter out dairy/eggs (for Vegan only)
      if (vegan) {
        const hasDairyEgg = DAIRY_EGG_KEYWORDS.some(keyword => name.includes(keyword)) ||
          /dairy|egg/.test(category)
        if (hasDairyEgg) return false
      }

      return true
    })
  }

  function calculateScore(items, targetCals, targetProt, currentGoal) {
    const totalCals = items.reduce((sum, i) => sum + (i.calories || 0), 0)
    const totalProt = items.reduce((sum, i) => sum + (i.protein || 0), 0)
    const totalFat = items.reduce((sum, i) => sum + (i.total_fat || 0), 0)
    const totalCarbs = items.reduce((sum, i) => sum + (i.total_carbohydrate || 0), 0)

    if (totalCals === 0) return -1000

    // 1. Calorie Score (how close to target) - Primary Factor
    const calDiffPercent = Math.abs(totalCals - targetCals) / targetCals
    const calScore = Math.max(0, 100 - (calDiffPercent * 200))

    // 2. Protein Score
    const protDiffPercent = Math.abs(totalProt - targetProt) / targetProt
    const protScore = Math.max(0, 100 - (protDiffPercent * 200))

    // 3. Goal Alignment (Macro Ratios)
    const goalConfig = {
      balanced: { p: 0.30, f: 0.30, c: 0.40 },
      weight_loss: { p: 0.40, f: 0.25, c: 0.35 },
      bulking: { p: 0.30, f: 0.20, c: 0.50 },
      keto: { p: 0.25, f: 0.70, c: 0.05 },
    }[currentGoal] || { p: 0.30, f: 0.30, c: 0.40 }

    const pRatio = (totalProt * 4) / totalCals
    const fRatio = (totalFat * 9) / totalCals
    const cRatio = (totalCarbs * 4) / totalCals

    const dist = Math.sqrt(
      Math.pow(pRatio - goalConfig.p, 2) +
      Math.pow(fRatio - goalConfig.f, 2) +
      Math.pow(cRatio - goalConfig.c, 2)
    )
    const macroScore = Math.max(0, 100 - (dist * 200))

    // Weighted Score
    return (calScore * 0.4) + (protScore * 0.3) + (macroScore * 0.3)
  }

  async function generateMealPlanLocal(targetCals, targetProt, currentMealType, currentGoal) {
    console.log('Running robust client-side meal generator...')

    // 1. Use pre-fetched items if available (otherwise verify fetch)
    let items = menuItems
    if (items.length === 0) {
      // Fallback fetch if somehow empty (shouldn't happen with useEffect)
      try {
        const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const response = await fetch(`${API_BASE}/${filename}.json`)
        if (!response.ok) throw new Error('Could not load menu data')
        const data = await response.json()
        items = data.foods || []
      } catch (e) {
        console.error('Local generation failed:', e)
        throw new Error('Could not load menu data. Please check your internet connection.')
      }
    }

    // 2. Filter by meal type, date, and dietary restrictions
    const dateToFilter = selectedDate !== 'All' ? selectedDate : (items.length > 0 ? items[0].date : '')

    let pool = items.filter(item =>
      item.meal_type === currentMealType &&
      (!dateToFilter || item.date === dateToFilter) &&
      (item.calories > 0) // Basic sanity check
    )

    // Apply Dietary Filters
    pool = filterByDietaryRestrictions(pool, isVegetarian, isVegan)

    if (pool.length === 0) {
      const dietMsg = isVegan ? ' (Vegan)' : (isVegetarian ? ' (Vegetarian)' : '')
      throw new Error(`No items found for ${currentMealType} on ${dateToFilter}${dietMsg}.`)
    }

    // 3. Monte Carlo Optimization
    // Generate 50 random combinations and pick the best one
    const POPULATION_SIZE = 50
    let bestMeal = null
    let bestScore = -Infinity

    // Categorize for better randomization
    const categories = {
      protein: pool.filter(i => /protein|chicken|beef|pork|fish|egg|tofu/i.test(i.category || '') || i.protein > 15),
      carbs: pool.filter(i => /grain|rice|pasta|bread|potato/i.test(i.category || '')),
      veg: pool.filter(i => /vegetable|salad|green/i.test(i.category || '')),
      other: pool
    }

    for (let i = 0; i < POPULATION_SIZE; i++) {
      let currentItems = []
      let currentCals = 0

      // Try to build a balanced meal structure first
      // 1. Main Protein
      if (categories.protein.length > 0 && Math.random() > 0.1) {
        const item = categories.protein[Math.floor(Math.random() * categories.protein.length)]
        currentItems.push(item)
        currentCals += item.calories || 0
      }

      // 2. Base Carb
      if (categories.carbs.length > 0 && Math.random() > 0.2) {
        const item = categories.carbs[Math.floor(Math.random() * categories.carbs.length)]
        if (!currentItems.includes(item)) {
          currentItems.push(item)
          currentCals += item.calories || 0
        }
      }

      // 3. Fill the rest randomly
      let attempts = 0
      while (currentCals < targetCals * 0.9 && attempts < 10) {
        const item = pool[Math.floor(Math.random() * pool.length)]
        if (!currentItems.includes(item)) {
          if (currentCals + (item.calories || 0) <= targetCals * 1.2) {
            currentItems.push(item)
            currentCals += item.calories || 0
          }
        }
        attempts++
      }

      // Score this combination
      const score = calculateScore(currentItems, targetCals, targetProt, currentGoal)

      if (score > bestScore) {
        bestScore = score
        bestMeal = currentItems
      }
    }

    if (!bestMeal || bestMeal.length === 0) {
      // Fallback if Monte Carlo fails (unlikely, but safe)
      bestMeal = [pool[0]]
    }

    // Calculate final totals
    const finalItems = bestMeal.map(item => ({
      name: item.name,
      category: item.category || 'N/A',
      servings: 1,
      calories: item.calories || 0,
      protein: item.protein || 0,
      carbs: item.total_carbohydrate || 0,
      fat: item.total_fat || 0
    }))

    const totals = finalItems.reduce((acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

    const totalMacros = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9

    return {
      dining_hall: diningHall,
      meal_type: currentMealType,
      target_calories: targetCals,
      target_protein: targetProt,
      goal: GOALS[currentGoal]?.label || currentGoal,
      items: finalItems,
      totals: {
        ...totals,
        protein_percent: totalMacros > 0 ? Math.round((totals.protein * 4 / totalMacros) * 100) : 0,
        carb_percent: totalMacros > 0 ? Math.round((totals.carbs * 4 / totalMacros) * 100) : 0,
        fat_percent: totalMacros > 0 ? Math.round((totals.fat * 9 / totalMacros) * 100) : 0
      },
      meets_target: Math.abs(totals.calories - targetCals) < (targetCals * 0.15),
      meets_protein_target: totals.protein >= targetProt * 0.8,
      is_offline: false // It's technically "online" via GitHub Pages now!
    }
  }

  async function generateMealPlan() {
    try {
      setLoading(true)
      setError(null)

      const calVal = parseInt(calories) || 600
      const protVal = parseInt(protein) || 40

      // Directly use the robust client-side generator
      // This makes the app "Serverless" and hostable anywhere
      const data = await generateMealPlanLocal(calVal, protVal, mealType, goal)

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
            <label>📅 Select Date</label>
            <select
              className="date-select"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
            >
              {availableDates.length === 0 && <option value="">Loading dates...</option>}
              {availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
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

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label>🥦 Dietary Preferences</label>
            <div className="dietary-toggles" style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={isVegetarian}
                  onChange={(e) => {
                    setIsVegetarian(e.target.checked)
                    if (e.target.checked) setIsVegan(false)
                  }}
                  style={{ marginRight: '8px', width: '18px', height: '18px', accentColor: '#4a7c59' }}
                />
                Vegetarian
              </label>
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={isVegan}
                  onChange={(e) => {
                    setIsVegan(e.target.checked)
                    if (e.target.checked) setIsVegetarian(false)
                  }}
                  style={{ marginRight: '8px', width: '18px', height: '18px', accentColor: '#4a7c59' }}
                />
                Vegan
              </label>
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

      // Extract unique dates and sort them
      const dates = [...new Set((data.foods || []).map(item => item.date))]

      // Sort dates chronologically
      dates.sort((a, b) => {
        const dateA = new Date(a)
        const dateB = new Date(b)
        return dateA - dateB
      })

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
