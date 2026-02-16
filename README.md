# O2O Laravel MCP Server

Custom MCP (Model Context Protocol) server for the O2O bike leasing Laravel application. Provides Claude with direct access to your domain architecture, file relationships, database schema, code quality tools, and much more!

## What It Does

Provides Claude with 18 specialized tools to analyze and navigate your O2O Laravel codebase:

- **Route & Service Discovery**: Map routes, controllers, repositories, and complete service chains
- **Test Coverage**: Find tests, identify untested code, understand test organization
- **Component & Frontend**: Track Vue component usage, map Inertia pages to controllers
- **API & Database**: List API endpoints, find table usage, discover Eloquent scopes

## Installation

### 1. Clone or Copy This Repo

```bash
cd ~/Documents/projects
git clone <your-repo-url> o2o-mcp-server
# OR if you received this as a zip/folder, just place it at ~/Documents/projects/o2o-mcp-server
```

### 2. Install Dependencies

```bash
cd ~/Documents/projects/o2o-mcp-server
npm install
```

### 3. Build the Server

```bash
npm run build
```

You should see output like:
```
Successfully compiled TypeScript
```

### 4. Configure Claude Code

Add the MCP server to your Claude Code configuration.

**Option A: Using VSCode Claude Extension Settings**

1. Open VSCode Settings (⌘ + ,)
2. Search for "Claude MCP"
3. Edit the MCP Servers configuration
4. Add:

```json
{
  "o2o-laravel": {
    "command": "node",
    "args": ["/Users/YOUR_USERNAME/Documents/projects/o2o-mcp-server/dist/index.js"]
  }
}
```

**⚠️ IMPORTANT:** Replace `YOUR_USERNAME` with your actual macOS username!

**Option B: Using Claude CLI Config**

Edit `~/.claude/config.json` and add:

```json
{
  "mcp_servers": {
    "o2o-laravel": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Documents/projects/o2o-mcp-server/dist/index.js"]
    }
  }
}
```

### 5. Restart Claude Code

Close and reopen Claude Code (or VSCode) for the changes to take effect.

### 6. Verify It Works

In Claude Code, ask:

```
Can you query the Employer domain structure?
```

Claude should use the `query_domain_structure` tool and return all files in the Employer domain.

---

## Available Tools (18 total)

### 📂 Core Domain Tools

#### 1. `query_domain_structure`

Get all files in a domain organized by type.

**Parameters:**
- `domain` (required): `Core`, `Customer`, `Dealer`, or `Employer`

**Example:**
```javascript
query_domain_structure({ domain: "Employer" })
```

#### 2. `find_related_files`

Find all related files for an entity (controller, repository, transformer, tests).

**Parameters:**
- `entity_name` (required): Entity name like `Contract`, `Invoice`, `Order`
- `domain` (optional): Limit search to specific domain

**Example:**
```javascript
find_related_files({ entity_name: "Contract", domain: "Employer" })
```

#### 3. `query_database_schema`

Get the schema for a database table.

**Parameters:**
- `table_name` (required): Table name like `employer_contracts`, `users`

**Example:**
```javascript
query_database_schema({ table_name: "employer_contracts" })
```

#### 4. `run_phpstan`

Run PHPStan static analysis on a file or directory.

**Parameters:**
- `path` (required): Relative path from project root

**Example:**
```javascript
run_phpstan({ path: "app/Employer/Controllers/ContractController.php" })
```

---

### 🗺️ Route & Service Discovery

#### 5. `find_route_by_name`

Find a Laravel route by its name.

**Parameters:**
- `route_name` (required): e.g., `"fleet.orders.index"`

**Example:**
```javascript
find_route_by_name({ route_name: "fleet.orders.index" })
```

**Returns:** Method, URI, controller, middleware, domain

---

#### 6. `find_routes_for_controller`

List all routes handled by a specific controller.

**Parameters:**
- `controller_name` (required): e.g., `"OrderController"`
- `domain` (optional): Limit to specific domain

**Example:**
```javascript
find_routes_for_controller({ controller_name: "OrderController", domain: "Employer" })
```

---

#### 7. `list_all_routes`

List all routes with optional filtering.

