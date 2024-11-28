const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const PDFDocument = require('pdfkit');
const fs = require('fs');
const productRouter = require('./routes/productRouter'); // Adjust as necessary
const PORT = process.env.PORT || 3000;
const router = express.Router(); // Define the router
const cors = require('cors');
const cron = require('node-cron');


// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/', productRouter);
app.use('/api', productRouter); // Assuming your router handles /api/update-product/:id
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    }
}));
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });
  

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Load environment variables from .env file
require('dotenv').config();

// MongoDB connection URI
const uri = process.env.MONGODB_URI;


mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => console.error("Atlas Connection Error:", err));


app.use(session({
    secret: '5b0b4a2a0a5d17a77e47c42d7a740e08c5497d1c5d3f5417c7a0a4e5d29e8bd8',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production if using HTTPS
}));

//=======================  ORDER SCHEMA ========================

// Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalAmount: { type: Number, required: true },
    orderDate: { type: Date, default: Date.now },
    pickupDate: { type: Date, required: true },
    pickupLocation: { type: String, required: true },
    storePostcode: { type: String, required: true },
    pickupStatus: { type: String, default: 'Pending' },
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true },
            category: { type: String, required: true }
        }
    ]
});

  // Create Order Model
  const Order = mongoose.model('Order', orderSchema);

  app.get('/api/user-expenses', async (req, res) => {
    try {
        // Fetch all orders for the logged-in user
        const orders = await Order.find({ userId: req.session.user._id });
        
        // Aggregate expenses by category
        const expensesByCategory = {};

        orders.forEach(order => {
            order.products.forEach(product => {
                const amountSpent = product.price * product.quantity;
                
                if (expensesByCategory[product.category]) {
                    expensesByCategory[product.category] += amountSpent;
                } else {
                    expensesByCategory[product.category] = amountSpent;
                }
            });
        });

        // Send aggregated data to the frontend
        res.json(expensesByCategory);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching user expenses' });
    }
});

  app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.session.user._id });
        res.json(orders);

    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });

    }
    });

  app.post('/api/orders', async (req, res) => {
    try {
        const { totalAmount, pickupDate, pickupLocation, storePostcode, products } = req.body;

        // Assume user is authenticated, get user ID
        const userId = req.session.user._id; // Adjust based on your session management

        // Fetch user details from the database
        const user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        // Create new order
        const newOrder = new Order({
            userId,
            totalAmount,
            pickupDate,
            pickupLocation,
            storePostcode,
            products, 
            pickupStatus: 'Pending', // Initial status
        });

        await newOrder.save();
        res.json({ success: true, orderId: newOrder._id });

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId: userId }).populate('products.productId');

        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart not found' });
        }

        const pdfDoc = new PDFDocument();
        const pdfPath = `./order_${newOrder._id}.pdf`;
        const stream = fs.createWriteStream(pdfPath);
        pdfDoc.pipe(stream);

        // Title and General Info
        pdfDoc.fontSize(20).text('Order Confirmation', { align: 'center', underline: true });
        pdfDoc.moveDown(2); // Add spacing

        // Customer Details
        pdfDoc.fontSize(14).text(`Name: ${user.name}`);
        pdfDoc.text(`Phone Number: ${user.phoneNumber || 'N/A'}`);
        pdfDoc.text(`Email: ${user.email}`);
        pdfDoc.moveDown(1.5); // Add spacing

        // Pickup Information
        pdfDoc.text(`Pickup Date: ${new Date(pickupDate).toLocaleString()}`);
        pdfDoc.text(`Pickup Location: ${pickupLocation}`);
        pdfDoc.moveDown(2); // Add spacing

        // Cart Table Header
        pdfDoc.fontSize(16).text('Cart Details:', { underline: true });
        pdfDoc.moveDown(1);

        // Cart Table Column Titles
        pdfDoc.fontSize(14)
            .text('Item Name', { width: 200, continued: true })
            .text('Price (RM)', { width: 100, continued: true, align: 'center' })
            .text('Quantity', { width: 100, align: 'right' });
        pdfDoc.moveDown(1);

        // Cart Items (Using the `cart` from your schema)
        cart.products.forEach(item => {
            pdfDoc.text(item.name, { width: 400, continued: true })
                .text(item.price.toFixed(2), { width: 200, continued: true, align: 'center' })
                .text(item.quantity, { width: 200, align: 'right' });
            pdfDoc.moveDown(0.5); // Add spacing between items
        });

        // Total Amount
        pdfDoc.moveDown(2);
        pdfDoc.fontSize(16).text(`Total Amount: RM ${totalAmount.toFixed(2)}`, { align: 'right' });

        pdfDoc.end();

        // Once the PDF is generated, send an email with the PDF as an attachment
        stream.on('finish', () => {
            transporter.sendMail({
                from: 'waytheking@gmail.com',
                to: user.email,
                subject: 'Your Pickup Order Confirmation',
                text: `Thank you for your order! Attached is your order confirmation for the amount of RM ${totalAmount} with a pickup date of ${new Date(pickupDate).toLocaleString()}.`,
                attachments: [
                    {
                        filename: `order_${newOrder._id}.pdf`,
                        path: pdfPath
                    }
                ]
            }, (err, info) => {
                if (err) {
                    console.error('Error sending email:', err);
                    return res.status(500).json({ success: false, message: 'Failed to send confirmation email' });
                }

                // Delete the PDF after sending the email
                fs.unlinkSync(pdfPath);

                return res.status(200).json({ success: true, message: 'Order placed and email sent' });
            });
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: 'Failed to place order' });
    }
});




