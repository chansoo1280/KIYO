import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import { z } from "zod";

const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

// Database IDs
const DATABASES = {
  tasks: "a621214a-c161-4b85-a8ad-0041865f1bfe",
  projects: "1ccd72ea-afd1-4755-a588-9c096d74d76b",
  decisions: "31c4b5f0-0c5b-42a4-83ec-35380245957d",
  bugs: "0ff73c12-75bb-47c4-990b-5a41e663f649",
  changelog: "aef93451-aa2a-4ecd-8fc2-8d3552b64477"
};

const server = new Server(
  {
    name: "notion-kiyo",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "notion_search",
        description: "Search across KIYO Notion databases",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            database: { 
              type: "string", 
              enum: ["tasks", "projects", "decisions", "bugs", "changelog", "all"],
              default: "all"
            },
            limit: { type: "number", default: 10 }
          },
          required: ["query"]
        }
      },
      {
        name: "notion_create_task",
        description: "Create a new task in KIYO Tasks",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: ["Backlog", "Todo", "In Progress", "Review", "Done", "Blocked"], default: "Todo" },
            priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"], default: "Medium" },
            tags: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            projectId: { type: "string" }
          },
          required: ["title"]
        }
      },
      {
        name: "notion_create_decision",
        description: "Record an architectural/technical decision",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            status: { type: "string", enum: ["Proposed", "Accepted", "Rejected", "Superseded", "Deferred"], default: "Proposed" },
            context: { type: "string" },
            decision: { type: "string" },
            consequences: { type: "string" },
            tags: { type: "array", items: { type: "string" } }
          },
          required: ["title"]
        }
      },
      {
        name: "notion_create_bug",
        description: "Log a bug",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["Critical", "High", "Medium", "Low"], default: "Medium" },
            component: { type: "string", enum: ["autofill", "crypto", "database", "ui", "android", "build"] },
            stepsToReproduce: { type: "string" },
            expectedBehavior: { type: "string" },
            actualBehavior: { type: "string" },
            tags: { type: "array", items: { type: "string" } }
          },
          required: ["title"]
        }
      },
      {
        name: "notion_add_changelog",
        description: "Add a changelog entry",
        inputSchema: {
          type: "object",
          properties: {
            version: { type: "string" },
            type: { type: "string", enum: ["Feature", "Fix", "Refactor", "Docs", "Breaking"], default: "Feature" },
            description: { type: "string" },
            components: { type: "array", items: { type: "string" } },
            breakingChanges: { type: "string" }
          },
          required: ["version"]
        }
      },
      {
        name: "notion_query_database",
        description: "Query any database with filters",
        inputSchema: {
          type: "object",
          properties: {
            database: { type: "string", enum: ["tasks", "projects", "decisions", "bugs", "changelog"] },
            filter: { type: "object" },
            sorts: { type: "array" },
            limit: { type: "number", default: 20 }
          },
          required: ["database"]
        }
      },
      {
        name: "notion_get_page",
        description: "Read a page as Markdown",
        inputSchema: {
          type: "object",
          properties: {
            pageId: { type: "string" }
          },
          required: ["pageId"]
        }
      },
      {
        name: "notion_update_task_status",
        description: "Update task status",
        inputSchema: {
          type: "object",
          properties: {
            pageId: { type: "string" },
            status: { type: "string", enum: ["Backlog", "Todo", "In Progress", "Review", "Done", "Blocked"] }
          },
          required: ["pageId", "status"]
        }
      }
    ]
  }
);

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "notion_search": {
        const { query, database = "all", limit = 10 } = args;
        const dbs = database === "all" 
          ? Object.values(DATABASES) 
          : [DATABASES[database]];
        
        const results = [];
        for (const db of dbs) {
          const response = await notion.databases.query({
            database_id: db,
            filter: {
              property: "Name",
              title: { contains: query }
            },
            page_size: limit
          });
          results.push(...response.results);
        }
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "notion_create_task": {
        const { title, status = "Todo", priority = "Medium", tags = [], description, projectId } = args;
        
        const properties: any = {
          Name: { title: [{ text: { content: title } }] },
          Status: { select: { name: status } },
          Priority: { select: { name: priority } },
          Tags: { multi_select: tags.map(t => ({ name: t })) }
        };
        
        if (description) {
          properties.Description = { rich_text: [{ text: { content: description } }] };
        }
        
        if (projectId) {
          properties.Project = { relation: [{ id: projectId }] };
        }
        
        const response = await notion.pages.create({
          parent: { database_id: DATABASES.tasks },
          properties
        });
        return { content: [{ type: "text", text: `Created task: ${response.url}` }] };
      }

      case "notion_create_decision": {
        const { title, status = "Proposed", context, decision, consequences, tags = [] } = args;
        
        const properties: any = {
          Name: { title: [{ text: { content: title } }] },
          Status: { select: { name: status } },
          Tags: { multi_select: tags.map(t => ({ name: t })) }
        };
        
        if (context) properties.Context = { rich_text: [{ text: { content: context } }] };
        if (decision) properties.Decision = { rich_text: [{ text: { content: decision } }] };
        if (consequences) properties.Consequences = { rich_text: [{ text: { content: consequences } }] };
        
        const response = await notion.pages.create({
          parent: { database_id: DATABASES.decisions },
          properties
        });
        return { content: [{ type: "text", text: `Created decision: ${response.url}` }] };
      }

      case "notion_create_bug": {
        const { title, severity = "Medium", component, stepsToReproduce, expectedBehavior, actualBehavior, tags = [] } = args;
        
        const properties: any = {
          Name: { title: [{ text: { content: title } }] },
          Severity: { select: { name: severity } },
          Component: { select: { name: component } },
          Tags: { multi_select: tags.map(t => ({ name: t })) }
        };
        
        if (stepsToReproduce) properties["Steps to Reproduce"] = { rich_text: [{ text: { content: stepsToReproduce } }] };
        if (expectedBehavior) properties["Expected Behavior"] = { rich_text: [{ text: { content: expectedBehavior } }] };
        if (actualBehavior) properties["Actual Behavior"] = { rich_text: [{ text: { content: actualBehavior } }] };
        
        const response = await notion.pages.create({
          parent: { database_id: DATABASES.bugs },
          properties
        });
        return { content: [{ type: "text", text: `Created bug: ${response.url}` }] };
      }

      case "notion_add_changelog": {
        const { version, type = "Feature", description, components = [], breakingChanges } = args;
        
        const properties: any = {
          Name: { title: [{ text: { content: version } }] },
          Version: { rich_text: [{ text: { content: version } }] },
          Type: { select: { name: type } },
          Date: { date: { start: new Date().toISOString().split("T")[0] } },
          Components: { multi_select: components.map(c => ({ name: c })) }
        };
        
        if (description) properties.Description = { rich_text: [{ text: { content: description } }] };
        if (breakingChanges) properties["Breaking Changes"] = { rich_text: [{ text: { content: breakingChanges } }] };
        
        const response = await notion.pages.create({
          parent: { database_id: DATABASES.changelog },
          properties
        });
        return { content: [{ type: "text", text: `Added changelog: ${response.url}` }] };
      }

      case "notion_query_database": {
        const { database, filter, sorts = [], limit = 20 } = args;
        
        const response = await notion.databases.query({
          database_id: DATABASES[database],
          filter,
          sorts,
          page_size: limit
        });
        return { content: [{ type: "text", text: JSON.stringify(response.results, null, 2) }] };
      }

      case "notion_get_page": {
        const { pageId } = args;
        const response = await notion.blocks.children.list({ block_id: pageId });
        // Convert blocks to markdown (simplified)
        return { content: [{ type: "text", text: JSON.stringify(response.results, null, 2) }] };
      }

      case "notion_update_task_status": {
        const { pageId, status } = args;
        
        const response = await notion.pages.update({
          page_id: pageId,
          properties: {
            Status: { select: { name: status } }
          }
        });
        return { content: [{ type: "text", text: `Updated task status to ${status}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }] };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Notion KIYO MCP Server running");
