const express = require('express');
const mongoose = require('mongoose');
const { User } = require('../server'); // Adjust the path as necessary4


const router = express.Router();

// Route to save selected store
router.post('/api/save-store', async (req, res) => {
  const userId = req.session.userId; // Get user ID from session
  const { store } = req.body; // Get store name from request body

  console.log(`Received request to save store: ${store} for user ID: ${userId}`);

  try {
    // Update the user's store field
    const updatedUser = await User.findByIdAndUpdate(userId, { store }, { new: true });

    if (!updatedUser) {
      console.error(`User not found for ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log(`User ${userId} updated with store: ${store}`);
    res.status(200).json({ message: 'Store updated successfully', updatedUser });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ message: 'Error updating store', error });
  }
});

module.exports = router; // Export the router
