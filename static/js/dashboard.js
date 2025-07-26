document.addEventListener('DOMContentLoaded', function() {
    const mainContentArea = document.getElementById('mainContent');
    const sidebarNavLinks = document.querySelectorAll('.sidebar nav ul li a');
    const sidebarElement = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const overlayElement = document.getElementById('overlay');
    const dashboardContentArea = document.getElementById('dashboardContentArea');

    // Custom Confirmation Modal Elements
    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYesButton = document.getElementById('confirmYes');
    const confirmNoButton = document.getElementById('confirmNo');

    // Make showCustomConfirm globally available
    window.showCustomConfirm = function(message) {
        return new Promise((resolve) => {
            if (!confirmOverlay || !confirmMessage || !confirmYesButton || !confirmNoButton) {
                console.error("Confirmation modal elements not found.");
                resolve(false);
                return;
            }

            confirmMessage.textContent = message;
            confirmOverlay.style.display = 'flex';

            const onYes = () => {
                confirmOverlay.style.display = 'none';
                confirmYesButton.removeEventListener('click', onYes);
                confirmNoButton.removeEventListener('click', onNo);
                resolve(true);
            };

            const onNo = () => {
                confirmOverlay.style.display = 'none';
                confirmYesButton.removeEventListener('click', onYes);
                confirmNoButton.removeEventListener('click', onNo);
                resolve(false);
            };

            confirmYesButton.addEventListener('click', onYes);
            confirmNoButton.addEventListener('click', onNo);
        });
    };

    // Make displayDashboardMessage globally available
    window.displayDashboardMessage = function(message, type = 'info') {
        let messageBox = document.getElementById('dashboardMessageBox');
        if (!messageBox) {
            messageBox = document.createElement('div');
            messageBox.id = 'dashboardMessageBox';
            // Prepend to the dedicated dashboardContentArea
            if (dashboardContentArea) {
                dashboardContentArea.prepend(messageBox);
            } else if (mainContentArea) {
                mainContentArea.prepend(messageBox);
            } else {
                console.error("Cannot find a suitable area to display messages.");
                return;
            }
        }

        // Apply dynamic classes from CSS for styling
        messageBox.textContent = message;
        messageBox.className = `dashboard-message-box ${type}`;
        messageBox.style.display = 'block';

        // Automatically hide after 5 seconds
        setTimeout(() => {
            messageBox.style.display = 'none';
            // Optionally remove the messageBox from DOM if you want to completely clean up
            // messageBox.remove();
        }, 5000);
    };

    // NEW: Make deleteWinner globally available
    window.deleteWinner = async function(winnerId, winnerName) {
        const confirmed = await window.showCustomConfirm(`Are you sure you want to delete winner "${winnerName}"? This action cannot be undone.`);
        if (confirmed) {
            try {
                const response = await fetch(`/api/admin/winners/${winnerId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                if (response.ok) {
                    window.displayDashboardMessage(data.message, 'success');
                    // Reload the 'Manage Winners' content after successful deletion
                    const manageWinnersLink = document.querySelector('#nav-manage-winners');
                    if (manageWinnersLink && manageWinnersLink.dataset.contentUrl) {
                        window.loadContent(manageWinnersLink.dataset.contentUrl);
                    }
                } else {
                    window.displayDashboardMessage(data.message || 'Failed to delete winner.', 'error');
                }
            } catch (error) {
                console.error('Delete winner error:', error);
                window.displayDashboardMessage('Network error or server issue during deletion.', 'error');
            }
        }
    };

    // NEW: Make editWinner globally available
    window.editWinner = function(winnerId) {
        // This function should load the winner form, pre-filling it with data for the given winnerId
        window.loadContent(`/winner_form_content?winner_id=${winnerId}`);
    };

    // Helper function to format currency
    function formatCurrency(amount, currency = 'USD') {
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            console.warn(`Currency formatting error for amount: ${amount}, currency: ${currency}`, e);
            return `${amount} ${currency}`; // Fallback
        }
    }

    // Helper function to get status color class
    function getStatusColorClass(status) {
        switch (status) {
            case 'Claimed':
                return 'status-badge claimed';
            case 'Pending':
                return 'status-badge pending';
            case 'Delivered':
                return 'status-badge delivered';
            case 'Rejected':
            case 'Cancelled':
                return 'status-badge rejected';
            default:
                return 'status-badge info';
        }
    }

    // NEW FUNCTION: Fetch and display winners for the admin table
    async function fetchAndDisplayAdminWinners() {
        const winnersTableTbodyAdmin = document.getElementById('winnersTableTbodyAdmin');
        if (!winnersTableTbodyAdmin) {
            console.warn("Admin winners table tbody (ID: winnersTableTbodyAdmin) not found. Skipping winner list fetching.");
            return;
        }

        winnersTableTbodyAdmin.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading winners...</td></tr>';

        try {
            const response = await fetch('/api/admin/winners');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();

            if (result.success && Array.isArray(result.winners) && result.winners.length > 0) {
                let tableHtml = '';
                result.winners.forEach(winner => {
                    const statusClass = getStatusColorClass(winner.status);
                    tableHtml += `
                        <tr>
                            <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                                <div class="flex items-center">
                                    <div class="flex-shrink-0 h-10 w-10">
                                        <img class="h-10 w-10 rounded-full object-cover" src="${winner.image_url || '/static/images/placeholder.png'}" alt="Winner Image">
                                    </div>
                                    <div class="ml-4">
                                        <div class="text-sm font-medium text-gray-900">${winner.name}</div>
                                        <div class="text-sm text-gray-500">${winner.location || 'N/A'}</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${winner.winning_code || 'N/A'}</td>
                            <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                                ${winner.fb_link ? `<a href="${winner.fb_link}" target="_blank" class="text-blue-600 hover:underline">Facebook</a>` : 'N/A'}
                            </td>
                            <td class="px-6 py-2 whitespace-nowrap text-sm">
                                <span class="${statusClass}">
                                    ${winner.status || 'N/A'}
                                </span>
                            </td>
                            <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${formatCurrency(winner.amount, winner.currency)}</td>
                            <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${formatCurrency(winner.payment_fee, winner.currency)}</td>
                            <td class="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                                <button data-winner-id="${winner._id}" class="text-indigo-600 hover:text-indigo-900 mr-2 edit-winner-btn">Edit</button>
                                <button data-winner-id="${winner._id}" data-winner-name="${winner.name}" class="text-red-600 hover:text-red-900 delete-winner-btn">Delete</button>
                            </td>
                        </tr>
                    `;
                });
                winnersTableTbodyAdmin.innerHTML = tableHtml;
            } else {
                winnersTableTbodyAdmin.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-gray-500">No winners found.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching admin winners:', error);
            winnersTableTbodyAdmin.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading winners: ' + error.message + '</td></tr>';
        }
    }

    // Function to load content into the mainContentArea via AJAX
    window.loadContent = async function(url) {
        if (!url) {
            console.error("No URL provided for loadContent.");
            const targetArea = dashboardContentArea || mainContentArea;
            if (targetArea) {
                targetArea.innerHTML = '<p class="text-red-500">Error: No content URL specified.</p>';
            }
            return;
        }

        // Clear existing content and show loading message
        const targetArea = dashboardContentArea || mainContentArea;
        if (targetArea) {
            targetArea.innerHTML = '<p class="text-gray-500 text-center py-8">Loading content...</p>';
        } else {
            console.error("Cannot find a content area to load content into.");
            return;
        }
        displayDashboardMessage('', 'info'); // Clear previous messages

        // Close sidebar and hide overlay on mobile when content is loaded
        if (window.innerWidth <= 768) {
            sidebarElement.classList.remove('visible');
            sidebarElement.classList.add('hidden-sidebar');
            overlayElement.classList.remove('visible');
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text(); // Get response text for more details
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }
            const html = await response.text();

            // Inject content into the specific content placeholder div
            targetArea.innerHTML = html;

            // Re-attach event listeners for newly loaded content
            // IMPORTANT: This function will now only attach listeners that need to be re-attached
            // due to content being replaced. Global/delegated listeners are handled once outside.
            attachContentSpecificEventListeners(url);

        } catch (error) {
            console.error('Error loading content:', error);
            const errorMessage = `<p class="text-red-500 text-center py-8">Error loading content: ${error.message}. Please try again.</p>`;
            targetArea.innerHTML = errorMessage;
            displayDashboardMessage(`Error loading content: ${error.message}.`, 'error');
        }
    };

    // Function to attach event listeners specific to dynamically loaded content
    // This runs AFTER content is loaded into the dashboardContentArea
    function attachContentSpecificEventListeners(loadedUrl) {
        // --- Manage Winners Section Listeners (for elements within the form) ---
        const winnerForm = document.getElementById('winnerForm');
        const winnerImageInput = document.getElementById('winner_image');
        const winnerImagePreview = document.getElementById('winnerImagePreview');
        const removeImageCheckbox = document.getElementById('remove_image');

        if (winnerForm) {
            // Remove previous listener to prevent duplication if form is reloaded
            winnerForm.removeEventListener('submit', handleWinnerFormSubmit);
            winnerForm.addEventListener('submit', handleWinnerFormSubmit);

            // Handle image preview for add/edit winner form
            if (winnerImageInput && winnerImagePreview) {
                // Remove previous listener to prevent duplication
                winnerImageInput.removeEventListener('change', handleWinnerImageChange);
                winnerImageInput.addEventListener('change', handleWinnerImageChange);
            }
            // Handle 'Remove Current Image' checkbox
            if (removeImageCheckbox && winnerImageInput && winnerImagePreview) {
                // Remove previous listener to prevent duplication
                removeImageCheckbox.removeEventListener('change', handleRemoveImageChange);
                removeImageCheckbox.addEventListener('change', handleRemoveImageChange);
            }
            // Initial display of image preview on form load if an image exists
            const currentImagePathInput = document.getElementById('current_image_path');
            if (winnerImagePreview && currentImagePathInput && currentImagePathInput.value && !removeImageCheckbox.checked) {
                winnerImagePreview.src = `/static/uploads/${currentImagePathInput.value}`;
                winnerImagePreview.style.display = 'block';
                winnerImagePreview.dataset.currentImageUrl = winnerImagePreview.src; // Store for reverting
            } else if (winnerImagePreview) {
                winnerImagePreview.style.display = 'none';
                winnerImagePreview.src = '';
            }
        }

        // --- Conditional Fetching for specific pages (Run ONLY when that page is loaded) ---
        if (loadedUrl.startsWith('/view_winners_content')) {
            fetchAndDisplayAdminWinners(); // Call the function to fetch and display winners
            // Attach listener for "Add New Winner" button specifically if it's on this page
            const addNewWinnerButton = document.getElementById('addNewWinnerButton');
            if (addNewWinnerButton) {
                addNewWinnerButton.removeEventListener('click', handleAddNewWinnerClick); // Prevent double
                addNewWinnerButton.addEventListener('click', handleAddNewWinnerClick);
            }
        }
        if (loadedUrl.startsWith('/view_applications_content')) {
            // Assuming a function like fetchAndDisplayAdminApplications() exists
            // This is where you'd call it to populate the applications table
            // For example: fetchAndDisplayAdminApplications();
        }
        // Add more conditional fetches for other pages
    }

    // Handlers for dynamically added content (to prevent re-attaching on loadContent)
    function handleWinnerImageChange() {
        const winnerImageInput = this; // 'this' refers to the input element
        const winnerImagePreview = document.getElementById('winnerImagePreview');
        const removeImageCheckbox = document.getElementById('remove_image');

        if (winnerImageInput.files && winnerImageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                winnerImagePreview.src = e.target.result;
                winnerImagePreview.style.display = 'block';
            };
            reader.readAsDataURL(winnerImageInput.files[0]);
            if (removeImageCheckbox) removeImageCheckbox.checked = false;
        } else {
            const currentImagePathInput = document.getElementById('current_image_path');
            if (currentImagePathInput && currentImagePathInput.value && !removeImageCheckbox.checked) {
                winnerImagePreview.src = `/static/uploads/${currentImagePathInput.value}`;
                winnerImagePreview.style.display = 'block';
            } else {
                winnerImagePreview.style.display = 'none';
                winnerImagePreview.src = '';
            }
        }
    }

    function handleRemoveImageChange() {
        const removeImageCheckbox = this; // 'this' refers to the checkbox
        const winnerImagePreview = document.getElementById('winnerImagePreview');
        const winnerImageInput = document.getElementById('winner_image');
        const currentImagePathInput = document.getElementById('current_image_path');

        if (removeImageCheckbox.checked) {
            winnerImagePreview.src = '';
            winnerImagePreview.style.display = 'none';
            if (winnerImageInput) winnerImageInput.value = ''; // Clear the file input
        } else {
            // If unchecked, try to restore current image if available
            if (currentImagePathInput && currentImagePathInput.value) {
                winnerImagePreview.src = `/static/uploads/${currentImagePathInput.value}`;
                winnerImagePreview.style.display = 'block';
            }
        }
    }

    async function handleWinnerFormSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const winnerId = form.dataset.winnerId;

        let url = '/api/admin/winners';
        if (winnerId && winnerId !== '0') {
            url = `/api/admin/winners/${winnerId}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                displayDashboardMessage(data.message, 'success');
                // Reload the 'Manage Winners' content
                const manageWinnersLink = document.querySelector('#nav-manage-winners');
                if (manageWinnersLink && manageWinnersLink.dataset.contentUrl) {
                    loadContent(manageWinnersLink.dataset.contentUrl);
                }
            } else {
                displayDashboardMessage(data.message || 'An error occurred during form submission.', 'error');
            }
        } catch (error) {
            console.error('Form submission error:', error);
            displayDashboardMessage('Network error or server issue during submission.', 'error');
        }
    }

    function handleAddNewWinnerClick() {
        loadContent('/winner_form_content');
    }

    // Event Delegation for dynamically added buttons (delete/edit winner, approve/reject/view application)
    // Attach these once to a stable parent element (like dashboardContentArea or mainContentArea)
    const delegationTarget = dashboardContentArea || mainContentArea;
    if (delegationTarget) {
        delegationTarget.addEventListener('click', async function(event) {
            // Handle Delete Winner Button
            if (event.target.classList.contains('delete-winner-btn')) {
                const button = event.target;
                const winnerId = button.dataset.winnerId;
                const winnerName = button.dataset.winnerName;
                window.deleteWinner(winnerId, winnerName); // Call the global delete function
            }
            // Handle Edit Winner Button
            else if (event.target.classList.contains('edit-winner-btn')) {
                const button = event.target;
                const winnerId = button.dataset.winnerId;
                window.editWinner(winnerId); // Call the global edit function
            }
            // Handle Delete Application Button
            else if (event.target.classList.contains('delete-application-btn')) {
                const button = event.target;
                const applicationId = button.dataset.appId;
                const applicantName = button.dataset.appName;

                const confirmed = await window.showCustomConfirm(`Are you sure you want to delete application from "${applicantName}"? This action cannot be undone.`);
                if (confirmed) {
                    try {
                        const response = await fetch(`/api/admin/applications/${applicationId}`, {
                            method: 'DELETE'
                        });
                        const data = await response.json();
                        if (response.ok) {
                            displayDashboardMessage(data.message, 'success');
                            const viewApplicationsLink = document.querySelector('#nav-view-applications');
                            if (viewApplicationsLink && viewApplicationsLink.dataset.contentUrl) {
                                loadContent(viewApplicationsLink.dataset.contentUrl); // Reload applications
                            }
                        } else {
                            displayDashboardMessage(data.message || 'Failed to delete application.', 'error');
                        }
                    } catch (error) {
                        console.error('Delete application error:', error);
                        displayDashboardMessage('Network error or server issue during deletion.', 'error');
                    }
                }
            }
            // Add event listeners for Approve and Reject Applications here using delegation
            else if (event.target.classList.contains('approve-application-btn')) {
                const button = event.target;
                const applicationId = button.dataset.applicationId;
                const confirmed = await window.showCustomConfirm("Are you sure you want to APPROVE this application?");
                if (confirmed) {
                    try {
                        const response = await fetch(`/admin/applications/${applicationId}/approve`, { method: 'POST' });
                        const data = await response.json();
                        if (response.ok) {
                            displayDashboardMessage(data.message, 'success');
                            loadContent(document.querySelector('#nav-view-applications').dataset.contentUrl);
                        } else {
                            displayDashboardMessage(data.message || 'Failed to approve application.', 'error');
                        }
                    } catch (error) {
                        console.error('Error approving application:', error);
                        displayDashboardMessage('Network error during approval.', 'error');
                    }
                }
            }
            else if (event.target.classList.contains('reject-application-btn')) {
                const button = event.target;
                const applicationId = button.dataset.applicationId;
                const confirmed = await window.showCustomConfirm("Are you sure you want to REJECT this application?");
                if (confirmed) {
                    try {
                        const response = await fetch(`/admin/applications/${applicationId}/reject`, { method: 'POST' });
                        const data = await response.json();
                        if (response.ok) {
                            displayDashboardMessage(data.message, 'success');
                            loadContent(document.querySelector('#nav-view-applications').dataset.contentUrl);
                        } else {
                            displayDashboardMessage(data.message || 'Failed to reject application.', 'error');
                        }
                    } catch (error) {
                        console.error('Error rejecting application:', error);
                        displayDashboardMessage('Network error during rejection.', 'error');
                    }
                }
            }
            else if (event.target.classList.contains('view-application-details-btn')) {
                const applicationId = event.target.dataset.applicationId;
                if (applicationId) {
                    loadContent(`/admin/applications/${applicationId}/view`);
                } else {
                    displayDashboardMessage("Invalid application ID for viewing details.", "error");
                }
            }
        });
    }

    // --- Sidebar Navigation Logic ---
    sidebarNavLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();

            // Remove active class from all links and add to the clicked one
            sidebarNavLinks.forEach(navLink => navLink.classList.remove('active'));
            this.classList.add('active');

            const contentUrl = this.dataset.contentUrl;
            if (contentUrl) {
                loadContent(contentUrl);
            }
        });
    });

    // --- Mobile Sidebar Toggle Logic ---
    if (sidebarToggle && sidebarElement && overlayElement) {
        sidebarToggle.addEventListener('click', function() {
            sidebarElement.classList.toggle('visible');
            overlayElement.classList.toggle('visible');

            if (sidebarElement.classList.contains('visible')) {
                sidebarElement.classList.remove('hidden-sidebar');
            } else {
                sidebarElement.classList.add('hidden-sidebar');
            }
            // Main content shifting is primarily handled by CSS media queries,
            // no need for JS to toggle 'sidebar-hidden' class on mainContentArea based on desktop/mobile
        });

        // Close sidebar if clicking on the overlay when open (on mobile)
        overlayElement.addEventListener('click', function() {
            if (sidebarElement.classList.contains('visible')) {
                sidebarElement.classList.remove('visible');
                sidebarElement.classList.add('hidden-sidebar');
                overlayElement.classList.remove('visible');
            }
        });
    } else {
        console.warn("Sidebar toggle elements (sidebarToggle, sidebarElement, overlayElement) not found. Mobile sidebar might not function.");
    }

    // Load default content (e.g., View Applications) on dashboard load
    const defaultContentLink = document.getElementById('nav-view-applications');
    if (defaultContentLink && defaultContentLink.dataset.contentUrl) {
        loadContent(defaultContentLink.dataset.contentUrl);
        // Set default link as active
        defaultContentLink.classList.add('active');
    } else {
        console.warn("Default content link (nav-view-applications) or its content URL not found.");
    }

    // Handle window resize to adjust sidebar visibility for desktop/mobile
    window.addEventListener('resize', function() {
        if (sidebarElement && mainContentArea && overlayElement) {
            if (window.innerWidth > 768) {
                // On desktop, ensure sidebar is visible and mobile classes are removed
                sidebarElement.classList.remove('hidden-sidebar');
                sidebarElement.classList.remove('visible'); // Remove 'visible' if it was left from mobile
                mainContentArea.classList.remove('sidebar-hidden'); // Ensure main content is not full width
                overlayElement.classList.remove('visible'); // Hide overlay on desktop
            } else {
                // On mobile, ensure sidebar is hidden by default unless explicitly opened by user
                // If it's not currently 'visible' (meaning it's closed), ensure 'hidden-sidebar' is applied
                if (!sidebarElement.classList.contains('visible')) {
                    sidebarElement.classList.add('hidden-sidebar');
                }
                // Main content should always be full width on mobile
                mainContentArea.classList.remove('sidebar-hidden');
            }
        }
    });

    // Initial check on load for desktop/mobile state
    if (sidebarElement && mainContentArea && overlayElement) {
        if (window.innerWidth <= 768) {
            sidebarElement.classList.add('hidden-sidebar'); // Ensure hidden on mobile by default
            sidebarElement.classList.remove('visible'); // Ensure it's not visible
            mainContentArea.classList.remove('sidebar-hidden'); // Ensure main content is full width
            overlayElement.classList.remove('visible'); // Ensure overlay is hidden
        }
        // For desktop, default CSS should handle initial state, but explicit clean-up for safety
        else {
            sidebarElement.classList.remove('hidden-sidebar');
            sidebarElement.classList.remove('visible');
            mainContentArea.classList.remove('sidebar-hidden');
            overlayElement.classList.remove('visible');
        }
    }
});