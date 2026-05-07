// auth.js — file-based user authentication for local development only.
// In production the frontend is fully static; this module is never deployed.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Flat JSON file used as the user store (gitignored).
const DB_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure the data directory and users.json exist before any other operation.
function initializeDatabase() {
    const dataDir = path.join(__dirname, 'data');

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
        console.log('Created users database file');
    }
}

// Read the full users array from disk. Returns [] on any read/parse error.
function readUsers() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data).users;
    } catch (err) {
        console.error('Error reading users:', err);
        return [];
    }
}

// Persist the updated users array to disk. Returns false on write error.
function writeUsers(users) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users }, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing users:', err);
        return false;
    }
}

// Hash a plaintext password with a random salt using PBKDF2-SHA512.
// Returns a "salt:hash" string that is safe to store in users.json.
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

// Verify a plaintext password against a stored "salt:hash" string.
function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// Register a new user. Calls back with an error if the email is already taken.
function registerUser(email, password, callback) {
    const users = readUsers();

    if (users.find(u => u.email === email)) {
        return callback({ error: 'Email already exists' }, null);
    }

    // Use max(existing IDs) + 1 so IDs never collide even after deletions.
    const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        email: email,
        password_hash: hashPassword(password),
        created_at: new Date().toISOString(),
        goal: null,
        age: null,
        sex: null,
        calories: null,
        dietary_restrictions: [],
        notifications_enabled: true,
        favorites: []
    };

    users.push(newUser);

    if (writeUsers(users)) {
        callback(null, {
            id: newUser.id,
            email: newUser.email,
            message: 'User registered successfully'
        });
    } else {
        callback({ error: 'Failed to save user' }, null);
    }
}

// Authenticate a user. Returns a sanitized profile (no password_hash) on success.
function loginUser(email, password, callback) {
    const users = readUsers();
    const user = users.find(u => u.email === email);

    // Return the same generic error for both "not found" and "wrong password"
    // to avoid leaking which emails are registered.
    if (!user) {
        return callback({ error: 'Invalid email or password' }, null);
    }

    if (!verifyPassword(password, user.password_hash)) {
        return callback({ error: 'Invalid email or password' }, null);
    }

    callback(null, {
        id: user.id,
        email: user.email,
        goal: user.goal,
        age: user.age,
        sex: user.sex,
        calories: user.calories,
        message: 'Login successful'
    });
}

// Patch only the fields present in profileData; leave everything else untouched.
function updateUserProfile(userId, profileData, callback) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return callback({ error: 'User not found' }, null);
    }

    const { goal, age, sex, calories, dietary_restrictions, notifications_enabled } = profileData;
    if (goal !== undefined) users[userIndex].goal = goal;
    if (age !== undefined) users[userIndex].age = age;
    if (sex !== undefined) users[userIndex].sex = sex;
    if (calories !== undefined) users[userIndex].calories = calories;
    if (dietary_restrictions !== undefined) users[userIndex].dietary_restrictions = dietary_restrictions;
    if (notifications_enabled !== undefined) users[userIndex].notifications_enabled = notifications_enabled;
    users[userIndex].updated_at = new Date().toISOString();

    if (writeUsers(users)) {
        callback(null, {
            message: 'Profile updated successfully',
            user: {
                id: users[userIndex].id,
                email: users[userIndex].email,
                goal: users[userIndex].goal,
                age: users[userIndex].age,
                sex: users[userIndex].sex,
                calories: users[userIndex].calories,
                dietary_restrictions: users[userIndex].dietary_restrictions,
                notifications_enabled: users[userIndex].notifications_enabled
            }
        });
    } else {
        callback({ error: 'Failed to update profile' }, null);
    }
}

// Retrieve a user's full profile (excluding password_hash).
function getUserProfile(userId, callback) {
    const users = readUsers();
    const user = users.find(u => u.id === userId);

    if (!user) {
        return callback({ error: 'User not found' }, null);
    }

    callback(null, {
        id: user.id,
        email: user.email,
        goal: user.goal,
        age: user.age,
        sex: user.sex,
        calories: user.calories,
        // Guard against older user records that predate these fields.
        dietary_restrictions: user.dietary_restrictions || [],
        notifications_enabled: user.notifications_enabled !== undefined ? user.notifications_enabled : true,
        favorites: user.favorites || [],
        created_at: user.created_at
    });
}

// Verify the old password before accepting the new one.
function changePassword(userId, oldPassword, newPassword, callback) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return callback({ error: 'User not found' }, null);
    }

    if (!verifyPassword(oldPassword, users[userIndex].password_hash)) {
        return callback({ error: 'Current password is incorrect' }, null);
    }

    users[userIndex].password_hash = hashPassword(newPassword);
    users[userIndex].updated_at = new Date().toISOString();

    if (writeUsers(users)) {
        callback(null, { message: 'Password changed successfully' });
    } else {
        callback({ error: 'Failed to change password' }, null);
    }
}

// Append a food item object to the user's favorites list.
function addFavorite(userId, foodItem, callback) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return callback({ error: 'User not found' }, null);
    }

    // Guard for old records that may not have the favorites field.
    if (!users[userIndex].favorites) {
        users[userIndex].favorites = [];
    }

    users[userIndex].favorites.push(foodItem);
    users[userIndex].updated_at = new Date().toISOString();

    if (writeUsers(users)) {
        callback(null, { message: 'Added to favorites', favorites: users[userIndex].favorites });
    } else {
        callback({ error: 'Failed to add favorite' }, null);
    }
}

// Remove a favorite by its array index (caller must pass the correct index).
function removeFavorite(userId, foodItemIndex, callback) {
    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return callback({ error: 'User not found' }, null);
    }

    if (!users[userIndex].favorites || users[userIndex].favorites.length === 0) {
        return callback({ error: 'No favorites to remove' }, null);
    }

    users[userIndex].favorites.splice(foodItemIndex, 1);
    users[userIndex].updated_at = new Date().toISOString();

    if (writeUsers(users)) {
        callback(null, { message: 'Removed from favorites', favorites: users[userIndex].favorites });
    } else {
        callback({ error: 'Failed to remove favorite' }, null);
    }
}

// Bootstrap the data directory and JSON file when this module is first required.
initializeDatabase();

module.exports = {
    registerUser,
    loginUser,
    updateUserProfile,
    getUserProfile,
    changePassword,
    addFavorite,
    removeFavorite
};
