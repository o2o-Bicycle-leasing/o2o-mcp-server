import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";
import { execSync } from "child_process";
import { O2O_BASE_PATH, VALID_DOMAINS } from "../utils/constants.js";
import { relativizeArray } from "../utils/helpers.js";

/**
 * Tool definitions for domain-related queries
 */
export const domainTools = [
  {
    name: "query_domain_structure",
    description: "Query the Laravel domain structure to get all files organized by type (controllers, repositories, transformers, etc.). Domains: Core, Customer, Dealer, Employer",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Domain name (Core, Customer, Dealer, or Employer)",
          enum: VALID_DOMAINS,
        },
      },
      required: ["domain"],
    },
  },
  {
    name: "find_related_files",
    description: "Find all related files for a given entity (e.g., 'Contract', 'Invoice'). Returns controllers, repositories, transformers, models, validation requests, and tests.",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: {
          type: "string",
          description: "Entity name to search for (e.g., 'Contract', 'Invoice', 'Order')",
        },
        domain: {
          type: "string",
          description: "Optional: Limit search to specific domain",
          enum: VALID_DOMAINS,
        },
      },
      required: ["entity_name"],
    },
  },
  {
    name: "query_database_schema",
    description: "Query the Laravel database schema for a specific table. Returns column names, types, nullable status, and defaults.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Database table name (e.g., 'employer_contracts', 'users')",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "run_phpstan",
    description: "Run PHPStan static analysis on a file or directory. Use this before committing code to catch errors early.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from project root to analyze (e.g., 'app/Employer/Controllers')",
        },
      },
      required: ["path"],
    },
  },
];

/**
 * Query domain structure - get all files organized by type
 */
export async function queryDomainStructure(args: { domain: string }) {
  const { domain } = args;

  if (!VALID_DOMAINS.includes(domain as any)) {
    throw new Error(
      `Invalid domain '${domain}'. Valid domains: ${VALID_DOMAINS.join(", ")}`
    );
  }

  const domainPath = path.join(O2O_BASE_PATH, "app", domain);

  if (!fs.existsSync(domainPath)) {
    throw new Error(`Domain path not found: ${domainPath}`);
  }

  // Search for all PHP files in the domain
  const files = globSync(`${domainPath}/**/*.php`, {
    ignore: ["**/vendor/**", "**/node_modules/**"],
  });

  // Categorize files by type
  const structure = {
    domain,
    path: domainPath,
    total_files: files.length,
    files: {
      controllers: files.filter((f) => f.includes("Controller")),
      repositories: files.filter(
        (f) => f.includes("Repository") && !f.includes("Interface")
      ),
      repository_interfaces: files.filter(
        (f) => f.includes("Repository") && f.includes("Interface")
      ),
      transformers: files.filter((f) => f.includes("Transformer")),
      requests: files.filter((f) => f.includes("Request")),
      models: files.filter((f) => f.includes("/Models/")),
      entities: files.filter((f) => f.includes("/Entities/")),
      services: files.filter((f) => f.includes("Service")),
      exceptions: files.filter((f) => f.includes("Exception")),
    },
  };

  const relativeStructure = {
    ...structure,
    files: {
      controllers: relativizeArray(structure.files.controllers),
      repositories: relativizeArray(structure.files.repositories),
      repository_interfaces: relativizeArray(structure.files.repository_interfaces),
      transformers: relativizeArray(structure.files.transformers),
      requests: relativizeArray(structure.files.requests),
      models: relativizeArray(structure.files.models),
      entities: relativizeArray(structure.files.entities),
      services: relativizeArray(structure.files.services),
      exceptions: relativizeArray(structure.files.exceptions),
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(relativeStructure, null, 2),
      },
    ],
  };
}

/**
 * Find related files for an entity
 */
