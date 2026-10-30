import { lesson } from "./define";

/** Chapter 7: Joins. Combine tables that share a key. */
export const joins = [
  lesson({
    id: "inner-join",
    title: "Join two tables",
    concepts: ["JOIN", "ON", "Keys"],
    headline: "Match rows from two tables on a shared key.",
    scene: "join",
    explanation: {
      short: "Each order stores a customer_id. JOIN customers ON orders.customer_id = customers.id puts each order next to the customer it belongs to.",
      long: [
        "ON says which columns must match. The order's customer_id points at the customer's id, so those are the two that must be equal.",
        "When two tables have a column with the same name, write the table in front: orders.id, customers.name. That way the database knows which one you mean.",
        "A plain JOIN (also called INNER JOIN) keeps only rows that find a match on both sides.",
      ],
    },
    table: "orders",
    goal: {
      description: "List each order's id, the customer's name and the amount, in columns id, name and amount.",
      referenceSql: "SELECT orders.id, customers.name, orders.amount FROM orders JOIN customers ON orders.customer_id = customers.id",
    },
    starterSql: "SELECT orders.id, customers.name, orders.amount FROM orders JOIN customers ON orders.customer_id = customers.customer_id",
    task: "The ON condition names a column that does not exist. Run it and fix the column.",
    hints: ["The Columns tab shows the order's columns. What is the customer's key called in customers?", "customers has id, not customer_id."],
  }),
  lesson({
    id: "left-join",
    title: "Keep unmatched rows with LEFT JOIN",
    concepts: ["LEFT JOIN", "NULL", "Unmatched rows"],
    headline: "LEFT JOIN keeps every row from the left table.",
    scene: "join",
    explanation: {
      short: "Some products have no reviews. JOIN drops them; LEFT JOIN keeps every product and fills the review's columns with NULL when there is no match.",
      long: [
        "The left table is the one before LEFT JOIN. All its rows stay, matched or not.",
        "Careful with WHERE afterwards: a test on the right table's column, like WHERE rating > 3, is unknown for the NULL rows, so it drops them again and the LEFT JOIN acts like a plain JOIN.",
        "WHERE reviews.id IS NULL after a LEFT JOIN finds exactly the products with no reviews.",
      ],
    },
    table: "products",
    goal: {
      description: "List every product's name with the rating of each of its reviews, including products with no reviews, in columns name and rating.",
      referenceSql: "SELECT products.name, reviews.rating FROM products LEFT JOIN reviews ON reviews.product_id = products.id",
    },
    starterSql: "SELECT products.name, reviews.rating FROM products JOIN reviews ON reviews.product_id = products.id",
    task: "This leaves out the products nobody has reviewed. Keep them.",
    hints: ["A plain JOIN keeps only rows that match on both sides.", "Write LEFT JOIN instead of JOIN."],
  }),
  lesson({
    id: "three-tables",
    title: "Join three tables",
    concepts: ["Several joins", "Table aliases"],
    headline: "Chain joins, one ON for each.",
    scene: "join",
    explanation: {
      short: "An order points at a customer and at a product. Join both, each with its own ON, to show who bought what.",
      long: [
        "Short names save typing: FROM orders o JOIN customers c lets you write o.amount and c.name.",
        "Check every ON against the arrows in your head: o.customer_id goes to c.id, o.product_id goes to p.id. Joining the wrong pair runs without an error and gives nonsense.",
      ],
    },
    table: "orders",
    goal: {
      description: "List each order's id, the customer's name, the product's name and the amount, in columns id, customer, product and amount.",
      referenceSql:
        "SELECT o.id, c.name AS customer, p.name AS product, o.amount FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id",
    },
    starterSql:
      "SELECT o.id, c.name AS customer, p.name AS product, o.amount FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = c.id",
    task: "One ON condition joins the wrong columns. Run it and check each one.",
    hints: ["Read the last ON aloud. Does a product id belong to a customer?", "The product's key is p.id."],
  }),
  lesson({
    id: "self-join",
    title: "Join a table to itself",
    concepts: ["Self-join", "Table aliases"],
    headline: "Use the same table twice under two names.",
    scene: "join",
    explanation: {
      short: "Each employee's manager is another employee. Join employees to itself, as e for the employee and m for the manager, on e.manager_id = m.id.",
      long: [
        "The two short names are what make this work: they let you talk about two different rows of the same table.",
        "The director has no manager (NULL), so a plain JOIN leaves them out. Use LEFT JOIN if you want them listed with an empty manager.",
      ],
    },
    table: "employees",
    goal: {
      description: "List each employee's name next to their manager's name, in columns employee and manager. The director, who has no manager, is not listed.",
      referenceSql: "SELECT e.name AS employee, m.name AS manager FROM employees e JOIN employees m ON e.manager_id = m.id",
    },
    starterSql: "SELECT e.name AS employee, m.name AS manager FROM employees e JOIN employees m ON e.id = m.manager_id",
    task: "The names come out the wrong way round. Run it and check which side of ON is which.",
    hints: ["e is the employee. Which of e's columns points at the manager?", "Use e.manager_id = m.id."],
  }),
];

