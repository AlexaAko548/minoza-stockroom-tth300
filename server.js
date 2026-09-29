const express = require('express');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;


// =====================================================
// MIDDLEWARE
// =====================================================

// Allow Express to read JSON request bodies
app.use(express.json());


// =====================================================
// SERVE FRONTEND
// =====================================================

// Your HTML/CSS files are inside the "public" folder
app.use(express.static(path.join(__dirname, 'public')));


// =====================================================
// HOME PAGE
// =====================================================

// When visiting http://localhost:3000/
// serve public/index.html
app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'index.html')
    );
});


// =====================================================
// MYSQL CONNECTION
// =====================================================

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// =====================================================
// TEST DATABASE CONNECTION
// =====================================================

async function testDatabaseConnection() {

    try {

        const connection = await pool.getConnection();

        console.log('MySQL database connected successfully.');

        connection.release();

    } catch (error) {

        console.error('Database connection failed:');
        console.error(error.message);

    }
}

testDatabaseConnection();


// =====================================================
// PRODUCTS API
// =====================================================


// -----------------------------------------------------
// GET ALL PRODUCTS
// GET /api/products
// -----------------------------------------------------

app.get('/api/products', async (req, res) => {

    try {

        const [rows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                supplier,
                stock,
                reorder_at AS reorderAt,
                price
            FROM products
            ORDER BY id DESC
        `);


        const products = rows.map(product => ({

            ...product,

            status: calculateStatus(
                product.stock,
                product.reorderAt
            )

        }));


        res.json(products);


    } catch (error) {

        console.error('Error retrieving products:');
        console.error(error);


        res.status(500).json({
            error: 'Failed to retrieve products'
        });

    }

});


// -----------------------------------------------------
// GET ONE PRODUCT
// GET /api/products/:id
// -----------------------------------------------------

app.get('/api/products/:id', async (req, res) => {

    try {

        const { id } = req.params;


        const [rows] = await pool.query(
            `
            SELECT
                id,
                name,
                category,
                supplier,
                stock,
                reorder_at AS reorderAt,
                price
            FROM products
            WHERE id = ?
            `,
            [id]
        );


        if (rows.length === 0) {

            return res.status(404).json({
                error: 'Product not found'
            });

        }


        const product = rows[0];


        product.status = calculateStatus(
            product.stock,
            product.reorderAt
        );


        res.json(product);


    } catch (error) {

        console.error('Error retrieving product:');
        console.error(error);


        res.status(500).json({
            error: 'Failed to retrieve product'
        });

    }

});


// -----------------------------------------------------
// CREATE PRODUCT
// POST /api/products
// -----------------------------------------------------

app.post('/api/products', async (req, res) => {

    try {

        const {
            name,
            category,
            supplier,
            stock,
            reorderAt,
            price
        } = req.body;


        if (
            !name ||
            !category ||
            !supplier ||
            stock === undefined ||
            reorderAt === undefined ||
            price === undefined
        ) {

            return res.status(400).json({
                error: 'All product fields are required'
            });

        }


        const [result] = await pool.query(
            `
            INSERT INTO products
            (
                name,
                category,
                supplier,
                stock,
                reorder_at,
                price
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                name,
                category,
                supplier,
                stock,
                reorderAt,
                price
            ]
        );


        res.status(201).json({

            message: 'Product created successfully',

            id: result.insertId

        });


    } catch (error) {

        console.error('Error creating product:');
        console.error(error);


        res.status(500).json({
            error: 'Failed to create product'
        });

    }

});


// -----------------------------------------------------
// UPDATE PRODUCT
// PUT /api/products/:id
// -----------------------------------------------------

app.put('/api/products/:id', async (req, res) => {

    try {

        const { id } = req.params;


        const {
            name,
            category,
            supplier,
            stock,
            reorderAt,
            price
        } = req.body;


        const [result] = await pool.query(
            `
            UPDATE products
            SET
                name = ?,
                category = ?,
                supplier = ?,
                stock = ?,
                reorder_at = ?,
                price = ?
            WHERE id = ?
            `,
            [
                name,
                category,
                supplier,
                stock,
                reorderAt,
                price,
                id
            ]
        );


        if (result.affectedRows === 0) {

            return res.status(404).json({
                error: 'Product not found'
            });

        }


        res.json({
            message: 'Product updated successfully'
        });


    } catch (error) {

        console.error('Error updating product:');
        console.error(error);


        res.status(500).json({
            error: 'Failed to update product'
        });

    }

});


// -----------------------------------------------------
// DELETE PRODUCT
// DELETE /api/products/:id
// -----------------------------------------------------

app.delete('/api/products/:id', async (req, res) => {

    try {

        const { id } = req.params;


        const [result] = await pool.query(
            'DELETE FROM products WHERE id = ?',
            [id]
        );


        if (result.affectedRows === 0) {

            return res.status(404).json({
                error: 'Product not found'
            });

        }


        res.json({
            message: 'Product deleted successfully'
        });


    } catch (error) {

        console.error('Error deleting product:');
        console.error(error);


        res.status(500).json({
            error: 'Failed to delete product'
        });

    }

});


// =====================================================
// CALCULATE PRODUCT STATUS
// =====================================================

function calculateStatus(stock, reorderAt) {

    if (stock === 0) {
        return 'Out of stock';
    }


    if (stock <= reorderAt) {
        return 'Low stock';
    }


    return 'In stock';
}

