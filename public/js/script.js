// Function to update the cart count displayed in the UI
function updateCartCount(count) {
  const cartCountElement = document.querySelector('.cart-count');
  cartCountElement.textContent = count; // Update the count
}

// Function to fetch the cart count and update the indicator
async function fetchCartCount() {
  try {
      const response = await fetch('/api/cart');
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      // Check if productCount is defined and update the cart count on the page
      if (data.productCount !== undefined) {
          updateCartCount(data.productCount);
      } else {
          console.error('Product count is not defined in the response');
          updateCartCount(0); // Set to 0 if product count is missing
      }
  } catch (error) {
      console.error('Error fetching cart count:', error);
      updateCartCount(0); // Set to 0 in case of error
  }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', fetchCartCount);



// Get modal elements
var modal = document.getElementById("locationModal");
var locationIcon = document.getElementById("locationIcon");
var selectStore = document.getElementById("selectStore");
var closeModal = document.getElementById("closeModal");

// Open modal with animation
function openModal() {
  modal.style.display = "flex";
  setTimeout(function() {
    document.querySelector(".modal-content").classList.add("show");
  }, 10); // Small delay for smooth transition
}

// Close modal with animation
function closeModalFunc() {
  document.querySelector(".modal-content").classList.remove("show");
  setTimeout(function() {
    modal.style.display = "none";
  }, 300); // Wait for animation to complete
}

// When the user clicks the location icon or "Select Store", open the modal
locationIcon.onclick = openModal;
selectStore.onclick = openModal;

// When the user clicks the close (X) button, close the modal
closeModal.onclick = closeModalFunc;

// Close modal if the user clicks outside of it
window.onclick = function(event) {
  if (event.target == modal) {
    closeModalFunc();
  }
}

// Search button functionality
document.getElementById("searchButton").onclick = function() {
  const postcode = document.getElementById("postcodeInput").value.trim();
  if (postcode) {
    // Fetch stores from your server
    fetch(`/api/stores?postcode=${postcode}`)
      .then(response => response.json())
      .then(data => {
        displayResults(data);
      })
      .catch(error => {
        console.error('Error fetching stores:', error);
      });
  } else {
    alert("Please enter a postcode.");
  }
};

function displayResults(stores) {
    const resultsContainer = document.getElementById("resultsContainer");
    resultsContainer.innerHTML = ''; // Clear previous results
  
    if (stores.length > 0) {
      stores.forEach(store => {
        const storeDiv = document.createElement("div");
        storeDiv.classList.add("store-item");
        storeDiv.innerHTML = 
          `<img src="images/store-pin.png" class="store-icon" alt="Store Icon">
          <div class="store-item-content">
            <strong>${store.name}</strong>
            <span>${store.address}</span>
          </div>`;
  
        // Add click event to each store item
        storeDiv.addEventListener("click", () => {
          const storeName = store.name; // Capture selected store name
          fetch("/save-store", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ storeName }), // Send storeName in request body
          })
          .then(response => response.json())
          .then(data => {
            console.log("Store saved successfully:", data);
  
            // Display the selected store in #selectStore
            const selectStoreElement = document.getElementById("selectStore");
            selectStoreElement.textContent = storeName;
  
            // Close the modal and show the cancel button again
            closeModalFunc();
          })
          .catch(error => {
            console.error("Error saving store:", error);
          });
        });
  
        resultsContainer.appendChild(storeDiv);
      });
    } else {
      resultsContainer.innerHTML = 'No stores found for this postcode.';
    }
  }
  

// Close modal if the user clicks outside of it
window.onclick = function(event) {
  if (event.target == modal) {
    closeModalFunc();
  }
};

// Function to fetch and display the user's selected store on page load
function displaySelectedStore() {
    fetch('/get-user-store')
      .then(response => response.json())
      .then(data => {
        if (data.storeName && data.storeName !== '-') {
          const selectStoreElement = document.getElementById("selectStore");
          selectStoreElement.textContent = data.storeName; // Display the store name in the selectStore element
        }
      })
      .catch(error => {
        console.error("Error fetching store name:", error);
      });
}

// Function to check if the user has selected a store
function checkUserStore() {
  fetch('/check-user-store')
    .then(response => response.json())
    .then(data => {
      if (!data.hasStore) {
        // If the user doesn't have a store, force them to select one
        openModal(); // Open the modal for store selection
        hideCancelButton(); // Hide the cancel button to prevent closing the modal
      }
    })
    .catch(error => {
      console.error("Error checking user store:", error);
    });
}

// Function to hide the cancel button in the modal
function hideCancelButton() {
  const cancelButton = document.getElementById("closeModal");
  if (cancelButton) {
    cancelButton.style.display = "none"; // Hide the cancel button
  }
}

// Combine both functions in the same window.onload to ensure both are called when the page loads
window.onload = function() {
  displaySelectedStore();  // Display the user's selected store
  checkUserStore();        // Check if the user has selected a store
};


document.getElementById('search-input').addEventListener('keypress', function (event) {
  if (event.key === 'Enter') { // Check if the Enter key is pressed
      const query = this.value; // Get the search input value
      if (query) {
          // Redirect to the search results page with the query as a URL parameter
          window.location.href = `search.html?query=${encodeURIComponent(query)}`;
      }
  }
});

if (!localStorage.getItem('userLoggedIn')) {
  window.location.href = '/index.html'; // Redirect to login page
}

document.addEventListener('DOMContentLoaded', function () {
  fetch('/api/user')
      .then(response => response.json())
      .then(user => {
          if (user.balance !== undefined) {
              // Check if the balance is less than 0 and set it to 0 if so
              const displayedBalance = user.balance < 0 ? 0 : user.balance;
              
              // Update the balance in the navbar
              document.getElementById('user-balance').textContent = `RM ${displayedBalance.toFixed(2)}`;
          }
      })
      .catch(error => {
          console.error('Error fetching user data:', error);
      });
});
