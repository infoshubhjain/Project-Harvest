import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.DEV
  ? '/api'
  : `${import.meta.env.BASE_URL}api`

const BASE_IMAGES_URL = 'https://infoshubhjain.github.io/Project-Harvest/images'

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
  'Lincoln Avenue Dining Hall (LAR)',
]

const GOALS = {
  balanced:    { label: 'Balanced',        desc: 'Even macros',    emoji: '⚖️', cfg: { p: 0.30, f: 0.30, c: 0.40 } },
  weight_loss: { label: 'High-Protein',    desc: 'Higher protein', emoji: '💪', cfg: { p: 0.40, f: 0.25, c: 0.35 } },
  bulking:     { label: 'Energy Boost',    desc: 'Higher carbs',   emoji: '🍚', cfg: { p: 0.30, f: 0.20, c: 0.50 } },
  keto:        { label: 'Low-Carb',        desc: 'High fat',       emoji: '🥑', cfg: { p: 0.25, f: 0.70, c: 0.05 } },
}

// Meal types that are served at each period
const MEAL_PERIOD_MAP = {
  Breakfast: ['Breakfast', 'Cereal', 'Waffle Bar', 'Beverages', 'Condiments'],
  Lunch:     ['Lunch', 'Deli & Bagel Bar', 'Salad Bar', 'Beverages', 'Condiments'],
  Dinner:    ['Dinner', 'Salad Bar', 'Ice Cream', 'Beverages', 'Condiments'],
}

const UPCOMING_DAYS = 5
const FAVORITES_KEY = 'ph_favorites_v1'

const MEAT_KEYWORDS = [
  'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna',
  'shrimp', 'crab', 'lobster', 'lamb', 'veal', 'bacon', 'ham',
  'sausage', 'pepperoni', 'salami', 'steak', 'burger', 'meatball',
  'wings', 'clams', 'oyster',
]
const DAIRY_EGG_KEYWORDS = [
  'milk', 'cheese', 'cream', 'yogurt', 'butter', 'egg', 'whey',
  'casein', 'honey', 'mayonnaise', 'gelato', 'custard', 'alfredo',
  'ranch', 'caesar',
]
const SWEET_KEYWORDS = [
  'cookie', 'cake', 'brownie', 'pie', 'donut', 'ice cream', 'gelato',
  'muffin', 'pudding', 'sweet', 'candy',
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
  return [...new Set(items.map(i => i.date).filter(Boolean))]
    .map(raw => ({ raw, parsed: parseMenuDate(raw) }))
    .filter(({ parsed }) => parsed && parsed >= today && parsed <= endDate)
    .sort((a, b) => a.parsed - b.parsed)
    .map(({ raw }) => raw)
}

function getSortedDates(items) {
  return [...new Set(items.map(i => i.date).filter(Boolean))]
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
  const diff = Math.round((parsed - today) / 86400000)
  if (diff === 0) return `Today — ${dateStr}`
  if (diff === 1) return `Tomorrow — ${dateStr}`
  return dateStr
}

function getDietFlags(item) {
  const name = (item.name || '').toLowerCase()
  const cat  = (item.category || '').toLowerCase()
  const hasMeat     = MEAT_KEYWORDS.some(k => name.includes(k)) || /meat|fish|poultry/.test(cat)
  const hasDairyEgg = DAIRY_EGG_KEYWORDS.some(k => name.includes(k)) || /dairy|egg/.test(cat)
  return { vegetarian: !hasMeat, vegan: !hasMeat && !hasDairyEgg }
}

function getItemKey(hall, item) {
  return `${hall}::${item.name || ''}::${item.meal_type || ''}::${item.date || ''}`
}

function getCategoryGroup(item) {
  const s = ((item.category || '') + ' ' + (item.name || '')).toLowerCase()
  if (/protein|grill|entree|main|chicken|beef|pork|fish|tofu/.test(s)) return 'protein'
  if (/grain|rice|pasta|bread|potato|noodle|tortilla|waffle|cereal/.test(s)) return 'carb'
  if (/salad|vegetable|green|produce/.test(s)) return 'veg'
  if (SWEET_KEYWORDS.some(k => s.includes(k))) return 'sweet'
  if (/beverage|drink|coffee|tea|juice/.test(s)) return 'drink'
  return 'other'
}

