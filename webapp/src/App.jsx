import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.DEV
  ? '/api'
  : `${import.meta.env.BASE_URL}api`

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
  'Illinois Street Dining Center (ISR)': 'Bright, social, and fast service near ISR.',
  'Ikenberry Dining Center (Ike)': 'Largest dining hall with broad station variety.',
  'Lincoln Avenue Dining Hall (LAR)': 'Cozy atmosphere with classic comfort foods.',
  'Pennsylvania Avenue Dining Hall (PAR)': 'Fresh ingredients and lighter choices.',
}

const MAIN_DINING_HALLS = [
  'Ikenberry Dining Center (Ike)',
  'Illinois Street Dining Center (ISR)',
  'Pennsylvania Avenue Dining Hall (PAR)',
  'Lincoln Avenue Dining Hall (LAR)'
]

const GOALS = {
  balanced: { label: 'Balanced', desc: 'Even macros', emoji: '⚖️' },
  weight_loss: { label: 'Lean & High-Protein', desc: 'Higher protein', emoji: '🥗' },
  bulking: { label: 'Energy Boost', desc: 'Higher carbs', emoji: '🍚' },
  keto: { label: 'Low-Carb', desc: 'High fat', emoji: '🥑' },
}

const UPCOMING_DAYS = 5
const FAVORITES_KEY = 'ph_favorites_v1'

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

const SWEET_KEYWORDS = [
  'cookie', 'cake', 'brownie', 'pie', 'donut', 'ice cream', 'gelato',
  'muffin', 'pudding', 'sweet', 'candy'
]