//=======================  USER SCHEMA ========================

// User Schema
const userSchema = new mongoose.Schema({
    name: { type: String },
    username: { type: String, unique: true },
    password: { type: String },
    idNumber: { type: String, unique: true, required: true },
    phoneNumber: { type: String },
    dob: { type: Date }, // Add this field if not already present
    store: { type: String },
    email: { type: String, unique: true, required: true },
    balance: { type: Number, default: 300 },
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    isAdmin: { type: Boolean, default: false } // Added isAdmin field
});
const User = mongoose.model('User', userSchema);
module.exports = { User };


app.post('/save-store', (req, res) => {
    const userId = req.session.userId; // Make sure session is working and userId is set
    const { storeName } = req.body;   // Get store name from request body
  
    // Check if userId and storeName are received
    console.log("User ID:", userId);
    console.log("Store Name:", storeName);
  
    if (!userId) {
      return res.status(401).send('User not authenticated');
    }
  
    if (!storeName) {
      return res.status(400).send('Store name is missing');
    }
  
    // Find user by ID and update store field
    User.findByIdAndUpdate(userId, { store: storeName }, { new: true })
      .then(updatedUser => {
        if (!updatedUser) {
          return res.status(404).send('User not found');
        }
        console.log('Store saved for user:', updatedUser);
        res.status(200).json({ message: 'Store saved successfully', updatedUser });
      })
      .catch(err => {
        console.error('Error saving store:', err);
        res.status(500).send('Error saving store');
      });
  });

