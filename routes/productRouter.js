// routes/productRouter.js
const express = require('express');
const router = express.Router();

// Sample data (in a real app, this would be replaced with database calls)
let products = [];

// Route to get all products
router.get('/', (req, res) => {
    res.json(products);
});

// Route to add a new product
router.post('/', (req, res) => {
    const newProduct = req.body; // Expecting product data in the request body
    products.push(newProduct); // Add new product to the array
    res.status(201).json(newProduct); // Respond with the added product
});

// Export the router
module.exports = router; // Ensure this line is present
