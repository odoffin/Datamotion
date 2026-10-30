import { lesson } from "./define";

/** Chapter 5: Functions. Reshape values one row at a time. */
export const functions = [
  lesson({
    id: "upper",
    title: "Change text with UPPER",
    concepts: ["Functions", "UPPER", "LOWER"],
    headline: "A function turns one value into another.",
    explanation: {
      short: "UPPER(city) gives the city in capital letters. A function takes a value in brackets and hands back a new one, for every row.",
      long: [
        "The table is not changed: UPPER only changes what the result shows. LOWER does the opposite, and LENGTH(name) counts the characters.",
        "A calculated column needs a name, so add AS city to keep the heading readable.",
      ],
    },
    table: "customers",
    goal: {
      description: "List every customer's name, and their city in capital letters, in columns called name and city.",
      referenceSql: "SELECT name, UPPER(city) AS city FROM customers",
    },
    starterSql: "SELECT name, UPPPER(city) AS city FROM customers",
    hints: ["Function names must be spelt exactly.", "The function for capitals is UPPER."],
  }),
  lesson({
    id: "round",
    title: "Round numbers with ROUND",
    concepts: ["ROUND", "Arithmetic"],
    headline: "Do arithmetic, then round the answer.",
    explanation: {
      short: "price * 1.2 adds 20% to a price. ROUND(price * 1.2, 2) rounds the answer to two decimal places.",
      long: [
        "You can use + - * / on number columns, row by row. The table keeps its values; only the result changes.",
        "ROUND takes a second number: how many decimal places to keep. Without it, ROUND rounds to a whole number.",
      ],
    },
    table: "products",
    goal: {
      description: "List each product's name and its price with 20% tax added, rounded to 2 decimal places, in columns called name and with_tax.",
      referenceSql: "SELECT name, ROUND(price * 1.2, 2) AS with_tax FROM products",
    },
    starterSql: "SELECT name, ROUND(price * 1.2) AS with_tax FROM products",
    task: "The prices come out as whole numbers. Keep two decimal places.",
    hints: ["ROUND takes a second number: how many decimal places to keep.", "Write ROUND(price * 1.2, 2)."],
  }),
  lesson({
    id: "dates",
    title: "Work with dates",
    concepts: ["Dates", "month()", "EXTRACT"],
    headline: "Pull the month out of a date.",
    explanation: {
      short: "month(order_date) gives the month as a number: 1 for January, 2 for February. Use it like any other value, for example in WHERE.",
      long: [
        "year(), month() and day() take a date apart. EXTRACT(month FROM order_date) does the same in the standard way.",
        "You can also compare dates directly: order_date >= DATE '2026-02-01' keeps orders from the first of February on.",
      ],
    },
    table: "orders",
    goal: { description: "List the orders placed in February 2026, with all their columns.", referenceSql: "SELECT * FROM orders WHERE month(order_date) = 2" },
    starterSql: "SELECT * FROM orders WHERE month(order_date) = 1",
    task: "This lists January's orders. Change it to February.",
    hints: ["month() returns 1 for January and 2 for February."],
  }),
  lesson({
    id: "concat",
    title: "Join text with ||",
    concepts: ["||", "Concatenation"],
    headline: "Glue pieces of text together.",
    explanation: {
      short: "name || ' lives in ' || city joins three pieces of text into one: Amara Okafor lives in Lagos.",
      long: [
        "|| joins text. Remember the spaces inside the quotes, or the words run together.",
        "If any piece is NULL, the whole result is NULL. concat(name, ' lives in ', city) treats NULL as empty text instead.",
      ],
    },
    table: "customers",
    goal: {
      description: "List one sentence per customer, like Amara Okafor lives in Lagos, in a column called line.",
      referenceSql: "SELECT name || ' lives in ' || city AS line FROM customers",
    },
    starterSql: "SELECT name || ' lives in ' city AS line FROM customers",
    hints: ["Each piece needs || between it and the next.", "Add || between ' lives in ' and city."],
  }),
];