app.get('/check-user-store', async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User not logged in' });
      }
  
      // Find the user by ID
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Check if the store is set
      if (!user.store || user.store === '-') {
        return res.json({ hasStore: false });
      }
  
      res.json({ hasStore: true });
    } catch (error) {
      console.error('Error checking user store:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
 app.get('/get-user-store', async (req, res) => {
    try {
      const userId = req.session.userId; // Assuming user ID is stored in the session
      if (!userId) {
        return res.status(401).json({ error: 'User not logged in' });
      }
  
      // Find the user by ID
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Send the store name as response
      res.json({ storeName: user.store });
    } catch (error) {
      console.error('Error fetching user store:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
// Fetch user’s selected store details
app.get('/get-store-details', async (req, res) => {
    try {
      const userId = req.session.userId; // Assuming user ID is stored in session
      if (!userId) {
        return res.status(401).json({ error: 'User not logged in' });
      }
  
      // Find the user by ID
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Fetch the store details based on the user's selected store
      const store = await Store.findOne({ name: user.store });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
  
      // Send the store details, including the postcode, as response
      res.json({
        storeName: store.name,
        storeAddress: store.address,
        storePostcode: store.postcode // Include postcode in the response
      });
    } catch (error) {
      console.error('Error fetching store details:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
  
  

app.get('/api/user', (req, res) => {
    const userId = req.session.userId; // Assuming you store the user ID in the session

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: No user ID found' });
    }

    User.findById(userId)
        .then(user => {
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            // Return only the needed fields
            res.json({
                name: user.name,
                username: user.username,
                email: user.email,
                dob: user.dob,
                phoneNumber: user.phoneNumber,
                balance: user.balance,
                idNumber: user.idNumber
            });
        })
        .catch(error => {
            console.error('Error fetching user:', error);
            res.status(500).json({ message: 'Error fetching user' });
        });
});

app.post('/api/update-profile', async (req, res) => {
    const { username, name, dob } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: No user logged in' });
    }

    try {
        // Check if the new username is already taken by another user
        const existingUser = await User.findOne({ username, _id: { $ne: userId } });

        if (existingUser) {
            return res.status(400).json({ message: 'Username is already taken' });
        }

        // Proceed with updating the user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username, name, dob },
            { new: true } // Return the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
});


app.get('/api/check-username', async (req, res) => {
    const { username } = req.query;

    try {
        const user = await User.findOne({ username });

        if (user) {
            return res.json({ exists: true });
        } else {
            return res.json({ exists: false });
        }
    } catch (error) {
        console.error('Error checking username:', error);
        return res.status(500).json({ message: 'Error checking username' });
    }
});

app.put('/api/user/balance', async (req, res) => {
    const { balance } = req.body; // Get the new balance from the request body
    const userId = req.session.userId; 

    try {
        // Update user balance in the database
        await User.findByIdAndUpdate(userId, { balance: balance });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating user balance:', error);
        res.status(500).json({ success: false, message: 'Failed to update balance' });
    }
});


// Logout route to clear session
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to log out' });
      }
      res.clearCookie('connect.sid'); // Optional: clear cookie if using cookies
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
  

  cron.schedule('0 0 1 * *', async () => {
    try {
        const users = await User.find(); // Get all users

        // Reset each user's balance to 300
        for (let user of users) {
            user.balance = 300;
            user.lastUpdated = new Date(); // Update the lastUpdated field
            await user.save();
        }

        console.log('Monthly balance reset completed successfully.');
    } catch (error) {
        console.error('Error resetting user balances:', error);
    }
});


//=======================  STORE SCHEMA ========================

const storeSchema = new mongoose.Schema({
    name: { type: String, required: true, },
    address: { type: String, required: true, },
    telephone: { type: String, required: true, },
    postcode: { type: String, required: true, },
    brand: { type: String, required: true,}});
  
  // Create Store Model
  const Store = mongoose.model('store', storeSchema);
  module.exports = Store;

  // API endpoint to fetch stores by postcode
app.get('/api/stores', async (req, res) => {
    const { postcode } = req.query;
    try {
      const stores = await Store.find({ postcode: postcode });
      res.json(stores);
    } catch (error) {
      console.error('Error fetching stores:', error);
      res.status(500).send('Internal Server Error');
    }
  });

//=======================  PRODUCT SCHEMA ========================

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    quantity: { type: String, required: true },
    brand: { type: String, required: true },
    image: { type: String, required: true }
});
const Product = mongoose.model('Product', productSchema);
module.exports = Product;

app.post('/add-product', async (req, res) => {
    try {
        const { name, price, category, brand, subcategory, quantity, image } = req.body;

        // Create a new product instance
        const newProduct = new Product({
            name,
            price,
            category,
            subcategory,
            quantity,
            brand,
            image
        });

        // Save the product to the database
        await newProduct.save();

        res.status(200).send('Product added successfully!');
    } catch (error) {
        res.status(500).send('Error adding product.');
    }
});

// Route to get all products
app.get('/get-products', async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
});

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Route to delete a product by ID
app.delete('/delete-product/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        await Product.findByIdAndDelete(productId);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
});

// Route to update a product by ID
router.put('/update-product/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.json({ success: true, product: updatedProduct });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
    console.log(`Update request received for product ID: ${req.params.id}`);
    console.log(`Request body: ${JSON.stringify(req.body)}`);
});

// Route to get random products
app.get('/get-random-products', async (req, res) => {
    try {
        const products = await Product.aggregate([{ $sample: { size: 12 } }]); // Randomly select 10 products
        res.json(products);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch random products' });
    }
});


//=======================  CART SCHEMA ========================

// Cart Schema
const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            name: String,
            price: Number,
            image: String, 
            quantity: { type: Number, default: 1 },
            category: String 
        }
    ]
});
const Cart = mongoose.model('Cart', cartSchema);


