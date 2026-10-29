import { filterLesson } from "./filter";
import type { LessonDefinition } from "./types";

/** Every lesson with real content. Only Filtering exists so far. */
export const lessons: Readonly<Record<string, LessonDefinition>> = {
  [filterLesson.id]: filterLesson,
};

export function getLesson(id: string): LessonDefinition | undefined {
  return Object.hasOwn(lessons, id) ? lessons[id] : undefined;
}