/** Chapter 8: Subqueries and set operations. */
export const subqueries = [
  lesson({
    id: "subquery",
    title: "A query inside a query",
    concepts: ["Subquery", "AVG"],
    headline: "Use one query's answer inside another.",
    scene: "subquery",
    explanation: {
      short: "(SELECT AVG(amount) FROM orders) works out the average first. The outer query then compares every order with that one number.",
      long: [
        "WHERE looks at one row at a time, so it cannot average a whole column itself. A subquery in brackets can, and hands the answer to WHERE.",
        "A subquery that returns a single value can go anywhere a number could.",
      ],
    },
    table: "orders",
    goal: {
      description: "List the orders whose amount is above the average amount, with all their columns.",
      referenceSql: "SELECT * FROM orders WHERE amount > (SELECT AVG(amount) FROM orders)",
    },
    starterSql: "SELECT * FROM orders WHERE amount > AVG(amount)",
    task: "This asks WHERE to work out an average, which it cannot do. Use a subquery.",
    hints: ["WHERE sees one row at a time.", "Write (SELECT AVG(amount) FROM orders) in place of AVG(amount)."],
  }),
  lesson({
    id: "in-subquery",
    title: "Filter with IN and a subquery",
    concepts: ["IN", "Subquery"],
    headline: "Let another query build the list for IN.",
    scene: "subquery",
    explanation: {
      short: "id IN (SELECT customer_id FROM orders WHERE product_id = 4) keeps customers whose id is in the list the inner query returns.",
      long: [
        "The inner query must return the same kind of value the outer one compares with. Here the outer query checks customer ids, so the inner one must return customer ids, not order ids.",
        "Many questions can be answered with IN or with a JOIN. IN is often easier to read when you only need columns from one table.",
      ],
    },
    table: "customers",
    goal: {
      description: "List the names of customers who bought the headphones (product id 4), in a column called name.",
      referenceSql: "SELECT name FROM customers WHERE id IN (SELECT customer_id FROM orders WHERE product_id = 4)",
    },
    starterSql: "SELECT name FROM customers WHERE id IN (SELECT id FROM orders WHERE product_id = 4)",
    task: "The inner query returns order ids, not customer ids. Fix it.",
    hints: ["Which column of orders holds the customer?", "SELECT customer_id inside the brackets."],
  }),
  lesson({
    id: "union",
    title: "Stack results with UNION",
    concepts: ["UNION", "UNION ALL"],
    headline: "Put two results one under the other.",
    scene: "subquery",
    explanation: {
      short: "SELECT city FROM customers UNION SELECT city FROM employees gives every city from both tables, each once.",
      long: [
        "UNION removes repeated rows. UNION ALL keeps them all, which is faster when you know there are no repeats or you want them.",
        "Both queries must return the same number of columns, of matching types. The column names come from the first query.",
      ],
    },
    table: "customers",
    goal: {
      description: "List every city where we have a customer or an employee, each city once, in a column called city.",
      referenceSql: "SELECT city FROM customers UNION SELECT city FROM employees",
    },
    starterSql: "SELECT city FROM customers UNION ALL SELECT city FROM employees",
    task: "Some cities appear more than once. Make each city appear once.",
    hints: ["UNION ALL keeps repeats.", "Use UNION on its own."],
  }),
  lesson({
    id: "except",
    title: "What is missing: EXCEPT",
    concepts: ["EXCEPT", "INTERSECT"],
    headline: "Take one list away from another.",
    scene: "subquery",
    explanation: {
      short: "SELECT id FROM products EXCEPT SELECT product_id FROM reviews lists the product ids that never appear in reviews.",
      long: [
        "EXCEPT keeps rows of the first result that are not in the second. INTERSECT keeps only rows that are in both.",
        "The same answer comes from a LEFT JOIN and IS NULL, or from NOT IN with a subquery. Be careful with NOT IN: one NULL in the list makes it find nothing.",
      ],
    },
    table: "products",
    goal: {
      description: "List the ids of products that have no reviews, in a column called id.",
      referenceSql: "SELECT id FROM products EXCEPT SELECT product_id FROM reviews",
    },
    starterSql: "SELECT id FROM products INTERSECT SELECT product_id FROM reviews",
    task: "This finds the products that do have reviews. Flip it.",
    hints: ["INTERSECT keeps what both lists share.", "Use EXCEPT to take the reviewed ones away."],
  }),
];

