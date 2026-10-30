import { defineTable, type Dataset } from "./types";

const customers = defineTable({
  name: "customers",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "VARCHAR" },
    { name: "city", type: "VARCHAR" },
  ],
  rows: [
    [1, "Amara Okafor", "Lagos"],
    [2, "Ben Carter", "Manchester"],
    [3, "Chloé Martin", "Lyon"],
    [4, "Diego Ramos", "Madrid"],
    [5, "Emeka Nwosu", "Abuja"],
    [6, "Freya Lund", "Oslo"],
    [7, "Grace Kim", "Seoul"],
    [8, "Hassan Ali", "Cairo"],
    [9, "Isla Murray", "Edinburgh"],
    [10, "Jonas Weber", "Berlin"],
    [11, "Kemi Adeyemi", "Lagos"],
    [12, "Liam O'Brien", "Dublin"],
  ],
});

const products = defineTable({
  name: "products",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "VARCHAR" },
    { name: "category", type: "VARCHAR" },
    { name: "price", type: "DOUBLE" },
  ],
  rows: [
    [1, "Wireless Mouse", "Electronics", 25],
    [2, "Mechanical Keyboard", "Electronics", 89.99],
    [3, "USB-C Hub", "Electronics", 39.5],
    [4, "Noise-Cancelling Headphones", "Electronics", 199],
    [5, "Desk Lamp", "Home", 32],
    [6, "Ceramic Mug", "Home", 9.5],
    [7, "Throw Blanket", "Home", 45],
    [8, "Notebook A5", "Stationery", 6],
    [9, "Fountain Pen", "Stationery", 50],
    [10, "Sticky Notes", "Stationery", 4.99],
    [11, "Running Shoes", "Sports", 120],
    [12, "Yoga Mat", "Sports", 28],
    [13, "Water Bottle", "Sports", 15],
    [14, "Coffee Beans 1kg", "Grocery", 24.5],
    [15, "Green Tea", "Grocery", 8.75],
  ],
});

// Amounts span ~5 to 200 with repeats; several are exactly 50 so the
// boundary behaviour of > vs >= (and < vs <=) is visible.
const orders = defineTable({
  name: "orders",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "customer_id", type: "INTEGER" },
    { name: "product_id", type: "INTEGER" },
    { name: "amount", type: "DOUBLE" },
    { name: "order_date", type: "DATE" },
  ],
  rows: [
    [1, 1, 2, 89.99, "2026-01-03"],
    [2, 3, 6, 9.5, "2026-01-04"],
    [3, 2, 9, 50, "2026-01-06"],
    [4, 5, 11, 120, "2026-01-07"],
    [5, 7, 13, 15, "2026-01-09"],
    [6, 4, 7, 45, "2026-01-10"],
    [7, 10, 4, 199, "2026-01-12"],
    [8, 6, 1, 25, "2026-01-13"],
    [9, 8, 14, 49, "2026-01-15"],
    [10, 11, 9, 50, "2026-01-16"],
    [11, 9, 5, 64, "2026-01-18"],
    [12, 12, 10, 4.99, "2026-01-19"],
    [13, 1, 12, 56, "2026-01-21"],
    [14, 2, 3, 39.5, "2026-01-22"],
    [15, 3, 8, 12, "2026-01-24"],
    [16, 5, 2, 179.98, "2026-01-25"],
    [17, 7, 15, 17.5, "2026-01-27"],
    [18, 4, 9, 50, "2026-01-28"],
    [19, 10, 11, 120, "2026-01-30"],
    [20, 6, 7, 51, "2026-02-01"],
    [21, 8, 6, 19, "2026-02-02"],
    [22, 11, 1, 25, "2026-02-04"],
    [23, 9, 4, 199, "2026-02-05"],
    [24, 12, 13, 30, "2026-02-07"],
    [25, 1, 14, 73.5, "2026-02-08"],
    [26, 2, 5, 32, "2026-02-10"],
    [27, 3, 12, 50, "2026-02-11"],
    [28, 5, 10, 5, "2026-02-13"],
    [29, 7, 2, 89.99, "2026-02-14"],
    [30, 4, 11, 150, "2026-02-16"],
    [31, 10, 8, 18, "2026-02-17"],
    [32, 6, 3, 79, "2026-02-19"],
    [33, 8, 9, 100, "2026-02-20"],
    [34, 11, 7, 45, "2026-02-22"],
    [35, 9, 15, 26.25, "2026-02-23"],
    [36, 12, 6, 50, "2026-02-25"],
    [37, 1, 4, 199, "2026-02-26"],
    [38, 2, 13, 60, "2026-02-28"],
    [39, 3, 1, 25, "2026-03-01"],
    [40, 5, 14, 98, "2026-03-03"],
  ],
});

// Some products have no reviews (LEFT JOIN, EXCEPT) and some reviews have no
// comment (IS NULL, COUNT(column) versus COUNT(*)).
const reviews = defineTable({
  name: "reviews",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "product_id", type: "INTEGER" },
    { name: "rating", type: "INTEGER" },
    { name: "comment", type: "VARCHAR" },
    { name: "review_date", type: "DATE" },
  ],
  rows: [
    [1, 2, 5, "Clicky and solid", "2026-01-10"],
    [2, 4, 4, null, "2026-01-15"],
    [3, 1, 3, "Battery dies fast", "2026-01-18"],
    [4, 11, 5, "Great for long runs", "2026-01-22"],
    [5, 6, 2, null, "2026-01-25"],
    [6, 4, 5, "Worth every penny", "2026-02-01"],
    [7, 7, 4, "Soft and warm", "2026-02-03"],
    [8, 3, 3, null, "2026-02-06"],
    [9, 13, 4, "Keeps water cold", "2026-02-09"],
    [10, 12, 5, null, "2026-02-12"],
    [11, 5, 2, "Too dim for reading", "2026-02-15"],
    [12, 2, 4, "Keys feel great", "2026-02-20"],
  ],
});

// Each employee's manager is another row of the same table (self-join); the
// director has none (NULL).
const employees = defineTable({
  name: "employees",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "name", type: "VARCHAR" },
    { name: "role", type: "VARCHAR" },
    { name: "manager_id", type: "INTEGER" },
    { name: "city", type: "VARCHAR" },
  ],
  rows: [
    [1, "Ngozi Eze", "Director", null, "Lagos"],
    [2, "Tom Harris", "Store manager", 1, "Manchester"],
    [3, "Aisha Bello", "Store manager", 1, "Abuja"],
    [4, "Lucas Silva", "Sales assistant", 2, "Manchester"],
    [5, "Mei Chen", "Sales assistant", 2, "Leeds"],
    [6, "Femi Ade", "Sales assistant", 3, "Abuja"],
    [7, "Sara Novak", "Warehouse lead", 1, "Lyon"],
    [8, "Omar Haddad", "Packer", 7, "Lyon"],
  ],
});

export const shop: Dataset = {
  id: "shop",
  title: "Shop",
  tables: [customers, products, orders, reviews, employees],
};
