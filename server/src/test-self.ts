import { PrismaClient } from "@prisma/client";
import assert from "assert";
import { assemblePrompt } from "./prompts/assembler.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting NovelForge self-check assertions...");

  // 1. Test database operations
  try {
    const testNovel = await prisma.novel.create({
      data: {
        title: "Test Self Check Title",
        genre: "Sci-Fi",
        premise: "A scientist discovers an ancient artifact.",
        subgenre: "Space Opera",
        tone: JSON.stringify(["Epic", "Exciting"]),
        themes: JSON.stringify(["Exploration", "Identity"]),
      },
    });

    console.log(`- Created novel: ${testNovel.title} (${testNovel.id})`);
    assert.strictEqual(testNovel.title, "Test Self Check Title");
    assert.strictEqual(testNovel.genre, "Sci-Fi");

    const fetched = await prisma.novel.findUnique({
      where: { id: testNovel.id },
    });
    assert(fetched !== null);
    assert.strictEqual(fetched.genre, "Sci-Fi");

    // Clean up
    await prisma.novel.delete({ where: { id: testNovel.id } });
    console.log("- Database assertion passed and cleaned up successfully.");
  } catch (error) {
    console.error("Database assertion failed!", error);
    process.exit(1);
  }

  // 2. Test prompt assembly
  try {
    const testCtx = {
      novel: {
        title: "The Iron Saga",
        genre: "Fantasy",
        subgenre: "Grimdark",
        tone: JSON.stringify(["Dark"]),
        themes: JSON.stringify(["War", "Sacrifice"]),
        premise: "An empire falls to shadow.",
      },
    };

    const assembled = assemblePrompt("QUESTIONNAIRE", testCtx);
    assert(assembled.userPrompt.includes("The Iron Saga"));
    assert(assembled.systemPrompt.includes("professional, bestselling novelist"));
    console.log("- Prompt assembly assertion passed.");
  } catch (error) {
    console.error("Prompt assembly assertion failed!", error);
    process.exit(1);
  }

  console.log("All self-check assertions passed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandle test exception:", err);
  process.exit(1);
});
