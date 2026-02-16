import { execSync } from "child_process";
import { O2O_BASE_PATH } from "./constants.js";

// Route cache (expires every 5 minutes)
let routeCache: any = null;
let routeCacheTime: number = 0;
const ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get Laravel routes with caching
 */
export async function getRoutes(): Promise<any[]> {
  const now = Date.now();

  // Return cache if valid
  if (routeCache && (now - routeCacheTime) < ROUTE_CACHE_TTL) {
    return routeCache;
  }

  try {
    const output = execSync("php artisan route:list --json", {
      cwd: O2O_BASE_PATH,
      encoding: "utf-8",
      timeout: 15000,
    });

    routeCache = JSON.parse(output);
    routeCacheTime = now;

    return routeCache;
  } catch (error) {
    throw new Error(`Failed to get routes: ${error}`);
  }
}