**Parameters:**
- `domain` (optional): Filter by domain
- `method` (optional): Filter by HTTP method (GET, POST, etc.)
- `middleware` (optional): Filter by middleware (e.g., `"auth"`)
- `prefix` (optional): Filter by URI prefix (e.g., `"/async"`)

**Example:**
```javascript
list_all_routes({ domain: "Employer", method: "POST" })
```

**Returns:** Routes with summary statistics by method and domain

---

#### 8. `find_service_chain`

Map the full service chain: Route → Controller → Repository → Model

**Parameters:**
- `entity_name` (required): e.g., `"Order"`, `"Contract"`
- `domain` (optional): Limit to specific domain

**Example:**
```javascript
find_service_chain({ entity_name: "Order", domain: "Employer" })
```

**Returns:** Complete data flow with model, repositories, controllers, routes, transformers, and validation requests

---

### ✅ Test Coverage

#### 9. `find_tests_for_file`

Find all related test files (Unit, Feature, Cypress) for a source file.

**Parameters:**
- `file_path` (required): Relative path to source file

**Example:**
```javascript
find_tests_for_file({
  file_path: "app/Employer/Infrastructure/Order/Controllers/OrderController.php"
})
```

**Returns:** All tests with type, location, and coverage summary

---

#### 10. `find_untested_files`

Identify files without test coverage in a domain.

**Parameters:**
- `domain` (required): Domain to check
- `file_type` (optional): Filter by type (`"controller"`, `"repository"`, `"model"`, `"service"`)

**Example:**
```javascript
find_untested_files({ domain: "Employer", file_type: "controller" })
```

**Returns:** List of untested files with suggested test locations and coverage percentage

---

#### 11. `get_test_structure_info`

Get information about test organization and available test utilities.

**Parameters:** None

**Example:**
```javascript
get_test_structure_info()
```

**Returns:** Test base classes, directories, naming conventions, and test commands

---

### 🧩 Component Usage

#### 12. `find_component_usage`

Find where a Vue component is imported and used.

**Parameters:**
- `component_name` (required): e.g., `"Button"`, `"OrderDetail"`
- `domain` (optional): Limit search to specific domain

**Example:**
```javascript
find_component_usage({ component_name: "Button" })
```

**Returns:** Component definition, all usages, and usage statistics

---

#### 13. `find_unused_components`

Identify Vue components that are not being used anywhere.

**Parameters:**
- `domain` (optional): Limit search to specific domain

**Example:**
```javascript
find_unused_components({ domain: "Employer" })
```

**Returns:** List of unused components with metadata and summary

---

### 📄 Inertia Pages

#### 14. `list_inertia_pages`

List all Inertia.js pages in the application.

**Parameters:**
- `domain` (optional): Filter by domain

**Example:**
```javascript
list_inertia_pages({ domain: "Employer" })
```

**Returns:** All Inertia pages with domain and file paths

---

#### 15. `find_page_props`

Find what props are passed to a specific Inertia page from controllers.

**Parameters:**
- `page_name` (required): e.g., `"Order/Index"`, `"Auth/UnifiedLogin"`

**Example:**
```javascript
find_page_props({ page_name: "Order/Index" })
```

**Returns:** Page file location and all controllers that render this page

---

### 🔌 API Endpoints

#### 16. `list_api_endpoints`

List all API endpoints with their transformers and validation.

**Parameters:**
- `domain` (optional): Filter by domain
- `prefix` (optional): Filter by URI prefix (default: `"/async"`)

**Example:**
```javascript
list_api_endpoints({ domain: "Employer", prefix: "/async" })
```

**Returns:** All API endpoints with method, URI, controller, middleware

---

#### 17. `find_endpoint_details`

Get detailed information about a specific API endpoint.

**Parameters:**
- `uri` (optional): Endpoint URI (e.g., `"/async/fleet/orders"`)
- `route_name` (optional): Or route name

**Example:**
```javascript
find_endpoint_details({ uri: "/async/fleet/orders" })
```

**Returns:** Complete endpoint information

---

### 🗄️ Database Queries

#### 18. `find_table_usage`

Find all locations where a database table is queried.

