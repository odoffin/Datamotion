import { notFound } from "next/navigation";
import { DbCheck } from "./db-check";

export default function DbCheckPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DbCheck />;
}
