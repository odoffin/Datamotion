import { lesson } from "./define";

/** Chapter 1: Foundations. What a table is, and how to ask for one. */
export const foundations = [
  lesson({
    id: "first-query",
    title: "Your first query",
    concepts: ["SELECT *", "FROM", "Tables"],
    headline: "Ask the database for a whole table.",
    explanation: {
      short:
        "A table is a grid: each row is one record, each column is one kind of fact. SELECT * FROM products asks for every row and every column of the products table.",
      long: [
        "Read the query left to right. SELECT says you want data back. The star means every column. FROM names the table to read.",
        "The database answers with a result: a new grid built from the table. Asking never changes the table itself.",
        "Table names must match the database exactly. The shop has five tables: customers, products, orders, reviews and employees. The Columns tab shows what the lesson's table holds.",
      ],
    },
    table: "products",
    goal: { description: "Show every row and every column of the products table.", referenceSql: "SELECT * FROM products" },
    starterSql: "SELECT * FROM product",
    task: "The table name on the slip is misspelt. Run it, read what the database suggests, and fix the name.",
    hints: ["The database lists the tables it knows. Which one is close to what you typed?", "The tables here have plural names: one table holds many products."],
  }),
  lesson({
    id: "from-clause",
    title: "Every query needs FROM",
    concepts: ["FROM", "Rows and columns"],
    headline: "Name the table you want to read.",
    explanation: {
      short: "SELECT says what you want; FROM says where it lives. Without FROM the database does not know which table you mean.",
      long: [
        "Every query in this course has the same skeleton: SELECT something FROM some table. Later chapters add more after FROM, but the skeleton stays.",
        "The customers table has three columns: id, name and city. The id is a number that identifies each customer, so two customers with the same name can still be told apart.",
      ],
    },
    table: "customers",
    goal: { description: "Show every customer, with all their columns.", referenceSql: "SELECT * FROM customers" },
    starterSql: "SELECT * customers",
    task: "A word is missing from the query. Run it and add the word the red pen asks for.",
    hints: ["Read it aloud: select everything ... which table?", "The table name comes after FROM."],
  }),
  lesson({
    id: "data-types",
    title: "Numbers, text and dates",
    concepts: ["Data types", "Text in quotes"],
    headline: "Every column holds one type of value.",
    explanation: {
      short:
        "A column holds one type: whole numbers, decimals, text or dates. Numbers are written plain, like 50. Text goes in single quotes, like 'Lagos'.",
      long: [
        "Without quotes, the database reads a word as the name of a column. Lagos on its own means the column called Lagos, which does not exist. 'Lagos' in quotes means the text Lagos.",
        "Dates are written as text with the word DATE in front: DATE '2026-01-03'. They sort and compare like dates, so January comes before February.",
        "This query uses WHERE to keep only some rows. Chapter 3 is all about WHERE; here it is only the quotes that matter.",
      ],
    },
    table: "customers",
    goal: { description: "Show the customers who live in Lagos, with all their columns.", referenceSql: "SELECT * FROM customers WHERE city = 'Lagos'" },
    starterSql: "SELECT * FROM customers WHERE city = Lagos",
    task: "The database thinks Lagos is a column. Run it and tell it that Lagos is text.",
    hints: ["Text values need single quotes around them.", "Write 'Lagos', with the quotes."],
  }),
  lesson({
    id: "count-rows",
    title: "How many rows?",
    concepts: ["COUNT(*)", "Naming a result"],
    headline: "Count the rows in a table.",
    explanation: {
      short: "COUNT(*) counts rows. SELECT COUNT(*) FROM orders answers with one number: how many orders there are.",
      long: [
        "COUNT(*) turns the whole table into one row with one number in it. Chapter 6 shows how to count per customer or per category.",
        "The database invents a name for a column it calculates, such as count_star(). Add AS and a name of your own, like AS orders, so the result says what it means.",
      ],
    },
    table: "orders",
    goal: { description: "How many orders are there? Return one number in a column called orders.", referenceSql: "SELECT COUNT(*) AS orders FROM orders" },
    starterSql: "SELECT COUNT(*) FROM orders",
    task: "This counts the rows, but the column does not have the name the goal asks for. Run it and read the hint.",
    hints: ["Look at the name of the column in your result.", "Add AS orders after COUNT(*)."],
  }),
];