// Add to cart route
app.post('/add-to-cart', async (req, res) => {
    try {
        const { productId, productName, productPrice, productImage, quantity, productCategory } = req.body; // Now also receiving quantity
        const userId = req.session.userId; // Assuming userId is stored in the session
        
        // Check if the user already has a cart
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            // If no cart exists for the user, create a new one
            cart = new Cart({
                userId,
                products: []
            });
        }

        // Check if the product is already in the cart
        const existingProduct = cart.products.find(item => item.productId.equals(productId));

        if (existingProduct) {
            // If the product exists, update the quantity
            existingProduct.quantity += parseInt(quantity); // Increment the quantity
            console.log(`Updated quantity for ${existingProduct.productId}: ${existingProduct.quantity}`); // Debug log
        } else {
            // If the product doesn't exist, add it to the cart
            cart.products.push({
                productId: new mongoose.Types.ObjectId(productId), // Ensure productId is stored as ObjectId
                name: productName,
                price: productPrice,
                image: productImage,
                quantity: parseInt(quantity), // Store the quantity
                category: productCategory // Store the category
            });
            console.log(`Added new product ${productId} to cart`); // Debug log
        }

        // Save the updated cart
        await cart.save();

        // Respond with success
        res.json({ success: true });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, message: 'Error adding to cart' });
    }
});


app.get('/api/cart', async (req, res) => {
    try {
        const userId = req.session.userId; // Ensure this is set
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        // Get the total count of products in the cart
        const productCount = cart.products.reduce((total, product) => total + product.quantity, 0);

        // Send products and the product count in the response
        res.json({ products: cart.products, productCount }); 
    } catch (err) {
        console.error('Error fetching cart', err);
        res.status(500).json({ error: 'Error fetching cart' });
    }
});

