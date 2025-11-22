import "dotenv/config";
import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// =============================================================================
// MCP Client
// =============================================================================

const mastraMcp = new MCPClient({
  id: "mastra-docs",
  servers: {
    mastra: {
      command: "npx",
      args: ["-y", "@mastra/mcp-docs-server@latest"],
    },
  },
});

// =============================================================================
// Agents
// =============================================================================

const keyPointsAgent = new Agent({
  name: "Workshop Key Points Generator",
  instructions: `You are an assistant that generates key points for a workshop description.

Your task:
1. Analyze the workshop information provided
2. Use the Mastra docs tools to understand the high-level concepts related to the workshop topics
3. Generate a list of compelling key points that:
   - Clearly explain what attendees will learn and what to expect
   - Focus on concepts and mental models, not specific API methods or classes
   - Identify pain points developers face that the workshop content addresses

Important rules:
- Only include information directly supported by the workshop details provided
- Do not promise outcomes (like "real-world applications" or "best practices") unless explicitly stated in the input
- Focus on what will be taught and built, not production concerns like error handling or debugging
- Keep points high-level and conceptual - avoid listing specific function names or class methods
- The workshop is hands-on and practical, but emphasize the "what" and "why", not implementation details
- Never use the word "delve" in any context

Return a structured list of 5-7 key points with brief explanations.`,
  model: "openai/gpt-4o-mini",
  // tools: await mastraMcp.listTools(),
});

const descriptionAgent = new Agent({
  name: "Workshop Description Writer",
  instructions: `You are a developer-focused copywriter. Take key points about a workshop and craft a compelling title and description.

Focus on the reader:
- Lead with what THEY will be able to do by the end, not what the workshop "covers" or "provides"
- Frame everything as outcomes and capabilities they'll gain
- Use "you will build", "you'll learn to", "by the end, you can" - not "this workshop covers"
- Be specific about the tangible result: what will they have built? What will they understand?

Your style:
- Direct and clear - state what's coming next without filler phrases
- Technical but accessible to devs who are new to AI
- Professional without being dry - confident, not enthusiastic
- Get to the point - devs appreciate brevity

Avoid:
- Passive descriptions of what the workshop "offers", "provides", or "covers"
- Worn-out idioms and clichés (e.g. "roll up your sleeves", "dive into", "take a deep dive", "delve")
- Empty enthusiasm or hype phrases (e.g. "Get ready!", "Join us to transform...")
- Mentioning specific framework names (like Mastra) in the title - focus on what attendees will learn
- Corporate-speak or marketing fluff
- The word "delve" in any context`,
  model: "openai/gpt-4o-mini",
});

// =============================================================================
// Workflow
// =============================================================================

const generateKeyPointsStep = createStep({
  id: "generate-key-points",
  inputSchema: z.object({
    hosts: z.string(),
    learningOutcomes: z.string(),
    targetAudience: z.string(),
  }),
  outputSchema: z.object({
    keyPoints: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("🔍 Researching Mastra docs and generating key points...\n");

    const response = await keyPointsAgent.generate(
      `Generate key points for this workshop:

Hosts: ${inputData.hosts}
Learning Outcomes: ${inputData.learningOutcomes}
Target Audience: ${inputData.targetAudience}

Use the Mastra docs to find specific features and capabilities that relate to the learning outcomes. Include concrete examples of what Mastra can do.`,
    );

    console.log("Key Points Generated:");
    console.log("-".repeat(50));
    console.log(response.text);
    console.log("-".repeat(50));

    return { keyPoints: response.text };
  },
});

const refineDescriptionStep = createStep({
  id: "refine-description",
  inputSchema: z.object({
    keyPoints: z.string(),
  }),
  outputSchema: z.object({
    title: z.string(),
    description: z.string(),
  }),
  execute: async ({ inputData }) => {
    console.log("\n✍️  Refining into workshop description...\n");

    const response = await descriptionAgent.generate(
      `Turn these key points into a compelling workshop title and description:

${inputData.keyPoints}`,
      {
        structuredOutput: {
          schema: z.object({
            title: z.string(),
            description: z.string(),
          }),
        },
      },
    );

    console.log("Final Workshop Description:");
    console.log("=".repeat(50));
    console.log(`Title: ${response.object.title}`);
    console.log(`\nDescription:\n${response.object.description}`);
    console.log("=".repeat(50));

    return {
      title: response.object.title,
      description: response.object.description,
    };
  },
});

const workshopWorkflow = createWorkflow({
  id: "workshop-workflow",
  inputSchema: z.object({
    hosts: z.string(),
    learningOutcomes: z.string(),
    targetAudience: z.string(),
  }),
  outputSchema: z.object({
    title: z.string(),
    description: z.string(),
  }),
})
  .then(generateKeyPointsStep)
  .then(refineDescriptionStep)
  .commit();

// =============================================================================
// Mastra Instance
// =============================================================================

const mastra = new Mastra({
  agents: { keyPointsAgent, descriptionAgent },
  workflows: { workshopWorkflow },
});

// =============================================================================
// Main
// =============================================================================

async function main() {
  const workflow = mastra.getWorkflow("workshopWorkflow");
  const run = await workflow.createRun();

  const result = await run.start({
    inputData: {
      hosts:
        "Alex Booker (Developer Experience) and Abhi Aiyer (CTO and co-founder)",
      learningOutcomes:
        "We're going to teach you about agent networks from first principles and how they work in Mastra.We'll start by explaining what they are, highlight when they're useful compared to other approaches like workflows, show you lots of code, make it clear what problem they solve and how you can use them specifically with Mastra. there will also be questions and answers in case you need help",
      targetAudience:
        "TypeScript developers with basic experience building agents",
    },
  });

  if (result.status === "success") {
    console.log("\n✅ Workflow completed successfully!");
  } else {
    console.log("\nWorkflow status:", result.status);
  }

  await mastraMcp.disconnect();
}

main();
