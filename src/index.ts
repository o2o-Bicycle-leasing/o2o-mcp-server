#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";

// Base path to the O2O Laravel application
// Configure this path via environment variable or update it to your local path
const O2O_BASE_PATH = process.env.O2O_BASE_PATH || "/path/to/your/o2o-apps";

// Valid domains in the O2O application
const VALID_DOMAINS = ["Core", "Customer", "Dealer", "Employer"];

// Route cache (expires every 5 minutes)
let routeCache: any = null;
let routeCacheTime: number = 0;
const ROUTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * MCP Server for O2O Laravel Bike Leasing Application
 *
 * Provides tools to query domain structure, find related files,
 * query database schema, and run code quality checks.
 */
class O2OLaravelServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "o2o-laravel-analyzer",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // EXISTING TOOLS
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
        // PHASE 1: Route Discovery
        {
          name: "find_route_by_name",
          description: "Find a Laravel route by its name (e.g., 'fleet.orders.index')",
          inputSchema: {
            type: "object",
            properties: {
              route_name: {
                type: "string",
                description: "Route name to search for",
              },
            },
            required: ["route_name"],
          },
        },
        {
          name: "find_routes_for_controller",
          description: "List all routes handled by a specific controller",
          inputSchema: {
            type: "object",
            properties: {
              controller_name: {
                type: "string",
                description: "Controller name (e.g., 'OrderController')",
              },
              domain: {
                type: "string",
                description: "Optional: Limit to specific domain",
                enum: VALID_DOMAINS,
              },
            },
            required: ["controller_name"],
          },
        },
        {
          name: "list_all_routes",
          description: "List all routes with optional filtering by domain, HTTP method, middleware, or URI prefix",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Filter by domain",
                enum: VALID_DOMAINS,
              },
              method: {
                type: "string",
                description: "Filter by HTTP method",
                enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
              },
              middleware: {
                type: "string",
                description: "Filter by middleware (e.g., 'auth', 'dealer')",
              },
              prefix: {
                type: "string",
                description: "Filter by URI prefix (e.g., '/async')",
              },
            },
          },
        },
        {
          name: "find_service_chain",
          description: "Map the full service chain for an entity: Route → Controller → Repository → Model. Shows the complete data flow.",
          inputSchema: {
            type: "object",
            properties: {
              entity_name: {
                type: "string",
                description: "Entity name (e.g., 'Order', 'Contract', 'Invoice')",
              },
              domain: {
                type: "string",
                description: "Optional: Limit to specific domain",
                enum: VALID_DOMAINS,
              },
            },
            required: ["entity_name"],
          },
        },
        // PHASE 1: Test Coverage Helper
        {
          name: "find_tests_for_file",
          description: "Find all related test files (Unit, Feature, Cypress) for a given source file",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "Relative path to source file (e.g., 'app/Employer/Infrastructure/Order/Controllers/OrderController.php')",
              },
            },
            required: ["file_path"],
          },
        },
        {
          name: "find_untested_files",
          description: "Identify files without test coverage in a domain",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Domain to check",
                enum: VALID_DOMAINS,
              },
              file_type: {
                type: "string",
                description: "Optional: Filter by file type",
                enum: ["controller", "repository", "model", "service"],
              },
            },
            required: ["domain"],
          },
        },
        {
          name: "get_test_structure_info",
          description: "Get information about test organization, base classes, and available test utilities",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        // PHASE 2: Component Usage Finder
        {
          name: "find_component_usage",
          description: "Find where a Vue component is imported and used throughout the codebase",
          inputSchema: {
            type: "object",
            properties: {
              component_name: {
                type: "string",
                description: "Component name (e.g., 'Button', 'OrderDetail')",
              },
              domain: {
                type: "string",
                description: "Optional: Limit search to specific domain",
                enum: VALID_DOMAINS,
              },
            },
            required: ["component_name"],
          },
        },
        {
          name: "find_unused_components",
          description: "Identify Vue components that are not being used anywhere",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Optional: Limit search to specific domain",
                enum: VALID_DOMAINS,
              },
            },
          },
        },
        // PHASE 2: Inertia Page Finder
        {
          name: "list_inertia_pages",
          description: "List all Inertia.js pages in the application",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Optional: Filter by domain",
                enum: VALID_DOMAINS,
              },
            },
          },
        },
        {
          name: "find_page_props",
          description: "Find what props are passed to a specific Inertia page from controllers",
          inputSchema: {
            type: "object",
            properties: {
              page_name: {
                type: "string",
                description: "Page name (e.g., 'Order/Index', 'Auth/UnifiedLogin')",
              },
            },
            required: ["page_name"],
          },
        },
        // PHASE 3: API Endpoint Lister
        {
          name: "list_api_endpoints",
          description: "List all API endpoints with their transformers and validation",
          inputSchema: {
            type: "object",
            properties: {
              domain: {
                type: "string",
                description: "Optional: Filter by domain",
                enum: VALID_DOMAINS,
              },
              prefix: {
                type: "string",
                description: "Optional: Filter by URI prefix (e.g., '/async')",
              },
            },
          },
        },
        {
          name: "find_endpoint_details",
          description: "Get detailed information about a specific API endpoint",
          inputSchema: {
            type: "object",
            properties: {
              uri: {
                type: "string",
                description: "Endpoint URI (e.g., '/async/fleet/orders')",
              },
              route_name: {
                type: "string",
                description: "Or route name (e.g., 'fleet.orders.index')",
              },
            },
          },
        },
        // PHASE 3: Database Query Helper
        {
          name: "find_table_usage",
          description: "Find all locations where a database table is queried (models, repositories, raw queries)",
          inputSchema: {
            type: "object",
            properties: {
              table_name: {
                type: "string",
                description: "Table name (e.g., 'employer_contracts')",
              },
            },
            required: ["table_name"],
          },
        },
        {
          name: "find_eloquent_scopes",
          description: "List all query scopes for an Eloquent model",
          inputSchema: {
            type: "object",
            properties: {
              model_name: {
                type: "string",
                description: "Model name (e.g., 'User', 'Order')",
              },
              domain: {
                type: "string",
                description: "Optional: Limit to specific domain",
                enum: VALID_DOMAINS,
              },
            },
            required: ["model_name"],
          },
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // EXISTING TOOLS
          case "query_domain_structure":
            return await this.queryDomainStructure(args as { domain: string });
          case "find_related_files":
            return await this.findRelatedFiles(
              args as { entity_name: string; domain?: string }
            );
          case "query_database_schema":
            return await this.queryDatabaseSchema(args as { table_name: string });
          case "run_phpstan":
            return await this.runPhpstan(args as { path: string });

          // PHASE 1: Route Discovery
          case "find_route_by_name":
            return await this.findRouteByName(args as { route_name: string });
          case "find_routes_for_controller":
            return await this.findRoutesForController(
              args as { controller_name: string; domain?: string }
            );
          case "list_all_routes":
            return await this.listAllRoutes(
              args as { domain?: string; method?: string; middleware?: string; prefix?: string }
            );
          case "find_service_chain":
            return await this.findServiceChain(
              args as { entity_name: string; domain?: string }
            );

          // PHASE 1: Test Coverage
          case "find_tests_for_file":
            return await this.findTestsForFile(args as { file_path: string });
          case "find_untested_files":
            return await this.findUntestedFiles(
              args as { domain: string; file_type?: string }
            );
          case "get_test_structure_info":
            return await this.getTestStructureInfo();

          // PHASE 2: Component Usage
          case "find_component_usage":
            return await this.findComponentUsage(
              args as { component_name: string; domain?: string }
            );
          case "find_unused_components":
            return await this.findUnusedComponents(args as { domain?: string });

          // PHASE 2: Inertia Pages
          case "list_inertia_pages":
            return await this.listInertiaPages(args as { domain?: string });
          case "find_page_props":
            return await this.findPageProps(args as { page_name: string });

          // PHASE 3: API Endpoints
          case "list_api_endpoints":
            return await this.listApiEndpoints(
              args as { domain?: string; prefix?: string }
            );
          case "find_endpoint_details":
            return await this.findEndpointDetails(
              args as { uri?: string; route_name?: string }
            );

          // PHASE 3: Database Query Helper
          case "find_table_usage":
            return await this.findTableUsage(args as { table_name: string });
          case "find_eloquent_scopes":
            return await this.findEloquentScopes(
              args as { model_name: string; domain?: string }
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // ==================== EXISTING TOOLS ====================

  /**
   * Query domain structure - get all files organized by type
   */
  private async queryDomainStructure(args: { domain: string }) {
    const { domain } = args;

    if (!VALID_DOMAINS.includes(domain)) {
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

    // Make paths relative for cleaner output
    const relativizeArray = (arr: string[]) =>
      arr.map((f) => f.replace(O2O_BASE_PATH + "/", ""));

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
  private async findRelatedFiles(args: { entity_name: string; domain?: string }) {
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

    // Make paths relative
    const relativizeArray = (arr: string[]) =>
      arr.map((f) => f.replace(O2O_BASE_PATH + "/", ""));

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
  private async queryDatabaseSchema(args: { table_name: string }) {
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
  private async runPhpstan(args: { path: string }) {
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

  // ==================== HELPER METHODS ====================

  /**
   * Get Laravel routes with caching
   */
  private async getRoutes(): Promise<any[]> {
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

  /**
   * Extract domain from controller class name
   */
  private extractDomain(controllerPath: string): string | null {
    const match = controllerPath.match(/App\\(Core|Customer|Dealer|Employer)\\/);
    return match ? match[1] : null;
  }

  /**
   * Make path relative to O2O base
   */
  private relativePath(absolutePath: string): string {
    return absolutePath.replace(O2O_BASE_PATH + "/", "");
  }

  /**
   * Count lines in a file
   */
  private countLines(filePath: string): number {
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
  private extractClassName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  // ==================== PHASE 1: ROUTE DISCOVERY ====================

  /**
   * Find route by name
   */
  private async findRouteByName(args: { route_name: string }) {
    const { route_name } = args;
    const routes = await this.getRoutes();

    const route = routes.find((r: any) => r.name === route_name);

    if (!route) {
      throw new Error(`Route '${route_name}' not found`);
    }

    const domain = this.extractDomain(route.action);

    const result = {
      route_name: route.name,
      method: route.method,
      uri: route.uri,
      controller: route.action,
      middleware: route.middleware || [],
      domain,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find routes for controller
   */
  private async findRoutesForController(args: { controller_name: string; domain?: string }) {
    const { controller_name, domain } = args;
    const routes = await this.getRoutes();

    let filteredRoutes = routes.filter((r: any) =>
      r.action && r.action.includes(controller_name)
    );

    if (domain) {
      filteredRoutes = filteredRoutes.filter((r: any) =>
        r.action && r.action.includes(`App\\${domain}\\`)
      );
    }

    const result = {
      controller_name,
      domain: domain || "all domains",
      total_routes: filteredRoutes.length,
      routes: filteredRoutes.map((r: any) => ({
        method: r.method,
        uri: r.uri,
        route_name: r.name || null,
        action: r.action,
        middleware: r.middleware || [],
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * List all routes with filtering
   */
  private async listAllRoutes(args: { domain?: string; method?: string; middleware?: string; prefix?: string }) {
    const { domain, method, middleware, prefix } = args;
    let routes = await this.getRoutes();

    // Apply filters
    if (domain) {
      routes = routes.filter((r: any) =>
        r.action && r.action.includes(`App\\${domain}\\`)
      );
    }

    if (method) {
      routes = routes.filter((r: any) => r.method === method);
    }

    if (middleware) {
      routes = routes.filter((r: any) =>
        r.middleware && r.middleware.includes(middleware)
      );
    }

    if (prefix) {
      routes = routes.filter((r: any) => r.uri && r.uri.startsWith(prefix));
    }

    // Calculate summary
    const byMethod: any = {};
    const byDomain: any = {};

    routes.forEach((r: any) => {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
      const d = this.extractDomain(r.action);
      if (d) {
        byDomain[d] = (byDomain[d] || 0) + 1;
      }
    });

    const result = {
      total_routes: routes.length,
      filters_applied: { domain, method, middleware, prefix },
      summary: {
        by_method: byMethod,
        by_domain: byDomain,
      },
      routes: routes.map((r: any) => ({
        method: r.method,
        uri: r.uri,
        name: r.name || null,
        controller: r.action,
        middleware: r.middleware || [],
        domain: this.extractDomain(r.action),
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find service chain for an entity
   */
  private async findServiceChain(args: { entity_name: string; domain?: string }) {
    const { entity_name, domain } = args;

    // Get related files
    const relatedResult = await this.findRelatedFiles({ entity_name, domain });
    const relatedData = JSON.parse(relatedResult.content[0].text);

    // Get routes
    const routes = await this.getRoutes();
    const entityRoutes = routes.filter((r: any) =>
      r.action && r.action.toLowerCase().includes(entity_name.toLowerCase())
    );

    // Build comprehensive chain
    const result = {
      entity_name,
      domain: domain || "all domains",
      model: relatedData.files.models.length > 0 ? {
        file: relatedData.files.models[0],
        class_name: this.extractClassName(relatedData.files.models[0]),
      } : null,
      repositories: relatedData.files.repositories.map((file: string) => ({
        type: file.includes("/Domain/") ? "domain" : "infrastructure",
        file,
        class_name: this.extractClassName(file),
      })),
      controllers: relatedData.files.controllers.map((file: string) => {
        const className = this.extractClassName(file);
        const controllerRoutes = entityRoutes.filter((r: any) =>
          r.action && r.action.includes(className)
        );
        return {
          file,
          class_name: className,
          routes: controllerRoutes.map((r: any) => ({
            method: r.method,
            uri: r.uri,
            route_name: r.name || null,
          })),
        };
      }),
      transformers: relatedData.files.transformers.map((file: string) => ({
        file,
        class_name: this.extractClassName(file),
      })),
      validation_requests: relatedData.files.requests.map((file: string) => ({
        file,
        class_name: this.extractClassName(file),
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ==================== PHASE 1: TEST COVERAGE ====================

  /**
   * Find tests for a file
   */
  private async findTestsForFile(args: { file_path: string }) {
    const { file_path } = args;

    const className = this.extractClassName(file_path);

    // Determine file type
    let fileType = "unknown";
    if (file_path.includes("Controller")) fileType = "controller";
    else if (file_path.includes("Repository")) fileType = "repository";
    else if (file_path.includes("Model")) fileType = "model";
    else if (file_path.includes("Service")) fileType = "service";
    else if (file_path.includes("Transformer")) fileType = "transformer";
    else if (file_path.endsWith(".vue")) fileType = "component";

    // Search for tests
    const tests: any[] = [];

    // Unit tests
    const unitTests = globSync(`tests/Unit/**/*${className}*Test.php`, {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    unitTests.forEach(testFile => {
      tests.push({
        test_file: this.relativePath(testFile),
        test_type: "unit",
        test_class: this.extractClassName(testFile),
        line_count: this.countLines(testFile),
      });
    });

    // Feature tests
    const featureTests = globSync(`tests/Feature/**/*${className}*Test.php`, {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    featureTests.forEach(testFile => {
      tests.push({
        test_file: this.relativePath(testFile),
        test_type: "feature",
        test_class: this.extractClassName(testFile),
        line_count: this.countLines(testFile),
      });
    });

    // Cypress tests
    const cypressTests = globSync(`cypress/e2e/**/*${className}*.cy.js`, {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    cypressTests.forEach(testFile => {
      tests.push({
        test_file: this.relativePath(testFile),
        test_type: "cypress",
        test_class: null,
        line_count: this.countLines(testFile),
      });
    });

    // Component tests (for Vue files)
    if (fileType === "component") {
      const componentTests = globSync(`app/**/UI/resources/js/components/**/__tests__/*${className}*.cy.js`, {
        cwd: O2O_BASE_PATH,
        absolute: true,
      });

      componentTests.forEach(testFile => {
        tests.push({
          test_file: this.relativePath(testFile),
          test_type: "cypress",
          test_class: null,
          line_count: this.countLines(testFile),
        });
      });
    }

    const result = {
      source_file: file_path,
      file_type: fileType,
      tests,
      coverage_summary: {
        has_unit_tests: tests.some(t => t.test_type === "unit"),
        has_feature_tests: tests.some(t => t.test_type === "feature"),
        has_e2e_tests: tests.some(t => t.test_type === "cypress"),
        total_test_count: tests.length,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find untested files in a domain
   */
  private async findUntestedFiles(args: { domain: string; file_type?: string }) {
    const { domain, file_type } = args;

    const domainPath = path.join(O2O_BASE_PATH, "app", domain);

    let files: string[] = [];

    if (file_type === "controller") {
      files = globSync(`${domainPath}/**/*Controller.php`, { absolute: true });
    } else if (file_type === "repository") {
      files = globSync(`${domainPath}/**/*Repository.php`, {
        absolute: true,
        ignore: ["**/*Interface.php"],
      });
    } else if (file_type === "model") {
      files = globSync(`${domainPath}/**/Models/**/*.php`, { absolute: true });
    } else if (file_type === "service") {
      files = globSync(`${domainPath}/**/*Service.php`, { absolute: true });
    } else {
      // All PHP files
      files = globSync(`${domainPath}/**/*.php`, {
        absolute: true,
        ignore: ["**/vendor/**", "**/node_modules/**"],
      });
    }

    const untestedFiles: any[] = [];
    let testedCount = 0;

    for (const file of files) {
      const className = this.extractClassName(file);

      // Check if tests exist
      const unitTests = globSync(`tests/Unit/**/*${className}*Test.php`, {
        cwd: O2O_BASE_PATH,
      });
      const featureTests = globSync(`tests/Feature/**/*${className}*Test.php`, {
        cwd: O2O_BASE_PATH,
      });

      if (unitTests.length === 0 && featureTests.length === 0) {
        untestedFiles.push({
          file: this.relativePath(file),
          file_type: file_type || "unknown",
          domain,
          suggested_test_location: `tests/Unit/${domain}/${className}Test.php`,
          complexity_score: this.countLines(file),
        });
      } else {
        testedCount++;
      }
    }

    const result = {
      domain,
      file_type_filter: file_type || "all",
      untested_files: untestedFiles,
      summary: {
        total_files: files.length,
        tested_files: testedCount,
        untested_files: untestedFiles.length,
        coverage_percentage: Math.round((testedCount / files.length) * 100) || 0,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Get test structure info
   */
  private async getTestStructureInfo() {
    const testBasePath = path.join(O2O_BASE_PATH, "tests");

    const baseClasses = [
      { class_name: "BikerTestCase", file: "tests/BikerTestCase.php", domain: "Customer" },
      { class_name: "DealerTestCase", file: "tests/DealerTestCase.php", domain: "Dealer" },
      { class_name: "FleetTestCase", file: "tests/FleetTestCase.php", domain: "Employer" },
      { class_name: "UnifiedTestCase", file: "tests/UnifiedTestCase.php", domain: "Core" },
      { class_name: "TestCase", file: "tests/TestCase.php", domain: "All" },
    ];

    const result = {
      test_base_classes: baseClasses,
      test_directories: {
        unit: "tests/Unit",
        feature: "tests/Feature",
        e2e: "cypress/e2e",
      },
      test_naming_conventions: {
        unit_tests: "tests/Unit/{Domain}/{Class}Test.php",
        feature_tests: "tests/Feature/{Domain}/{Feature}Test.php",
        cypress_tests: "cypress/e2e/{domain}/specs/{feature}/{Test}.cy.js",
        component_tests: "app/{Domain}/UI/resources/js/components/**/__tests__/*.cy.js",
      },
      test_commands: {
        run_all: "vendor/bin/sail test",
        run_specific: "vendor/bin/sail test <path>",
        run_cypress_smoke: "npm run smoketest",
        run_cypress_all: "npm run test",
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ==================== PHASE 2: COMPONENT USAGE ====================

  /**
   * Find component usage
   */
  private async findComponentUsage(args: { component_name: string; domain?: string }) {
    const { component_name, domain } = args;

    const searchPath = domain
      ? path.join(O2O_BASE_PATH, `app/${domain}/UI/resources/js`)
      : path.join(O2O_BASE_PATH, "app");

    // Find component definition
    const componentFiles = globSync(`**/${component_name}.vue`, {
      cwd: searchPath,
      absolute: true,
    });

    if (componentFiles.length === 0) {
      throw new Error(`Component '${component_name}' not found`);
    }

    const componentFile = componentFiles[0];
    const componentDomain = this.extractDomain(componentFile);

    // Search for imports
    const allVueFiles = globSync("app/**/UI/resources/js/**/*.vue", {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    const usages: any[] = [];

    for (const vueFile of allVueFiles) {
      const content = fs.readFileSync(vueFile, "utf-8");

      // Check for import
      const importRegex = new RegExp(`import.*${component_name}.*from`, "i");
      if (importRegex.test(content)) {
        // Count usage in template
        const templateRegex = new RegExp(`<${component_name}`, "gi");
        const matches = content.match(templateRegex);
        const usageCount = matches ? matches.length : 0;

        if (usageCount > 0) {
          usages.push({
            file: this.relativePath(vueFile),
            file_type: vueFile.includes("/pages/") ? "page" : "component",
            domain: this.extractDomain(vueFile),
            usage_count: usageCount,
          });
        }
      }
    }

    const result = {
      component_name,
      component_definition: {
        file: this.relativePath(componentFile),
        domain: componentDomain,
      },
      usages,
      usage_summary: {
        total_usages: usages.reduce((sum, u) => sum + u.usage_count, 0),
        files_using: usages.length,
        pages_using: usages.filter(u => u.file_type === "page").length,
        components_using: usages.filter(u => u.file_type === "component").length,
        domains_using: [...new Set(usages.map(u => u.domain).filter(Boolean))],
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find unused components
   */
  private async findUnusedComponents(args: { domain?: string }) {
    const { domain } = args;

    const searchPath = domain
      ? path.join(O2O_BASE_PATH, `app/${domain}/UI/resources/js/components`)
      : path.join(O2O_BASE_PATH, "app/**/UI/resources/js/components");

    const componentFiles = globSync("**/*.vue", {
      cwd: searchPath,
      absolute: true,
      ignore: ["**/Shared/**", "**/Layout/**"], // Exclude base components
    });

    const allVueFiles = globSync("app/**/UI/resources/js/**/*.vue", {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    const unusedComponents: any[] = [];
    let usedCount = 0;

    for (const componentFile of componentFiles) {
      const componentName = this.extractClassName(componentFile);

      // Check if used anywhere
      let isUsed = false;
      for (const vueFile of allVueFiles) {
        if (vueFile === componentFile) continue;

        const content = fs.readFileSync(vueFile, "utf-8");
        const importRegex = new RegExp(`import.*${componentName}.*from`, "i");

        if (importRegex.test(content)) {
          isUsed = true;
          break;
        }
      }

      if (!isUsed) {
        const stats = fs.statSync(componentFile);
        unusedComponents.push({
          component_name: componentName,
          file: this.relativePath(componentFile),
          domain: this.extractDomain(componentFile),
          last_modified: stats.mtime.toISOString(),
          lines_of_code: this.countLines(componentFile),
        });
      } else {
        usedCount++;
      }
    }

    const result = {
      domain: domain || "all domains",
      unused_components: unusedComponents,
      summary: {
        total_components: componentFiles.length,
        used_components: usedCount,
        unused_components: unusedComponents.length,
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ==================== PHASE 2: INERTIA PAGES ====================

  /**
   * List Inertia pages
   */
  private async listInertiaPages(args: { domain?: string }) {
    const { domain } = args;

    const searchPath = domain
      ? path.join(O2O_BASE_PATH, `app/${domain}/UI/resources/js/pages`)
      : path.join(O2O_BASE_PATH, "app/**/UI/resources/js/pages");

    const pageFiles = globSync("**/*.vue", {
      cwd: searchPath,
      absolute: true,
    });

    const pages: any[] = [];

    for (const pageFile of pageFiles) {
      const relativePath = this.relativePath(pageFile);
      const pageDomain = this.extractDomain(pageFile);

      // Extract page name (e.g., "Order/Index")
      const match = relativePath.match(/pages\/(.+)\.vue$/);
      const pageName = match ? match[1] : null;

      pages.push({
        domain: pageDomain,
        page_name: pageName,
        file_path: relativePath,
      });
    }

    const result = {
      domain: domain || "all domains",
      total_pages: pages.length,
      pages,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find page props
   */
  private async findPageProps(args: { page_name: string }) {
    const { page_name } = args;

    // Find the page file
    const pageFiles = globSync(`app/**/UI/resources/js/pages/${page_name}.vue`, {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    if (pageFiles.length === 0) {
      throw new Error(`Page '${page_name}' not found`);
    }

    const pageFile = pageFiles[0];

    // Search for Inertia::render calls
    const controllerFiles = globSync("app/**/*Controller.php", {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    const controllersUsingPage: any[] = [];

    for (const controllerFile of controllerFiles) {
      const content = fs.readFileSync(controllerFile, "utf-8");

      // Look for Inertia::render with this page name
      const renderRegex = new RegExp(`Inertia::render\\(['"]${page_name}['"]`, "i");

      if (renderRegex.test(content)) {
        controllersUsingPage.push({
          controller: this.relativePath(controllerFile),
          class_name: this.extractClassName(controllerFile),
        });
      }
    }

    const result = {
      page_name,
      page_file: this.relativePath(pageFile),
      controllers_using_page: controllersUsingPage,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ==================== PHASE 3: API ENDPOINTS ====================

  /**
   * List API endpoints
   */
  private async listApiEndpoints(args: { domain?: string; prefix?: string }) {
    const { domain, prefix } = args;

    let routes = await this.getRoutes();

    // Filter for API routes (typically /async or /api)
    const apiPrefix = prefix || "/async";
    routes = routes.filter((r: any) => r.uri && r.uri.startsWith(apiPrefix));

    if (domain) {
      routes = routes.filter((r: any) =>
        r.action && r.action.includes(`App\\${domain}\\`)
      );
    }

    const endpoints = routes.map((r: any) => ({
      method: r.method,
      uri: r.uri,
      name: r.name || null,
      controller: r.action,
      middleware: r.middleware || [],
      domain: this.extractDomain(r.action),
    }));

    const result = {
      prefix: apiPrefix,
      domain: domain || "all domains",
      total_endpoints: endpoints.length,
      endpoints,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find endpoint details
   */
  private async findEndpointDetails(args: { uri?: string; route_name?: string }) {
    const { uri, route_name } = args;

    if (!uri && !route_name) {
      throw new Error("Either uri or route_name must be provided");
    }

    const routes = await this.getRoutes();

    const route = uri
      ? routes.find((r: any) => r.uri === uri)
      : routes.find((r: any) => r.name === route_name);

    if (!route) {
      throw new Error(`Endpoint not found`);
    }

    const result = {
      endpoint: {
        method: route.method,
        uri: route.uri,
        name: route.name || null,
        controller: route.action,
        middleware: route.middleware || [],
        domain: this.extractDomain(route.action),
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // ==================== PHASE 3: DATABASE QUERY HELPER ====================

  /**
   * Find table usage
   */
  private async findTableUsage(args: { table_name: string }) {
    const { table_name } = args;

    // Find model with this table
    const modelFiles = globSync("app/**/Models/**/*.php", {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    let modelFile: string | null = null;

    for (const file of modelFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const tableRegex = new RegExp(`protected\\s+\\$table\\s*=\\s*['"]${table_name}['"]`);

      if (tableRegex.test(content)) {
        modelFile = file;
        break;
      }
    }

    // Find raw queries
    const phpFiles = globSync("app/**/*.php", {
      cwd: O2O_BASE_PATH,
      absolute: true,
      ignore: ["**/vendor/**"],
    });

    const directQueries: any[] = [];

    for (const file of phpFiles) {
      const content = fs.readFileSync(file, "utf-8");

      // Check for DB::table usage
      if (content.includes(`DB::table('${table_name}')`)) {
        directQueries.push({
          file: this.relativePath(file),
          query_type: "query_builder",
        });
      }
    }

    // Find migrations
    const migrations = globSync(`database/migrations/**/*${table_name}*.php`, {
      cwd: O2O_BASE_PATH,
      absolute: true,
    });

    const result = {
      table_name,
      model: modelFile ? {
        file: this.relativePath(modelFile),
        class_name: this.extractClassName(modelFile),
      } : null,
      direct_queries: directQueries,
      migrations: migrations.map(m => ({
        file: this.relativePath(m),
        migration_name: this.extractClassName(m),
      })),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Find Eloquent scopes
   */
  private async findEloquentScopes(args: { model_name: string; domain?: string }) {
    const { model_name, domain } = args;

    const searchPath = domain
      ? path.join(O2O_BASE_PATH, `app/${domain}`)
      : path.join(O2O_BASE_PATH, "app");

    const modelFiles = globSync(`**/Models/**/${model_name}.php`, {
      cwd: searchPath,
      absolute: true,
    });

    if (modelFiles.length === 0) {
      throw new Error(`Model '${model_name}' not found`);
    }

    const modelFile = modelFiles[0];
    const content = fs.readFileSync(modelFile, "utf-8");

    // Find scope methods
    const scopeRegex = /public\s+function\s+(scope\w+)\s*\(/g;
    const scopes: any[] = [];
    let match;

    while ((match = scopeRegex.exec(content)) !== null) {
      scopes.push({
        scope_name: match[1].replace("scope", "").toLowerCase(),
        method_name: match[1],
      });
    }

    const result = {
      model_name,
      model_path: this.relativePath(modelFile),
      scopes,
      total_scopes: scopes.length,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("O2O Laravel MCP server running on stdio");
  }
}

// Start the server
const server = new O2OLaravelServer();
server.run().catch(console.error);
