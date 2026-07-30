import {
  findAllHolds,
  saveHold
} from "../repositories/holdsRepositories.js";

const cleanText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const listHolds = async () => {
  return findAllHolds();
};

export const placeHold = async (input) => {
  const patronName = cleanText(input.patronName);
  const bookTitle = cleanText(input.bookTitle);
  const branch = cleanText(input.branch);

  if (!patronName) {
    return {
      ok: false,
      status: 400,
      error: "Patron name is required."
    };
  }

  if (!bookTitle) {
    return {
      ok: false,
      status: 400,
      error: "Book title is required."
    };
  }

  if (!branch) {
    return {
      ok: false,
      status: 400,
      error: "Library branch is required."
    };
  }

  const existingHolds = await findAllHolds();

  const duplicateHold = existingHolds.find(
    (hold) =>
      hold.patronName.toLowerCase() === patronName.toLowerCase() &&
      hold.bookTitle.toLowerCase() === bookTitle.toLowerCase()
  );

  if (duplicateHold) {
    return {
      ok: false,
      status: 409,
      error: "This patron already has a hold on that book."
    };
  }

  const hold = {
    id: crypto.randomUUID(),
    patronName,
    bookTitle,
    branch,
    status: "waiting",
    createdAt: new Date().toISOString()
  };

  await saveHold(hold);

  return {
    ok: true,
    hold
  };
};
