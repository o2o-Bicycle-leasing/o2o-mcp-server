# O2O MCP Server - Features Overview

A human-readable guide to what this MCP server can do for you.

---

## 🎯 What Is This?

This MCP server gives Claude superpowers to understand and navigate your O2O Laravel codebase. Instead of manually searching for files, routes, or components, Claude can instantly query your codebase structure.

---

## 📚 Feature Categories

### 🏗️ **Domain Architecture** (Original - 4 tools)
Understand the structure of your domain-driven architecture.

#### What You Can Do:
- ✅ "Show me all files in the Employer domain"
- ✅ "Find everything related to Contract entity"
- ✅ "What's the database schema for employer_contracts table?"
- ✅ "Run PHPStan on the OrderController"

#### Why It's Useful:
- Quickly navigate domain boundaries
- Find all related files for any entity (controller, repo, transformer, tests)
- Inspect database schemas without reading migrations
- Catch code quality issues before pushing

---

### 🗺️ **Route Discovery** (Phase 1 - 4 tools)
Navigate Laravel routes and understand request flow.

#### What You Can Do:
- ✅ "Find the route named 'fleet.orders.index'"
- ✅ "What routes does OrderController handle?"
- ✅ "List all POST routes in the Employer domain"
- ✅ "Show me the complete service chain for Order entity"

#### Why It's Useful:
- Instantly find route definitions without searching
- Understand which controller handles which routes
- Filter routes by domain, method, middleware, or URI prefix
- See the complete data flow: Route → Controller → Repository → Model

#### Technical Details:
- **Caching**: Routes are cached for 5 minutes to avoid repeated artisan calls
- **Filtering**: Support for domain, HTTP method, middleware, and URI prefix
- **Smart Parsing**: Automatically extracts domain from controller namespace

---

### ✅ **Test Coverage Analysis** (Phase 1 - 3 tools)
Identify tested and untested code across your codebase.

#### What You Can Do:
- ✅ "Find all tests for OrderController"
- ✅ "Show me untested controllers in Employer domain"
- ✅ "What's my test coverage percentage for repositories?"
- ✅ "How are tests organized in this project?"

#### Why It's Useful:
- Quickly assess test coverage for any file
- Identify gaps in test coverage by domain
- Understand test structure and conventions
- Get suggested test locations for untested files

#### Technical Details:
- **Test Types Detected**: Unit tests, Feature tests, Cypress E2E tests, Component tests
- **Coverage Metrics**: Calculates percentage of tested vs untested files
- **Smart Matching**: Matches files to tests by class name
- **Test Conventions**: Documents base test classes (BikerTestCase, DealerTestCase, etc.)

---

### 🧩 **Component Usage Tracking** (Phase 2 - 2 tools)
Understand Vue component dependencies and usage.

#### What You Can Do:
- ✅ "Where is the Button component used?"
- ✅ "Find all unused components in the Employer domain"
- ✅ "How many times is OrderDetail component used?"
- ✅ "Which pages use the Message component?"

#### Why It's Useful:
- Track component dependencies before refactoring
- Identify unused components for cleanup
- Understand component usage patterns
- Safely remove or modify components

#### Technical Details:
- **Import Detection**: Searches for component imports across all .vue files
- **Template Usage**: Counts actual usage in templates (not just imports)
- **Exclusions**: Automatically excludes base components (Shared, Layout)
- **Statistics**: Provides usage counts, domains using, pages vs components

---

### 📄 **Inertia Page Mapping** (Phase 2 - 2 tools)
Map Inertia.js pages to their controllers.

#### What You Can Do:
- ✅ "List all Inertia pages in the Employer domain"
- ✅ "Which controllers render the Order/Index page?"
- ✅ "What props are passed to Auth/UnifiedLogin?"
- ✅ "Find all pages in the application"

#### Why It's Useful:
- Understand page-controller relationships
- Find which controller renders a specific page
- See what props are being passed to pages
- Navigate between frontend and backend code

#### Technical Details:
- **Page Discovery**: Searches all domains for .vue files in /pages directories
- **Controller Matching**: Finds Inertia::render() calls in controllers
- **Page Naming**: Extracts relative page names (e.g., "Order/Index")
- **Domain Organization**: Groups pages by domain

---

### 🔌 **API Endpoint Explorer** (Phase 3 - 2 tools)
List and inspect API endpoints.

#### What You Can Do:
- ✅ "List all API endpoints in Employer domain"
- ✅ "Show me all /async endpoints"
- ✅ "Find details for /async/fleet/orders endpoint"
- ✅ "What endpoints does this controller expose?"

#### Why It's Useful:
- Document available API endpoints
- Understand API structure
- Find endpoint middleware and controllers
- Filter endpoints by domain or prefix

#### Technical Details:
- **Default Prefix**: Defaults to /async but configurable
- **Filtering**: By domain, URI prefix
- **Metadata**: Returns method, URI, controller, middleware, domain
- **Route Integration**: Uses cached route list for performance

---

### 🗄️ **Database Query Helper** (Phase 3 - 2 tools)
Find where and how database tables are used.

#### What You Can Do:
- ✅ "Where is the employer_contracts table used?"
- ✅ "Find the model for users table"
- ✅ "Show me all Eloquent scopes in the User model"
- ✅ "What migrations exist for contracts?"

#### Why It's Useful:
- Find which model uses a table
- Identify raw database queries
- Discover available Eloquent scopes
- Locate related migrations

