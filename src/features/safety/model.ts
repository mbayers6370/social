import { z } from "zod";
export const reportSchema = z.strictObject({
  target: z.strictObject({
    kind: z.enum(["profile", "post", "comment", "message"]),
    id: z.string().min(1).max(100),
    personId: z.string().min(1).max(100),
    label: z.string().min(1).max(160),
  }),
  reason: z.enum(["harassment", "spam", "privacy", "harmful", "other"]),
  details: z.string().trim().max(1000),
});
export type ReportInput = z.infer<typeof reportSchema>;
export type SafetyReport = ReportInput & {
  id: string;
  createdAt: string;
  status: "saved-locally";
};
export const reportReasons = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam or scams" },
  { value: "privacy", label: "Privacy or consent" },
  { value: "harmful", label: "Harmful or inappropriate content" },
  { value: "other", label: "Something else" },
] as const;
