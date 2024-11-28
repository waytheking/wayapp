//carousel

let slideIndex = 0;
showSlides();

function showSlides() {
  const slides = document.getElementsByClassName("slide");
  const dots = document.getElementsByClassName("dots");
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  slideIndex++;
  if (slideIndex > slides.length) {slideIndex = 1}    
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active-dot", "");
  }
  slides[slideIndex-1].style.display = "block";  
  dots[slideIndex-1].className += " active-dot";
  setTimeout(showSlides, 4000); // Change image every 4 seconds
}

document.querySelector('.next').onclick = () => {
  slideIndex += 1;
  if (slideIndex > document.getElementsByClassName("slide").length) {slideIndex = 1}
  showCurrentSlide(slideIndex);
}

document.querySelector('.prev').onclick = () => {
  slideIndex -= 1;
  if (slideIndex < 1) {slideIndex = document.getElementsByClassName("slide").length}
  showCurrentSlide(slideIndex);
}

function currentSlide(n) {
  slideIndex = n;
  showCurrentSlide(slideIndex);
}

function showCurrentSlide(n) {
  const slides = document.getElementsByClassName("slide");
  const dots = document.getElementsByClassName("dots");
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";  
  }
  for (let i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active-dot", "");
  }
  slides[n-1].style.display = "block";  
  dots[n-1].className += " active-dot";
}


//customers favourite
const track = document.getElementById('carouselTrack');
const dots = document.querySelectorAll('.dot');
let currentIndex = 0;
const itemsPerPage = 4; // Show 4 products per page
let products = []; // Declare a global variable to hold the fetched products



