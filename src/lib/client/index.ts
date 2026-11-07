/**
 * Client service layer. UI components import from here only; every function calls
 * the server API (route handlers) — no business rules run in the browser.
 */
export * as assignmentService from "./assignment.service";
export * as submissionService from "./submission.service";
export * as practiceService from "./practice.service";
export * as buddyService from "./buddy.service";
export * as rewardService from "./rewards.service";
export * as reportService from "./report.service";
export * as settingsService from "./settings.service";
export { useStore, getDB, refresh, setActiveStudent } from "./store";
export type { DemoDB, AppState } from "./store";
