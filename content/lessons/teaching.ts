import type { Teaching } from "./types";

/** The structure of a table, for sandbox examples that create one. */
const columnsOf = (table: string) =>
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`;

/** A table's rules, for sandbox examples that add them. */
const constraintsOf = (table: string) =>
  `SELECT constraint_type, array_to_string(constraint_column_names, ', ') AS columns, referenced_table FROM duckdb_constraints() WHERE table_name = '${table}' ORDER BY 1, 2`;

/**
 * "Explained simply", for every lesson in the course. Written so a young child
 * can follow: short sentences, everyday pictures, one idea at a time. Each
 * worked example uses other data than its exercise, so it shows the idea
 * without handing over the answer.
 */
export const teaching: Readonly<Record<string, Teaching>> = {
  // Chapter 1: Foundations
  "first-query": {
    picture:
      "A table is like a page in an exercise book ruled into a grid. Each row is one thing, like one product. Each column is one fact about it, like its name or its price. A query is a question you hand to the database: please show me this table.",
    steps: [
      "SELECT means: show me.",
      "The star * means: every column.",
      "FROM products says which table to look in.",
      "The ; at the end says the question is finished, like a full stop.",
    ],
    example: { sql: "SELECT * FROM customers", says: "Shows every column of every row in the customers table." },
    watchOut:
      "The table name must be spelled exactly as the database has it. product is not products: one missing letter and the database cannot find the table.",
    remember: "SELECT * FROM table_name; shows a whole table.",
  },
  "from-clause": {
    picture:
      "Think of a library with five shelves. SELECT says what you want; FROM says which shelf to take it from. Without FROM, the librarian does not know where to look.",
    steps: [
      "Every query in this course has the same skeleton: SELECT something FROM a table.",
      "FROM comes straight after the list of columns.",
      "The name after FROM must be one of the tables: customers, products, orders, reviews or employees.",
    ],
    example: { sql: "SELECT * FROM employees", says: "Shows the whole employees table: who works for the shop, and where." },
    watchOut:
      "Leaving out the word FROM (SELECT * customers) confuses the database: it has no table to read, so it stops with an error.",
    remember: "SELECT what FROM where.",
  },
  "data-types": {
    picture:
      "Every column holds one kind of value, like labelled jars: one jar only takes numbers, one only words, one only dates. Words (text) always go inside quote marks, like the words someone says in a story.",
    steps: [
      "Numbers are written as they are: 50 or 9.5.",
      "Text goes inside single quote marks: 'Lagos'.",
      "Dates are written like text, as year-month-day: '2026-01-25'.",
      "Without quotes, the database thinks a word is the name of a column.",
    ],
    example: {
      sql: "SELECT * FROM products WHERE category = 'Home'",
      says: "Keeps only the products whose category is the text Home. The quote marks tell the database Home is a word, not a column.",
    },
    watchOut: "city = Lagos (no quotes) fails: the database looks for a column called Lagos. Write city = 'Lagos', with single quotes.",
    remember: "Numbers as they are, text in 'quotes'.",
  },
  "count-rows": {
    picture:
      "Counting rows is like counting the children in a classroom: you do not need their names, only how many there are.",
    steps: [
      "COUNT(*) counts rows.",
      "The * inside the brackets means every row, whatever is in it.",
      "Many rows go in; one row with one number comes out.",
      "AS gives that number a name for its column.",
    ],
    example: { sql: "SELECT COUNT(*) AS products FROM products", says: "Counts the rows in the products table and calls the answer products." },
    watchOut: "COUNT(column) skips empty (NULL) values, so it can be smaller than COUNT(*). To count every row, use COUNT(*).",
    remember: "COUNT(*) answers: how many rows?",
  },

  // Chapter 2: Query basics
  "choose-columns": {
    picture: "Choosing columns is like copying only the boxes you need from a form, not the whole page.",
    steps: [
      "List the columns you want after SELECT.",
      "Put a comma between each column and the next.",
      "They come back in the order you list them.",
    ],
    example: { sql: "SELECT name, price FROM products", says: "Shows just two columns of the products table: the name and the price." },
    watchOut:
      "A missing comma (SELECT name city) does not give two columns. The database reads city as a new name for the name column.",
    remember: "SELECT column1, column2 picks just those columns.",
  },
  aliases: {
    picture:
      "AS gives a column a nickname. You stay the same person when your friends call you by a nickname; the column stays the same too, only its heading in your answer changes.",
    steps: [
      "Write the column, then AS, then the new name: name AS product.",
      "Only the heading in your result changes. The table keeps its real column name.",
      "Use one plain word for the new name, like customer or total_price.",
      "ORDER BY can use the new name, because it runs after SELECT. WHERE cannot: it runs before SELECT gives the nickname.",
    ],
    example: { sql: "SELECT name AS customer, city FROM customers", says: "Shows each customer's name under the heading customer, and their city." },
    watchOut: "WHERE customer = 'Ben Carter' fails here: WHERE runs before SELECT, so the nickname does not exist yet. Use the real column name in WHERE.",
    remember: "column AS new_name renames it in the result only.",
  },
  distinct: {
    picture: "Think of a list of home towns for a class. If three children live in Lagos, you write Lagos once.",
    steps: [
      "Put DISTINCT straight after SELECT.",
      "The database removes rows that are exact copies of each other.",
      "With two columns, a row only counts as a copy if both values match.",
    ],
    example: { sql: "SELECT DISTINCT category FROM products", says: "Shows each product category once, however many products share it." },
    watchOut: "DISTINCT works on whole rows, not on one column. SELECT DISTINCT city, name still shows every customer, because every name is different.",
    remember: "SELECT DISTINCT shows each different value once.",
  },
  limit: {
    picture: "LIMIT is like reading only the first three names on a list, after the list has been put in order.",
    steps: [
      "LIMIT goes at the very end of the query.",
      "It keeps only that many rows, from the top.",
      "Sort first with ORDER BY, so you know which rows are at the top.",
    ],
    example: { sql: "SELECT * FROM products ORDER BY price LIMIT 3", says: "Sorts the products from cheapest up, then keeps only the first three." },
    watchOut: "Without ORDER BY, the first rows can come in any order, so LIMIT may give you different rows each time.",
    remember: "Sort with ORDER BY, then keep the top with LIMIT.",
  },

  // Chapter 3: Filtering
  filter: {
    picture:
      "WHERE works like a sieve. Each row is tested; the rows that pass fall through into your answer, and the rest stay behind. The table itself never changes.",
    steps: [
      "WHERE comes after FROM.",
      "The database looks at one row at a time and asks the test.",
      "If the answer is yes, the row stays. If it is no, the row is dropped.",
    ],
    example: { sql: "SELECT * FROM products WHERE price < 20", says: "Keeps only the products that cost less than 20." },
    watchOut: "> means more than, so amount > 50 does not keep 50 itself. Use >= (more than or equal to) to keep it.",
    remember: "WHERE keeps the rows that pass the test.",
  },
  "and-or": {
    picture:
      "AND is a club that only lets you in if you are tall and wearing red. OR lets you in if you are tall or wearing red, or both.",
    steps: [
      "AND: both tests must be true.",
      "OR: at least one test must be true.",
      "When a WHERE has both, AND is checked first. Brackets make your meaning clear: (a OR b) AND c.",
    ],
    example: {
      sql: "SELECT * FROM products WHERE category = 'Home' AND price < 40",
      says: "Keeps the products that are in the Home category and also cost less than 40.",
    },
    watchOut: "No number is more than 150 and less than 10 at the same time, so AND finds nothing there. Ask yourself: must both be true, or is one enough?",
    remember: "AND narrows, OR widens.",
  },
  between: {
    picture: "BETWEEN is like a sign saying children aged 5 to 7: children who are exactly 5 or exactly 7 count too.",
    steps: [
      "Write the column, BETWEEN, the low value, AND, the high value.",
      "Both ends are included.",
      "It is a short way of writing price >= 25 AND price <= 50.",
    ],
    example: { sql: "SELECT * FROM orders WHERE amount BETWEEN 100 AND 200", says: "Keeps the orders from 100 up to 200, with 100 and 200 included." },
    watchOut: "Put the smaller value first. BETWEEN 50 AND 25 finds nothing.",
    remember: "BETWEEN low AND high includes both ends.",
  },
  like: {
    picture: "LIKE is a word game with blanks. The % sign is a blank that can hide any number of letters, even none.",
    steps: [
      "LIKE compares text with a pattern.",
      "'L%' means: starts with L, then anything.",
      "'%a' means ends with a, and '%Mug%' means Mug somewhere inside.",
      "An underscore _ stands for exactly one letter.",
    ],
    example: { sql: "SELECT * FROM products WHERE name LIKE '%Mug%'", says: "Keeps the products with Mug anywhere in their name." },
    watchOut: "city = 'L%' looks for a city really called L%. Patterns need LIKE, not =.",
    remember: "LIKE 'L%' means: starts with L.",
  },
  "is-null": {
    picture: "NULL is an empty box: not zero, not a blank word, just nothing written there yet. It means: we don't know.",
    steps: [
      "NULL means the value is missing.",
      "Test for it with IS NULL, or IS NOT NULL for the opposite.",
      "Comparing anything with = NULL gives unknown, so no row passes.",
    ],
    example: { sql: "SELECT * FROM employees WHERE manager_id IS NULL", says: "Finds the employees with no manager: the person at the top." },
    watchOut: "comment = NULL never keeps a row, not even the empty ones. Always write IS NULL.",
    remember: "Missing values: IS NULL, never = NULL.",
  },

  // Chapter 4: Sorting and conditional logic
  "order-by": {
    picture: "ORDER BY is like lining children up by height, smallest first.",
    steps: [
      "ORDER BY goes near the end, after WHERE.",
      "Name the column to sort by.",
      "Numbers go smallest to largest, words A to Z, dates earliest to latest.",
    ],
    example: { sql: "SELECT * FROM customers ORDER BY name", says: "Lists the customers in A to Z order of their names." },
    watchOut: "Without ORDER BY, the database may hand back rows in any order. Never count on the order you happen to see.",
    remember: "ORDER BY column sorts from low to high.",
  },
  "order-desc": {
    picture: "DESC turns the list into a leaderboard: the biggest score goes on top.",
    steps: [
      "Add DESC after the column to flip the order.",
      "DESC means descending: biggest first, Z to A, latest first.",
      "ASC (ascending) is the normal order, so you can leave it out.",
    ],
    example: { sql: "SELECT * FROM orders ORDER BY order_date DESC", says: "Lists the orders with the newest first." },
    watchOut: "DESC belongs only to the column just before it. In ORDER BY a, b DESC, only b is flipped.",
    remember: "ORDER BY column DESC puts the biggest first.",
  },
  "sort-two": {
    picture: "Sorting by two columns is like a school list sorted by class, and then, inside each class, by name.",
    steps: [
      "List two columns after ORDER BY, with a comma between them.",
      "The first column decides the order.",
      "The second column only sorts rows that tie on the first.",
    ],
    example: { sql: "SELECT * FROM products ORDER BY category, price DESC", says: "Groups the products by category A to Z, and inside each category puts the dearest first." },
    watchOut: "The order of the columns matters: swap them and you get a different list. Put the main sort first.",
    remember: "The first column sorts; the second breaks ties.",
  },
  case: {
    picture: "CASE is like sorting letters into post boxes: if a letter is big, it goes in this box; otherwise, it goes in that one.",
    steps: [
      "CASE starts the rule and END finishes it.",
      "WHEN gives a test; THEN gives the label for rows that pass it.",
      "ELSE gives the label for every other row.",
      "AS names the new column.",
    ],
    example: {
      sql: "SELECT name, price, CASE WHEN price < 20 THEN 'cheap' ELSE 'not cheap' END AS label FROM products",
      says: "Adds a label column: cheap for products under 20, not cheap for the rest.",
    },
    watchOut: "Every CASE needs an END. Forgetting it is the most common slip.",
    remember: "CASE WHEN test THEN label ELSE other_label END.",
  },

  // Chapter 5: Functions
  upper: {
    picture: "A function is like a little machine: you put a value in the brackets, and a changed value comes out. UPPER is like pressing Caps Lock while you copy a word.",
    steps: [
      "Write the function's name, then the value in brackets: UPPER(city).",
      "UPPER gives capital letters; LOWER gives small letters.",
      "The table is not changed, only your answer.",
    ],
    example: { sql: "SELECT name, LOWER(category) AS category FROM products", says: "Shows each product with its category written in small letters." },
    watchOut: "Spell the function exactly. UPPPER, with three Ps, is not a function the database knows.",
    remember: "UPPER(text) for capitals, LOWER(text) for small letters.",
  },
  round: {
    picture: "Rounding is like saying about 33 instead of 33.3333: you keep only the decimals you need.",
    steps: [
      "You can do sums inside a query: + adds, - takes away, * multiplies, / divides.",
      "ROUND(number, 2) keeps 2 digits after the decimal point.",
      "ROUND(number) with no second number rounds to a whole number.",
    ],
    example: { sql: "SELECT name, ROUND(price / 3, 1) AS each_of_three FROM products", says: "Splits each price three ways and keeps one decimal place." },
    watchOut: "The second number is how many digits after the point, not how many digits in total.",
    remember: "ROUND(value, places).",
  },
  dates: {
    picture: "A date is like a birthday card with three parts: the year, the month and the day. You can read just one part.",
    steps: [
      "month(date) gives the month as a number: January is 1, February is 2.",
      "year(date) gives the year.",
      "Use them in WHERE to keep the rows from one month or year.",
    ],
    example: { sql: "SELECT * FROM reviews WHERE month(review_date) = 1", says: "Keeps the reviews written in January." },
    watchOut: "month() ignores the year: month(order_date) = 2 keeps February of every year.",
    remember: "month(date) and year(date) read one part of a date.",
  },
  concat: {
    picture: "|| is glue. It sticks pieces of text together into one line, like word cards laid side by side.",
    steps: [
      "Put || between two pieces of text to join them.",
      "Add your own words in quote marks, spaces included: ' lives in '.",
      "Name the new column with AS.",
    ],
    example: { sql: "SELECT name || ' costs ' || price AS line FROM products", says: "Makes a sentence for each product, like Desk Lamp costs 32." },
    watchOut: "Every piece needs its own || before the next one. A missing || is an error.",
    remember: "a || ' and ' || b glues text together.",
  },

  // Chapter 6: Aggregation
  sum: {
    picture: "SUM is like tipping all the coins out of a jar and adding them up into one number.",
    steps: [
      "SUM(column) adds up every value in that column.",
      "Many rows go in; one row comes out.",
      "COUNT counts rows; SUM adds up the values in them.",
    ],
    example: { sql: "SELECT SUM(price) AS total FROM products", says: "Adds up the prices of every product into one total." },
    watchOut: "COUNT(amount) tells you how many orders there are; SUM(amount) adds up the money. Pick the one the question asks for.",
    remember: "SUM adds, COUNT counts.",
  },
  "group-by": {
    picture: "GROUP BY is like sorting sweets into piles by colour, then counting each pile.",
    steps: [
      "GROUP BY column puts rows with the same value into one pile.",
      "Totals like COUNT(*) are worked out once for each pile.",
      "You get one row per pile.",
      "Every column after SELECT must either be grouped or sit inside a total.",
    ],
    example: { sql: "SELECT category, COUNT(*) AS products FROM products GROUP BY category", says: "Counts how many products there are in each category." },
    watchOut: "Showing a column that is neither grouped nor totalled, like id, is an error. Which id could one pile show?",
    remember: "GROUP BY gives one row per group.",
  },
  avg: {
    picture: "The average is the fair share: put all the values together, then share them out equally.",
    steps: [
      "AVG(column) adds the values and divides by how many there are.",
      "With GROUP BY, you get one average for each group.",
      "MIN gives the smallest value and MAX the biggest.",
    ],
    example: { sql: "SELECT customer_id, AVG(amount) AS average FROM orders GROUP BY customer_id", says: "Works out each customer's average order." },
    watchOut: "MAX is not AVG. Read the question and pick the total that answers it.",
    remember: "AVG is the fair share; MIN the smallest; MAX the biggest.",
  },
  having: {
    picture: "First make the piles, then throw away the small piles. WHERE looks at single sweets; HAVING looks at whole piles.",
    steps: [
      "HAVING comes after GROUP BY.",
      "It tests each group, so it can use totals like COUNT(*).",
      "WHERE tests single rows, before the groups are made.",
    ],
    example: {
      sql: "SELECT category, COUNT(*) AS products FROM products GROUP BY category HAVING COUNT(*) >= 3",
      says: "Keeps only the categories with 3 or more products.",
    },
    watchOut: "WHERE COUNT(*) >= 4 is an error: when WHERE runs, there are no groups to count yet. Use HAVING.",
    remember: "WHERE filters rows; HAVING filters groups.",
  },

  // Chapter 7: Joins
  "inner-join": {
    picture: "A join is like matching each order slip to the customer card with the same number, then clipping the two together.",
    steps: [
      "JOIN puts a second table beside the first.",
      "ON says which columns must match, like the order's customer_id and the customer's id.",
      "Each row is clipped to every row in the other table that matches.",
      "When both tables have a column with the same name, write table.column, like orders.id.",
    ],
    example: {
      sql: "SELECT reviews.rating, products.name FROM reviews JOIN products ON reviews.product_id = products.id",
      says: "Puts each review next to the product it is about.",
    },
    watchOut: "Check ON carefully: joining the wrong pair of columns still runs, but gives nonsense.",
    remember: "JOIN table ON left.key = right.id.",
  },
  "left-join": {
    picture: "LEFT JOIN is like a party guest list: everyone on the list gets a seat, even if their partner did not come. The partner's seat stays empty: NULL.",
    steps: [
      "LEFT JOIN keeps every row of the first (left) table.",
      "Rows that find a match get it clipped on.",
      "Rows with no match still appear, with NULL in the other table's columns.",
    ],
    example: {
      sql: "SELECT customers.name, orders.id FROM customers LEFT JOIN orders ON orders.customer_id = customers.id",
      says: "Lists every customer with their orders; a customer with no orders would still appear, with NULL.",
    },
    watchOut: "A WHERE test on the right table (like rating > 3) throws the NULL rows away again, and the LEFT JOIN acts like a plain JOIN.",
    remember: "LEFT JOIN keeps everyone on the left.",
  },
  "three-tables": {
    picture: "Joining three tables is like a chain of paper clips: each new table clips on to one already in the chain.",
    steps: [
      "Start FROM one table, then add one JOIN for each extra table.",
      "Every JOIN needs its own ON.",
      "Short names save typing: FROM reviews r lets you write r.rating.",
    ],
    example: {
      sql: "SELECT r.rating, p.name, o.amount FROM reviews r JOIN products p ON r.product_id = p.id JOIN orders o ON o.product_id = p.id",
      says: "Chains reviews to products, and products to their orders.",
    },
    watchOut: "In each ON, check the pair makes sense: a product id must match a product's id, not a customer's.",
    remember: "One JOIN and one ON for each extra table.",
  },
  "self-join": {
    picture: "A self-join is like a family tree drawn from one list of people: to find someone's parent, you look them up in the same list again.",
    steps: [
      "Use the same table twice, with two different short names.",
      "Each short name is a copy you can talk about on its own.",
      "ON connects a row in one copy to a row in the other.",
    ],
    example: {
      sql: "SELECT a.name, b.name AS neighbour FROM customers a JOIN customers b ON a.city = b.city AND a.id < b.id",
      says: "Pairs up customers who live in the same city.",
    },
    watchOut: "Getting the two sides of ON the wrong way round flips the answer. Decide which copy is which before you write ON.",
    remember: "Same table, two short names.",
  },

  // Chapter 8: Subqueries and set operations
  subquery: {
    picture: "A subquery is like asking a friend a quick question first (what is the highest price?) and then using their answer in your own question.",
    steps: [
      "Write the small query inside brackets.",
      "It runs first and gives back one value.",
      "The big query uses that value like a number.",
    ],
    example: { sql: "SELECT * FROM products WHERE price = (SELECT MAX(price) FROM products)", says: "Finds the most expensive product." },
    watchOut: "WHERE cannot use AVG or MAX directly. Put them in a small query inside brackets.",
    remember: "(SELECT …) can stand in for a number.",
  },
  "in-subquery": {
    picture: "IN with a subquery is like writing a guest list first, then checking each person at the door against it.",
    steps: [
      "The small query makes a list of values.",
      "IN keeps the rows whose value is on that list.",
      "The small query must give back exactly one column.",
    ],
    example: {
      sql: "SELECT name FROM products WHERE id IN (SELECT product_id FROM reviews WHERE rating = 5)",
      says: "Lists the products that got at least one five-star review.",
    },
    watchOut: "The list must hold the same kind of value you check: customer ids for customer ids, not order ids.",
    remember: "WHERE x IN (SELECT …) checks against a list.",
  },
  union: {
    picture: "UNION is like pouring two bags of marbles into one jar and then taking out the doubles.",
    steps: [
      "Write two queries with UNION between them.",
      "Both must have the same number of columns, in the same order.",
      "UNION removes repeated rows; UNION ALL keeps them.",
    ],
    example: { sql: "SELECT name FROM customers UNION SELECT name FROM employees", says: "Makes one list of every customer's and every employee's name." },
    watchOut: "UNION ALL keeps the copies. If the question says each one once, use UNION.",
    remember: "UNION stacks two lists and removes repeats.",
  },
  except: {
    picture: "EXCEPT is like crossing names off a list: everyone on the first list, minus anyone who is also on the second.",
    steps: [
      "EXCEPT keeps rows from the first query that the second query does not have.",
      "INTERSECT keeps only the rows both queries have.",
      "Both queries need the same columns.",
    ],
    example: { sql: "SELECT city FROM customers EXCEPT SELECT city FROM employees", says: "Lists the cities with customers but no shop staff." },
    watchOut: "Order matters: A EXCEPT B is not the same as B EXCEPT A.",
    remember: "EXCEPT takes away; INTERSECT keeps what both share.",
  },

  // Chapter 9: CTEs and window functions
  cte: {
    picture: "WITH is like doing your working out on scrap paper first, giving it a name, and then using it in your final answer.",
    steps: [
      "WITH name AS ( query ) gives a query a name.",
      "The main query below can use that name like a table.",
      "Long queries then read top to bottom, one step at a time.",
    ],
    example: {
      sql: "WITH cheap AS (SELECT * FROM products WHERE price < 20) SELECT category, COUNT(*) AS items FROM cheap GROUP BY category",
      says: "First makes a step called cheap, then counts the cheap products in each category.",
    },
    watchOut: "Remember AS between the name and the bracket: WITH cheap AS (…).",
    remember: "WITH name AS (…) names a step.",
  },
  "row-number": {
    picture: "ROW_NUMBER is like numbering the children in each classroom: every classroom starts again at 1.",
    steps: [
      "ROW_NUMBER() gives each row a number: 1, 2, 3.",
      "OVER ( … ) says how: PARTITION BY splits the rows into groups, ORDER BY sets the order inside each group.",
      "Every row stays; it just gains a number.",
    ],
    example: {
      sql: "SELECT category, name, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price) AS n FROM products",
      says: "Numbers the products inside each category, cheapest first, starting at 1 for every category.",
    },
    watchOut: "Without PARTITION BY, the numbers run across the whole table instead of starting again for each group.",
    remember: "PARTITION BY starts again; ORDER BY sets the order.",
  },
  rank: {
    picture: "RANK is like a race: two runners who tie share a place, and the next place is skipped.",
    steps: [
      "RANK() gives each row its place in the order.",
      "Rows with the same value share a place.",
      "After a tie, places are skipped: 1, 2, 2, 4.",
    ],
    example: { sql: "SELECT id, amount, RANK() OVER (ORDER BY amount DESC) AS place FROM orders", says: "Gives each order its place, the biggest amount first." },
    watchOut: "Use DESC if the biggest should be number 1.",
    remember: "RANK shares ties; ROW_NUMBER never does.",
  },
  "running-total": {
    picture: "A running total is like a piggy bank: after each coin goes in, you write down how much is inside now.",
    steps: [
      "SUM(column) OVER (ORDER BY …) adds up the values so far.",
      "Each row shows the total of itself and every row before it.",
      "Every row stays; nothing is squashed together.",
    ],
    example: {
      sql: "SELECT review_date, rating, SUM(rating) OVER (ORDER BY review_date) AS stars_so_far FROM reviews",
      says: "Adds up the stars, review by review, in date order.",
    },
    watchOut: "Without ORDER BY inside OVER, every row shows the grand total instead of a running one.",
    remember: "SUM(…) OVER (ORDER BY …) is a running total.",
  },

  // Chapter 10: Changing data (each example runs on a fresh copy that is thrown away)
  "create-table": {
    picture: "CREATE TABLE is like ruling a new page in your notebook and writing the column headings before any rows are filled in.",
    steps: [
      "CREATE TABLE gives the new table a name.",
      "In brackets, list each column: its name, then its type.",
      "INTEGER is a whole number, VARCHAR is text, DATE is a date.",
      "The new table starts empty.",
    ],
    example: { sql: "CREATE TABLE pets (id INTEGER, name VARCHAR)", check: columnsOf("pets"), says: "Makes an empty pets table with two columns: id and name." },
    watchOut: "Separate the columns with commas, and spell TABLE correctly.",
    remember: "CREATE TABLE name (column TYPE, column TYPE).",
  },
  insert: {
    picture: "INSERT is like writing a new line in your table, filling in one box at a time.",
    steps: [
      "INSERT INTO names the table.",
      "VALUES gives the new row in brackets, in the same order as the columns.",
      "Add more rows with more brackets, separated by commas.",
      "Text in quotes, numbers as they are.",
    ],
    example: { sql: "INSERT INTO notes VALUES (3, 'Water the plants')", check: "SELECT * FROM notes ORDER BY id", says: "Adds one note to the empty notes table." },
    watchOut: "INSERT needs INTO: INSERT INTO notes, not INSERT notes.",
    remember: "INSERT INTO table VALUES (…), (…).",
  },
  update: {
    picture: "UPDATE is like using an eraser and a pencil on one box of your table.",
    steps: [
      "UPDATE names the table.",
      "SET says which column gets which new value.",
      "WHERE picks the rows to change.",
      "Rows that fail the WHERE test stay exactly as they were.",
    ],
    example: { sql: "UPDATE products SET price = 9 WHERE id = 6", check: "SELECT * FROM products ORDER BY id", says: "Changes the price of product 6, the Ceramic Mug, to 9. Every other price stays." },
    watchOut: "Forget the WHERE and every row changes. Always check the WHERE before you run an UPDATE.",
    remember: "UPDATE table SET column = value WHERE test.",
  },
  delete: {
    picture: "DELETE is like tearing out only the lines you no longer want.",
    steps: [
      "DELETE FROM names the table.",
      "WHERE picks the rows to remove.",
      "All the other rows stay.",
    ],
    example: { sql: "DELETE FROM reviews WHERE rating = 2", check: "SELECT * FROM reviews ORDER BY id", says: "Removes the two-star reviews and keeps the rest." },
    watchOut: "DELETE FROM orders with no WHERE removes every order. Try your WHERE in a SELECT first to see which rows it picks.",
    remember: "DELETE FROM table WHERE test.",
  },
  constraints: {
    picture: "Constraints are house rules for a table, like: every seat has a different number, and nobody leaves their name blank.",
    steps: [
      "PRIMARY KEY: every row needs a different value here, and it can never be empty.",
      "NOT NULL: this column can never be empty.",
      "The database refuses any row that breaks a rule.",
    ],
    example: {
      sql: "CREATE TABLE pets (id INTEGER PRIMARY KEY, name VARCHAR NOT NULL)",
      check: constraintsOf("pets"),
      says: "Makes a pets table where every id is different and every pet has a name.",
    },
    watchOut: "Put each rule straight after the column it belongs to: id INTEGER PRIMARY KEY.",
    remember: "Rules keep bad rows out of a table.",
  },

  // Chapter 11: Database design
  "foreign-key": {
    picture: "A foreign key is like a library card that must match a real member: a book can only be lent to a member number that exists.",
    steps: [
      "REFERENCES other_table(column) links a column to a row in another table.",
      "Every value must match a row that exists there.",
      "The database refuses a value that points at nothing.",
    ],
    example: {
      sql: "CREATE TABLE teams (id INTEGER PRIMARY KEY); CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER REFERENCES teams(id))",
      check: constraintsOf("players"),
      says: "Makes a players table whose team_id must point at a real team.",
    },
    watchOut: "The column you point at must be a key, usually the other table's id.",
    remember: "REFERENCES keeps links pointing at real rows.",
  },
  "one-fact-one-place": {
    picture: "Store each fact once, like writing each child's address once on their card, not on every homework sheet they hand in.",
    steps: [
      "Spot a fact copied on many rows, like a customer's city on every order.",
      "Move it into its own table, one row each.",
      "DISTINCT makes each fact appear once in the new table.",
    ],
    example: {
      sql: "CREATE TABLE categories AS SELECT DISTINCT category FROM products",
      check: "SELECT * FROM categories ORDER BY category",
      says: "Makes a table with each product category written once.",
    },
    watchOut: "Without DISTINCT, all the copies come along into the new table too.",
    remember: "One fact, one place.",
  },
  "update-anomaly": {
    picture: "If your address is written on ten forms and you move house, you must fix all ten. Miss one, and nobody knows where you live.",
    steps: [
      "A repeated fact lives in many rows.",
      "Changing it means changing every copy.",
      "Miss a copy, and the table disagrees with itself.",
    ],
    example: {
      sql: "UPDATE order_log SET customer_city = 'Abuja' WHERE order_id = 1",
      check: "SELECT * FROM order_log WHERE customer_name = 'Amara Okafor' ORDER BY order_id",
      says: "Changes the city on one of Amara's orders only, so the table now says she lives in two places. That is the problem.",
    },
    watchOut: "WHERE order_id = 3 changes one copy. Pick the rows by the repeated thing (the customer), so every copy changes.",
    remember: "Repeated facts drift apart; store them once.",
  },
  "star-schema": {
    picture: "A star schema looks like a star: the facts with the numbers (the orders) sit in the middle, and the tables that describe them (customers, products) sit around it.",
    steps: [
      "The fact table holds what happened and how much: orders and their amounts.",
      "Dimension tables describe it: who bought, what was bought.",
      "Join the facts to a dimension, group by a describing column, and total the numbers.",
    ],
    example: {
      sql: "SELECT c.city, SUM(o.amount) AS sales FROM orders o JOIN customers c ON o.customer_id = c.id GROUP BY c.city",
      says: "Adds up the sales for each customer city.",
    },
    watchOut: "Group by the describing column (like city) and total the fact (like amount), not the other way round.",
    remember: "Join facts to dimensions, group, then total.",
  },

  // Chapter 12: Real-world SQL
  views: {
    picture: "A view is like a saved search on your phone: you keep the question, not a copy of the answers, so it gives fresh results every time.",
    steps: [
      "CREATE VIEW name AS query saves the query under a name.",
      "SELECT * FROM name then runs it again.",
      "A view always shows the current data.",
    ],
    example: {
      sql: "CREATE VIEW cheap_products AS SELECT * FROM products WHERE price < 20",
      check: "SELECT * FROM cheap_products ORDER BY id",
      says: "Saves the question which products cost under 20, then reads it like a table.",
    },
    watchOut: "AS is needed between the view's name and its query.",
    remember: "A view is a saved question.",
  },
  indexes: {
    picture: "An index is like the index at the back of a book: instead of reading every page, you look up the word and jump straight to its page.",
    steps: [
      "CREATE INDEX name ON table (column) builds a lookup for one column.",
      "Searches on that column can then jump straight to the matching rows.",
      "The rows themselves do not change.",
    ],
    example: {
      sql: "CREATE INDEX idx_products_category ON products (category)",
      check: "SELECT table_name, expressions FROM duckdb_indexes() ORDER BY 1, 2",
      says: "Builds a lookup for the category column of products.",
    },
    watchOut: "In DuckDB an index needs a name, written between CREATE INDEX and ON.",
    remember: "An index is a lookup for one column.",
  },
  explain: {
    picture: "EXPLAIN is like asking a cook for the recipe instead of the meal: you see the steps, not the food.",
    steps: [
      "Put EXPLAIN in front of a query.",
      "DuckDB shows its plan: the steps it would take, with the first step at the bottom.",
      "You get the plan, not the rows.",
    ],
    example: { sql: "EXPLAIN SELECT * FROM products WHERE price > 100", says: "Shows how DuckDB would find the products over 100, without finding them." },
    watchOut: "EXPLAIN does not give you the rows. Take it away to run the query for real.",
    remember: "EXPLAIN shows the plan, not the answer.",
  },
  capstone: {
    picture: "A real report is built from small steps you already know, like a model made from bricks: join the tables, group, keep the big groups, then sort.",
    steps: [
      "FROM and JOIN put the tables together.",
      "GROUP BY makes one group for each customer.",
      "HAVING keeps the groups that pass the test.",
      "SELECT shows the totals and ORDER BY puts the biggest first.",
    ],
    example: {
      sql: "SELECT p.category, COUNT(*) AS orders FROM orders o JOIN products p ON o.product_id = p.id GROUP BY p.category HAVING COUNT(*) >= 5 ORDER BY orders DESC",
      says: "Counts the orders in each product category, keeps the busy ones and lists the busiest first.",
    },
    watchOut: "HAVING tests groups and WHERE tests rows. ORDER BY may use the AS name, because it runs last.",
    remember: "Build a report one clause at a time.",
  },
};