**Parameters:**
- `table_name` (required): e.g., `"employer_contracts"`

**Example:**
```javascript
find_table_usage({ table_name: "employer_contracts" })
```

**Returns:** Associated model, direct queries, repositories, and migrations

---

#### 19. `find_eloquent_scopes`

List all query scopes for an Eloquent model.

**Parameters:**
- `model_name` (required): e.g., `"User"`, `"Order"`
- `domain` (optional): Limit to specific domain

**Example:**
```javascript
find_eloquent_scopes({ model_name: "User", domain: "Core" })
```

**Returns:** All scope methods in the model

---

## Performance Features

- **Route Caching**: Routes are cached for 5 minutes to avoid repeated `artisan route:list` calls
- **Efficient File Searching**: Uses glob patterns for fast file system searches
- **Optimized Queries**: Database queries use Laravel's Tinker for efficient schema inspection

---

## Development

### Watch Mode

If you're modifying the MCP server code:

```bash
npm run watch
```

This will automatically rebuild when you change TypeScript files.

### Manual Testing

You can test the server manually (though it's designed to run via Claude Code):

```bash
npm start
```

Press Ctrl+D to exit.

---

## Troubleshooting

### "MCP server not found" in Claude Code

- Verify the path in your config is correct
- Ensure you ran `npm run build`
- Check that `dist/index.js` exists
- Restart Claude Code/VSCode

### "Domain path not found" error

The server expects the O2O app at a configured path.

**Configuration:**
1. Copy `.env.example` to `.env`
2. Update `O2O_BASE_PATH` to your local path
3. Or set environment variable: `export O2O_BASE_PATH=/path/to/your/o2o-apps`

### "Cannot find module" error

Run `npm install` again to ensure all dependencies are installed.

### Database schema query fails

The server tries to query the database directly via Laravel. If that fails, it falls back to reading migration files. Make sure:
- Your `.env` file has correct database credentials
- The database is running (Laravel Sail is up)

### Route listing fails

If `php artisan route:list` fails:
- Ensure Laravel Sail is running
- Check that you're in the correct directory
- Try running the command manually to see the error

---

## Team Sharing

### Via Git (Recommended)

1. Initialize git repo:
```bash
cd ~/Documents/projects/o2o-mcp-server
git init
git add .
git commit -m "Initial commit: O2O MCP Server"
```

2. Push to GitHub/GitLab:
```bash
git remote add origin <your-repo-url>
git push -u origin main
```

3. Team members clone:
```bash
git clone <your-repo-url> ~/Documents/projects/o2o-mcp-server
cd ~/Documents/projects/o2o-mcp-server
npm install
npm run build
```

4. Each team member updates their Claude Code config with their own username in the path.

### Via Shared Folder/Zip

1. Share the entire `o2o-mcp-server` folder
2. Team members place it at `~/Documents/projects/o2o-mcp-server`
3. Run `npm install && npm run build`
4. Configure Claude Code

---

## Customization

### Adding New Tools

Edit `src/index.ts` and:

1. Add tool definition in `ListToolsRequestSchema` handler
2. Add case in `CallToolRequestSchema` handler
3. Implement the tool method
4. Run `npm run build`
5. Restart Claude Code

### Changing O2O App Path

If your O2O app is at a different location:

1. Edit `src/index.ts`
2. Change the `O2O_BASE_PATH` constant
3. Run `npm run build`

---

## What Claude Can Do

With these 18 tools, Claude can:

✅ Navigate your entire domain architecture
✅ Find any route and its complete chain
✅ Identify untested code
✅ Track component usage across the app
✅ Map Inertia pages to controllers
✅ List all API endpoints
✅ Find database table usage
✅ Discover Eloquent query scopes
✅ Run static analysis with PHPStan
✅ Query database schemas

---

## Version History

- **2.0.0** - Complete MCP server with 18 tools for comprehensive Laravel codebase analysis
- **1.0.0** - Initial release with 4 core domain tools

---

## License

MIT - Use freely within the O2O team

## Support

Questions? Ask in the team Slack or open an issue on the repo.

---

Built with ❤️ for the O2O team to make Claude even more powerful!
