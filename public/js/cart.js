document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/cart')
      .then(response => response.json())
      .then(data => {
          console.log('Fetched cart data:', data); // Log the fetched data
          if (data.error) {
              console.error(data.error);
              return;
          }

          const cartItems = data.products.map(item => `
          <tr>
              <td class="product-info">
                  <img src="${item.image}" alt="${item.name}" class="product-image">
                  <span class="product-name">${item.name}</span>
              </td>
              <td>RM${item.price.toFixed(2)}</td>
              <td>
                  <div class="quantity-controls">
                      <button class="quantity-btn" data-action="decrease" data-product-id="${item._id}">-</button>
                      <input type="text" value="${item.quantity}" readonly>
                      <button class="quantity-btn" data-action="increase" data-product-id="${item._id}">+</button>
                  </div>
              </td>
              <td class="item-total">RM${(item.price * item.quantity).toFixed(2)}</td>
              <td>
                  <button class="delete-btn" data-product-id="${item._id}">
                      <i class="bi bi-trash"></i>
                  </button>
              </td>
          </tr>
          `).join('');

          document.getElementById('cart-items').innerHTML = cartItems;
          updateCartTotal(); // Update the total price after rendering the items
      })
      .catch(err => console.error('Error fetching cart items', err));
});

function updateCartTotal() {
  const itemTotals = document.querySelectorAll('.item-total');
  let total = 0;

  itemTotals.forEach(itemTotal => {
      const itemPrice = parseFloat(itemTotal.textContent.replace('RM', ''));
      total += itemPrice;
  });

  document.getElementById('cart-total').textContent = total.toFixed(2);
}

document.querySelector('.cart-container').addEventListener('click', (event) => {
const target = event.target.closest('button'); // Ensure you capture the button

// Delete Button
if (target && target.classList.contains('delete-btn')) {
  const productId = target.dataset.productId;
  console.log(`Deleting product: ${productId}`);

  const row = target.closest('tr');
  
  // Add swipe-left class to start animation
  row.classList.add('swipe-left');
  
  // Wait for the animation to complete before removing the row
  setTimeout(() => {
      // Make a DELETE request to the server after the animation
      fetch(`/api/cart/${productId}`, { method: 'DELETE' })
          .then(response => response.json())
          .then(data => {
              if (data.success) {
                  row.remove(); // Remove the row after animation and successful deletion
                  updateCartTotal();
              } else {
                  console.error('Error deleting product', data.error);
              }
          })
          .catch(err => console.error('Error deleting product', err));
  }, 500); // Match the duration of the swipe animation
}

  // Quantity Buttons
  if (target && target.classList.contains('quantity-btn')) {
      const productId = target.dataset.productId;
      const action = target.dataset.action;
      const quantityInput = target.closest('.quantity-controls').querySelector('input');
      const priceCell = target.closest('tr').querySelector('td:nth-child(2)');
      const totalPriceCell = target.closest('tr').querySelector('td:nth-child(4)');
      let currentQuantity = parseInt(quantityInput.value);
      const unitPrice = parseFloat(priceCell.textContent.replace('RM', ''));

      console.log(`Action: ${action}, Product: ${productId}, Unit Price: ${unitPrice}`);

      // Adjust quantity based on button clicked
      if (action === 'increase') {
          currentQuantity++;
      } else if (action === 'decrease' && currentQuantity > 1) {
          currentQuantity--;
      }

      quantityInput.value = currentQuantity;
      const newTotalPrice = (unitPrice * currentQuantity).toFixed(2);
      totalPriceCell.textContent = `RM${newTotalPrice}`;

      // Send the updated quantity to the server
      fetch(`/api/cart/${productId}`, {
          method: 'PATCH',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ quantity: currentQuantity })
      })
          .then(response => response.json())
          .then(data => {
              if (!data.success) {
                  console.error('Error updating quantity', data.error);
              }
          })
          .catch(err => console.error('Error updating quantity', err));

      // Update the cart total after the quantity is changed
      updateCartTotal();
  }
});

document.querySelector('.checkout-btn').addEventListener('click', function() {
  window.location.href = 'checkout.html';
});

document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/user')
        .then(response => response.json())
        .then(user => {
            if (user.balance !== undefined) {
                // Update the balance in the navbar
                document.getElementById('user-balance').textContent = `RM ${user.balance}`;
            }
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
        });
  });