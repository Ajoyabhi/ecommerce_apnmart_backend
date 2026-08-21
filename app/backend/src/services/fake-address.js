/**
 * Fake (random) Indian address generator — FOR TESTING ONLY.
 *
 * When enabled (env INVOICE_FAKE_ADDRESS=true), invoice generation replaces the
 * real buyer address with a totally random one:
 *   1. Pick a random real Indian PIN code from a curated pool.
 *   2. Resolve District + State from the free postalpincode.in API
 *      (https://api.postalpincode.in/pincode/<PIN>), falling back to the pool's
 *      embedded district/state if the API is unreachable.
 *   3. Generate a random house number, street, area and landmark.
 *
 * This is intentionally gated behind an env flag so it can NEVER silently affect
 * real production invoices.
 */

const logger = require('../utils/logger');

// ── Enable flag ──────────────────────────────────────────────────────────────
function isFakeAddressEnabled() {
    const v = String(process.env.INVOICE_FAKE_ADDRESS || '').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

// ── Curated pool of real Indian PIN codes (with fallback district/state) ──────
// Spread across states so the generated "Supply Type" (interstate/intrastate)
// on the invoice also varies. If the API is up, District/State come from it and
// override these; if it is down, these are used as-is.
const PINCODE_POOL = [
    { pincode: '110001', district: 'Central Delhi', state: 'Delhi' },
    { pincode: '400001', district: 'Mumbai', state: 'Maharashtra' },
    { pincode: '411001', district: 'Pune', state: 'Maharashtra' },
    { pincode: '560001', district: 'Bengaluru', state: 'Karnataka' },
    { pincode: '600001', district: 'Chennai', state: 'Tamil Nadu' },
    { pincode: '700001', district: 'Kolkata', state: 'West Bengal' },
    { pincode: '500001', district: 'Hyderabad', state: 'Telangana' },
    { pincode: '380001', district: 'Ahmedabad', state: 'Gujarat' },
    { pincode: '302001', district: 'Jaipur', state: 'Rajasthan' },
    { pincode: '226001', district: 'Lucknow', state: 'Uttar Pradesh' },
    { pincode: '201301', district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh' },
    { pincode: '208001', district: 'Kanpur Nagar', state: 'Uttar Pradesh' },
    { pincode: '800001', district: 'Patna', state: 'Bihar' },
    { pincode: '462001', district: 'Bhopal', state: 'Madhya Pradesh' },
    { pincode: '452001', district: 'Indore', state: 'Madhya Pradesh' },
    { pincode: '160017', district: 'Chandigarh', state: 'Chandigarh' },
    { pincode: '141001', district: 'Ludhiana', state: 'Punjab' },
    { pincode: '682001', district: 'Ernakulam', state: 'Kerala' },
    { pincode: '751001', district: 'Khordha', state: 'Odisha' },
    { pincode: '781001', district: 'Kamrup', state: 'Assam' },
    { pincode: '248001', district: 'Dehradun', state: 'Uttarakhand' },
    { pincode: '834001', district: 'Ranchi', state: 'Jharkhand' },
    { pincode: '492001', district: 'Raipur', state: 'Chhattisgarh' },
    { pincode: '530001', district: 'Visakhapatnam', state: 'Andhra Pradesh' },
    { pincode: '403001', district: 'North Goa', state: 'Goa' },
];

// ── Random content pools ──────────────────────────────────────────────────────
const FIRST_NAMES = [
    'Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Rahul', 'Amit', 'Vikram',
    'Priya', 'Sneha', 'Neha', 'Ananya', 'Riya', 'Kavya', 'Pooja', 'Meera',
];
const LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Singh', 'Patel', 'Reddy', 'Nair', 'Iyer',
    'Das', 'Mehta', 'Kapoor', 'Menon', 'Joshi', 'Rao', 'Chopra', 'Bose',
];
const STREET_NAMES = [
    'MG Road', 'Gandhi Nagar', 'Nehru Street', 'Station Road', 'Park Avenue',
    'Ring Road', 'Church Street', 'Subhash Marg', 'Rajaji Road', 'Bazaar Street',
    'Green Park', 'Model Town', 'Civil Lines', 'Shivaji Nagar', 'Ashok Vihar',
];
const AREA_NAMES = [
    'Sector 12', 'Phase 2', 'Block C', 'Old Town', 'New Colony', 'East Extension',
    'West End', 'North Enclave', 'Sunrise Society', 'Lake View', 'Palm Residency',
];
const LANDMARKS = [
    'Near City Mall', 'Opposite SBI Bank', 'Behind Bus Stand', 'Near Metro Station',
    'Next to Apollo Pharmacy', 'Above Reliance Fresh', 'Near Water Tank',
    'Opposite Govt. School', 'Beside Hanuman Mandir', 'Near D-Mart',
];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function randomPhone() {
    // Indian mobile: starts 6-9, 10 digits total.
    return String(randInt(6, 9)) + String(randInt(0, 999999999)).padStart(9, '0');
}

/**
 * Look up District/State for a PIN from api.postalpincode.in.
 * Returns { district, state, area } or null on any failure/timeout.
 */
async function fetchPincodeInfo(pincode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const entry = Array.isArray(json) ? json[0] : null;
        if (!entry || entry.Status !== 'Success' || !Array.isArray(entry.PostOffice) || !entry.PostOffice.length) {
            return null;
        }
        const po = rand(entry.PostOffice);
        const clean = (s) => (typeof s === 'string' ? s.trim() : null) || null;
        return {
            district: clean(po.District),
            state: clean(po.State),
            area: clean(po.Name) || clean(po.Block),
        };
    } catch (err) {
        // Network error / timeout / abort — caller falls back to embedded data.
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Build a totally random Indian shipping address in the shape the invoice
 * generator expects: { fullName, phone, addressLine1, addressLine2, city,
 * state, pincode, country }.
 */
async function buildFakeShippingAddress() {
    const pick = rand(PINCODE_POOL);

    // Resolve district/state from the API; fall back to the pool's embedded data.
    const info = await fetchPincodeInfo(pick.pincode);
    const district = (info && info.district) || pick.district;
    const state = (info && info.state) || pick.state;
    const area = (info && info.area) || rand(AREA_NAMES);

    const fullName = `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
    const houseNo = randInt(1, 499);
    const flat = Math.random() < 0.5 ? `Flat ${randInt(1, 40)}, ` : '';

    logger.info(`[FAKE-ADDRESS] Generated test address: ${pick.pincode} → ${district}, ${state} (API: ${info ? 'yes' : 'fallback'})`);

    return {
        fullName,
        phone: randomPhone(),
        addressLine1: `${flat}${houseNo}, ${rand(STREET_NAMES)}`,
        addressLine2: `${area}, ${rand(LANDMARKS)}`,
        city: district,
        state,
        pincode: pick.pincode,
        country: 'India',
    };
}

module.exports = {
    isFakeAddressEnabled,
    buildFakeShippingAddress,
    fetchPincodeInfo,
};
