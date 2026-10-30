import { lesson } from "./define";
import { filterLesson } from "./filter";

/** Chapter 3: Filtering. WHERE and its traps. */
export const filtering = [
  filterLesson,
  lesson({
    id: "and-or",
    title: "Combine tests with AND and OR",
    concepts: ["AND", "OR", "Parentheses"],
    headline: "Two tests: both must pass, or either may.",
    explanation: {
      short: "AND keeps a row only when both tests pass. OR keeps it when at least one passes.",
      long: [
        "amount > 150 AND amount < 10 asks for orders that are over 150 and under 10 at the same time. No order can be both, so nothing comes back. OR is what you want for 'either end'.",
        "When you mix AND and OR, AND is worked out first. Add parentheses to say what you mean: WHERE city = 'Lagos' AND (amount < 10 OR amount > 150).",
      ],
    },
    table: "orders",
    goal: { description: "List the orders whose amount is over 150 or under 10, with all their columns.", referenceSql: "SELECT * FROM orders WHERE amount > 150 OR amount < 10" },
    starterSql: "SELECT * FROM orders WHERE amount > 150 AND amount < 10",
    task: "This query runs but finds nothing. Work out why, then fix it.",
    hints: ["Can one amount be over 150 and under 10 at the same time?", "AND needs both tests to pass. OR needs at least one."],
  }),
  lesson({
    id: "between",
    title: "Ranges with BETWEEN",
    concepts: ["BETWEEN", "Boundaries"],
    headline: "BETWEEN includes both ends.",
    explanation: {
      short: "price BETWEEN 25 AND 50 keeps prices from 25 up to 50, including 25 and 50 themselves.",
      long: [
        "It is the same as price >= 25 AND price <= 50. With > and < instead, the two end values are left out, which is the same boundary trap as in the first filtering lesson.",
        "The smaller number comes first. BETWEEN 50 AND 25 finds nothing.",
      ],
    },
    table: "products",
    goal: { description: "List the products priced from 25 to 50, including 25 and 50, with all their columns.", referenceSql: "SELECT * FROM products WHERE price BETWEEN 25 AND 50" },
    starterSql: "SELECT * FROM products WHERE price > 25 AND price < 50",
    task: "This query leaves out two products the goal wants. Find them and fix the rule.",
    hints: ["Look at the products priced exactly 25 and exactly 50.", "BETWEEN 25 AND 50 keeps both ends; > and < drop them."],
  }),
  lesson({
    id: "like",
    title: "Match text with LIKE",
    concepts: ["LIKE", "% wildcard", "IN"],
    headline: "Find text that fits a pattern.",
    explanation: {
      short: "city LIKE 'L%' keeps cities that start with L. The % stands for any run of characters, including none.",
      long: [
        "= compares the whole value, so city = 'L%' looks for a city literally called L%. LIKE treats % as a wildcard; an underscore _ stands for exactly one character.",
        "To match a short list of exact values, use IN: city IN ('Lagos', 'Lyon') is shorter than two tests joined with OR.",
        "LIKE cares about capital letters. ILIKE ignores them: city ILIKE 'l%' also finds Lagos.",
      ],
    },
    table: "customers",
    goal: { description: "List the customers whose city starts with the letter L, with all their columns.", referenceSql: "SELECT * FROM customers WHERE city LIKE 'L%'" },
    starterSql: "SELECT * FROM customers WHERE city = 'L%'",
    task: "This query looks for a city literally called L%. Make it match any city that starts with L.",
    hints: ["= compares the whole value. Which word matches a pattern?", "In a pattern, % stands for any run of characters."],
  }),
  lesson({
    id: "is-null",
    title: "Missing values and IS NULL",
    concepts: ["NULL", "IS NULL", "Unknown"],
    headline: "NULL means unknown, so test it with IS NULL.",
    explanation: {
      short: "Some reviews have no comment: the value is NULL, meaning unknown. A test like comment = NULL is never true, so use comment IS NULL.",
      long: [
        "Comparing anything with NULL gives unknown, not true or false. WHERE keeps a row only when its test is true, so rows with an unknown answer quietly drop out.",
        "Even NULL = NULL is unknown: two unknown values are not known to be equal. IS NULL and IS NOT NULL are the only reliable tests.",
        "NOT does not help either. NOT (unknown) is still unknown.",
      ],
    },
    table: "reviews",
    goal: { description: "List the reviews that have no comment, with all their columns.", referenceSql: "SELECT * FROM reviews WHERE comment IS NULL" },
    starterSql: "SELECT * FROM reviews WHERE comment = NULL",
    task: "This query finds nothing, though some reviews have no comment. Fix the test.",
    hints: ["NULL means unknown. Is unknown equal to unknown?", "Write IS NULL instead of = NULL."],
  }),
];