export async function findRelatedFiles(args: { entity_name: string; domain?: string }) {
  const { entity_name, domain } = args;

  const searchPath = domain
    ? path.join(O2O_BASE_PATH, "app", domain)
    : path.join(O2O_BASE_PATH, "app");

  if (!fs.existsSync(searchPath)) {
    throw new Error(`Search path not found: ${searchPath}`);
  }

  // Search for files matching the entity name
  const pattern = `**/*${entity_name}*.php`;
  const files = globSync(pattern, {
    cwd: searchPath,
    absolute: true,
    ignore: ["**/vendor/**", "**/node_modules/**"],
  });

  // Also search for test files
  const testPattern = `**/*${entity_name}*Test.php`;
  const testFiles = globSync(testPattern, {
    cwd: path.join(O2O_BASE_PATH, "tests"),
    absolute: true,
  });

  // Categorize related files
  const related = {
    entity_name,
    search_domain: domain || "all domains",
    total_files: files.length + testFiles.length,
    files: {
      controllers: files.filter((f) => f.includes("Controller")),
      repositories: files.filter(
        (f) => f.includes("Repository") && !f.includes("Interface")
      ),
      repository_interfaces: files.filter(
        (f) => f.includes("Repository") && f.includes("Interface")
      ),
      transformers: files.filter((f) => f.includes("Transformer")),
      models: files.filter((f) => f.includes("/Models/")),
      entities: files.filter((f) => f.includes("/Entities/")),
      requests: files.filter((f) => f.includes("Request")),
      services: files.filter((f) => f.includes("Service")),
      tests: testFiles,
    },
  };

  const relativeRelated = {
    ...related,
    files: {
      controllers: relativizeArray(related.files.controllers),
      repositories: relativizeArray(related.files.repositories),
      repository_interfaces: relativizeArray(related.files.repository_interfaces),
      transformers: relativizeArray(related.files.transformers),
      models: relativizeArray(related.files.models),
      entities: relativizeArray(related.files.entities),
      requests: relativizeArray(related.files.requests),
      services: relativizeArray(related.files.services),
      tests: relativizeArray(related.files.tests),
    },
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(relativeRelated, null, 2),
      },
    ],
  };
}

/**
 * Query database schema for a table
 */
export async function queryDatabaseSchema(args: { table_name: string }) {
  const { table_name } = args;

  try {
    // Use Laravel's schema inspection via artisan tinker
    const command = `php artisan tinker --execute="echo json_encode(DB::select('DESCRIBE ${table_name}'));"`;

    const output = execSync(command, {
      cwd: O2O_BASE_PATH,
      encoding: "utf-8",
      timeout: 10000,
    });

    // Parse the output
    const schema = JSON.parse(output.trim());

    const formattedSchema = {
      table: table_name,
      columns: schema.map((col: any) => ({
        name: col.Field,
        type: col.Type,
        nullable: col.Null === "YES",
        key: col.Key,
        default: col.Default,
        extra: col.Extra,
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(formattedSchema, null, 2),
        },
      ],
    };
  } catch (error) {
    // If MySQL describe fails, try reading migrations
    const migrationPattern = `**/*_create_${table_name}_table.php`;
    const migrations = globSync(migrationPattern, {
      cwd: path.join(O2O_BASE_PATH, "database/migrations"),
      absolute: true,
    });

    if (migrations.length > 0) {
      const migrationContent = fs.readFileSync(migrations[0], "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `Could not query database directly. Found migration file:\n\n${migrationContent}`,
          },
        ],
      };
    }

    throw new Error(
      `Could not retrieve schema for table '${table_name}'. Error: ${error}`
    );
  }
}

/**
 * Run PHPStan static analysis
 */
export async function runPhpstan(args: { path: string }) {
  const { path: targetPath } = args;

  const fullPath = path.join(O2O_BASE_PATH, targetPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Path not found: ${targetPath}`);
  }

  try {
    const output = execSync(`./vendor/bin/phpstan analyse ${targetPath}`, {
      cwd: O2O_BASE_PATH,
      encoding: "utf-8",
      timeout: 30000,
    });

    return {
      content: [
        {
          type: "text",
          text: `PHPStan analysis for ${targetPath}:\n\n${output}`,
        },
      ],
    };
  } catch (error: any) {
    // PHPStan exits with non-zero code when it finds errors
    // But we still want to see the output
    const output = error.stdout || error.message || String(error);

    return {
      content: [
        {
          type: "text",
          text: `PHPStan analysis for ${targetPath}:\n\n${output}`,
        },
      ],
    };
  }
}
