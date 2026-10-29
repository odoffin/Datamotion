import type { Metadata } from "next";
import { FilterLesson } from "@/components/lesson/FilterLesson";
import { filterLesson } from "@/content/lessons/filter";

export const metadata: Metadata = { title: filterLesson.title };

export default function FilterLessonPage() {
  return <FilterLesson />;
}
