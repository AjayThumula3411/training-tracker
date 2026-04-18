import express from "express";
import {
  deleteFeedback,
  getFeedbackByDeveloper,
  giveFeedback,
  getMyFeedback,
  updateFeedback,
} from "../controllers/feedback.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/", authenticate, giveFeedback);
router.get("/my", authenticate, getMyFeedback);
router.patch("/:id", authenticate, updateFeedback);
router.delete("/:id", authenticate, deleteFeedback);
router.get("/:developerId", authenticate, getFeedbackByDeveloper);

export default router;