#### Technical Details:
- **Model Detection**: Searches for protected $table property
- **Query Detection**: Finds DB::table() calls
- **Scope Extraction**: Regex pattern matches scope methods (scopeActive, etc.)
- **Migration Search**: Finds migrations by table name

---

## 🚀 Performance Optimizations

### Route Caching
- **What**: Laravel routes are cached in memory
- **Duration**: 5 minutes (300 seconds)
- **Why**: Avoid expensive `php artisan route:list` calls on every request
- **Cache Key**: Routes stored with timestamp, auto-invalidates after TTL

### Efficient File Searching
- **What**: Uses glob patterns for file system searches
- **Why**: Much faster than recursive directory walking
- **Patterns**: Optimized patterns like `app/**/Controllers/*.php`
- **Ignore Lists**: Automatically skips vendor/, node_modules/

### Smart Filtering
- **What**: Filters applied at query time, not post-processing
- **Why**: Reduces memory usage and improves speed
- **Examples**: Domain filtering in glob patterns, route filtering before iteration

### Lazy Loading
- **What**: Files only read when needed
- **Why**: Avoids reading large files unnecessarily
- **Example**: Component detection only reads files if import regex matches

---

## 🎨 Code Organization

### Domain-Driven
All tools understand O2O's four domains:
- **Core**: Authentication, shared utilities
- **Customer**: Biker-facing features
- **Dealer**: Dealer portal features
- **Employer**: Fleet management features

### Type-Aware
Tools understand different file types:
- Controllers, Repositories, Models, Services
- Transformers, Validation Requests
- Vue Components, Inertia Pages
- Unit Tests, Feature Tests, Cypress Tests

### Pattern Matching
Smart pattern recognition for:
- Repository pattern (Domain vs Infrastructure)
- Test naming conventions
- Component imports
- Eloquent scope methods

---

## 💡 Common Use Cases

### Starting a New Feature
```
1. "Show me all files related to Contract entity"
2. "Find the service chain for Contract"
3. "What routes does ContractController handle?"
4. "Find tests for ContractController"
```

### Code Review
```
1. "Show me untested files in this PR's domain"
2. "Where is this component being used?"
3. "What props does this Inertia page expect?"
4. "Run PHPStan on the changed files"
```

### Refactoring
```
1. "Find all unused components in Employer domain"
2. "Where is the employer_contracts table queried?"
3. "Show me all routes for this controller"
4. "What Eloquent scopes exist on this model?"
```

### Understanding Codebase
```
1. "List all Inertia pages in the application"
2. "Show me the domain structure for Core"
3. "What API endpoints exist in the Dealer domain?"
4. "How are tests organized?"
```

---

## 🔧 Technical Requirements

### Prerequisites
- Node.js 14+ (for running the MCP server)
- O2O Laravel app at the expected path
- Laravel Sail running (for database queries)

### Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `glob` - Fast file system pattern matching
- TypeScript - Type-safe code

### Environment
- Reads from: Configured `O2O_BASE_PATH` (set via environment variable)
- Executes: `php artisan` commands in O2O app context
- Requires: Proper Laravel environment setup

---

## 📊 Statistics

### Coverage
- **Total Tools**: 20
- **Domains Supported**: 4 (Core, Customer, Dealer, Employer)
- **File Types**: 9 (Controllers, Repositories, Models, etc.)
- **Test Types**: 4 (Unit, Feature, Cypress, Component)

### Performance
- **Route Cache TTL**: 5 minutes
- **Typical Query Time**: < 1 second for most operations
- **File Search**: Uses glob patterns for speed
- **Memory**: Minimal footprint with lazy loading

---

## 🆘 Troubleshooting Guide

### "Route not found"
**Cause**: Route cache might be stale or routes haven't been registered
**Solution**: Restart Laravel Sail, ensure routes are defined

### "Component not found"
**Cause**: Component name case-sensitive or in unexpected location
**Solution**: Check exact component name, ensure it's in a components/ directory

### "No tests found"
**Cause**: Tests might not follow naming conventions
**Solution**: Ensure test files end with `Test.php` and are in tests/ directory

### "Database query failed"
**Cause**: Laravel Sail not running or database not accessible
**Solution**: Start Sail with `sail up`, check .env database credentials

### "Domain path not found"
**Cause**: O2O app path mismatch
**Solution**: Update O2O_BASE_PATH in src/index.ts

---

## 🎓 Best Practices

### When to Use Each Tool

**Use `find_related_files`** when:
- Starting work on an existing entity
- Need to see all files for a feature
- Want a quick overview

**Use `find_service_chain`** when:
- Need to understand data flow
- Debugging request lifecycle
- Documenting architecture

**Use test coverage tools** when:
- Reviewing PRs
- Planning test strategy
- Measuring code quality

**Use component tools** when:
- Refactoring components
- Planning component removal
- Understanding dependencies

**Use Inertia tools** when:
- Working on frontend-backend integration
- Debugging prop mismatches
- Understanding page structure

**Use API tools** when:
- Documenting APIs
- Finding endpoint details
- Understanding API structure

**Use database tools** when:
- Optimizing queries
- Understanding table usage
- Finding model relationships

---

## 🔮 Future Enhancements

Potential additions (see NEW_TOOLS_SPECIFICATION.md):
- Event/Listener mapping
- Job/Queue analysis
- Middleware tracking
- Translation key usage
- Asset bundling analysis

---

Built with ❤️ for the O2O team
