// Prestige SMS - Client-side JavaScript

// Select contact and reload messages
function selectContact(phone, name) {
    window.location.href = `/?contact=${encodeURIComponent(phone)}`;
}

// Send message via AJAX
async function sendMessage(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {
        from_number: formData.get('from_number'),
        to_number: formData.get('to_number'),
        message_content: formData.get('message_content')
    };
    
    // Disable form during send
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sending...';
    
    try {
        const response = await fetch('/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Clear input
            form.querySelector('#message_content').value = '';
            // Reload page to show new message
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            // Show detailed error message
            let errorMsg = result.error || 'Failed to send message';
            if (result.details) {
                errorMsg += '\n\nDetails: ' + result.details;
            }
            if (result.from && result.to) {
                errorMsg += `\n\nFrom: ${result.from}\nTo: ${result.to}`;
            }
            
            // Show error in a more visible way
            showErrorMessage(errorMsg, result.error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showErrorMessage('Network error: ' + error.message + '\n\nPlease check your connection and try again.', 'Network Error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Auto-scroll chat to bottom
function scrollChatToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Refresh logs periodically
async function refreshLogs() {
    try {
        const response = await fetch('/api/logs');
        const logs = await response.json();
        
        const logsContent = document.getElementById('logsContent');
        if (logsContent && logs.length > 0) {
            logsContent.innerHTML = logs.map(log => `
                <div class="log-item ${log.status === 'error' ? 'log-error' : 'log-success'}">
                    <div class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div class="log-action">${log.action}</div>
                    <div class="log-details">${log.details}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error refreshing logs:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Scroll chat to bottom
    scrollChatToBottom();
    
    // Refresh logs every 10 seconds
    setInterval(refreshLogs, 10000);
    
    // Auto-refresh page every 30 seconds (fallback)
    // This is also handled by meta refresh tag
    
    // Ensure Bootstrap modal is available
    if (typeof bootstrap === 'undefined') {
        console.warn('Bootstrap not loaded. Some features may not work.');
    }
});

// Handle Enter key in message input (allow Shift+Enter for new line)
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('message_content');
    if (messageInput) {
        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const form = document.getElementById('sendForm');
                if (form && messageInput.value.trim()) {
                    form.requestSubmit();
                }
            }
        });
    }
});

// Show error message in a styled alert
function showErrorMessage(message, title = 'Error') {
    // Create error alert element
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-danger alert-dismissible fade show error-toast';
    errorAlert.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        white-space: pre-line;
    `;
    errorAlert.innerHTML = `
        <strong><i class="bi bi-exclamation-triangle-fill"></i> ${title}</strong>
        <br><br>${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(errorAlert);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorAlert.parentNode) {
            errorAlert.remove();
        }
    }, 10000);
}

// Handle logout
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const result = await response.json();
            if (result.success) {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if request fails
            window.location.href = '/login';
        }
    }
}

// Contact Management Functions
function openAddContactModal() {
    console.log('openAddContactModal called');
    try {
        const modalElement = document.getElementById('contactModal');
        if (!modalElement) {
            console.error('Modal element not found');
            alert('Error: Contact modal not found. Please refresh the page.');
            return;
        }
        
        console.log('Modal element found, initializing...');
        
        const modalLabel = document.getElementById('contactModalLabel');
        if (modalLabel) {
            modalLabel.innerHTML = '<i class="bi bi-person-plus-fill"></i> Add New Contact';
        }
        
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {
            modalTitle.textContent = 'Add New Contact';
        }
        
        const form = document.getElementById('contactForm');
        if (form) {
            form.reset();
        }
        
        const contactId = document.getElementById('contactId');
        if (contactId) {
            contactId.value = '';
        }
        
        const contactPhone = document.getElementById('contactPhone');
        if (contactPhone) {
            contactPhone.readOnly = false;
            contactPhone.value = '';
            contactPhone.removeAttribute('readonly');
        }
        
        const deleteBtn = document.getElementById('deleteContactBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // Initialize and show modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            console.log('Using Bootstrap modal');
            let modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalElement);
            }
            modalInstance.show();
        } else {
            console.log('Bootstrap not available, using fallback');
            // Fallback if Bootstrap not loaded
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
            modalElement.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'modalBackdrop';
            document.body.appendChild(backdrop);
        }
        
        console.log('Modal should be visible now');
    } catch (error) {
        console.error('Error opening add contact modal:', error);
        alert('Error opening contact form: ' + error.message);
    }
}

// Make function globally accessible
window.openAddContactModal = openAddContactModal;

function openEditContactModal(phone, name) {
    try {
        const modalElement = document.getElementById('contactModal');
        if (!modalElement) {
            console.error('Modal element not found');
            alert('Error: Contact modal not found. Please refresh the page.');
            return;
        }
        
        const modalLabel = document.getElementById('contactModalLabel');
        if (modalLabel) {
            modalLabel.innerHTML = '<i class="bi bi-pencil-square"></i> Edit Contact';
        }
        
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {
            modalTitle.textContent = 'Edit Contact';
        }
        
        const contactPhone = document.getElementById('contactPhone');
        if (contactPhone) {
            contactPhone.value = phone;
            contactPhone.readOnly = true;
            contactPhone.setAttribute('readonly', 'readonly');
        }
        
        const contactName = document.getElementById('contactName');
        if (contactName) {
            contactName.value = (name === phone || !name) ? '' : name;
        }
        
        const contactId = document.getElementById('contactId');
        if (contactId) {
            contactId.value = phone;
        }
        
        const deleteBtn = document.getElementById('deleteContactBtn');
        if (deleteBtn) {
            deleteBtn.style.display = 'inline-block';
        }
        
        // Initialize and show modal
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            let modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (!modalInstance) {
                modalInstance = new bootstrap.Modal(modalElement);
            }
            modalInstance.show();
        } else {
            modalElement.style.display = 'block';
            modalElement.classList.add('show');
            modalElement.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        }
    } catch (error) {
        console.error('Error opening edit contact modal:', error);
        alert('Error opening edit form: ' + error.message);
    }
}

// Make function globally accessible
window.openEditContactModal = openEditContactModal;

async function saveContact(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const phone = formData.get('phone');
    const name = formData.get('name');
    const contactId = formData.get('id');
    
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone, name })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('contactModal'));
            modal.hide();
            
            // Reload page to show updated contacts
            setTimeout(() => {
                window.location.reload();
            }, 300);
        } else {
            alert('Error: ' + (result.error || 'Failed to save contact'));
        }
    } catch (error) {
        console.error('Error saving contact:', error);
        alert('Error saving contact. Please try again.');
    }
}

async function deleteContact() {
    const phoneInput = document.getElementById('contactPhone');
    if (!phoneInput) {
        alert('Error: Could not find contact phone number.');
        return;
    }
    
    const phone = phoneInput.value;
    
    if (!phone) {
        alert('Error: No phone number found.');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete contact ${phone}? This will also delete all messages with this contact.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/contact/${encodeURIComponent(phone)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Close modal
            const modalElement = document.getElementById('contactModal');
            if (modalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) {
                    modal.hide();
                }
            }
            
            // Reload page
            setTimeout(() => {
                window.location.href = '/';
            }, 300);
        } else {
            alert('Error: ' + (result.error || 'Failed to delete contact'));
        }
    } catch (error) {
        console.error('Error deleting contact:', error);
        alert('Error deleting contact: ' + error.message);
    }
}

// Make all functions globally accessible
window.saveContact = saveContact;
window.deleteContact = deleteContact;

