import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, assessmentsTable, frameworksTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListAssessmentsResponse,
  GetAssessmentResponse,
  CreateAssessmentBody,
  CreateAssessmentResponse,
  UpdateAssessmentBody,
  UpdateAssessmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/assessments", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(assessmentsTable.entityCode, entityCode));
  if (frameworkId) conditions.push(eq(assessmentsTable.frameworkId, frameworkId));
  if (status) conditions.push(eq(assessmentsTable.status, status));

  const query = db.select().from(assessmentsTable).orderBy(assessmentsTable.createdAt);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListAssessmentsResponse.parse(serializeDates(rows)));
});

router.post("/assessments", async (req, res): Promise<void> => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();
  // Resolve frameworkCode from frameworkId
  const fw = await db.select().from(frameworksTable).where(eq(frameworksTable.id, parsed.data.frameworkId));
  const frameworkCode = fw[0]?.code ?? parsed.data.frameworkId;
  const frameworkName = fw[0]?.name ?? null;
  const [row] = await db.insert(assessmentsTable).values({ id, frameworkCode, frameworkName, ...parsed.data }).returning();
  res.status(201).json(CreateAssessmentResponse.parse(serializeDates(row)));
});

router.get("/assessments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(GetAssessmentResponse.parse(serializeDates(rows[0])));
});

router.patch("/assessments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(assessmentsTable).set(parsed.data).where(eq(assessmentsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(UpdateAssessmentResponse.parse(serializeDates(row)));
});

export default router;
