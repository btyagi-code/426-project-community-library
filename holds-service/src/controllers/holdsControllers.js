import {
  listHolds,
  placeHold
} from "../services/holdsServices.js";

export const getHolds = async (req, res) => {
  try {
    const holds = await listHolds();

    res.status(200).json({
      ok: true,
      holds
    });
  } catch (error) {
    console.error("Unable to retrieve holds:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to retrieve holds."
    });
  }
};

export const createHold = async (req, res) => {
  try {
    const result = await placeHold(req.body);

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error
      });
    }

    return res.status(201).json({
      ok: true,
      hold: result.hold
    });
  } catch (error) {
    console.error("Unable to create hold:", error);

    return res.status(500).json({
      ok: false,
      error: "Unable to create the hold."
    });
  }
};
