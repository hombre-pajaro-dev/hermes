"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_1 = require("@cucumber/cucumber");
const database_1 = require("../../src/db/database");
(0, cucumber_1.Before)(async function () {
    (0, database_1.resetDb)();
    const db = (0, database_1.getDb)();
    // Seed test products
    db.prepare("INSERT INTO products (name, description, cost, price, units) VALUES ('Espresso', 'Single shot', 0.80, 3.00, 100)").run();
    db.prepare("INSERT INTO products (name, description, cost, price, units) VALUES ('Croissant', 'Butter croissant', 1.20, 4.50, 50)").run();
    db.prepare("INSERT INTO products (name, description, cost, price, units) VALUES ('Latte', 'Milk coffee', 1.50, 5.00, 80)").run();
});
