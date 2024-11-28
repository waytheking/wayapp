const mongoose = require('mongoose');

// Check if the model is already compiled to avoid OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    name: { type: String },
    username: { type: String, unique: true },
    password: { type: String },
    idNumber: { type: String, unique: true, required: true },
    phoneNumber: { type: String },
    store: { type: String },
    email: { type: String, unique: true, required: true },
    cart: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    isAdmin: { type: Boolean, default: false }
}));

module.exports = User;