/** Chapter 6: Aggregation. Many rows in, one answer out (per group). */
export const aggregation = [
  lesson({
    id: "sum",
    title: "Add up a column with SUM",
    concepts: ["SUM", "COUNT", "Aggregates"],
    headline: "Turn a whole column into one number.",
    scene: "aggregate",
    explanation: {
      short: "SUM(amount) adds up every amount. COUNT counts rows, AVG averages, MIN and MAX find the smallest and largest.",
      long: [
        "These are aggregate functions: they read many rows and return one value. Without GROUP BY, the whole table becomes one row.",
        "COUNT(amount) counts the rows where amount is not NULL. It counts; it does not add.",
      ],
    },
    table: "orders",
    goal: { description: "What is the total of all order amounts? One row with a column called total.", referenceSql: "SELECT SUM(amount) AS total FROM orders" },
    starterSql: "SELECT COUNT(amount) AS total FROM orders",
    task: "This counts the orders instead of adding up their amounts. Fix it.",
    hints: ["COUNT counts rows. Which function adds numbers?", "Use SUM(amount)."],
  }),
  lesson({
    id: "group-by",
    title: "One answer per group",
    concepts: ["GROUP BY", "COUNT(*)"],
    headline: "GROUP BY gives one row per group.",
    scene: "aggregate",
    explanation: {
      short: "GROUP BY customer_id puts each customer's orders in a pile; COUNT(*) then counts each pile. The result has one row per customer.",
      long: [
        "Every column in SELECT must either be in GROUP BY or be inside an aggregate like COUNT or SUM. Otherwise the database cannot know which of the many values in a pile to show.",
        "The order of work is: FROM picks the table, WHERE removes rows, GROUP BY makes the piles, then SELECT works out each pile's answer.",
      ],
    },
    table: "orders",
    goal: {
      description: "For each customer_id, how many orders? Return customer_id and orders.",
      referenceSql: "SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id",
    },
    starterSql: "SELECT customer_id, COUNT(*) AS orders FROM orders",
    task: "This query does not say how to group the orders. Run it and add the missing clause.",
    hints: ["Which column should each pile share?", "Add GROUP BY customer_id at the end."],
  }),
  lesson({
    id: "avg",
    title: "Average per group with AVG",
    concepts: ["AVG", "MIN and MAX"],
    headline: "Pick the aggregate that answers the question.",
    scene: "aggregate",
    explanation: {
      short: "AVG(price) gives the average price. With GROUP BY category, you get one average per category.",
      long: [
        "MAX finds the biggest value in each pile and MIN the smallest. Choose the aggregate that matches the question you are asking.",
        "AVG skips NULL values, so a missing price does not drag the average down.",
      ],
    },
    table: "products",
    goal: {
      description: "For each product category, the average price, in columns category and avg_price.",
      referenceSql: "SELECT category, AVG(price) AS avg_price FROM products GROUP BY category",
    },
    starterSql: "SELECT category, MAX(price) AS avg_price FROM products GROUP BY category",
    task: "This finds each category's highest price. The goal asks for the average.",
    hints: ["MAX is the biggest value. Which function averages?", "Use AVG(price)."],
  }),
  lesson({
    id: "having",
    title: "Filter groups with HAVING",
    concepts: ["HAVING", "WHERE versus HAVING"],
    headline: "WHERE filters rows; HAVING filters groups.",
    scene: "aggregate",
    explanation: {
      short: "WHERE runs before the groups exist, so it cannot test COUNT(*). HAVING runs after GROUP BY and can.",
      long: [
        "The database works in this order: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY. That order explains why WHERE cannot see a count: there is nothing to count yet.",
        "Use WHERE for tests on single rows (amount > 50) and HAVING for tests on groups (COUNT(*) >= 4). A query can use both.",
      ],
    },
    table: "orders",
    goal: {
      description: "Which customer_ids have 4 or more orders? Return customer_id and orders.",
      referenceSql: "SELECT customer_id, COUNT(*) AS orders FROM orders GROUP BY customer_id HAVING COUNT(*) >= 4",
    },
    starterSql: "SELECT customer_id, COUNT(*) AS orders FROM orders WHERE COUNT(*) >= 4 GROUP BY customer_id",
    task: "WHERE cannot test a count. Run it, then move the test to where it belongs.",
    hints: ["WHERE runs before the groups exist.", "Remove the WHERE and add HAVING COUNT(*) >= 4 after GROUP BY."],
  }),
];
