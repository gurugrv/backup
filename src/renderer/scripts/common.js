// Global utility functions
function showStatus(elementId, message, type = 'info') {
    const statusElement = document.getElementById(elementId);
    statusElement.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                       type === 'error' ? 'fa-exclamation-circle' : 
                       type === 'warning' ? 'fa-exclamation-triangle' : 
                       'fa-info-circle'}"></i> ${message}`;
    statusElement.className = `status ${type}`;
    
    // Auto-hide after 5 seconds unless it's an error
    if (type !== 'error') {
        setTimeout(() => {
            statusElement.innerHTML = '';
            statusElement.className = 'status';
        }, 5000);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

// Tab switching functionality
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Load tab-specific content
    if (tabName === 'settings') {
        if (window.settingsManager) {
            window.settingsManager.initialize();
        }
    }
}

// Advanced settings toggle
function toggleAdvancedSettings() {
    const content = document.getElementById('advanced-settings');
    const toggle = document.querySelector('.advanced-toggle i');
    if (content.classList.contains('visible')) {
        content.classList.remove('visible');
        toggle.classList.remove('fa-chevron-down');
        toggle.classList.add('fa-chevron-right');
    } else {
        content.classList.add('visible');
        toggle.classList.remove('fa-chevron-right');
        toggle.classList.add('fa-chevron-down');
    }
}

// Reset settings
function resetSettings() {
    // Reset settings functionality will be implemented here
    showStatus('settings-status', 'Settings reset to defaults', 'success');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    
    // Set up tab button click handlers
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            showTab(tabName);
        });
    });

    // Set up advanced settings toggle
    const advancedToggle = document.querySelector('.advanced-toggle');
    if (advancedToggle) {
        advancedToggle.addEventListener('click', toggleAdvancedSettings);
    }

    // Set up reset settings button
    const resetBtn = document.querySelector('.secondary-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSettings);
    }
    
    // Load component scripts
    const scripts = [
        'scripts/backup.js',
        'scripts/settings.js'
    ];

    scripts.forEach(script => {
        const scriptElement = document.createElement('script');
        scriptElement.src = script;
        scriptElement.onerror = (error) => {
            console.error(`Failed to load script: ${script}`, error);
            showStatus('backup-status', 
                `Failed to load required components: ${script}`, 'error');
        };
        document.body.appendChild(scriptElement);
    });

    // Set up error handling
    window.onerror = function(msg, url, lineNo, columnNo, error) {
        console.error('Window Error:', msg, url, lineNo, columnNo, error);
        showStatus('backup-status', 
            'An unexpected error occurred. Check the console for details.', 'error');
        return false;
    };

    // Handle unhandled promise rejections
    window.onunhandledrejection = function(event) {
        console.error('Unhandled Promise Rejection:', event.reason);
        showStatus('backup-status', 
            'An unexpected error occurred. Check the console for details.', 'error');
    };

    // Development mode check
    if (window.electron?.env?.isDevelopment) {
        console.log('Development mode enabled');
    }

    console.log('Application initialized');
});
