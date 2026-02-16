import * as fs from "fs";
import * as path from "path";
import { O2O_BASE_PATH } from "./constants.js";

/**
 * Extract domain from controller class name
 */
export function extractDomain(controllerPath: string): string | null {
  const match = controllerPath.match(/App\\(Core|Customer|Dealer|Employer)\\/);
  return match ? match[1] : null;
}

/**
 * Make path relative to O2O base
 */
export function relativePath(absolutePath: string): string {
  return absolutePath.replace(O2O_BASE_PATH + "/", "");
}

/**
 * Count lines in a file
 */
export function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

/**
 * Extract class name from file path
 */
export function extractClassName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Relativize array of paths
 */
export function relativizeArray(arr: string[]): string[] {
  return arr.map((f) => relativePath(f));
}
