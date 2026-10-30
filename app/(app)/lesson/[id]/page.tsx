import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ledger";
import { LessonView } from "@/components/lesson/LessonView";
import { chapterOfLesson } from "@/content/chapters";
import { getLesson, lessons } from "@/content/lessons";

// Cache Components needs at least one sample; unknown ids fall through to notFound().
export function generateStaticParams() {
  return Object.keys(lessons).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/lesson/[id]">): Promise<Metadata> {
  const lesson = getLesson((await params).id);
  return { title: lesson?.title ?? "Lesson not found" };
}

export default async function LessonPage({ params }: PageProps<"/lesson/[id]">) {
  const lesson = getLesson((await params).id);
  if (!lesson) notFound();
  const chapter = chapterOfLesson(lesson.id);
  const position = chapter ? chapter.lessonIds.indexOf(lesson.id) + 1 : 1;
  return (
    <>
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 sm:px-14">
        <Breadcrumb
          items={[
            { label: "Chapters", href: "/chapters" },
            ...(chapter ? [{ label: `${chapter.n}. ${chapter.name}`, href: `/chapters#chapter-${chapter.n}` }] : []),
            { label: `Lesson ${position} of ${chapter?.lessonIds.length ?? 1}: ${lesson.title}` },
          ]}
        />
      </div>
      <LessonView lesson={lesson} />
    </>
  );
}