/** Chapter 4: Sorting and conditional logic. */
export const sorting = [
  lesson({
    id: "order-by",
    title: "Sort with ORDER BY",
    concepts: ["ORDER BY", "Ascending"],
    headline: "Put the rows in the order you want.",
    scene: "sort",
    explanation: {
      short: "ORDER BY price sorts the result from the lowest price to the highest. Without ORDER BY, the order is not promised.",
      long: [
        "Sorting happens near the very end, after the rows have been chosen. It changes the order of the result, never the table.",
        "Text sorts alphabetically, dates from earliest to latest, numbers from smallest to largest.",
      ],
    },
    table: "products",
    goal: { description: "List all products from cheapest to most expensive, with all their columns.", referenceSql: "SELECT * FROM products ORDER BY price", compare: "rows-ordered" },
    starterSql: "SELECT * FROM products ORDER price",
    task: "A word is missing from the sort. Run it and add the word the red pen asks for.",
    hints: ["It is two words: ORDER and one more.", "Write ORDER BY price."],
  }),
  lesson({
    id: "order-desc",
    title: "Biggest first with DESC",
    concepts: ["DESC", "ORDER BY"],
    headline: "Sort the other way with DESC.",
    scene: "sort",
    explanation: {
      short: "ORDER BY price DESC sorts from the highest price to the lowest. DESC means descending; the default, ASC, is ascending.",
      long: [
        "DESC belongs to the column just before it. In ORDER BY category, price DESC, only price is reversed.",
        "Top-N questions, like the three most expensive products, are ORDER BY ... DESC followed by LIMIT 3.",
      ],
    },
    table: "products",
    goal: { description: "List all products from most expensive to cheapest, with all their columns.", referenceSql: "SELECT * FROM products ORDER BY price DESC", compare: "rows-ordered" },
    starterSql: "SELECT * FROM products ORDER BY price",
    task: "The products come out cheapest first. Turn the sort around.",
    hints: ["Which word reverses a sort?", "Add DESC after price."],
  }),
  lesson({
    id: "sort-two",
    title: "Sort by two columns",
    concepts: ["Several sort keys", "Ties"],
    headline: "The first sort groups, the second breaks ties.",
    scene: "sort",
    explanation: {
      short: "ORDER BY customer_id, amount DESC sorts by customer first; within each customer, the biggest order comes first.",
      long: [
        "The second column only matters when the first is tied. Here it orders the rows inside each customer.",
        "Each column has its own direction. customer_id is ascending (the default) and amount is descending.",
      ],
    },
    table: "orders",
    goal: {
      description: "List customer_id, id and amount for every order: lowest customer_id first, and within each customer, biggest amount first.",
      referenceSql: "SELECT customer_id, id, amount FROM orders ORDER BY customer_id, amount DESC",
      compare: "rows-ordered",
    },
    starterSql: "SELECT customer_id, id, amount FROM orders ORDER BY amount DESC, customer_id",
    task: "The sort keys are in the wrong order: this sorts by amount first. Make customer the first sort.",
    hints: ["The first column after ORDER BY decides the main order.", "Swap them: customer_id first, then amount DESC."],
  }),
  lesson({
    id: "case",
    title: "If-then rules with CASE",
    concepts: ["CASE", "WHEN", "ELSE"],
    headline: "Label each row with CASE.",
    explanation: {
      short: "CASE WHEN amount > 100 THEN 'large' ELSE 'small' END works out a value for every row: large or small.",
      long: [
        "The rules are tried in order and the first that is true wins. ELSE covers everything else; without it, rows that match no rule get NULL.",
        "Every CASE ends with END. Give the new column a name with AS.",
      ],
    },
    table: "orders",
    goal: {
      description: "List each order's id and amount, plus a column called size that says large when the amount is over 100 and small otherwise.",
      referenceSql: "SELECT id, amount, CASE WHEN amount > 100 THEN 'large' ELSE 'small' END AS size FROM orders",
    },
    starterSql: "SELECT id, amount, CASE WHEN amount > 100 THEN 'large' ELSE 'small' AS size FROM orders",
    task: "The CASE is not finished. Run it and add the word the red pen asks for.",
    hints: ["Every CASE needs a word to close it.", "Write END before AS size."],
  }),
];