function parseMenuDate(dateStr) {
  if (!dateStr) return null
  const parsed = new Date(`${dateStr} 00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function getUpcomingDates(items, days = UPCOMING_DAYS) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = new Date(today)
  endDate.setDate(today.getDate() + (days - 1))

  return [...new Set(items.map(item => item.date).filter(Boolean))]
    .map(raw => ({ raw, parsed: parseMenuDate(raw) }))
    .filter(({ parsed }) => parsed && parsed >= today && parsed <= endDate)
    .sort((a, b) => a.parsed - b.parsed)
    .map(({ raw }) => raw)
}

function getSortedDates(items) {
  return [...new Set(items.map(item => item.date).filter(Boolean))]
    .map(raw => ({ raw, parsed: parseMenuDate(raw) }))
    .filter(({ parsed }) => parsed)
    .sort((a, b) => a.parsed - b.parsed)
    .map(({ raw }) => raw)
}

function formatDateLabel(dateStr) {
  const parsed = parseMenuDate(dateStr)
  if (!parsed) return dateStr
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((parsed - today) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return `${dateStr} (Today)`
  if (diffDays === 1) return `${dateStr} (Tomorrow)`
  return dateStr
}

function getDietFlags(item) {
  const name = (item.name || '').toLowerCase()
  const category = (item.category || '').toLowerCase()
  const hasMeat = MEAT_KEYWORDS.some(keyword => name.includes(keyword)) ||
    /meat|fish|poultry/.test(category)
  const hasDairyEgg = DAIRY_EGG_KEYWORDS.some(keyword => name.includes(keyword)) ||
    /dairy|egg/.test(category)
  return {
    vegetarian: !hasMeat,
    vegan: !hasMeat && !hasDairyEgg
  }
}

function getItemKey(hall, item) {
  return `${hall}::${item.name || ''}::${item.meal_type || ''}::${item.date || ''}`
}

function getCategoryGroup(item) {
  const category = (item.category || '').toLowerCase()
  const name = (item.name || '').toLowerCase()
  if (/protein|grill|entree|main|chicken|beef|pork|fish|tofu/.test(category + name)) return 'protein'
  if (/grain|rice|pasta|bread|potato|noodle|tortilla/.test(category + name)) return 'carb'
  if (/salad|vegetable|green|produce/.test(category + name)) return 'veg'
  if (SWEET_KEYWORDS.some(keyword => name.includes(keyword))) return 'sweet'
  if (/beverage|drink|coffee|tea|juice/.test(category + name)) return 'drink'
  return 'other'
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

function saveFavorites(set) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]))
}

function MealBuilder({ diningHall, onBack }) {
  const [calories, setCalories] = useState('650')
  const [protein, setProtein] = useState('40')
  const [mealType, setMealType] = useState('Lunch')
  const [goal, setGoal] = useState('balanced')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [mealPlan, setMealPlan] = useState(null)
  const [isVegetarian, setIsVegetarian] = useState(false)
  const [isVegan, setIsVegan] = useState(false)
  const [maxItems, setMaxItems] = useState(5)
  const [preferVariety, setPreferVariety] = useState(true)

  const [availableDates, setAvailableDates] = useState([])
  const [menuItems, setMenuItems] = useState([])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 10) setMealType('Breakfast')
    else if (hour < 15) setMealType('Lunch')
    else setMealType('Dinner')
  }, [])

  useEffect(() => {
    async function fetchMenuData() {
      try {
        const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const response = await fetch(`${API_BASE}/${filename}.json`)
        if (!response.ok) throw new Error('Could not load menu data')
        const data = await response.json()
        const items = data.foods || []
        setMenuItems(items)

        const upcomingDates = getUpcomingDates(items)
        const dates = upcomingDates.length > 0 ? upcomingDates : getSortedDates(items)

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

  function filterByDietaryRestrictions(items, vegetarian, vegan) {
    if (!vegetarian && !vegan) return items

    return items.filter(item => {
      const flags = getDietFlags(item)
      if (vegan) return flags.vegan
      if (vegetarian) return flags.vegetarian
      return true
    })
  }

  function calculateScore(items, targetCals, targetProt, currentGoal, maxItemsAllowed) {
    const totalCals = items.reduce((sum, i) => sum + (i.calories || 0), 0)
    const totalProt = items.reduce((sum, i) => sum + (i.protein || 0), 0)
    const totalFat = items.reduce((sum, i) => sum + (i.total_fat || 0), 0)
    const totalCarbs = items.reduce((sum, i) => sum + (i.total_carbohydrate || 0), 0)

    if (totalCals === 0) return -1000

    const calDiffPercent = Math.abs(totalCals - targetCals) / targetCals
    const calScore = Math.max(0, 100 - (calDiffPercent * 220))

    const protDiffPercent = Math.abs(totalProt - targetProt) / targetProt
    const protScore = Math.max(0, 100 - (protDiffPercent * 210))

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
    const macroScore = Math.max(0, 100 - (dist * 220))

    const uniqueGroups = new Set(items.map(getCategoryGroup)).size
    const varietyScore = Math.min(100, uniqueGroups * 20)

    const sizePenalty = Math.max(0, items.length - maxItemsAllowed) * 6
    const overPenalty = totalCals > targetCals * 1.2 ? 20 : 0

    return (calScore * 0.42) + (protScore * 0.28) + (macroScore * 0.2) + (varietyScore * 0.1) - sizePenalty - overPenalty
  }

  async function generateMealPlanLocal(targetCals, targetProt, currentMealType, currentGoal) {
    let items = menuItems
    if (items.length === 0) {
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

    const dateToFilter = selectedDate !== 'All' ? selectedDate : (items.length > 0 ? items[0].date : '')

    let pool = items.filter(item =>
      item.meal_type === currentMealType &&
      (!dateToFilter || item.date === dateToFilter) &&
      (item.calories > 0)
    )

    pool = filterByDietaryRestrictions(pool, isVegetarian, isVegan)

    if (pool.length === 0) {
      const dietMsg = isVegan ? ' (Vegan)' : (isVegetarian ? ' (Vegetarian)' : '')
      throw new Error(`No items found for ${currentMealType} on ${dateToFilter}${dietMsg}.`)
    }

    const ranked = [...pool].sort((a, b) => (b.protein || 0) - (a.protein || 0))
    const seeds = ranked.slice(0, Math.min(8, ranked.length))

    const POPULATION_SIZE = 70
    let bestMeal = null
    let bestScore = -Infinity

    for (let i = 0; i < POPULATION_SIZE; i++) {
      const seed = seeds[i % seeds.length] || pool[Math.floor(Math.random() * pool.length)]
      let currentItems = [seed]
      let currentCals = seed.calories || 0

      const attemptsLimit = 20
      let attempts = 0
      while (currentItems.length < maxItems && attempts < attemptsLimit) {
        const candidate = pool[Math.floor(Math.random() * pool.length)]
        if (currentItems.includes(candidate)) {
          attempts++
          continue
        }

        const projectedCals = currentCals + (candidate.calories || 0)
        if (projectedCals > targetCals * 1.25) {
          attempts++
          continue
        }

        currentItems.push(candidate)
        currentCals = projectedCals
        attempts++
      }

      if (preferVariety) {
        const grouped = {}
        currentItems.forEach(item => {
          const group = getCategoryGroup(item)
          grouped[group] = grouped[group] ? [...grouped[group], item] : [item]
        })
        const varied = []
        Object.values(grouped).forEach(groupItems => {
          varied.push(groupItems[Math.floor(Math.random() * groupItems.length)])
        })
        currentItems = varied.slice(0, maxItems)
      }

      const score = calculateScore(currentItems, targetCals, targetProt, currentGoal, maxItems)
      if (score > bestScore) {
        bestScore = score
        bestMeal = currentItems
      }
    }

    if (!bestMeal || bestMeal.length === 0) {
      bestMeal = [pool[0]]
    }

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
      date: dateToFilter,
      items: finalItems,
      totals: {
        ...totals,
        protein_percent: totalMacros > 0 ? Math.round((totals.protein * 4 / totalMacros) * 100) : 0,
        carb_percent: totalMacros > 0 ? Math.round((totals.carbs * 4 / totalMacros) * 100) : 0,
        fat_percent: totalMacros > 0 ? Math.round((totals.fat * 9 / totalMacros) * 100) : 0
      },
      meets_target: Math.abs(totals.calories - targetCals) < (targetCals * 0.15),
      meets_protein_target: totals.protein >= targetProt * 0.8,
      is_offline: false,
      score: Math.round(bestScore)
    }
  }

  async function generateMealPlan() {
    try {
      setLoading(true)
      setError(null)

      const calVal = clampNumber(parseInt(calories, 10) || 650, 300, 1800)
      const protVal = clampNumber(parseInt(protein, 10) || 40, 10, 200)

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
    <div className="page">
      <header className="hero hero--compact">
        <div className="hero-content">
          <div>
            <p className="hero-eyebrow">Meal Builder</p>
            <h1>Craft a cozy plate in minutes.</h1>
            <p className="hero-subtitle">Set goals, pick a date, and we do the rest.</p>
          </div>
          <div className="hero-chip">{diningHall}</div>
        </div>
      </header>

      <main className="container container--wide">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back to Dining Halls
        </button>

        <div className="panel panel--lifted">
          <div className="panel-header">
            <div>
              <h2>Build your meal</h2>
              <p>Personalized for the day and dining hall you choose.</p>
            </div>
            <div className="badge">{selectedDate ? formatDateLabel(selectedDate) : 'Loading dates...'}</div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="calories">Target Calories</label>
              <input
                id="calories"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 650"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="protein">Target Protein (g)</label>
              <input
                id="protein"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 40"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="date">Select Date</label>
              <select
                id="date"
                className="select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {availableDates.length === 0 && <option value="">Loading dates...</option>}
                {availableDates.map(date => (
                  <option key={date} value={date}>{formatDateLabel(date)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Meal Type</label>
              <div className="toggle-row">
                {['Breakfast', 'Lunch', 'Dinner'].map(type => (
                  <button
                    key={type}
                    className={`chip ${mealType === type ? 'chip--active' : ''}`}
                    onClick={() => setMealType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Dietary Preferences</label>
              <div className="toggle-row">
                <button
                  className={`chip ${isVegetarian ? 'chip--active' : ''}`}
                  onClick={() => {
                    setIsVegetarian(!isVegetarian)
                    if (!isVegetarian) setIsVegan(false)
                  }}
                >
                  Vegetarian
                </button>
                <button
                  className={`chip ${isVegan ? 'chip--active' : ''}`}
                  onClick={() => {
                    setIsVegan(!isVegan)
                    if (!isVegan) setIsVegetarian(false)
                  }}
                >
                  Vegan
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Max Items</label>
              <div className="range-wrap">
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={maxItems}
                  onChange={(e) => setMaxItems(parseInt(e.target.value, 10))}
                />
                <span>{maxItems} items</span>
              </div>
            </div>
            <div className="form-group">
              <label>Style</label>
              <div className="toggle-row">
                {Object.entries(GOALS).map(([key, { label, desc, emoji }]) => (
                  <button
                    key={key}
                    className={`chip ${goal === key ? 'chip--active' : ''}`}
                    onClick={() => setGoal(key)}
                    title={desc}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group form-group--full">
              <label>Variety Boost</label>
              <div className="toggle-row">
                <button
                  className={`chip ${preferVariety ? 'chip--active' : ''}`}
                  onClick={() => setPreferVariety(!preferVariety)}
                >
                  {preferVariety ? 'On' : 'Off'}
                </button>
                <span className="hint">Picks a mix of proteins, carbs, veggies, and treats.</span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary btn-large" onClick={generateMealPlan} disabled={loading}>
            {loading ? 'Building your plate...' : 'Generate My Meal'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <strong>Heads up:</strong> {error}
          </div>
        )}

        {mealPlan && (
          <div className="panel panel--results">
            <div className="results-header">
              <div>
                <h3>Your personalized meal</h3>
                <p>{mealPlan.date}</p>
              </div>
              <div className="score-card">
                <span>Score</span>
                <strong>{mealPlan.score}</strong>
              </div>
            </div>

            <div className="meal-items">
              {mealPlan.items.map((item, index) => (
                <div key={index} className="meal-plan-item">
                  <div className="item-main">
                    <span className="item-servings">{item.servings}×</span>
                    <div>
                      <p className="item-name">{item.name}</p>
                      <span className="item-sub">{item.category}</span>
                    </div>
                  </div>
                  <div className="item-macros">
                    <span className="macro">{Math.round(item.calories)} cal</span>
                    <span className="macro">{Math.round(item.protein)}g P</span>
                    <span className="macro">{Math.round(item.carbs)}g C</span>
                    <span className="macro">{Math.round(item.fat)}g F</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="meal-totals">
              <div className="totals-grid">
                <div>
                  <h4>{Math.round(mealPlan.totals.calories)}</h4>
                  <p>Calories</p>
                  <span className={`pill ${mealPlan.meets_target ? 'pill--good' : 'pill--warn'}`}>
                    Target {mealPlan.target_calories}
                  </span>
                </div>
                <div>
                  <h4>{Math.round(mealPlan.totals.protein)}g</h4>
                  <p>Protein</p>
                  <span className={`pill ${mealPlan.meets_protein_target ? 'pill--good' : 'pill--warn'}`}>
                    Target {mealPlan.target_protein}g
                  </span>
                </div>
                <div>
                  <h4>{Math.round(mealPlan.totals.carbs)}g</h4>
                  <p>Carbs</p>
                </div>
                <div>
                  <h4>{Math.round(mealPlan.totals.fat)}g</h4>
                  <p>Fat</p>
                </div>
              </div>

              <div className="macro-breakdown">
                <div className="macro-bar">
                  <div className="macro-segment protein" style={{ width: `${mealPlan.totals.protein_percent}%` }}></div>
                  <div className="macro-segment carbs" style={{ width: `${mealPlan.totals.carb_percent}%` }}></div>
                  <div className="macro-segment fat" style={{ width: `${mealPlan.totals.fat_percent}%` }}></div>
                </div>
                <div className="macro-legend">
                  <span><span className="legend-dot protein"></span> Protein {mealPlan.totals.protein_percent}%</span>
                  <span><span className="legend-dot carbs"></span> Carbs {mealPlan.totals.carb_percent}%</span>
                  <span><span className="legend-dot fat"></span> Fat {mealPlan.totals.fat_percent}%</span>
                </div>
              </div>
            </div>

            <button className="btn btn-ghost" onClick={generateMealPlan} disabled={loading}>
              Generate Another
            </button>
          </div>
        )}
      </main>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [dietFilter, setDietFilter] = useState('any')
  const [minProtein, setMinProtein] = useState(0)
  const [maxCalories, setMaxCalories] = useState(1500)
  const [sortBy, setSortBy] = useState('recommended')
  const [favorites, setFavorites] = useState(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [stats, setStats] = useState({ lastUpdated: '', hallCount: 0 })

  useEffect(() => {
    loadDiningHalls()
    setFavorites(getFavorites())
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      )
    }

    filtered = filtered.filter(item => (item.protein || 0) >= minProtein)
    filtered = filtered.filter(item => (item.calories || 0) <= maxCalories)

    if (dietFilter !== 'any') {
      filtered = filtered.filter(item => {
        const flags = getDietFlags(item)
        if (dietFilter === 'vegetarian') return flags.vegetarian
        if (dietFilter === 'vegan') return flags.vegan
        return true
      })
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter(item => favorites.has(getItemKey(selectedHall, item)))
    }

    if (sortBy === 'protein') {
      filtered = filtered.slice().sort((a, b) => (b.protein || 0) - (a.protein || 0))
    } else if (sortBy === 'calories') {
      filtered = filtered.slice().sort((a, b) => (a.calories || 0) - (b.calories || 0))
    } else if (sortBy === 'name') {
      filtered = filtered.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    setFilteredItems(filtered)
  }, [selectedMealType, selectedDate, menuItems, searchQuery, minProtein, maxCalories, dietFilter, sortBy, favorites, showFavoritesOnly, selectedHall])

  async function loadDiningHalls() {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/dining-halls.json`)
      if (!response.ok) throw new Error('Failed to load dining halls')
      const data = await response.json()
      const filtered = MAIN_DINING_HALLS.filter(hall =>
        (data.dining_halls || []).includes(hall)
      )
      setDiningHalls(filtered.length > 0 ? filtered : data.dining_halls || [])
      setStats({ lastUpdated: data.last_updated || '', hallCount: (data.dining_halls || []).length })
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

      const upcomingDates = getUpcomingDates(data.foods || [])
      const dates = upcomingDates.length > 0 ? upcomingDates : getSortedDates(data.foods || [])

      setAvailableDates(dates)
      if (dates.length > 0) {
        setSelectedDate(dates[0])
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

  function toggleFavorite(item) {
    const key = getItemKey(selectedHall, item)
    const updated = new Set(favorites)
    if (updated.has(key)) updated.delete(key)
    else updated.add(key)
    setFavorites(updated)
    saveFavorites(updated)
  }

  const hallStats = useMemo(() => {
    const totalItems = menuItems.length
    const mealTypes = new Set(menuItems.map(item => item.meal_type)).size
    const dates = new Set(menuItems.map(item => item.date)).size
    return { totalItems, mealTypes, dates }
  }, [menuItems])

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
      <div className="page">
        <header className="hero hero--compact">
          <div className="hero-content">
            <div>
              <p className="hero-eyebrow">Project Harvest</p>
              <h1>Warming up the menu...</h1>
              <p className="hero-subtitle">Loading dining halls and today’s menu data.</p>
            </div>
          </div>
        </header>
        <main className="container">
          <div className="loading-card">
            <div className="spinner"></div>
            <p>Loading dining halls...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error && diningHalls.length === 0) {
    return (
      <div className="page">
        <header className="hero hero--compact">
          <div className="hero-content">
            <div>
              <p className="hero-eyebrow">Project Harvest</p>
              <h1>We hit a snag.</h1>
              <p className="hero-subtitle">Let’s try fetching the data again.</p>
            </div>
          </div>
        </header>
        <main className="container">
          <div className="alert alert-error">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={loadDiningHalls}>Try Again</button>
          </div>
        </main>
      </div>
    )
  }

  if (selectedHall) {
    return (
      <div className="page">
        <header className="hero hero--compact">
          <div className="hero-content">
            <div>
              <p className="hero-eyebrow">Dining Hall</p>
              <h1>{selectedHall}</h1>
              <p className="hero-subtitle">Explore today’s menu and build your perfect plate.</p>
            </div>
            <div className="hero-chip">{hallStats.totalItems} items</div>
          </div>
        </header>

        <main className="container container--wide">
          <div className="toolbar">
            <button className="btn btn-ghost" onClick={() => setSelectedHall(null)}>
              ← Back to Dining Halls
            </button>
            <button className="btn btn-primary" onClick={() => setMealBuilderHall(selectedHall)}>
              Build My Meal
            </button>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Menu explorer</h2>
                <p>{filteredItems.length} items shown</p>
              </div>
              <div className="pill">{hallStats.dates} days • {hallStats.mealTypes} meal types</div>
            </div>

            <div className="filter-stack">
              <div className="filter-row">
                <div className="form-group">
                  <label>Search</label>
                  <input
                    type="text"
                    placeholder="Try \"banana\" or \"salad\""
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <select
                    className="select"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  >
                    <option value="All">All Dates</option>
                    {availableDates.map(date => (
                      <option key={date} value={date}>{formatDateLabel(date)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Diet</label>
                  <select className="select" value={dietFilter} onChange={(e) => setDietFilter(e.target.value)}>
                    <option value="any">Any</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sort by</label>
                  <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="recommended">Recommended</option>
                    <option value="protein">Highest protein</option>
                    <option value="calories">Lowest calories</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>

              <div className="filter-row">
                <div className="form-group">
                  <label>Meal Type</label>
                  <div className="toggle-row">
                    {getMealTypes().map(type => (
                      <button
                        key={type}
                        className={`chip ${selectedMealType === type ? 'chip--active' : ''}`}
                        onClick={() => setSelectedMealType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Min Protein</label>
                  <div className="range-wrap">
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={minProtein}
                      onChange={(e) => setMinProtein(parseInt(e.target.value, 10))}
                    />
                    <span>{minProtein}g+</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Max Calories</label>
                  <div className="range-wrap">
                    <input
                      type="range"
                      min="100"
                      max="1200"
                      value={maxCalories}
                      onChange={(e) => setMaxCalories(parseInt(e.target.value, 10))}
                    />
                    <span>{maxCalories} cal</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Favorites</label>
                  <button
                    className={`chip ${showFavoritesOnly ? 'chip--active' : ''}`}
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  >
                    {showFavoritesOnly ? 'Showing Favorites' : 'Show Favorites'}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading-card">
                <div className="spinner"></div>
                <p>Loading menu...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <p>No items match your filters.</p>
              </div>
            ) : (
              <div className="menu-items">
                {filteredItems.map((item, index) => {
                  const flags = getDietFlags(item)
                  const isFav = favorites.has(getItemKey(selectedHall, item))
                  return (
                    <div key={`${item.name}-${index}`} className="menu-item">
                      <div className="item-header">
                        <div>
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            <span className="meta-tag">{item.category || 'N/A'}</span>
                            <span className="meta-tag">{item.serving_size || 'N/A'}</span>
                            {flags.vegan && <span className="tag tag--vegan">Vegan</span>}
                            {!flags.vegan && flags.vegetarian && <span className="tag tag--veg">Vegetarian</span>}
                          </div>
                        </div>
                        <div className="item-actions">
                          <div className="calories-badge">{item.calories || 0} cal</div>
                          <button className={`icon-btn ${isFav ? 'icon-btn--active' : ''}`} onClick={() => toggleFavorite(item)}>
                            {isFav ? '★' : '☆'}
                          </button>
                        </div>
                      </div>
                      <div className="nutrition-grid">
                        <div>
                          <span>Protein</span>
                          <strong>{item.protein || 0}g</strong>
                        </div>
                        <div>
                          <span>Carbs</span>
                          <strong>{item.total_carbohydrate || 0}g</strong>
                        </div>
                        <div>
                          <span>Fat</span>
                          <strong>{item.total_fat || 0}g</strong>
                        </div>
                        <div>
                          <span>Fiber</span>
                          <strong>{item.dietary_fiber || 0}g</strong>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-content">
          <div>
            <p className="hero-eyebrow">Project Harvest</p>
            <h1>Warm, satisfying meals made simple.</h1>
            <p className="hero-subtitle">Explore today’s dining hall menus and build a meal that fits your goals.</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => setSelectedHall(diningHalls[0] || null)}>
                Explore Menus
              </button>
              <div className="hero-stats">
                <span>{stats.hallCount} halls</span>
                <span>{stats.lastUpdated ? `Updated ${new Date(stats.lastUpdated).toLocaleDateString()}` : 'Fresh daily'}</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <h3>What’s cooking</h3>
            <p>Browse dining halls, filter for your macros, and build a cozy plate in minutes.</p>
            <div className="hero-card-tags">
              <span>Real-time menus</span>
              <span>Nutrition-first</span>
              <span>Favorites</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container container--wide">
        <section className="section">
          <div className="section-header">
            <div>
              <h2>Choose your dining hall</h2>
              <p>Pick a location to see today’s menu and detailed nutrition.</p>
            </div>
          </div>
          <div className="dining-halls-grid">
            {diningHalls.map((hall) => (
              <div key={hall} className="dining-hall-card">
                <div className="dining-hall-image" onClick={() => setSelectedHall(hall)}>
                  <img
                    src={DINING_HALL_IMAGES[hall]}
                    alt={hall}
                    onError={(e) => { e.target.onerror = null; e.target.src = `${BASE_IMAGES_URL}/Logo.png`; setImageFallbacks(prev => ({ ...prev, [hall]: true })); }}
                  />
                  <div className="image-overlay"></div>
                  {imageFallbacks[hall] && (
                    <div className="image-fallback">Fallback image</div>
                  )}
                </div>
                <div className="dining-hall-content">
                  <h3>{hall}</h3>
                  <p>{DINING_HALL_INFO[hall]}</p>
                  <div className="card-buttons">
                    <button className="btn btn-outline" onClick={() => setSelectedHall(hall)}>
                      View Menu
                    </button>
                    <button className="btn btn-primary" onClick={() => setMealBuilderHall(hall)}>
                      Build Meal
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
