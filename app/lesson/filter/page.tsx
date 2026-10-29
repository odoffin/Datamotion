import type { Metadata } from "next";
import { LessonView } from "@/components/lesson/LessonView";
import { filterLesson } from "@/content/lessons/filter";

export const metadata: Metadata = { title: filterLesson.title };

export default function FilterLessonPage() {
  return <LessonView lesson={filterLesson} />;
}