// Route to update product quantity in the cart
app.patch('/api/cart/:productId', async (req, res) => {
    try {
        const userId = req.session.userId; // Assume user is authenticated and userId is in session
        const productId = req.params.productId;
        const newQuantity = req.body.quantity;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        // Convert productId to ObjectId
        const objectId = new mongoose.Types.ObjectId(productId);

        // Find the product in the cart and update its quantity
        const product = cart.products.find(product => product._id.equals(objectId));

        if (product) {
            product.quantity = newQuantity;
            await cart.save(); // Save the updated cart

            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Product not found in cart' });
        }
    } catch (error) {
        console.error('Error updating product quantity in cart:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to delete a specific product from the cart
app.delete('/api/cart/:productId', async (req, res) => {
    try {
        const userId = req.session.userId; // Assume user is authenticated and userId is in session
        const productId = req.params.productId;

        console.log('Product ID:', productId); // Log the productId

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        // Validate the productId format
        const isValidObjectId = (id) => /^[0-9a-fA-F]{24}$/.test(id);
        if (!isValidObjectId(productId)) {
            return res.status(400).json({ error: 'Invalid product ID format' });
        }

        // Convert productId to ObjectId
        const objectId = new mongoose.Types.ObjectId(productId);

        // Find the product in the cart and remove it
        const productIndex = cart.products.findIndex(product => product._id.equals(objectId));

        if (productIndex > -1) {
            cart.products.splice(productIndex, 1); // Remove the product
            await cart.save(); // Save the updated cart

            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Product not found in cart' });
        }
    } catch (error) {
        console.error('Error deleting product from cart:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


//=======================  SIGN-UP/LOGIN ========================

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'waytheking@gmail.com',
        pass: 'lwjg ptav qaph dxkf'
    }
});

// In-memory storage for OTPs
const otpStore = {};

// Helper function to mask email address
function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    const maskedLocalPart = localPart.substring(0, 4) + 'x'.repeat(localPart.length - 4);
    return `${maskedLocalPart}@${domain}`;
}

// Middleware to check if user is an admin
function ensureAdmin(req, res, next) {
    if (s && req.session.user.isAdmin) {
        return next();
    }
    res.redirect('/login.html'); // Redirect to login if not an admin
}

// Serve id-check.html for ID number check
app.get('/checkid', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'id-check.html'));
});

// Handle ID number check
app.post('/checkid', async (req, res) => {
    const { idNumber } = req.body;
    console.log(`Checking ID Number: ${idNumber}`);

    // Client-side validation: Check if ID number is 12 digits and numeric
    if (idNumber.length !== 12 || isNaN(idNumber)) {
        console.log('Invalid ID Number');
        return res.status(400).json({ error: 'Invalid IC Number. Please enter a valid 12-digit number.' });
    }

    try {
        const existingUser = await User.findOne({ idNumber });
        if (existingUser) {
            if (existingUser.username) {
                console.log('User already registered with this IC number');
                return res.status(400).json({ error: 'User already registered with this IC number.' });
            } else {
                console.log('ID number found, redirecting to signup');
                return res.status(200).json({ redirect: `/signup?idNumber=${idNumber}&email=${existingUser.email}` });
            }
        } else {
            console.log('ID number not found');
            return res.status(400).json({ error: 'IC number not found. Please check your IC number.' });
        }
    } catch (err) {
        console.error('Error checking IC number', err);
        return res.status(500).json({ error: 'Error checking IC number' });
    }
});

// Serve signup.html for sign up
app.get('/signup', (req, res) => {
    const { idNumber, email } = req.query;
    res.render('signup', { idNumber, email });
});

// Handle user registration
app.post('/register', async (req, res) => {
    const { name, username, password, idNumber, email } = req.body;
    const otp = generateOTP();

    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser && existingUser.username) {
            console.log('Username already exists');
            // Pass the error message to the template
            return res.render('signup', { errorMessage: 'Username already exists.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        const mailOptions = {
            from: 'waytheking@gmail.com',
            to: email,
            subject: 'Welcome to BINGKAS! Verify Your Registration',
            text: `
Dear ${name},

Thank you for registering with BINGKAS! To complete your registration, please use the One-Time Password (OTP) provided below. This OTP is valid for the next 10 minutes.

Your OTP for registration is: ${otp}

If you did not sign up for an account with BINGKAS, please ignore this email.

For any questions or assistance, please contact our support team.

Best regards,
The BINGKAS Team

Note: This is an automated message, please do not reply to this email.
            `
        };

        await transporter.sendMail(mailOptions);

        otpStore[email] = { otp, userInfo: { name, username, password: hashedPassword, idNumber, email } };

        const maskedEmail = maskEmail(email);
        res.render('verifyOTP', { email, maskedEmail });
    } catch (err) {
        console.error('Error sending email:', err);
        res.status(400).send('Error sending email');
    }
});

// Serve the OTP verification page
app.get('/verifyOTP', (req, res) => {
    res.render('verifyOTP');
});

// Handle OTP verification
app.post('/verifyOTP', async (req, res) => {
    const { email, otp } = req.body;
    const storedOTP = otpStore[email]?.otp;
    const userInfo = otpStore[email]?.userInfo;

    if (otp === storedOTP && userInfo) {
        try {
            const newUser = await User.findOneAndUpdate(
                { idNumber: userInfo.idNumber, email: userInfo.email },
                { name: userInfo.name, username: userInfo.username, password: userInfo.password, phoneNumber: userInfo.phoneNumber },
                { new: true, upsert: true }
            );
            delete otpStore[email];
            res.redirect('/bingkas.html');
        } catch (err) {
            console.error('Error saving user:', err);
            res.status(400).send('Error saving user');
        }
    } else {
        res.status(400).send('Incorrect OTP. Please try again.');
    }
});

// Serve login.html for login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle user login

app.post('/login', async (req, res) => {

    const { idNumber, password } = req.body;
    try {
        const user = await User.findOne({ idNumber });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id; // Store user ID in the session
            req.session.user = user; // Store user info in session
            // Redirect based on role
            if (user.isAdmin) {
                res.redirect('/admin-dashboard.html');
            } else {
                res.redirect('/bingkas.html');
            }
        } else {
            res.status(400).json({ message: 'Invalid ID number or password' });
        }
    } catch (err) {
        console.error('Error logging in', err);
        res.status(500).send('Error logging in');
    }

});
// Handle OTP request for login
app.post('/requestLoginOTP', async (req, res) => {
    const { idNumber, password } = req.body;
    try {
        const user = await User.findOne({ idNumber });
        if (user && await bcrypt.compare(password, user.password)) {
            const otp = generateOTP();

            const mailOptions = {
                from: 'waytheking@gmail.com',
                to: user.email,
                subject: 'Your BINGKAS Login OTP',
                text: `
Dear ${user.name},

Thank you for logging into your BINGKAS account. To complete the login process, please use the One-Time Password (OTP) provided below. This OTP is valid for the next 10 minutes.

Your OTP for login is: ${otp}

If you did not request this OTP, please ignore this email. For your security, do not share this OTP with anyone.

If you encounter any issues or have any questions, feel free to contact our support team.

Best regards,
The BINGKAS Team

Note: This is an automated message, please do not reply to this email.
                `
            };

            await transporter.sendMail(mailOptions);

            otpStore[user.email] = { otp, idNumber };
            const maskedEmail = maskEmail(user.email); // Add this line to get the masked email
            res.json({ success: true, email: user.email, maskedEmail }); // Update the response with maskedEmail
        } else {
            res.json({ success: false, message: 'Invalid ID number or password' });
        }
    } catch (err) {
        console.error('Error during OTP request for login', err);
        res.status(500).json({ success: false, message: 'Error during OTP request for login' });
    }
});

