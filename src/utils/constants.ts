// Base path to the O2O Laravel application
// Configure this path via environment variable or update it to your local path
export const O2O_BASE_PATH = process.env.O2O_BASE_PATH || "/path/to/your/o2o-apps";

// Valid domains in the O2O application
export const VALID_DOMAINS = ["Core", "Customer", "Dealer", "Employer"] as const;

export type Domain = typeof VALID_DOMAINS[number];
