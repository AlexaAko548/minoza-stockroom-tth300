CREATE DATABASE IF NOT EXISTS stockroom_db;

USE stockroom_db;

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    supplier VARCHAR(150) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    reorder_at INT NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO products
(name, category, supplier, stock, reorder_at, price)
VALUES
('Morning Mug', 'Home', 'Supplier Inc.', 45, 10, 12.00),
('Steel Pan', 'Kitchen', 'Culinary Co.', 5, 10, 45.00);

CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NULL,
    quantity INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sales_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL
);

/*sample sales data*/

INSERT INTO sales (product_id, quantity, total_amount, sold_at)
SELECT id, 3, 36.00, DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM products
WHERE name = 'Morning Mug'
LIMIT 1;

INSERT INTO sales (product_id, quantity, total_amount, sold_at)
SELECT id, 1, 45.00, DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM products
WHERE name = 'Steel Pan'
LIMIT 1;

INSERT INTO sales (product_id, quantity, total_amount, sold_at)
SELECT id, 2, 24.00, DATE_SUB(NOW(), INTERVAL 3 DAY)
FROM products
WHERE name = 'Morning Mug'
LIMIT 1;