// Handle OTP verification for login
app.post('/verifyLoginOTP', async (req, res) => {
    const { email, otp } = req.body;
    const storedOTP = otpStore[email]?.otp;
    const idNumber = otpStore[email]?.idNumber;
    if (otp === storedOTP) {
        try {
            delete otpStore[email];
            const user = await User.findOne({ email: email });
            if (user) {
                req.session.user = user; // Store user info in session
                req.session.userId = user._id; // Store user ID in the session

                if (user.isAdmin) {
                    res.redirect('/admin-dashboard.html'); // Redirect admin to admin dashboard
                } else {
                    res.redirect('/bingkas.html'); // Redirect regular user to success page
                }
            } else {
                res.status(400).send('User not found');
            }
        } catch (err) {
            console.error('Error during login OTP verification', err);
            res.status(500).send('Error during login OTP verification');
        }
    } else {
        res.status(400).send('Incorrect OTP. Please try again.');
    }

});
// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


app.get('/admin/top-products', async (req, res) => {
    try {
        // Fetch the top 10 products by sales
        const topProducts = await Order.aggregate([
            { $unwind: "$products" }, // Decompose the products array to process each product
            {
                $group: {
                    _id: "$products.productId",
                    totalQuantity: { $sum: "$products.quantity" }, // Sum all quantities sold
                    totalSales: { $sum: { $multiply: ["$products.quantity", "$products.price"] } }, // Sum total sales value
                    productName: { $first: "$products.name" }, // Take the first occurrence of product name
                    price: { $first: "$products.price" }  // Get the price
                }
            },
            { $sort: { totalQuantity: -1 } }, // Sort by quantity sold, in descending order
            { $limit: 10 } // Limit to top 10 products
        ]);

        // Fetch all products for the sales details
        const allProductsDetails = await Order.aggregate([
            { $unwind: "$products" },
            {
                $group: {
                    _id: "$products.productId",
                    totalQuantity: { $sum: "$products.quantity" },
                    productName: { $first: "$products.name" },
                    price: { $first: "$products.price" }
                }
            },
            { $sort: { totalQuantity: -1 } } // Sort by quantity sold
        ]);

        res.json({ topProducts, allProductsDetails }); // Send both sets of data as a JSON response
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});



app.get('/admin/category-sales', async (req, res) => {
    try {
        // Fetch orders and populate product details
        const orders = await Order.find().populate('products.productId');
        
        const categoryCounts = {};

        // Aggregate the quantities sold by category
        orders.forEach(order => {
            order.products.forEach(item => {
                const category = item.productId.category;
                if (categoryCounts[category]) {
                    categoryCounts[category] += item.quantity;
                } else {
                    categoryCounts[category] = item.quantity;
                }
            });
        });

        // Convert the object into an array for Chart.js
        const categoryData = Object.keys(categoryCounts).map(category => ({
            category: category,
            quantity: categoryCounts[category]
        }));

        res.json(categoryData);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.get('/admin/price-range-distribution', async (req, res) => {
    try {
        const orders = await Order.find();
        
        // Initialize price range counters with the new range
        const priceRanges = {
            '0-5': 0,
            '6-10': 0,
            '11-15': 0,
            '16-20': 0,
            '20+': 0  // New price range
        };

        // Count products in each price range
        orders.forEach(order => {
            order.products.forEach(product => {
                const price = product.price;
                if (price <= 5) {
                    priceRanges['0-5'] += product.quantity;
                } else if (price <= 10) {
                    priceRanges['6-10'] += product.quantity;
                } else if (price <= 15) {
                    priceRanges['11-15'] += product.quantity;
                } else if (price <= 20) {
                    priceRanges['16-20'] += product.quantity;
                } else {
                    priceRanges['20+'] += product.quantity;  // Count products over $20
                }
            });
        });

        res.json(priceRanges);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});


async function getTopProductsByDistrict(district) {
    const postcodes = {
        Petaling: ['46000', '47400'],
        Sepang: ['43900'],
        Gombak: ['68100'],
        HuluLangat: ['43100'], 
    };

    // Find orders with the matching district's postcode
    const orders = await Order.find({ storePostcode: { $in: postcodes[district.toLowerCase()] } });

    // Aggregate the product purchases and calculate total quantities
    const productMap = new Map();
    orders.forEach(order => {
        order.products.forEach(product => {
            if (productMap.has(product.name)) {
                productMap.set(product.name, productMap.get(product.name) + product.quantity);
            } else {
                productMap.set(product.name, product.quantity);
            }
        });
    });

    // Sort the products by quantity and get the top 5
    const sortedProducts = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1]);
    return sortedProducts.slice(0, 5); // Return the top 5
}

// API to get top products for a district
app.get('/api/top-products/:district', async (req, res) => {
    const district = req.params.district;

    try {
        const topProducts = await getTopProductsByDistrict(district);
        res.json(topProducts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to get top products' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



