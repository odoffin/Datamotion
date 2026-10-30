import { lesson } from "./define";

/** The structure of a table, for lessons that create one. */
const columnsOf = (table: string) =>
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`;

/** A table's rules, written as text so every runner compares them the same way. */
const constraintsOf = (table: string) =>
  `SELECT constraint_type, array_to_string(constraint_column_names, ', ') AS columns, referenced_table FROM duckdb_constraints() WHERE table_name = '${table}' ORDER BY 1, 2`;

/** A flat table that repeats each customer's city on every order (chapter 11). */
const ORDER_LOG =
  "CREATE TABLE order_log AS SELECT o.id AS order_id, c.name AS customer_name, c.city AS customer_city, o.amount FROM orders o JOIN customers c ON o.customer_id = c.id";

const SANDBOX_NOTE =
  "Every run starts from a fresh copy of the data and is thrown away afterwards, so nothing you do here can break another lesson.";

/** Chapter 10: Changing data, in the scratch sandbox. */
export const changingData = [
  lesson({
    id: "create-table",
    title: "Make a table with CREATE TABLE",
    concepts: ["CREATE TABLE", "Column types"],
    headline: "Describe a new table, column by column.",
    scene: "change",
    explanation: {
      short: "CREATE TABLE notes (id INTEGER, body VARCHAR) makes an empty table with two columns: a whole number and some text.",
      long: [
        "Each column gets a name and a type. INTEGER holds whole numbers, DOUBLE decimals, VARCHAR (or TEXT) text, DATE dates.",
        "The ledger shows the new table's columns and types, because a brand new table has no rows yet.",
        SANDBOX_NOTE,
      ],
    },
    table: "notes",
    sandbox: { check: columnsOf("notes") },
    goal: {
      description: "Create a table called notes with two columns: id, a whole number (INTEGER), and body, text (VARCHAR).",
      referenceSql: "CREATE TABLE notes (id INTEGER, body VARCHAR)",
    },
    starterSql: "CREATE TABEL notes (id INTEGER, body VARCHAR)",
    hints: ["Read the second word letter by letter.", "It is CREATE TABLE."],
  }),
  lesson({
    id: "insert",
    title: "Add rows with INSERT",
    concepts: ["INSERT INTO", "VALUES"],
    headline: "Put rows into a table.",
    scene: "change",
    explanation: {
      short: "INSERT INTO notes VALUES (1, 'Restock mugs') adds one row. List several rows in brackets, separated by commas, to add them in one go.",
      long: [
        "Values go in the same order as the table's columns: here id first, then body. To be safe, name the columns: INSERT INTO notes (id, body) VALUES ...",
        "Text still needs single quotes; numbers do not.",
        SANDBOX_NOTE,
      ],
    },
    table: "notes",
    sandbox: { setup: ["CREATE TABLE notes (id INTEGER, body VARCHAR)"], check: "SELECT * FROM notes ORDER BY id", focus: "body" },
    goal: {
      description: "The notes table is empty. Add two notes: 1, Restock mugs and 2, Call Ben.",
      referenceSql: "INSERT INTO notes VALUES (1, 'Restock mugs'), (2, 'Call Ben')",
    },
    starterSql: "INSERT notes VALUES (1, 'Restock mugs'), (2, 'Call Ben')",
    hints: ["INSERT needs one more word before the table name.", "Write INSERT INTO notes."],
  }),
  lesson({
    id: "update",
    title: "Change rows with UPDATE",
    concepts: ["UPDATE", "SET", "WHERE"],
    headline: "UPDATE changes every row its WHERE allows.",
    scene: "change",
    explanation: {
      short: "UPDATE products SET price = 30 WHERE id = 5 changes the price of product 5 only. Without WHERE, it changes every product.",
      long: [
        "UPDATE has no undo in a real database. A good habit: first run SELECT * FROM products WHERE id = 5 to see exactly which rows your WHERE picks, then turn it into the UPDATE.",
        "SET can change several columns at once: SET price = 30, category = 'Home'.",
        SANDBOX_NOTE,
      ],
    },
    table: "products",
    sandbox: { check: "SELECT * FROM products ORDER BY id", focus: "price" },
    goal: { description: "The desk lamp (product id 5) now costs 30. Change its price, and nothing else.", referenceSql: "UPDATE products SET price = 30 WHERE id = 5" },
    starterSql: "UPDATE products SET price = 30",
    task: "Run it and look at the products afterwards: this changes every price. Limit it to the desk lamp.",
    hints: ["Without WHERE, UPDATE changes every row.", "Add WHERE id = 5."],
  }),
  lesson({
    id: "delete",
    title: "Remove rows with DELETE",
    concepts: ["DELETE", "WHERE"],
    headline: "DELETE removes the rows its WHERE picks.",
    scene: "change",
    explanation: {
      short: "DELETE FROM orders WHERE amount < 10 removes the small orders and keeps the rest.",
      long: [
        "Like UPDATE, DELETE without WHERE empties the whole table. Check the rows with a SELECT using the same WHERE first.",
        "The ledger shows the table after your DELETE, so you can see what is left.",
        SANDBOX_NOTE,
      ],
    },
    table: "orders",
    sandbox: { check: "SELECT * FROM orders ORDER BY id", focus: "amount" },
    goal: { description: "Delete the orders with an amount under 10.", referenceSql: "DELETE FROM orders WHERE amount < 10" },
    starterSql: "DELETE FROM orders WHERE amount > 10",
    task: "Run it and look at what is left: this removes the wrong orders. Fix the rule.",
    hints: ["Which orders does amount > 10 pick?", "Under 10 is amount < 10."],
  }),
  lesson({
    id: "constraints",
    title: "Protect a table with constraints",
    concepts: ["PRIMARY KEY", "NOT NULL", "Constraints"],
    headline: "Rules the database enforces for you.",
    scene: "change",
    explanation: {
      short: "PRIMARY KEY means every id is different and present. NOT NULL means a column can never be left empty.",
      long: [
        "Constraints stop bad data at the door: an INSERT that breaks one fails with an error instead of quietly saving a duplicate or a gap.",
        "Transactions are the other safety net. BEGIN starts a group of changes, COMMIT keeps them all and ROLLBACK undoes them all. This sandbox wraps every run in one and rolls it back, which is why each run starts fresh.",
        SANDBOX_NOTE,
      ],
    },
    table: "notes",
    sandbox: { check: constraintsOf("notes") },
    goal: {
      description: "Create the notes table again (id INTEGER, body VARCHAR), but this time id must be the primary key and body must never be empty (NOT NULL).",
      referenceSql: "CREATE TABLE notes (id INTEGER PRIMARY KEY, body VARCHAR NOT NULL)",
    },
    starterSql: "CREATE TABLE notes (id INTEGER PRIMARY KEY, body VARCHAR)",
    task: "The table has a primary key, but body can still be left empty. Add the missing rule.",
    hints: ["Which words stop a column from being empty?", "Add NOT NULL after body VARCHAR."],
  }),
];

/** Chapter 11: Database design. */
export const design = [
  lesson({
    id: "foreign-key",
    title: "Link tables with a foreign key",
    concepts: ["FOREIGN KEY", "REFERENCES", "Relationships"],
    headline: "A foreign key points at a row in another table.",
    scene: "change",
    explanation: {
      short: "supplier_id INTEGER REFERENCES suppliers(id) means every supplier_id must match an id that exists in suppliers.",
      long: [
        "This is how tables relate: one supplier has many supplies, and each supply points back at its supplier. The database refuses a supply for a supplier that does not exist.",
        "The column it points at must be a key in its own table; here suppliers.id is a primary key.",
        SANDBOX_NOTE,
      ],
    },
    table: "supplies",
    sandbox: { setup: ["CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL)"], check: constraintsOf("supplies") },
    goal: {
      description:
        "Create a table supplies with id (INTEGER, the primary key), supplier_id (INTEGER, which must point at an id in suppliers) and product_name (VARCHAR).",
      referenceSql: "CREATE TABLE supplies (id INTEGER PRIMARY KEY, supplier_id INTEGER REFERENCES suppliers(id), product_name VARCHAR)",
    },
    starterSql: "CREATE TABLE supplies (id INTEGER PRIMARY KEY, supplier_id INTEGER, product_name VARCHAR)",
    task: "The table is there, but nothing stops supplier_id pointing at a supplier that does not exist. Add the link.",
    hints: ["A foreign key is written with REFERENCES.", "Write supplier_id INTEGER REFERENCES suppliers(id)."],
  }),
  lesson({
    id: "one-fact-one-place",
    title: "Store each fact once",
    concepts: ["Normalization", "Repeated facts"],
    headline: "One fact, one place.",
    scene: "change",
    explanation: {
      short: "order_log repeats each customer's city on every order. Pull the customers out into their own table, one row each, and the city is stored once.",
      long: [
        "Repeating a fact wastes space, but the real problem is that the copies can disagree. Normalization is the habit of giving every fact a single home and linking to it with keys.",
        "CREATE TABLE ... AS SELECT builds a table from a query's result, so DISTINCT decides how many rows it gets.",
        SANDBOX_NOTE,
      ],
    },
    table: "order_log",
    sandbox: { setup: [ORDER_LOG], check: "SELECT * FROM customer_cities ORDER BY customer_name" },
    goal: {
      description: "Create a table customer_cities from order_log with one row per customer: customer_name and customer_city.",
      referenceSql: "CREATE TABLE customer_cities AS SELECT DISTINCT customer_name, customer_city FROM order_log",
    },
    starterSql: "CREATE TABLE customer_cities AS SELECT customer_name, customer_city FROM order_log",
    task: "This copies a row for every order, so each customer appears several times. Keep one row per customer.",
    hints: ["How do you remove repeated rows from a result?", "Add DISTINCT after SELECT."],
  }),
  lesson({
    id: "update-anomaly",
    title: "Why repeated facts go wrong",
    concepts: ["Update anomaly", "Consistency"],
    headline: "Change a repeated fact and you must change every copy.",
    scene: "change",
    explanation: {
      short: "Ben Carter has moved. In order_log his city is written on every one of his orders, so all of those rows must change, not just one.",
      long: [
        "Miss one copy and the table says he lives in two cities at once. This is called an update anomaly, and it is the main reason to normalize.",
        "In the customers table his city is stored once, so the same change is one row.",
        SANDBOX_NOTE,
      ],
    },
    table: "order_log",
    sandbox: { setup: [ORDER_LOG], check: "SELECT * FROM order_log ORDER BY order_id", focus: "customer_city" },
    goal: {
      description: "Ben Carter has moved to Leeds. In order_log, change his city on every one of his orders.",
      referenceSql: "UPDATE order_log SET customer_city = 'Leeds' WHERE customer_name = 'Ben Carter'",
    },
    starterSql: "UPDATE order_log SET customer_city = 'Leeds' WHERE order_id = 3",
    task: "This changes one of Ben's orders and leaves the others saying Manchester. Change them all.",
    hints: ["WHERE order_id = 3 picks one row. Which column do all of Ben's rows share?", "Use WHERE customer_name = 'Ben Carter'."],
  }),
  lesson({
    id: "star-schema",
    title: "Facts and dimensions",
    concepts: ["Star schema", "Fact table", "Dimensions"],
    headline: "Facts in the middle, descriptions around them.",
    scene: "aggregate",
    explanation: {
      short: "orders is a fact table: one row per sale, with numbers to add up. products and customers describe those facts; they are dimensions.",
      long: [
        "Analysis tables are often shaped like a star: one big fact table in the middle, joined to small dimension tables around it. Reports join facts to a dimension and group by it.",
        "Here you join each sale to its product, then add up the amounts per category.",
      ],
    },
    table: "orders",
    goal: {
      description: "Total sales per product category: join orders to products and return category and sales (the sum of the amounts).",
      referenceSql: "SELECT p.category, SUM(o.amount) AS sales FROM orders o JOIN products p ON o.product_id = p.id GROUP BY p.category",
    },
    starterSql: "SELECT p.category, COUNT(*) AS sales FROM orders o JOIN products p ON o.product_id = p.id GROUP BY p.category",
    task: "This counts the orders per category. The goal wants the money: add up the amounts.",
    hints: ["COUNT(*) counts rows. Which function adds them up?", "Use SUM(o.amount)."],
  }),
];

/** Chapter 12: Real-world SQL. */
export const realWorld = [
  lesson({
    id: "views",
    title: "Save a query as a view",
    concepts: ["CREATE VIEW", "Views"],
    headline: "A view is a saved query you can read like a table.",
    scene: "change",
    explanation: {
      short: "CREATE VIEW big_orders AS SELECT ... saves the query under a name. SELECT * FROM big_orders then runs it for you.",
      long: [
        "A view stores the query, not the rows, so it always shows the current data.",
        "Views hide complexity: a long join can become one simple name the rest of a team uses.",
        SANDBOX_NOTE,
      ],
    },
    table: "orders",
    sandbox: { check: "SELECT * FROM big_orders ORDER BY id", focus: "amount" },
    goal: { description: "Create a view called big_orders that shows the orders over 100.", referenceSql: "CREATE VIEW big_orders AS SELECT * FROM orders WHERE amount > 100" },
    starterSql: "CREATE VIEW big_orders SELECT * FROM orders WHERE amount > 100",
    hints: ["A view is written CREATE VIEW name AS query.", "Add AS before SELECT."],
  }),
  lesson({
    id: "indexes",
    title: "Speed up lookups with an index",
    concepts: ["CREATE INDEX", "Indexes"],
    headline: "An index is a lookup table for one column.",
    scene: "change",
    explanation: {
      short: "CREATE INDEX idx_orders_customer ON orders (customer_id) builds a sorted lookup, so finding one customer's orders does not mean reading every row.",
      long: [
        "Indexes help most when a query picks a few rows by an exact value, like WHERE customer_id = 3, on a big table. Each index also slows down inserts and updates a little, so add them where they pay off.",
        "Every index needs a name. Any name works; a common habit is idx_table_column.",
        SANDBOX_NOTE,
      ],
    },
    table: "orders",
    sandbox: { check: "SELECT table_name, expressions FROM duckdb_indexes() ORDER BY 1, 2" },
    goal: { description: "Create an index on the customer_id column of orders. Any index name will do.", referenceSql: "CREATE INDEX idx_orders_customer ON orders (customer_id)" },
    starterSql: "CREATE INDEX ON orders (customer_id)",
    task: "The index has no name, and DuckDB needs one. Run it and give it a name.",
    hints: ["The name goes between CREATE INDEX and ON.", "For example: CREATE INDEX idx_orders_customer ON orders (customer_id)."],
  }),
  lesson({
    id: "explain",
    title: "Read a query plan with EXPLAIN",
    concepts: ["EXPLAIN", "Query plans"],
    headline: "Ask the database how it will run your query.",
    scene: "change",
    explanation: {
      short: "Put EXPLAIN in front of a query and DuckDB shows its plan, the steps it will take, instead of the rows.",
      long: [
        "Read the plan from the bottom up: a scan reads the table, a filter keeps the rows that pass, a projection picks the columns.",
        "A Sequential Scan reads every row. On a big table that is where indexes and better filters help. EXPLAIN ANALYZE also runs the query and shows how long each step took.",
      ],
    },
    table: "orders",
    sandbox: {},
    goal: {
      description: "Ask DuckDB for its plan for SELECT * FROM orders WHERE customer_id = 3, without running it.",
      referenceSql: "EXPLAIN SELECT * FROM orders WHERE customer_id = 3",
      compare: "explain",
    },
    starterSql: "SELECT * FROM orders WHERE customer_id = 3",
    task: "This runs the query and shows its rows. Make DuckDB show its plan instead.",
    hints: ["One word in front of SELECT does it.", "Write EXPLAIN SELECT ..."],
  }),
  lesson({
    id: "capstone",
    title: "Capstone: a real report",
    concepts: ["JOIN", "GROUP BY", "HAVING", "ORDER BY"],
    headline: "Put it all together, from an empty slip.",
    scene: "aggregate",
    explanation: {
      short: "Each customer's total spend, only the big spenders, biggest first. You have used every piece already: JOIN, SUM, GROUP BY, HAVING and ORDER BY.",
      long: [
        "Build it a step at a time and run it after each step: join orders to customers, then group by name and add up the amounts, then keep the totals over 200, then sort.",
        "Any query that returns the right rows in the right order passes.",
      ],
    },
    table: "orders",
    goal: {
      description: "A report of each customer's name and total spend (columns name and total), only customers who spent more than 200, biggest spender first.",
      referenceSql:
        "SELECT c.name, SUM(o.amount) AS total FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.name HAVING SUM(o.amount) > 200 ORDER BY total DESC",
      compare: "rows-ordered",
    },
    starterSql: "",
    task: "Write this one yourself, from an empty slip. The hints help one step at a time.",
    hints: [
      "Start with FROM orders JOIN customers ON the customer's id.",
      "GROUP BY the customer's name and add up the amounts with SUM(amount) AS total.",
      "Keep totals over 200 with HAVING, then ORDER BY total DESC.",
    ],
  }),
];
