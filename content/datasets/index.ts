import { shop } from "./shop";
import type { Dataset } from "./types";

export const datasets = { shop } as const satisfies Record<string, Dataset>;
export type DatasetId = keyof typeof datasets;
