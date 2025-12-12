const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'nutrition_data.db');
const outputDir = path.join(__dirname, '..', 'docs', 'api');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

console.log('Exporting database to JSON files...');

// Export dining halls list
db.all('SELECT DISTINCT dining_hall FROM nutrition_data ORDER BY dining_hall', [], (err, rows) => {
    if (err) {
        console.error('Error fetching dining halls:', err);
        return;
    }

    const halls = rows.map(row => row.dining_hall);
    fs.writeFileSync(
        path.join(outputDir, 'dining-halls.json'),
        JSON.stringify({ dining_halls: halls, count: halls.length }, null, 2)
    );
    console.log(`✓ Exported ${halls.length} dining halls`);

    // Export foods for each dining hall
    halls.forEach(hall => {
        const filename = hall.replace(/[^a-z0-9]/gi, '-').toLowerCase();

        db.all(
            `SELECT DISTINCT
                name, category, serving_size, calories, protein,
                total_fat, total_carbohydrate, dietary_fiber, sugars, sodium,
                meal_type, date
             FROM nutrition_data
             WHERE dining_hall = ?
             ORDER BY meal_type, category, name`,
            [hall],
            (err, foods) => {
                if (err) {
                    console.error(`Error fetching foods for ${hall}:`, err);
                    return;
                }

                const output = {
                    dining_hall: hall,
                    foods: foods,
                    count: foods.length,
                    last_updated: new Date().toISOString()
                };

                fs.writeFileSync(
                    path.join(outputDir, `${filename}.json`),
                    JSON.stringify(output, null, 2)
                );
                console.log(`✓ Exported ${foods.length} foods for ${hall}`);
            }
        );
    });
});

// Export all available meal types and dates
db.all('SELECT DISTINCT meal_type, date FROM nutrition_data ORDER BY date DESC, meal_type', [], (err, rows) => {
    if (err) {
        console.error('Error fetching meal types:', err);
        return;
    }

    fs.writeFileSync(
        path.join(outputDir, 'available-meals.json'),
        JSON.stringify({ meals: rows, count: rows.length }, null, 2)
    );
    console.log(`✓ Exported ${rows.length} available meal times`);
});

// Close database connection after a delay to allow all queries to complete
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('\n✅ All data exported successfully!');
            console.log(`📁 JSON files saved to: ${outputDir}`);
            console.log('\nYour API endpoints will be:');
            console.log('  https://infoshubhjain.github.io/Project-Harvest/api/dining-halls.json');
            console.log('  https://infoshubhjain.github.io/Project-Harvest/api/[hall-name].json');
        }
    });
}, 3000);
