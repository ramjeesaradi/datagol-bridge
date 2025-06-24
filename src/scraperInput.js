export const JOB_TITLES = [
    'Financial controller',
    'Business controller',
    'Financial analyst',
    'FP&A',
    'Finance Business Partner',
    'Contrôleur de gestion',
    'Analyste Financier',
    'Financieel analist',
    'Financieel controller',
    'Accountant',
    'comptable',
    'boekhouder',
    'gestionnaire de dossiers',
    'dossierbeheerder',
];

export const LOCATIONS = [
    'Brussels',
    'Namur',
    'Charleroi',
    'Liège',
    'Mons',
    'Arlon',
];

// Number of job rows to fetch from the LinkedIn scraper. Can be overridden
// by setting the `ROWS` environment variable before running the actor.
const rowsEnv = parseInt(process.env.ROWS ?? '', 10);
export const ROWS = Number.isFinite(rowsEnv) ? rowsEnv : 10;
