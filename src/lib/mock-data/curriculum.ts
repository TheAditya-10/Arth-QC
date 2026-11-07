import type { Subject, Topic } from "@/types";

export const SUBJECTS: Subject[] = [
  { id: "mathematics", name: "Mathematics", enabled: true, color: "#292B59" },
  { id: "science", name: "Science", enabled: false, color: "#1F7A55" },
  { id: "english", name: "English", enabled: false, color: "#B54632" },
];

export const TOPICS: Topic[] = [
  { id: "knowing-numbers", subjectId: "mathematics", name: "Knowing Our Numbers", chapter: 1 },
  { id: "whole-numbers", subjectId: "mathematics", name: "Whole Numbers", chapter: 2 },
  { id: "playing-numbers", subjectId: "mathematics", name: "Playing with Numbers", chapter: 3 },
  { id: "basic-geometry", subjectId: "mathematics", name: "Basic Geometrical Ideas", chapter: 4 },
  { id: "elementary-shapes", subjectId: "mathematics", name: "Understanding Elementary Shapes", chapter: 5 },
  { id: "integers", subjectId: "mathematics", name: "Integers", chapter: 6 },
  { id: "fractions", subjectId: "mathematics", name: "Fractions", chapter: 7 },
  { id: "decimals", subjectId: "mathematics", name: "Decimals", chapter: 8 },
];

export function topicName(id: string): string {
  return TOPICS.find((t) => t.id === id)?.name ?? "Mixed topics";
}

export function subjectName(id: string): string {
  return SUBJECTS.find((s) => s.id === id)?.name ?? id;
}
