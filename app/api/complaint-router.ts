import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  listComplaints,
  getComplaint,
  createComplaint,
  updateComplaintStatus,
  addComplaintMessage,
} from "./queries/complaints";

export type { Complaint, ComplaintMessage, ComplaintStatus, ReporterType } from "./queries/complaints";

const statusSchema = z.enum(["Open", "In Progress", "Resolved", "Closed"]);
const reporterTypeSchema = z.enum(["Customer", "Driver"]);

export const complaintRouter = createRouter({
  list: publicQuery.input(z.object({ status: statusSchema.optional() }).optional()).query(({ input }) => listComplaints(input?.status)),

  get: publicQuery.input(z.object({ id: z.string() })).query(({ input }) => getComplaint(input.id)),

  create: publicQuery
    .input(
      z.object({
        subject: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(2000),
        reporterName: z.string().trim().min(1).max(80),
        reporterPhone: z.string().trim().min(1).max(20),
        reporterType: reporterTypeSchema,
        relatedRideId: z.string().trim().max(30).optional(),
      })
    )
    .mutation(({ input }) => createComplaint(input)),

  updateStatus: publicQuery
    .input(z.object({ id: z.string(), status: statusSchema }))
    .mutation(({ input }) => updateComplaintStatus(input.id, input.status)),

  addMessage: publicQuery
    .input(z.object({ id: z.string(), sender: z.enum(["admin", "reporter"]), text: z.string().trim().min(1).max(1000) }))
    .mutation(({ input }) => addComplaintMessage(input.id, input.sender, input.text)),
});
