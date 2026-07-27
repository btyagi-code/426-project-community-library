import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const dataFile = path.resolve(
  currentDirectory,
  "../../data/holds.json"
);

const readHoldsFile = async () => {
  try {
    const fileContents = await readFile(dataFile, "utf8");
    return JSON.parse(fileContents);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(dataFile, "[]", "utf8");
      return [];
    }

    throw error;
  }
};

const writeHoldsFile = async (holds) => {
  await writeFile(
    dataFile,
    JSON.stringify(holds, null, 2),
    "utf8"
  );
};

export const findAllHolds = async () => {
  return readHoldsFile();
};

export const saveHold = async (hold) => {
  const holds = await readHoldsFile();
  const updatedHolds = [...holds, hold];

  await writeHoldsFile(updatedHolds);

  return hold;
};