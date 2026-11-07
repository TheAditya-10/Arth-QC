"use client";

import type { AppPreferences, NotificationPreferences, Role, User } from "@/types";
import { sleep } from "@/lib/utils";
import type { ParentProfileValues, StudentProfileValues } from "@/lib/validations/assignment";
import { resetDB, setDB } from "./store";

export async function updateStudentProfile(values: StudentProfileValues): Promise<void> {
  await sleep(500);
  setDB((db) => ({
    ...db,
    student: { ...db.student, ...values },
    users: db.users.map((u) => (u.id === db.student.userId ? { ...u, name: values.name } : u)),
  }));
}

export async function updateParentProfile(id: string, values: ParentProfileValues): Promise<void> {
  await sleep(500);
  setDB((db) => ({
    ...db,
    users: db.users.map((u): User => (u.id === id ? { ...u, ...values } : u)),
    reportSettings: {
      ...db.reportSettings,
      recipients: db.reportSettings.recipients.map((r) => (r.id === id ? { ...r, name: values.name, email: values.email } : r)),
    },
  }));
}

export function updateNotificationPrefs(patch: Partial<NotificationPreferences>) {
  setDB((db) => ({ ...db, notificationPrefs: { ...db.notificationPrefs, ...patch } }));
}

export function updateAppPrefs(patch: Partial<AppPreferences>) {
  setDB((db) => ({ ...db, appPrefs: { ...db.appPrefs, ...patch } }));
}

export async function resetDemoData(): Promise<void> {
  await sleep(400);
  resetDB();
}

// ---- Demo role (no real authentication in Phase 1) ----
const ROLE_KEY = "arthqc.demo.role";

export function getDemoRole(): Role | null {
  try {
    const r = window.localStorage.getItem(ROLE_KEY);
    return r === "student" || r === "parent" ? r : null;
  } catch {
    return null;
  }
}

export function setDemoRole(role: Role) {
  try {
    window.localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}
