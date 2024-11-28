// Fetch cart items and display them on the page
async function fetchCart() {
    try {
        // Fetch cart data
        const cartResponse = await fetch('/api/cart'); // Adjust this endpoint if needed
        const cartData = await cartResponse.json();
        console.log('Cart Data:', cartData); // Log cart data

        // Fetch user balance
        const userResponse = await fetch('/api/user'); // Adjust this endpoint if needed
        const userData = await userResponse.json();
        console.log('User Data:', userData); // Log user data to check balance

        // Check if user balance exists
        if (userData && userData.balance !== undefined) {
            const balance = userData.balance; // Get user's balance
            console.log('User Balance:', balance); // Log the user balance

            // Calculate total amount from cart products
            const totalAmount = cartData.products.reduce((total, product) => {
                return total + product.price * product.quantity;
            }, 0);
            console.log('Total Amount:', totalAmount); // Log the total amount

            const remainingBalance = (balance - totalAmount).toFixed(2); // Calculate remaining balance
            console.log('Remaining Balance:', remainingBalance); // Log remaining balance

            // Update remaining balance in the HTML
            document.getElementById('remaining-balance').textContent = `RM ${remainingBalance}`;
            displayCartItems(cartData.products, remainingBalance); // Pass remaining balance to displayCartItems
        } else {
            console.error('User balance is not available');
            document.getElementById('remaining-balance').textContent = 'RM 0.00'; // Default if balance not available
            displayCartItems(cartData.products, 0); // Pass 0 if balance is not available
        }

        // Add event listener to place order button after cart is displayed
        document.getElementById('placeOrderButton').addEventListener('click', async () => {
            const totalElement = document.getElementById('total');
            if (!totalElement) {
                console.error('Total element not found.');
                return;
            }
            const totalAmount = parseFloat(totalElement.textContent.replace('RM ', '')); // Get total amount
            const pickupLocation = document.getElementById('storeInfo').innerText.trim(); // Get store info
            const storePostcode = document.getElementById('storeInfo').getAttribute('data-postcode');
            
            if (!pickupLocation) {
                alert('Please select a location.');
                return;
            }

            // Determine pickup time based on selection
            let pickupDateTime;
            if (document.getElementById('standard').checked) {
                // "Standard" option selected - Set pickup time to 20 minutes from now
                const currentTime = new Date();
                pickupDateTime = new Date(currentTime.getTime() + 20 * 60000); // Add 20 minutes
            } else {
                // Use the selected date and time from the calendar for custom pickup
                pickupDateTime = new Date(document.getElementById('pick-datetime').value);
            }

            if (!pickupDateTime) {
                alert('Please select a valid pickup date and time.');
                return;
            }

            try {
                const response = await fetch('/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        totalAmount: totalAmount,
                        pickupDate: pickupDateTime,  // Change pickupDateTime to pickupDate
                        pickupLocation: pickupLocation,
                        storePostcode: storePostcode, // Include postcode
                        products: cartData.products  // Send products array from the cart
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    await clearCart();
                    document.getElementById('confirmationModal').style.display = 'block';
                    // Now update the user's balance
                    const remainingBalance = (userData.balance - totalAmount).toFixed(2); // Calculate remaining balance
                    await updateUserBalance(remainingBalance); // Call function to update the user's balance

                } else {
                    alert('Failed to place order. Please try again.');
                }
            } catch (error) {
                console.error('Error placing order:', error);
                alert('An error occurred while placing your order.');
            }
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
    }
}

async function clearCart() {
    try {
        // Fetch the current cart to get all product IDs
        const cartResponse = await fetch('/api/cart');
        const cartData = await cartResponse.json();

        // Delete each product in the cart
        for (const product of cartData.products) {
            const response = await fetch(`/api/cart/${product._id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete product ${product._id}`);
            }
        }

        console.log('Cart cleared successfully');
        // Optional: Refresh cart display or update UI
        await fetchCart(); // Re-fetch the cart to update the display
    } catch (error) {
        console.error('Error clearing cart:', error);
        alert('Failed to clear cart. Please try again.');
    }
}

async function updateUserBalance(remainingBalance) {
    try {
        const response = await fetch('/api/user/balance', {
            method: 'PUT', // Use PUT for updates
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ balance: parseFloat(remainingBalance) }), // Send the new balance as a number
        });

        if (!response.ok) {
            throw new Error('Failed to update user balance');
        }

        console.log('User balance updated successfully');
    } catch (error) {
        console.error('Error updating user balance:', error);
        alert('Failed to update balance. Please try again.');
    }
}


// Function to display cart items and calculate subtotal
function displayCartItems(products, remainingBalance) {
    const orderSummaryContainer = document.querySelector('.order-summary');
    orderSummaryContainer.innerHTML = ''; // Clear previous items

    const orderTitle = document.createElement('h2');
    orderTitle.textContent = 'Your Order';
    orderSummaryContainer.appendChild(orderTitle);

    let subtotal = 0;

    products.forEach(product => {
        const item = document.createElement('div');
        item.classList.add('item');

        const itemName = document.createElement('p');
        // Display product name with quantity
        itemName.textContent = `${product.name} × ${product.quantity}`;

        const itemPrice = document.createElement('p');
        const totalPrice = (product.price * product.quantity).toFixed(2);
        itemPrice.textContent = `RM ${totalPrice}`;

        item.appendChild(itemName);
        item.appendChild(itemPrice);

        orderSummaryContainer.appendChild(item);

        subtotal += product.price * product.quantity;
    });

    // Add total element with id="total"
    const totalItem = document.createElement('div');
    totalItem.classList.add('item', 'total');
    totalItem.innerHTML = `<p>Total</p><p id="total">RM ${subtotal.toFixed(2)}</p>`;
    orderSummaryContainer.appendChild(totalItem);

    // Check and log remainingBalance before appending
    console.log('Remaining Balance:', remainingBalance);

    // Add remaining balance element
    const remainingBalanceItem = document.createElement('div');
    remainingBalanceItem.classList.add('item', 'remaining-balance');
    remainingBalanceItem.innerHTML = `<p>Remaining Balance</p><p>RM ${remainingBalance !== undefined ? remainingBalance : '0.00'}</p>`;
    orderSummaryContainer.appendChild(remainingBalanceItem);

    // Check if additional payment is needed in-store
    if (remainingBalance < 0) {
        const extraAmount = Math.abs(remainingBalance).toFixed(2);
        const extraPaymentItem = document.createElement('div');
        extraPaymentItem.classList.add('item', 'extra-payment');
        extraPaymentItem.innerHTML = `<p>Amount Needed to Pay in Store</p><p>RM ${extraAmount}</p>`;
        orderSummaryContainer.appendChild(extraPaymentItem);
    }
}


