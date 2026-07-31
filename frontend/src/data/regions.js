// Phase 1 note (per the prompt): this is a deliberately simple starter list,
// not an exhaustive ISO country/state database — swap in a package like
// `country-state-city` later, or auto-geolocate, once region actually
// matters for gameplay (Phase 5's regional leaderboard).
//
// User.region is stored as a single free-text string (e.g. "Punjab, India"
// or just "France" if no state list exists for that country). Countries
// without an entry in STATES_BY_COUNTRY fall back to a free-text
// "state/province (optional)" input on the Profile page.

export const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Ireland',
  'Sweden',
  'Norway',
  'Denmark',
  'Switzerland',
  'Japan',
  'South Korea',
  'Singapore',
  'New Zealand',
  'Brazil',
  'Mexico',
  'South Africa',
  'United Arab Emirates',
  'Other',
]

export const STATES_BY_COUNTRY = {
  India: [
    'Andhra Pradesh',
    'Bihar',
    'Delhi',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Karnataka',
    'Kerala',
    'Maharashtra',
    'Punjab',
    'Rajasthan',
    'Tamil Nadu',
    'Telangana',
    'Uttar Pradesh',
    'West Bengal',
  ],
  'United States': [
    'California',
    'Texas',
    'New York',
    'Florida',
    'Illinois',
    'Washington',
    'Massachusetts',
    'Colorado',
    'Georgia',
    'Pennsylvania',
  ],
}