/** Chapter 9: CTEs and window functions. */
export const windows = [
  lesson({
    id: "cte",
    title: "Name a step with WITH",
    concepts: ["WITH", "CTE"],
    headline: "Give a step a name, then use it.",
    scene: "cte",
    explanation: {
      short: "WITH big AS (SELECT ... ) names a result; the main query then reads from big as if it were a table.",
      long: [
        "A long query reads top to bottom when each step has a name. These named steps are called common table expressions, or CTEs.",
        "Several steps are separated by commas: WITH a AS (...), b AS (...) SELECT ... A later step can use an earlier one.",
      ],
    },
    table: "orders",
    goal: {
      description: "With a step called big that holds the orders over 100, count how many big orders each customer_id has, in columns customer_id and big_orders.",
      referenceSql: "WITH big AS (SELECT * FROM orders WHERE amount > 100) SELECT customer_id, COUNT(*) AS big_orders FROM big GROUP BY customer_id",
    },
    starterSql: "WITH big (SELECT * FROM orders WHERE amount > 100) SELECT customer_id, COUNT(*) AS big_orders FROM big GROUP BY customer_id",
    hints: ["A named step is written WITH name AS ( ... ).", "Add AS after big."],
  }),
  lesson({
    id: "row-number",
    title: "Number rows with ROW_NUMBER",
    concepts: ["ROW_NUMBER", "OVER", "PARTITION BY"],
    headline: "Number rows inside each group, without merging them.",
    scene: "window",
    explanation: {
      short: "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) numbers each customer's orders 1, 2, 3 by date.",
      long: [
        "A window function looks at other rows but keeps every row in the result. GROUP BY would collapse each customer to one row; OVER does not.",
        "PARTITION BY says where the numbering starts again. Without it, the whole table is one window, numbered 1 to 40.",
      ],
    },
    table: "orders",
    goal: {
      description: "Number each customer's orders by date, starting at 1 for each customer: columns customer_id, id, order_date and n.",
      referenceSql: "SELECT customer_id, id, order_date, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date) AS n FROM orders",
    },
    starterSql: "SELECT customer_id, id, order_date, ROW_NUMBER() OVER (ORDER BY order_date) AS n FROM orders",
    task: "The numbering runs across all orders. Make it start again for each customer.",
    hints: ["Which words say where the numbering restarts?", "Add PARTITION BY customer_id before ORDER BY inside OVER."],
  }),
  lesson({
    id: "rank",
    title: "Rank with RANK",
    concepts: ["RANK", "DENSE_RANK", "Ties"],
    headline: "Rank rows without collapsing them.",
    scene: "window",
    explanation: {
      short: "RANK() OVER (ORDER BY price DESC) gives the most expensive product rank 1, the next rank 2, and so on.",
      long: [
        "Tied values share a rank, and RANK then skips: 1, 2, 2, 4. DENSE_RANK does not skip: 1, 2, 2, 3. ROW_NUMBER never ties.",
        "The ORDER BY inside OVER decides the ranking. It does not sort the result; add an ORDER BY at the end for that.",
      ],
    },
    table: "products",
    goal: {
      description: "Rank the products by price, most expensive first: columns name, price and price_rank.",
      referenceSql: "SELECT name, price, RANK() OVER (ORDER BY price DESC) AS price_rank FROM products",
    },
    starterSql: "SELECT name, price, RANK() OVER (ORDER BY price) AS price_rank FROM products",
    task: "Rank 1 goes to the cheapest product. The goal wants the most expensive first.",
    hints: ["The ranking follows the ORDER BY inside OVER.", "Add DESC after price inside OVER."],
  }),
  lesson({
    id: "running-total",
    title: "A running total",
    concepts: ["SUM OVER", "Running total"],
    headline: "Add up as you go.",
    scene: "window",
    explanation: {
      short: "SUM(amount) OVER (ORDER BY order_date) adds each order to the total of all the orders before it.",
      long: [
        "With ORDER BY inside OVER, the window grows row by row: from the first order up to the current one.",
        "With an empty OVER (), the window is the whole table, so every row shows the same grand total.",
      ],
    },
    table: "orders",
    goal: {
      description: "List each order's id, order_date and amount with a running total of amounts in date order, in a column called running_total.",
      referenceSql: "SELECT id, order_date, amount, SUM(amount) OVER (ORDER BY order_date) AS running_total FROM orders",
    },
    starterSql: "SELECT id, order_date, amount, SUM(amount) OVER () AS running_total FROM orders",
    task: "Every row shows the same grand total. Make it add up as the dates go on.",
    hints: ["The window needs an order to grow along.", "Put ORDER BY order_date inside OVER ( )."],
  }),
];
