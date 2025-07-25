// script.js

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const winnersTableTbody = document.getElementById('winnersTableTbody'); // This is for your public-facing weekly winners table
    const searchInput = document.getElementById('searchInput'); // For public view search bar
    const searchButton = document.getElementById('searchButton'); // For public view search button
    const winnerDetailsModal = document.getElementById('winnerDetailsModal');
    const winnerDetailsContent = document.getElementById('winnerDetailsContent');
    const winnerDetailsCloseButton = document.querySelector('#winnerDetailsModal .close-button');
    const customMessageContainer = document.getElementById('customMessage'); // For public view messages

    let allWinnersData = []; // To store data fetched for the main public table

    // Helper function to display custom messages
    function showCustomMessage(message, type = 'info') {
        if (customMessageContainer) {
            customMessageContainer.textContent = message;
            // Clear all previous type-specific classes
            customMessageContainer.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-blue-500');

            // Ensure base classes are present (you can define these in your CSS)
            customMessageContainer.classList.add('p-3', 'rounded-md', 'text-white', 'text-center', 'mb-4');

            if (type === 'error') {
                customMessageContainer.classList.add('bg-red-500');
            } else if (type === 'warning') {
                customMessageContainer.classList.add('bg-yellow-500');
            } else if (type === 'success') {
                customMessageContainer.classList.add('bg-green-500');
            } else { // default or 'info'
                customMessageContainer.classList.add('bg-blue-500');
            }
            customMessageContainer.style.display = 'block';
        } else {
            console.warn("Custom message container not found.", message);
        }
    }

    // Helper function to hide the custom message
    function hideFrontendMessage() {
        if (customMessageContainer) {
            customMessageContainer.style.display = 'none';
            customMessageContainer.textContent = ''; // Clear text as well
        }
    }

    // Helper function to format currency
    function formatCurrency(amount, currency = 'USD') { // Default to USD if currency is not provided
        const numericAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numericAmount);
    }

    // Helper function for status colors
    function getStatusColorClass(status) {
        if (!status) return 'text-gray-600';
        const lowerStatus = status.toLowerCase();
        switch (lowerStatus) {
            case 'claimed': return 'text-green-600';
            case 'pending': return 'text-yellow-600';
            case 'not yet claimed': return 'text-red-600';
            case 'delivered': return 'text-blue-600';
            case 'processing': return 'text-purple-600';
            case 'rejected': return 'text-gray-600';
            default: return 'text-gray-600';
        }
    }

    /**
     * Displays a modal with detailed information about a winner (used for search results).
     * @param {Object} winner - The winner object with details.
     */
    function showWinnerDetailsModal(winner) {
        if (!winnerDetailsModal || !winnerDetailsContent) {
            showCustomMessage("Could not display winner details modal.", 'error');
            return;
        }

        // IMPORTANT: Ensure your backend provides these keys matching the JS expectation.
        // We're adapting to match what the HTML expects (e.g., winner_name vs name)
        const winnerName = winner.name || 'N/A'; // From Flask: 'name'
        const winnerLocation = winner.location || 'N/A'; // From Flask: 'location'
        const winningCode = winner.winning_code || 'N/A'; // From Flask: 'winning_code'
        const winningAmount = winner.amount; // From Flask: 'amount'
        const winnerPaymentFee = winner.payment_fee; // From Flask: 'payment_fee'
        const winnerStatus = winner.status || 'N/A'; // From Flask: 'status'
        const winnerFblink = winner.fb_link || ''; // From Flask: 'fb_link'
        const imageUrl = winner.image_url && winner.image_url !== ''
            ? winner.image_url
            : 'https://placehold.co/120x120/007bff/ffffff?text=No+Image';

        winnerDetailsContent.innerHTML = `
            <div class="p-6 text-center">
                <h3 class="text-3xl font-extrabold text-blue-700 mb-4 animate-fade-in-down">
                    🎉 Congratulations! 🎉
                </h3>
                <p class="text-lg text-gray-700 mb-6 font-semibold">
                    We found a matching winner!
                </p>

                <div class="flex flex-col items-center mb-6">
                    <img src="${imageUrl}" alt="Winner Image"
                        class="w-32 h-32 md:w-40 md:h-40 object-cover rounded-full shadow-lg border-4 border-blue-400 animate-zoom-in"
                        onerror="this.onerror=null;this.src='https://placehold.co/120x120/007bff/ffffff?text=No+Image';">
                    <p class="text-2xl font-bold text-gray-900 mt-4">${winnerName}</p>
                    <p class="text-md text-gray-600">${winnerLocation}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left text-gray-800">
                    <div class="bg-gray-50 p-3 rounded-lg shadow-sm">
                        <strong class="block text-sm text-gray-500">Winning Code:</strong>
                        <span class="text-lg font-mono text-purple-700 break-words">${winningCode}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg shadow-sm">
                        <strong class="block text-sm text-gray-500">Winning Amount:</strong>
                        <span class="text-xl font-bold text-green-600">${formatCurrency(winningAmount, winner.currency || 'USD')}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg shadow-sm">
                        <strong class="block text-sm text-gray-500">Payment Fee:</strong>
                        <span class="text-lg font-semibold text-red-600">${formatCurrency(winnerPaymentFee, winner.currency || 'USD')}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg shadow-sm">
                        <strong class="block text-sm text-gray-500">Status:</strong>
                        <span class="text-lg font-semibold ${getStatusColorClass(winnerStatus)}">${winnerStatus}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg shadow-sm col-span-1 md:col-span-2">
                        <strong class="block text-sm text-gray-500">Facebook Profile:</strong>
                        ${winnerFblink ? `<a href="${winnerFblink}" target="_blank" class="text-blue-500 hover:underline text-base break-words">View Facebook Profile</a>` : '<span class="text-lg">N/A</span>'}
                    </div>
                </div>

                <p class="text-sm text-gray-500 mt-8">
                    Please contact our official claiming agent for further assistance.
                </p>

            <a href="mailto:ggf.agent.02488@gmail.com" target="_blank"
               class="inline-block mt-4 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 transition duration-300 text-lg">
                Email Agent
            </a>
            <a href="tel:+14085029445"
               class="inline-block mt-4 px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-md hover:bg-green-700 transition duration-300 text-lg ml-4">
                Call Agent
            </a>
            </div>
        `;

        winnerDetailsModal.style.display = 'flex'; // Show the modal
    }

    // Close winner details modal
    if (winnerDetailsCloseButton) {
        winnerDetailsCloseButton.addEventListener('click', () => {
            winnerDetailsModal.style.display = 'none';
        });
    }

    // Close modal if clicking outside
    if (winnerDetailsModal) {
        winnerDetailsModal.addEventListener('click', (event) => {
            if (event.target === winnerDetailsModal) {
                winnerDetailsModal.style.display = 'none';
            }
        });
    }

    /**
     * Fetches and displays ALL winners in the "Weekly Winners Selection" table (frontend).
     * Image is deliberately NOT shown in this table view.
     */
    async function fetchAllWinnersForPublicTable() {
        if (!winnersTableTbody) {
            console.error("Winners table body not found for initial load (public view).");
            return;
        }

        winnersTableTbody.innerHTML = '<tr><td colspan="8" class="loading-row text-center py-4 text-gray-500">Loading weekly winners...</td></tr>';
        hideFrontendMessage(); // Hide any previous messages

        try {
            // *** CHANGE START: Point to your Flask API endpoint for all winners ***
            const response = await fetch('/api/public/winners'); // Updated URL
            // *** CHANGE END ***

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json(); // Data is now directly the array of winners

            if (data && data.length > 0) { // Check if data is an array and not empty
                allWinnersData = data; // Store fetched data
                winnersTableTbody.innerHTML = ''; // Clear loading row
                allWinnersData.forEach(winner => {
                    const row = document.createElement('tr');

                    // Use the new getStatusColorClass helper
                    const statusClass = getStatusColorClass(winner.status); // From Flask: 'status'

                    row.innerHTML = `
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                            ${winner.name || 'N/A'}
                        </td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${winner.location || 'N/A'}</td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${winner.winning_code || 'N/A'}</td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${winner.fb_link ? `<a href="${winner.fb_link}" target="_blank" class="text-blue-500 hover:underline">Link</a>` : 'N/A'}</td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm"><span class="${statusClass}">${winner.status || 'N/A'}</span></td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${formatCurrency(winner.amount, winner.currency || 'USD')}</td>
                        <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${formatCurrency(winner.payment_fee, winner.currency || 'USD')}</td>
                    `;
                    winnersTableTbody.appendChild(row);
                });
            } else {
                winnersTableTbody.innerHTML = '<tr><td colspan="8" class="no-winners-row text-center py-4 text-gray-500">No weekly winners found.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching all winners for public table:', error);
            winnersTableTbody.innerHTML = '<tr><td colspan="8" class="no-winners-row text-center py-4 text-red-500">Error loading weekly winners. Please try again later.</td></tr>';
            showCustomMessage('Failed to load weekly winners. Please check your connection.', 'error');
        }
    }

    /**
     * Handles the search functionality to find a specific winner by name or code for the PUBLIC FRONTEND.
     */
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', async () => {
            const searchTerm = searchInput.value.trim();
            if (!searchTerm) {
                showCustomMessage('Please enter a name or winning code to search.', 'warning');
                return;
            }

            hideFrontendMessage();

            Swal.fire({
                title: 'Searching...',
                text: 'Please wait while we look for the winner.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                // *** CHANGE START: Point to your Flask API endpoint for search ***
                // Your Flask endpoint expects a 'query' parameter
                const response = await fetch(`/api/winners/search?query=${encodeURIComponent(searchTerm)}`);
                // *** CHANGE END ***

                if (!response.ok) {
                    // If the response status is 404 (Not Found), it means no winner was found
                    if (response.status === 404) {
                        Swal.close();
                        showCustomMessage('No winner found matching your search criteria.', 'error');
                        return; // Exit function if no winner found
                    }
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json(); // Expects a single winner object or an empty array

                Swal.close(); // Close SweetAlert loading spinner

                // The backend `/api/winners/search` should return an array,
                // even if it's just one winner.
                if (data && data.length > 0) { // Check if data is an array and has at least one winner
                    showWinnerDetailsModal(data[0]); // Show the first found winner in the modal
                } else {
                    showCustomMessage('No winner found matching your search.', 'error');
                }
            } catch (error) {
                console.error('Error during public search:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Search Error',
                    text: `An error occurred while searching: ${error.message}. Please try again.`,
                    confirmButtonColor: '#dc3545'
                });
            }
        });
        // Allow pressing Enter to search
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchButton.click();
            }
        });
    }

    // Initial load of all winners for the public-facing table when the page loads
    if (winnersTableTbody) {
        fetchAllWinnersForPublicTable();
    }
});