// =====================================================
// DASHBOARD API
// GET /api/dashboard
// =====================================================

app.get('/api/dashboard', async (req, res) => {

    try {

        // ---------------------------------------------
        // INVENTORY SUMMARY
        // ---------------------------------------------

        const [inventorySummaryRows] = await pool.query(`
            SELECT
                COALESCE(SUM(stock * price), 0) AS inventoryValue,
                COALESCE(SUM(stock), 0) AS unitsInStock,
                COALESCE(
                    SUM(
                        CASE
                            WHEN stock <= reorder_at THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS needsAttention
            FROM products
        `);


        const inventorySummary = inventorySummaryRows[0];


        // ---------------------------------------------
        // PRODUCTS NEEDING ATTENTION
        // ---------------------------------------------

        const [attentionRows] = await pool.query(`
            SELECT
                id,
                name,
                category,
                stock,
                reorder_at AS reorderAt
            FROM products
            WHERE stock <= reorder_at
            ORDER BY stock ASC, id DESC
            LIMIT 5
        `);


        const attentionProducts = attentionRows.map(product => ({
            ...product,

            status: calculateStatus(
                product.stock,
                product.reorderAt
            )
        }));


        // ---------------------------------------------
        // SALES SUMMARY
        // ---------------------------------------------

        const [salesSummaryRows] = await pool.query(`
            SELECT
                COALESCE(
                    SUM(
                        CASE
                            WHEN sold_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS salesThisWeek,

                COALESCE(
                    SUM(
                        CASE
                            WHEN sold_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                             AND sold_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
                            THEN total_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS salesPreviousWeek

            FROM sales
        `);


        const salesSummary = salesSummaryRows[0];


        // ---------------------------------------------
        // CALCULATE SALES PERCENTAGE CHANGE
        // ---------------------------------------------

        const currentSales =
            Number(salesSummary.salesThisWeek) || 0;

        const previousSales =
            Number(salesSummary.salesPreviousWeek) || 0;

        let salesChange = 0;

        if (previousSales > 0) {

            salesChange =
                ((currentSales - previousSales) / previousSales) * 100;

        }


        // ---------------------------------------------
        // LAST 7 DAYS SALES
        // ---------------------------------------------

        const [dailySalesRows] = await pool.query(`
            SELECT
                DATE(sold_at) AS saleDate,
                COALESCE(SUM(total_amount), 0) AS total
            FROM sales
            WHERE sold_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(sold_at)
            ORDER BY saleDate ASC
        `);


        // Create all 7 dates, including days with zero sales
        const dailySales = [];

        for (let i = 6; i >= 0; i--) {

            const date = new Date();

            date.setDate(date.getDate() - i);

            const dateString =
                date.toISOString().slice(0, 10);

            const existing =
                dailySalesRows.find(
                    row =>
                        String(row.saleDate).slice(0, 10)
                        === dateString
                );


            dailySales.push({

                date: dateString,

                total: existing
                    ? Number(existing.total)
                    : 0

            });
        }


        // ---------------------------------------------
        // RECENT SALES ACTIVITY
        // ---------------------------------------------

        const [recentSalesRows] = await pool.query(`
            SELECT
                'sale' AS type,
                'Sale recorded' AS title,
                CONCAT(
                    s.quantity,
                    ' × ',
                    COALESCE(p.name, 'Unknown product')
                ) AS detail,
                'Store' AS actor,
                s.sold_at AS activityTime
            FROM sales s
            LEFT JOIN products p
                ON s.product_id = p.id
            ORDER BY s.sold_at DESC
            LIMIT 5
        `);


        // ---------------------------------------------
        // RECENT PRODUCT ACTIVITY
        // ---------------------------------------------

        const [recentProductRows] = await pool.query(`
            SELECT
                'product' AS type,
                'Product added' AS title,
                CONCAT(
                    name,
                    ' · ',
                    category
                ) AS detail,
                'System' AS actor,
                created_at AS activityTime
            FROM products
            ORDER BY created_at DESC
            LIMIT 5
        `);


        // ---------------------------------------------
        // COMBINE ACTIVITIES
        // ---------------------------------------------

        const recentActivity = [
            ...recentSalesRows,
            ...recentProductRows
        ]
            .sort(
                (a, b) =>
                    new Date(b.activityTime) -
                    new Date(a.activityTime)
            )
            .slice(0, 5);


        // ---------------------------------------------
        // SEND RESPONSE
        // ---------------------------------------------

        res.json({

            inventoryValue:
                Number(inventorySummary.inventoryValue) || 0,

            unitsInStock:
                Number(inventorySummary.unitsInStock) || 0,

            needsAttention:
                Number(inventorySummary.needsAttention) || 0,

            salesThisWeek:
                currentSales,

            salesChange,

            dailySales,

            attentionProducts,

            recentActivity
        });


    } catch (error) {

        console.error('Dashboard API error:');
        console.error(error);

        res.status(500).json({
            error: 'Failed to load dashboard data'
        });

    }

});


// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log('');
    console.log('======================================');
    console.log(' Stockroom server is running');
    console.log('======================================');
    console.log(` Website: http://localhost:${PORT}`);
    console.log(` Products API: http://localhost:${PORT}/api/products`);
    console.log('======================================');
    console.log('');

});