// Call fetchCart when the DOM is ready
document.addEventListener('DOMContentLoaded', fetchCart);

// Show/Hide calendar based on radio button selection
function toggleCalendar(show) {
    const calendar = document.getElementById("calendar");
    if (show) {
        calendar.style.display = "block";
    } else {
        calendar.style.display = "none";
    }
}

// Initialize Flatpickr for date and time selection
flatpickr("#pick-datetime", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    time_24hr: true,
    defaultHour: 10,
    minuteIncrement: 30,
    minTime: "10:00",
    maxTime: "22:00"
});

// Add event listener for OK button
document.getElementById('ok-button').addEventListener('click', function() {
    const selectedDateTime = document.getElementById("pick-datetime").value;
    if (selectedDateTime) {
        toggleCalendar(false); // Hide the calendar after selection

        // Hide the standard option
        const standardOption = document.querySelector('.standard-option');
        if (standardOption) {
            standardOption.style.display = 'none'; // Hide the standard option
        }

        // Update the scheduled label with the selected date and time
        const scheduledLabel = document.getElementById('scheduled-label');
        scheduledLabel.innerHTML = `Scheduled <span style="color: #888;">${selectedDateTime}</span>`; // Set color for date and time
        
        // Show the edit icon
        const editIconContainer = document.getElementById('edit-icon-container');
        editIconContainer.innerHTML = ''; // Clear previous icon if any

        const editIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        editIcon.setAttribute("viewBox", "0 0 24 24");
        editIcon.setAttribute("style", "width: 16px; height: 16px; cursor: pointer; margin-left: 8px;");
        editIcon.innerHTML = '<path d="M3 17.25V21h3.75l11.5-11.5-3.75-3.75L3 17.25zm16.85-10.45l-1.4 1.4-3.75-3.75 1.4-1.4a2.5 2.5 0 013.55 0c.97.98.97 2.57 0 3.55z"/>';

        // Append the edit icon to the edit icon container
        editIconContainer.appendChild(editIcon);
        editIconContainer.style.display = 'inline'; // Show the edit icon container
        
        // Add event listener for the edit icon
        editIcon.addEventListener('click', function() {
            toggleCalendar(true); // Show the calendar again
            // When re-opening the calendar, set the selected date
            flatpickr("#pick-datetime", {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                minDate: "today",
                time_24hr: true,
                defaultHour: 10,
                minuteIncrement: 30,
                minTime: "10:00",
                maxTime: "22:00"
            }).setDate(selectedDateTime); // Set previously selected date
        });
    }
});

// Fetch and display user details
document.addEventListener('DOMContentLoaded', () => {
    fetchUserDetails(); // Call the function to fetch user details
});

async function fetchUserDetails() {
    try {
        const response = await fetch('/api/user', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Include credentials to send cookies with the request
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Check if user data is received
        if (data.name && data.email) {
            // Update the HTML with user details
            document.querySelector('.personal-details h2').textContent = 'Personal Details';
            document.querySelector('.personal-details p:nth-of-type(1)').innerHTML = `<strong>${data.name}</strong>`;
            document.querySelector('.personal-details p:nth-of-type(2)').textContent = data.email;
            document.querySelector('.personal-details p:nth-of-type(3)').textContent = data.phoneNumber || 'N/A'; // Optional phone number
        } else {
            console.error('User data is not available');
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
    }
}

// Function to fetch and display store details on checkout page
function loadStoreDetails() {
    fetch('/get-store-details')
      .then(response => response.json())
      .then(data => {
        if (data.storeName && data.storeAddress && data.storePostcode) {
          const storeInfoDiv = document.getElementById('storeInfo');
          storeInfoDiv.innerHTML = `
            <p><strong>${data.storeName}</strong></p>
            <p>${data.storeAddress}</p>
            <p>Postcode: ${data.storePostcode}</p> <!-- Display the postcode -->
          `;

          // Store the postcode for use when placing the order
          storeInfoDiv.setAttribute('data-postcode', data.storePostcode);
        } else {
          const storeInfoDiv = document.getElementById('storeInfo');
          storeInfoDiv.innerHTML = '<p>No store selected.</p>';
        }
      })
      .catch(error => {
        console.error('Error fetching store details:', error);
        const storeInfoDiv = document.getElementById('storeInfo');
        storeInfoDiv.innerHTML = '<p>Error loading store details.</p>';
      });
}


// Call the function when the page loads
window.onload = loadStoreDetails;


// Function to handle modal close
document.querySelector('.close-button').addEventListener('click', () => {
    document.getElementById('confirmationModal').style.display = 'none';
});

// Function to continue shopping
function continueShopping() {
    document.getElementById('confirmationModal').style.display = 'none';
    window.location.href = '/bingkas.html'; // Adjust the URL as needed
}

