import { prisma } from "./lib/prisma.js";

async function checkDb() {
  try {
    const states = await prisma.appState.findMany();
    console.log("=== AppState Entries ===");
    for (const state of states) {
      console.log(`Key: ${state.key}`);
      console.log(`Value: ${JSON.stringify(state.value, null, 2)}`);
      console.log("------------------------");
    }
  } catch (error) {
    console.error("Error checking database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

await checkDb();