// Function to render product cards
function renderProducts() {
    track.innerHTML = '';
    const start = currentIndex * itemsPerPage;
    const end = start + itemsPerPage;
    const visibleProducts = products.slice(start, end);

    visibleProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image">
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.quantity}</p>
                <div class="price-section">
                    <span class="current-price">RM ${product.price}</span>
                </div>
            </div>
            <div class="quantity-add-section">
                    <input type="number" value="1" min="1" class="quantity-selector">
                <button class="add-button" onclick="addToCart('${product._id}', '${product.name}', ${product.price}, '${product.image}', '${product.category}')">ADD</button>
            </div>
        `;
        track.appendChild(card);
    });
    
    // Update dots
    dots.forEach(dot => dot.classList.remove('active'));
    const totalPages = Math.ceil(products.length / itemsPerPage);
    if (currentIndex < totalPages) {
        dots[currentIndex].classList.add('active');
    }
}

//
function addToCart(productId, productName, productPrice, productImage, productCategory) { // Add productCategory parameter
    // Get the button element that was clicked
    const addButton = event.target;

    // Get the quantity selected by the user
    const quantitySelector = addButton.parentElement.querySelector('.quantity-selector');
    const quantity = parseInt(quantitySelector.value); // Parse as integer

    // Make an AJAX request to your server to add the product to the cart
    fetch('/add-to-cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            productId: productId, 
            productName: productName, 
            productPrice: productPrice, 
            productImage: productImage, 
            quantity: quantity, // Include the quantity
            productCategory: productCategory // Include the category
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Change the button text to "Added"
            addButton.innerHTML = 'Added <i class="fa fa-check"></i>';

            // Change the button color to green
            addButton.style.backgroundColor = 'green';

            // Disable the button to prevent further clicks
            addButton.disabled = true;

            setTimeout(() => {
                addButton.innerHTML = 'ADD';
                addButton.style.backgroundColor = ''; // Reset background color
                addButton.disabled = false; // Re-enable the button
            }, 500);
            // Update the cart count immediately after adding to cart
            fetchCartCount(); // Fetch and update the cart count
        } else {
            alert('Failed to add product to cart.');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}



function moveCarousel(direction) {
    const totalPages = Math.ceil(products.length / itemsPerPage);
    currentIndex += direction;

    // Wrap around logic
    if (currentIndex < 0) {
        currentIndex = totalPages - 1;
    } else if (currentIndex >= totalPages) {
        currentIndex = 0;
    }

    renderProducts();
}

// Fetch random products from the server
async function fetchRandomProducts() {
    try {
        const response = await fetch('/get-random-products');
        products = await response.json(); // Store fetched products in the global variable
        renderProducts();
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Initial fetch and render
fetchRandomProducts();




// load all products
let allProducts = []; // Global array to hold all fetched products
var cart = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
});

async function fetchProducts() {
  try {
      const response = await fetch('/api/products');
      allProducts = await response.json(); // Store fetched products globally
      displayedProducts = [...allProducts]; // Initialize displayedProducts with all products
      displayProducts(displayedProducts); // Display all products initially
      displayTotalItems(allProducts.length); 
  } catch (error) {
      console.error('Error fetching products:', error);
  }
}

let currentPage = 1;
const productsPerPage = 12;

function displayPagination(products) {
const paginationContainer = document.getElementById('pagination-container');
paginationContainer.innerHTML = ''; // Clear previous pagination buttons

const totalPages = Math.ceil(products.length / productsPerPage);

// Create Previous Button with Icon
const prevButton = document.createElement('button');
prevButton.innerHTML = '&#8592;'; // Left arrow (←)
prevButton.classList.add('pagination-btn');
prevButton.disabled = currentPage === 1;
prevButton.onclick = () => {
if (currentPage > 1) {
    currentPage--;
    displayProducts(products);
}
};
paginationContainer.appendChild(prevButton);

// Create Page Number Buttons
for (let i = 1; i <= totalPages; i++) {
const pageButton = document.createElement('button');
pageButton.innerText = i;
pageButton.classList.add('pagination-btn');
if (i === currentPage) {
    pageButton.classList.add('active'); // Highlight current page
}
pageButton.onclick = () => {
    currentPage = i;
    displayProducts(products);
};
paginationContainer.appendChild(pageButton);
}

// Create Next Button with Icon
const nextButton = document.createElement('button');
nextButton.innerHTML = '&#8594;'; // Right arrow (→)
nextButton.classList.add('pagination-btn');
nextButton.disabled = currentPage === totalPages;
nextButton.onclick = () => {
if (currentPage < totalPages) {
    currentPage++;
    displayProducts(products);
}
};
paginationContainer.appendChild(nextButton);
}

let currentSort = 'default'; // Track current sorting option
let displayedProducts = []; // To hold currently displayed products

document.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.querySelector('.dropdown');
    const dropdownSelect = dropdown.querySelector('.dropdown-select');
    const dropdownContent = dropdown.querySelector('.dropdown-content');
    const dropdownOptions = dropdownContent.querySelectorAll('a');

    // Toggle the dropdown on click
    dropdownSelect.addEventListener('click', () => {
        const isOpen = dropdownContent.style.display === 'block';
        dropdownContent.style.display = isOpen ? 'none' : 'block';
        dropdownContent.style.opacity = isOpen ? '0' : '1';
    });

    // Update the select text based on the clicked option
    dropdownOptions.forEach(option => {
        option.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the link from navigating
            const selectedValue = option.getAttribute('data-value'); // Get the value of the selected option
            dropdownSelect.textContent = selectedValue; // Update the dropdown-select text
            dropdownContent.style.display = 'none'; // Close the dropdown after selection
            dropdownContent.style.opacity = '0';

            // Call the sorting function with the currently displayed products
            sortProducts(selectedValue, displayedProducts); 
        });
    });

    // Close the dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!dropdown.contains(event.target)) {
            dropdownContent.style.display = 'none';
            dropdownContent.style.opacity = '0';
        }
    });
});

function sortProducts(sortType) {
  // Ensure sorting happens on the displayedProducts array
  switch (sortType) {
      case 'Featured':
          displayedProducts = [...allProducts]; // Reset to default order if sorting by 'Featured'
          break;
      case 'Alphabetically, A-Z':
          displayedProducts.sort((a, b) => a.name.localeCompare(b.name));
          break;
      case 'Price, low to high':
          displayedProducts.sort((a, b) => a.price - b.price);
          break;
      case 'Alphabetically, Z-A':
          displayedProducts.sort((a, b) => b.name.localeCompare(a.name));
          break;
      case 'Price, high to low':
          displayedProducts.sort((a, b) => b.price - a.price);
          break;
  }
  currentPage = 1; // Reset to the first page after sorting
  displayProducts(displayedProducts); // Re-render products after sorting
}


function displayProducts(products) {
  const container = document.getElementById('allproduct-container');
  container.innerHTML = ''; // Clear previous products

  // Calculate the start and end index for products to display on the current page
  const start = (currentPage - 1) * productsPerPage;
  const end = start + productsPerPage;
  const paginatedProducts = products.slice(start, end);

  // Display the paginated or filtered products
  paginatedProducts.forEach(product => {
      const productCard = document.createElement('div');
      productCard.className = 'all-product-card'; 

      const productContent = `
          <img src="${product.image}" alt="${product.name}" class="product-image">
          <div class="all-product-info">
              <h3>${product.name}</h3>
              <p>${product.quantity}</p>
              <div class="all-price-section">
                  <span class="all-current-price">RM ${product.price}</span>
              </div>
          </div>
          <div class="quantity-add-section">
              <input type="number" value="1" min="1" class="quantity-selector">
              <button class="add-button" onclick="addToCart('${product._id}', '${product.name}', ${product.price}, '${product.image}','${product.category}')">ADD</button>
          </div>
      `;
      
      productCard.innerHTML = productContent; // Set inner HTML for the product card
      container.appendChild(productCard); // Append to the container
  });

  // Only show pagination if there are enough products
  if (products.length > productsPerPage) {
      displayPagination(products);
  } else {
      document.getElementById('pagination-container').innerHTML = ''; // Hide pagination
  }
}

// Function to filter products by category and show the category name with cancel icon
function filterProducts(category) {
  // Reset current page to 1 when filtering
  currentPage = 1;

  // Smoothly scroll to the product section
  document.getElementById('allproduct-container').scrollIntoView({
      behavior: 'smooth'
  });

  // Get all products filtered by category
  displayedProducts = allProducts.filter(product => product.category === category);

  // Display filtered products
  displayProducts(displayedProducts);

  // Show the cancel icon and update the heading with the selected category
  const cancelIcon = document.querySelector('.cancel-filter');
  cancelIcon.style.display = 'inline'; // Show cancel icon

  const heading = document.querySelector('.heading-tittle');
  heading.innerHTML = `${category} <span class="cancel-filter" onclick="resetFilter()">&times;</span>`; // Update heading to show category with cancel icon
}

// Function to reset the filter and show all products
function resetFilter() {
  // Reset current page to 1
  currentPage = 1;

  // Display all products
  displayProducts(allProducts);

  // Hide the cancel icon and reset the heading text to "All Products"
  const heading = document.querySelector('.heading-tittle');
  heading.innerHTML = 'All Products';

  // Hide the cancel icon (already included inside the heading reset)
  document.querySelector('.cancel-filter').style.display = 'none';
}

