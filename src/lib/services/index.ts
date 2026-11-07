/**
 * Service layer barrel. UI components import from here only.
 * Phase 2: re-implement these modules against real APIs (same signatures).
 */
export * as assignmentService from "./assignment.service";
export * as submissionService from "./submission.service";
export * as practiceService from "./practice.service";
export * as buddyService from "./buddy.service";
export * as rewardService from "./rewards.service";
export * as reportService from "./report.service";
export * as settingsService from "./settings.service";
export { useStore, getDB } from "./store";
export type { DemoDB } from "./store";