/** Chapter 2: Query basics. Choosing columns, naming them, removing repeats, taking a few. */
export const queryBasics = [
  lesson({
    id: "choose-columns",
    title: "Choose your columns",
    concepts: ["Column list", "Commas"],
    headline: "Ask only for the columns you need.",
    explanation: {
      short: "Instead of the star, list the columns you want, separated by commas: SELECT name, city FROM customers.",
      long: [
        "The result has exactly the columns you list, in the order you list them.",
        "Watch the commas. Without one, SELECT name city reads as the column name, renamed to city. It runs without an error and quietly gives you the wrong result.",
      ],
    },
    table: "customers",
    goal: { description: "List every customer's name and city, in columns called name and city.", referenceSql: "SELECT name, city FROM customers" },
    starterSql: "SELECT name city FROM customers",
    task: "This query runs, but the result is wrong. Run it and compare its columns with the goal.",
    hints: ["Count the columns in your result. The goal asks for two.", "Without a comma, the second word becomes a new name for the first column."],
  }),
  lesson({
    id: "aliases",
    title: "Rename a column with AS",
    concepts: ["AS", "Aliases"],
    headline: "Give a column a clearer name.",
    explanation: {
      short: "AS renames a column in the result: SELECT name AS product shows the name column under the heading product. The table itself keeps its names.",
      long: [
        "Good names make a result easy to read and easy to use in the next query. You will need AS often for calculated columns, which get awkward names otherwise.",
        "AS only changes the heading of the result. The table still has a column called name.",
      ],
    },
    table: "products",
    goal: { description: "List every product's name and price, with the columns called product and price.", referenceSql: "SELECT name AS product, price FROM products" },
    starterSql: "SELECT name, price FROM products",
    task: "The columns are right, but one has the wrong name. Rename it with AS.",
    hints: ["The goal asks for a column called product.", "Write name AS product."],
  }),
  lesson({
    id: "distinct",
    title: "Remove repeats with DISTINCT",
    concepts: ["DISTINCT", "Duplicates"],
    headline: "Show each value once.",
    explanation: {
      short: "SELECT DISTINCT city FROM customers lists each city once, however many customers live there.",
      long: [
        "Without DISTINCT you get one row per customer, so a city with two customers appears twice.",
        "DISTINCT looks at the whole row. With two columns, SELECT DISTINCT city, name keeps every pair that differs, which is usually every row.",
      ],
    },
    table: "customers",
    goal: { description: "List each city that has at least one customer, once, in a column called city.", referenceSql: "SELECT DISTINCT city FROM customers" },
    starterSql: "SELECT city FROM customers",
    task: "This lists a city once per customer, so one city appears twice. Make each city appear once.",
    hints: ["Which city appears twice in your result?", "Put DISTINCT straight after SELECT."],
  }),
  lesson({
    id: "limit",
    title: "Take a few rows with LIMIT",
    concepts: ["LIMIT", "ORDER BY first"],
    headline: "Ask for just a few rows.",
    scene: "sort",
    explanation: {
      short: "LIMIT 5 stops after five rows. Put ORDER BY before it, so you know which five you get.",
      long: [
        "Without ORDER BY a table has no promised order, so LIMIT alone could return any five rows. ORDER BY id sorts by id first; chapter 4 covers sorting properly.",
        "LIMIT always comes last in the query.",
      ],
    },
    table: "orders",
    goal: {
      description: "Show the first five orders by id, lowest id first, with all their columns.",
      referenceSql: "SELECT * FROM orders ORDER BY id LIMIT 5",
      compare: "rows-ordered",
    },
    starterSql: "SELECT * FROM orders ORDER BY id LIMIT",
    task: "The query stops before it says how many rows. Run it and finish it.",
    hints: ["LIMIT needs a number after it.", "The goal asks for five rows."],
  }),
];
