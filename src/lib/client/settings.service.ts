"use client";

import type { AppPreferences, NotificationPreferences } from "@/types";
import type { StudentProfileValues } from "@/lib/validations/assignment";
import { authClient } from "@/lib/auth/client";
import { api } from "./api";
import { peekState, refresh, resetStore } from "./store";

const sid = () => peekState()?.viewer.activeStudentId;

export async function updateStudentProfile(values: StudentProfileValues): Promise<void> {
  await api("PATCH", "/api/settings/student", { studentProfileId: sid(), ...values });
  await refresh();
}

export async function updateParentProfile(userId: string, values: { name: string; relation: "Mother" | "Father" | "Guardian" }): Promise<void> {
  await api("PATCH", "/api/settings/parent", { userId, name: values.name, relation: values.relation });
  await refresh();
}

export async function updateNotificationPrefs(patch: Partial<NotificationPreferences>) {
  await api("PATCH", "/api/settings/notifications", patch);
  await refresh();
}

export async function updateAppPrefs(patch: Partial<AppPreferences>) {
  await api("PATCH", "/api/settings/app", { studentProfileId: sid(), ...patch });
  await refresh();
}

export async function inviteParent(email: string, relation: "Mother" | "Father" | "Guardian") {
  const res = await api<{ emailStatus: string; devLink?: string }>("POST", "/api/family/invitations", { email, relation });
  await refresh();
  return res;
}

export async function revokeInvitation(id: string) {
  await api("DELETE", `/api/family/invitations/${id}`);
  await refresh();
}

export async function createStudent(input: { displayName: string; username: string; pin: string; grade: number; school: string }) {
  const res = await api<{ studentProfileId: string }>("POST", "/api/students", input);
  await refresh();
  return res;
}

export async function resetStudentPin(studentProfileId: string, pin: string) {
  await api("POST", `/api/students/${studentProfileId}/pin`, { pin });
}

export async function signOut() {
  await authClient.signOut();
  resetStore();
  window.location.href = "/login";
}