function clampNumber(value, min, max) {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

function getFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')) }
  catch { return new Set() }
}

function saveFavorites(set) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]))
}

// ---------------------------------------------------------------------------
// Meal Builder
// ---------------------------------------------------------------------------
function MealBuilder({ diningHall, onBack }) {
  const [calories, setCalories]         = useState('700')
  const [protein, setProtein]           = useState('40')
  const [mealPeriod, setMealPeriod]     = useState('Lunch')
  const [goal, setGoal]                 = useState('balanced')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [mealPlan, setMealPlan]         = useState(null)
  const [isVegetarian, setIsVegetarian] = useState(false)
  const [isVegan, setIsVegan]           = useState(false)
  const [availableDates, setAvailableDates] = useState([])
  const [menuItems, setMenuItems]       = useState([])

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 10) setMealPeriod('Breakfast')
    else if (h < 15) setMealPeriod('Lunch')
    else setMealPeriod('Dinner')
  }, [])

  useEffect(() => {
    async function fetchMenuData() {
      try {
        const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const res = await fetch(`${API_BASE}/${filename}.json`)
        if (!res.ok) throw new Error('Could not load menu data')
        const data = await res.json()
        const items = data.foods || []
        setMenuItems(items)
        const dates = getUpcomingDates(items).length > 0
          ? getUpcomingDates(items)
          : getSortedDates(items)
        setAvailableDates(dates)
        if (dates.length > 0) setSelectedDate(dates[0])
      } catch (e) {
        console.error('Failed to load menu data:', e)
      }
    }
    fetchMenuData()
  }, [diningHall])

  // Build a pool from all meal types that belong to the chosen period
  function buildPool(items, period, dateStr) {
    const allowedTypes = MEAL_PERIOD_MAP[period] || [period]
    return items.filter(item =>
      allowedTypes.includes(item.meal_type) &&
      (!dateStr || item.date === dateStr) &&
      item.calories > 0
    )
  }

  function filterDiet(items) {
    if (!isVegetarian && !isVegan) return items
    return items.filter(item => {
      const f = getDietFlags(item)
      return isVegan ? f.vegan : f.vegetarian
    })
  }

  function scoreCombo(combo, targetCals, targetProt, goalKey) {
    const cals  = combo.reduce((s, i) => s + (i.calories || 0), 0)
    const prot  = combo.reduce((s, i) => s + (i.protein || 0), 0)
    const fat   = combo.reduce((s, i) => s + (i.total_fat || 0), 0)
    const carbs = combo.reduce((s, i) => s + (i.total_carbohydrate || 0), 0)
    if (cals === 0) return -9999

    // Calorie closeness — hard penalize going over by more than 20%
    const calDiff = cals - targetCals
    if (calDiff > targetCals * 0.20) return -9999
    const calScore = Math.max(0, 100 - Math.abs(calDiff / targetCals) * 200)

    // Protein closeness
    const protScore = Math.max(0, 100 - Math.abs(prot - targetProt) / targetProt * 150)

    // Macro ratio alignment with goal
    const { cfg } = GOALS[goalKey] || GOALS.balanced
    const totalMacroKcal = prot * 4 + carbs * 4 + fat * 9
    const pRatio = (prot * 4) / totalMacroKcal
    const cRatio = (carbs * 4) / totalMacroKcal
    const fRatio = (fat * 9) / totalMacroKcal
    const dist = Math.sqrt((pRatio - cfg.p) ** 2 + (cRatio - cfg.c) ** 2 + (fRatio - cfg.f) ** 2)
    const macroScore = Math.max(0, 100 - dist * 180)

    // Variety bonus
    const groups = new Set(combo.map(getCategoryGroup)).size
    const varietyScore = Math.min(100, groups * 22)

    return calScore * 0.45 + protScore * 0.30 + macroScore * 0.15 + varietyScore * 0.10
  }

  function generateBest(pool, targetCals, targetProt, goalKey) {
    // Greedy + random restarts: build combos and keep the best
    const MAX_ITEMS = 6
    const RESTARTS  = 120
    let best = null
    let bestScore = -Infinity

    for (let r = 0; r < RESTARTS; r++) {
      // Start with a random item that isn't a beverage/condiment if possible
      const mains = pool.filter(i => !['drink', 'other'].includes(getCategoryGroup(i)))
      const startPool = mains.length > 0 ? mains : pool
      const seed = startPool[Math.floor(Math.random() * startPool.length)]
      const combo = [seed]
      let totalCals = seed.calories || 0

      // Greedily add items
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      for (const candidate of shuffled) {
        if (combo.length >= MAX_ITEMS) break
        if (combo.includes(candidate)) continue
        const projected = totalCals + (candidate.calories || 0)
        if (projected > targetCals * 1.20) continue
        combo.push(candidate)
        totalCals = projected
      }

      const s = scoreCombo(combo, targetCals, targetProt, goalKey)
      if (s > bestScore) {
        bestScore = s
        best = combo
      }
    }

    return { items: best || [pool[0]], score: Math.round(bestScore) }
  }

  async function generateMealPlan() {
    try {
      setLoading(true)
      setError(null)
      setMealPlan(null)

      const targetCals = clampNumber(parseInt(calories, 10) || 700, 300, 2000)
      const targetProt = clampNumber(parseInt(protein, 10) || 40, 5, 200)

      let items = menuItems
      if (!items.length) {
        const filename = diningHall.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
        const res = await fetch(`${API_BASE}/${filename}.json`)
        if (!res.ok) throw new Error('Could not load menu data')
        items = (await res.json()).foods || []
      }

      let pool = buildPool(items, mealPeriod, selectedDate)
      pool = filterDiet(pool)

      if (pool.length === 0) {
        const dietNote = isVegan ? ' (Vegan)' : isVegetarian ? ' (Vegetarian)' : ''
        throw new Error(`No ${mealPeriod} items found for ${selectedDate}${dietNote}. Try a different date or fewer dietary restrictions.`)
      }

      const { items: resultItems, score } = generateBest(pool, targetCals, targetProt, goal)

      const mapped = resultItems.map(item => ({
        name:     item.name,
        category: item.category || 'N/A',
        calories: item.calories || 0,
        protein:  item.protein || 0,
        carbs:    item.total_carbohydrate || 0,
        fat:      item.total_fat || 0,
      }))

      const totals = mapped.reduce((acc, i) => ({
        calories: acc.calories + i.calories,
        protein:  acc.protein  + i.protein,
        carbs:    acc.carbs    + i.carbs,
        fat:      acc.fat      + i.fat,
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

      const totalMacroKcal = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9

      setMealPlan({
        period: mealPeriod,
        goal:   GOALS[goal]?.label || goal,
        date:   selectedDate,
        items:  mapped,
        totals: {
          ...totals,
          protein_pct: totalMacroKcal > 0 ? Math.round(totals.protein * 4 / totalMacroKcal * 100) : 0,
          carb_pct:    totalMacroKcal > 0 ? Math.round(totals.carbs  * 4 / totalMacroKcal * 100) : 0,
          fat_pct:     totalMacroKcal > 0 ? Math.round(totals.fat    * 9 / totalMacroKcal * 100) : 0,
        },
        target_calories: targetCals,
        target_protein:  targetProt,
        meets_calories:  Math.abs(totals.calories - targetCals) <= targetCals * 0.15,
        meets_protein:   totals.protein >= targetProt * 0.85,
        quality: score >= 70 ? 'Great match' : score >= 45 ? 'Good match' : 'Closest available',
      })
    } catch (err) {
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
            <h1>Build your perfect plate.</h1>
            <p className="hero-subtitle">Set your targets and we will find the best combination from today's menu.</p>
          </div>
          <div className="hero-chip">{diningHall}</div>
        </div>
      </header>

      <main className="container container--wide">
        <button className="btn btn-ghost back-btn" onClick={onBack}>← Back to Dining Halls</button>

        <div className="builder-layout">
          {/* Controls */}
          <div className="panel panel--lifted builder-controls">
            <h2 className="panel-title">Your preferences</h2>

            <div className="form-group">
              <label>Date</label>
              <select
                className="select"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              >
                {availableDates.length === 0 && <option value="">Loading...</option>}
                {availableDates.map(d => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Meal Period</label>
              <div className="toggle-row">
                {['Breakfast', 'Lunch', 'Dinner'].map(p => (
                  <button
                    key={p}
                    className={`chip ${mealPeriod === p ? 'chip--active' : ''}`}
                    onClick={() => setMealPeriod(p)}
                  >
                    {p === 'Breakfast' ? '🌅' : p === 'Lunch' ? '☀️' : '🌙'} {p}
                  </button>
                ))}
              </div>
              <p className="hint">Includes all stations open during this period.</p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="calories">Target Calories</label>
                <input
                  id="calories"
                  type="number"
                  min="300"
                  max="2000"
                  placeholder="e.g. 700"
                  value={calories}
                  onChange={e => setCalories(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="protein">Target Protein (g)</label>
                <input
                  id="protein"
                  type="number"
                  min="5"
                  max="200"
                  placeholder="e.g. 40"
                  value={protein}
                  onChange={e => setProtein(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Nutrition Goal</label>
              <div className="goal-grid">
                {Object.entries(GOALS).map(([key, { label, desc, emoji }]) => (
                  <button
                    key={key}
                    className={`goal-btn ${goal === key ? 'goal-btn--active' : ''}`}
                    onClick={() => setGoal(key)}
                  >
                    <span className="goal-emoji">{emoji}</span>
                    <span className="goal-label">{label}</span>
                    <span className="goal-desc">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Dietary Preference</label>
              <div className="toggle-row">
                <button
                  className={`chip ${!isVegetarian && !isVegan ? 'chip--active' : ''}`}
                  onClick={() => { setIsVegetarian(false); setIsVegan(false) }}
                >
                  Any
                </button>
                <button
                  className={`chip ${isVegetarian && !isVegan ? 'chip--active' : ''}`}
                  onClick={() => { setIsVegetarian(true); setIsVegan(false) }}
                >
                  Vegetarian
                </button>
                <button
                  className={`chip ${isVegan ? 'chip--active' : ''}`}
                  onClick={() => { setIsVegan(true); setIsVegetarian(false) }}
                >
                  Vegan
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={generateMealPlan}
              disabled={loading || !selectedDate}
            >
              {loading ? 'Building your plate...' : 'Generate Meal Plan'}
            </button>
          </div>

          {/* Results */}
          <div className="builder-results">
            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            {!mealPlan && !error && (
              <div className="builder-placeholder">
                <div className="placeholder-icon">🍽️</div>
                <h3>Ready to build</h3>
                <p>Set your preferences on the left and hit Generate to get a personalized meal from today's menu.</p>
              </div>
            )}

            {mealPlan && (
              <div className="results-panel">
                <div className="results-top">
                  <div>
                    <h2 className="results-title">Your {mealPlan.period} plate</h2>
                    <p className="results-sub">{mealPlan.date} · {mealPlan.goal}</p>
                  </div>
                  <span className={`quality-badge quality-badge--${mealPlan.meets_calories ? 'good' : 'ok'}`}>
                    {mealPlan.quality}
                  </span>
                </div>

                <div className="meal-items">
                  {mealPlan.items.map((item, i) => (
                    <div key={i} className="meal-plan-item">
                      <div className="mpi-left">
                        <p className="mpi-name">{item.name}</p>
                        <span className="mpi-cat">{item.category}</span>
                      </div>
                      <div className="mpi-macros">
                        <span className="mpi-cal">{Math.round(item.calories)} cal</span>
                        <span className="mpi-macro">{Math.round(item.protein)}g P</span>
                        <span className="mpi-macro">{Math.round(item.carbs)}g C</span>
                        <span className="mpi-macro">{Math.round(item.fat)}g F</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="totals-card">
                  <div className="totals-row">
                    <div className="total-stat">
                      <span className="total-val">{Math.round(mealPlan.totals.calories)}</span>
                      <span className="total-lbl">Calories</span>
                      <span className={`total-target ${mealPlan.meets_calories ? 'target--good' : 'target--warn'}`}>
                        target {mealPlan.target_calories}
                      </span>
                    </div>
                    <div className="total-stat">
                      <span className="total-val">{Math.round(mealPlan.totals.protein)}g</span>
                      <span className="total-lbl">Protein</span>
                      <span className={`total-target ${mealPlan.meets_protein ? 'target--good' : 'target--warn'}`}>
                        target {mealPlan.target_protein}g
                      </span>
                    </div>
                    <div className="total-stat">
                      <span className="total-val">{Math.round(mealPlan.totals.carbs)}g</span>
                      <span className="total-lbl">Carbs</span>
                    </div>
                    <div className="total-stat">
                      <span className="total-val">{Math.round(mealPlan.totals.fat)}g</span>
                      <span className="total-lbl">Fat</span>
                    </div>
                  </div>

                  <div className="macro-bar-wrap">
                    <div className="macro-bar">
                      <div className="macro-seg seg-protein" style={{ width: `${mealPlan.totals.protein_pct}%` }} />
                      <div className="macro-seg seg-carbs"   style={{ width: `${mealPlan.totals.carb_pct}%` }} />
                      <div className="macro-seg seg-fat"     style={{ width: `${mealPlan.totals.fat_pct}%` }} />
                    </div>
                    <div className="macro-legend">
                      <span><span className="dot dot-protein" />Protein {mealPlan.totals.protein_pct}%</span>
                      <span><span className="dot dot-carbs"   />Carbs {mealPlan.totals.carb_pct}%</span>
                      <span><span className="dot dot-fat"     />Fat {mealPlan.totals.fat_pct}%</span>
                    </div>
                  </div>
                </div>

                <button className="btn btn-outline regen-btn" onClick={generateMealPlan} disabled={loading}>
                  Try another combination
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
function App() {
  const [diningHalls, setDiningHalls]       = useState([])
  const [selectedHall, setSelectedHall]     = useState(null)
  const [mealBuilderHall, setMealBuilderHall] = useState(null)
  const [menuItems, setMenuItems]           = useState([])
  const [filteredItems, setFilteredItems]   = useState([])
  const [availableDates, setAvailableDates] = useState([])
  const [selectedDate, setSelectedDate]     = useState('All')
  const [selectedMealType, setSelectedMealType] = useState('All')
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [imageFallbacks, setImageFallbacks] = useState({})
  const [searchQuery, setSearchQuery]       = useState('')
  const [dietFilter, setDietFilter]         = useState('any')
  const [minProtein, setMinProtein]         = useState(0)
  const [maxCalories, setMaxCalories]       = useState(1500)
  const [sortBy, setSortBy]                 = useState('recommended')
  const [favorites, setFavorites]           = useState(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [stats, setStats]                   = useState({ lastUpdated: '', hallCount: 0 })

  useEffect(() => { loadDiningHalls(); setFavorites(getFavorites()) }, [])
  useEffect(() => { if (selectedHall) loadMenu(selectedHall) }, [selectedHall])

  useEffect(() => {
    let f = menuItems
    if (selectedMealType !== 'All') f = f.filter(i => i.meal_type === selectedMealType)
    if (selectedDate !== 'All')     f = f.filter(i => i.date === selectedDate)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      f = f.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q))
    }
    f = f.filter(i => (i.protein  || 0) >= minProtein)
    f = f.filter(i => (i.calories || 0) <= maxCalories)
    if (dietFilter === 'vegetarian') f = f.filter(i => getDietFlags(i).vegetarian)
    if (dietFilter === 'vegan')      f = f.filter(i => getDietFlags(i).vegan)
    if (showFavoritesOnly)           f = f.filter(i => favorites.has(getItemKey(selectedHall, i)))
    if (sortBy === 'protein')  f = [...f].sort((a, b) => (b.protein  || 0) - (a.protein  || 0))
    if (sortBy === 'calories') f = [...f].sort((a, b) => (a.calories || 0) - (b.calories || 0))
    if (sortBy === 'name')     f = [...f].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setFilteredItems(f)
  }, [selectedMealType, selectedDate, menuItems, searchQuery, minProtein, maxCalories, dietFilter, sortBy, favorites, showFavoritesOnly, selectedHall])

  async function loadDiningHalls() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/dining-halls.json`)
      if (!res.ok) throw new Error('Failed to load dining halls')
      const data = await res.json()
      const halls = MAIN_DINING_HALLS.filter(h => (data.dining_halls || []).includes(h))
      setDiningHalls(halls.length > 0 ? halls : data.dining_halls || [])
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
      const res = await fetch(`${API_BASE}/${filename}.json`)
      if (!res.ok) throw new Error(`Failed to load menu for ${hallName}`)
      const data = await res.json()
      const foods = data.foods || []
      setMenuItems(foods)
      setFilteredItems(foods)
      const dates = getUpcomingDates(foods).length > 0 ? getUpcomingDates(foods) : getSortedDates(foods)
      setAvailableDates(dates)
      setSelectedDate(dates.length > 0 ? dates[0] : 'All')
      setSelectedMealType('All')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function getMealTypes() {
    return ['All', ...[...new Set(menuItems.map(i => i.meal_type))].sort()]
  }

  function toggleFavorite(item) {
    const key = getItemKey(selectedHall, item)
    const updated = new Set(favorites)
    updated.has(key) ? updated.delete(key) : updated.add(key)
    setFavorites(updated)
    saveFavorites(updated)
  }

  const hallStats = useMemo(() => ({
    totalItems: menuItems.length,
    mealTypes:  new Set(menuItems.map(i => i.meal_type)).size,
    dates:      new Set(menuItems.map(i => i.date)).size,
  }), [menuItems])

  if (mealBuilderHall) {
    return <MealBuilder diningHall={mealBuilderHall} onBack={() => setMealBuilderHall(null)} />
  }

  if (loading && diningHalls.length === 0) {
    return (
      <div className="page">
        <header className="hero hero--compact">
          <div className="hero-content">
            <div>
              <p className="hero-eyebrow">Project Harvest</p>
              <h1>Loading menus...</h1>
            </div>
          </div>
        </header>
        <main className="container">
          <div className="loading-card"><div className="spinner" /><p>Fetching dining hall data...</p></div>
        </main>
      </div>
    )
  }

  if (error && diningHalls.length === 0) {
    return (
      <div className="page">
        <header className="hero hero--compact">
          <div className="hero-content"><div><p className="hero-eyebrow">Project Harvest</p><h1>We hit a snag.</h1></div></div>
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
              <p className="hero-subtitle">Browse today's full menu with nutrition details.</p>
            </div>
            <div className="hero-chip">{hallStats.totalItems} items</div>
          </div>
        </header>

        <main className="container container--wide">
          <div className="toolbar">
            <button className="btn btn-ghost" onClick={() => setSelectedHall(null)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setMealBuilderHall(selectedHall)}>Build My Meal</button>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Menu explorer</h2>
                <p className="muted">{filteredItems.length} items shown · {hallStats.dates} days · {hallStats.mealTypes} stations</p>
              </div>
            </div>

            <div className="filter-bar">
              <div className="form-group filter-search">
                <label>Search</label>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Date</label>
                <select className="select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                  <option value="All">All Dates</option>
                  {availableDates.map(d => (
                    <option key={d} value={d}>{formatDateLabel(d)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Station</label>
                <select className="select" value={selectedMealType} onChange={e => setSelectedMealType(e.target.value)}>
                  {getMealTypes().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Diet</label>
                <select className="select" value={dietFilter} onChange={e => setDietFilter(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                </select>
              </div>
              <div className="form-group">
                <label>Sort</label>
                <select className="select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="recommended">Default</option>
                  <option value="protein">Most protein</option>
                  <option value="calories">Fewest calories</option>
                  <option value="name">Name A–Z</option>
                </select>
              </div>
            </div>

            <div className="filter-bar filter-bar--secondary">
              <div className="form-group range-group">
                <label>Min Protein: <strong>{minProtein}g+</strong></label>
                <input type="range" min="0" max="40" value={minProtein} onChange={e => setMinProtein(+e.target.value)} />
              </div>
              <div className="form-group range-group">
                <label>Max Calories: <strong>{maxCalories} cal</strong></label>
                <input type="range" min="100" max="1500" step="50" value={maxCalories} onChange={e => setMaxCalories(+e.target.value)} />
              </div>
              <div className="form-group">
                <label>Favorites</label>
                <button
                  className={`chip ${showFavoritesOnly ? 'chip--active' : ''}`}
                  onClick={() => setShowFavoritesOnly(v => !v)}
                >
                  {showFavoritesOnly ? '★ Showing favorites' : '☆ Show favorites'}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-card"><div className="spinner" /><p>Loading menu...</p></div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <p>No items match your filters.</p>
                <button className="btn btn-ghost" onClick={() => { setSearchQuery(''); setMinProtein(0); setMaxCalories(1500); setDietFilter('any'); setShowFavoritesOnly(false) }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="menu-items">
                {filteredItems.map((item, idx) => {
                  const flags = getDietFlags(item)
                  const isFav = favorites.has(getItemKey(selectedHall, item))
                  return (
                    <div key={`${item.name}-${idx}`} className="menu-item">
                      <div className="item-header">
                        <div className="item-header-left">
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">
                            <span className="meta-tag">{item.category || 'N/A'}</span>
                            {item.serving_size && <span className="meta-tag">{item.serving_size}</span>}
                            {flags.vegan       && <span className="tag tag--vegan">Vegan</span>}
                            {!flags.vegan && flags.vegetarian && <span className="tag tag--veg">Vegetarian</span>}
                          </div>
                        </div>
                        <div className="item-actions">
                          <span className="calories-badge">{item.calories || 0} cal</span>
                          <button
                            className={`icon-btn ${isFav ? 'icon-btn--active' : ''}`}
                            onClick={() => toggleFavorite(item)}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {isFav ? '★' : '☆'}
                          </button>
                        </div>
                      </div>
                      <div className="nutrition-grid">
                        <div><span>Protein</span><strong>{item.protein || 0}g</strong></div>
                        <div><span>Carbs</span><strong>{item.total_carbohydrate || 0}g</strong></div>
                        <div><span>Fat</span><strong>{item.total_fat || 0}g</strong></div>
                        <div><span>Fiber</span><strong>{item.dietary_fiber || 0}g</strong></div>
                        <div><span>Sodium</span><strong>{item.sodium || 0}mg</strong></div>
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
            <h1>Eat well, every day.</h1>
            <p className="hero-subtitle">Browse real-time dining hall menus and build a meal that fits your nutrition goals.</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => setSelectedHall(diningHalls[0] || null)}>
                Explore Menus
              </button>
              <div className="hero-stats">
                <span>{stats.hallCount} dining halls</span>
                <span>{stats.lastUpdated ? `Updated ${new Date(stats.lastUpdated).toLocaleDateString()}` : 'Updated daily'}</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <h3>What's inside</h3>
            <p>Live menus, full nutrition data, and a meal builder that matches your calorie and macro targets.</p>
            <div className="hero-card-tags">
              <span>Daily menus</span>
              <span>Macro tracking</span>
              <span>Diet filters</span>
              <span>Favorites</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container container--wide">
        <section className="section">
          <div className="section-header">
            <h2>Choose a dining hall</h2>
            <p>Select a location to browse today's menu and nutrition info.</p>
          </div>
          <div className="dining-halls-grid">
            {diningHalls.map(hall => (
              <div key={hall} className="dining-hall-card">
                <div className="dining-hall-image" onClick={() => setSelectedHall(hall)}>
                  <img
                    src={DINING_HALL_IMAGES[hall]}
                    alt={hall}
                    onError={e => { e.target.onerror = null; e.target.src = `${BASE_IMAGES_URL}/Logo.png`; setImageFallbacks(p => ({ ...p, [hall]: true })) }}
                  />
                  <div className="image-overlay" />
                </div>
                <div className="dining-hall-content">
                  <h3>{hall}</h3>
                  <p>{DINING_HALL_INFO[hall]}</p>
                  <div className="card-buttons">
                    <button className="btn btn-outline" onClick={() => setSelectedHall(hall)}>View Menu</button>
                    <button className="btn btn-primary" onClick={() => setMealBuilderHall(hall)}>Build Meal</button>
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
