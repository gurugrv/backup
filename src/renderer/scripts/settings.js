// src/renderer/scripts/settings.js

class SettingsManager {
    constructor() {
        this.initialized = false;
        this.defaultSettings = {
            schedule: {
                frequency: 'daily',
                time: '00:00',
                weekdays: [],
                lastRun: null
            },
            retention: {
                keepLatest: 5,
                keepDaily: 7,
                keepWeekly: 4,
                keepMonthly: 6
            },
            application: {
                startWithSystem: false,
                minimizeToTray: true,
                showNotifications: true
            }
        };
        this.initializeElements();
    }

    initializeElements() {
        // Schedule elements
        this.scheduleFrequency = document.getElementById('schedule-frequency');
        this.scheduleTime = document.getElementById('schedule-time');
        this.customSchedule = document.getElementById('custom-schedule');
        this.weekdaySelectors = document.querySelectorAll('.weekday-selector input');
        
        // Retention elements
        this.keepLatest = document.getElementById('keep-latest');
        this.keepDaily = document.getElementById('keep-daily');
        this.keepWeekly = document.getElementById('keep-weekly');
        this.keepMonthly = document.getElementById('keep-monthly');
        
        // Application settings elements
        this.startWithSystem = document.getElementById('start-with-system');
        this.minimizeToTray = document.getElementById('minimize-to-tray');
        this.showNotifications = document.getElementById('show-notifications');
        
        // Status and buttons
        this.statusElement = document.getElementById('settings-status');
        this.saveButton = document.getElementById('save-settings');
    }

    async initialize() {
        if (this.initialized) return;

        try {
            // Load current settings
            const result = await window.electron.kopia.getSettings();
            if (result.success) {
                this.applySettings(result.settings);
            } else {
                console.warn('Using default settings:', result.error);
                this.applySettings(this.defaultSettings);
            }
            
            this.setupEventListeners();
            this.initialized = true;
            console.log('Settings initialized successfully');
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            this.showStatus('Failed to load settings', 'error');
        }
    }

    setupEventListeners() {
        // Schedule frequency change handler
        this.scheduleFrequency.addEventListener('change', (e) => {
            this.toggleCustomSchedule(e.target.value === 'custom');
        });

        // Save settings handler
        this.saveButton.addEventListener('click', async () => {
            await this.saveSettings();
        });

        // Input validation handlers
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const value = parseInt(e.target.value);
                const min = parseInt(e.target.getAttribute('min'));
                if (value < min) {
                    e.target.value = min;
                }
            });
        });

        // Weekday selector handlers
        this.weekdaySelectors.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (this.scheduleFrequency.value === 'custom') {
                    const anyChecked = Array.from(this.weekdaySelectors)
                        .some(cb => cb.checked);
                    if (!anyChecked) {
                        checkbox.checked = true;
                        this.showStatus('At least one day must be selected', 'warning');
                    }
                }
            });
        });

        // Time input validation
        this.scheduleTime.addEventListener('change', (e) => {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(e.target.value)) {
                e.target.value = '00:00';
                this.showStatus('Invalid time format. Using default.', 'warning');
            }
        });
    }

    showStatus(message, type = 'info') {
        if (window.showStatus) {
            window.showStatus('settings-status', message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }
	
	    applySettings(settings) {
        try {
            // Schedule settings
            this.scheduleFrequency.value = settings.schedule.frequency;
            this.scheduleTime.value = settings.schedule.time || '00:00';
            
            // Show/hide custom schedule options
            this.toggleCustomSchedule(settings.schedule.frequency === 'custom');
            
            // Set weekday checkboxes
            this.weekdaySelectors.forEach(checkbox => {
                checkbox.checked = settings.schedule.weekdays?.includes(parseInt(checkbox.value)) || false;
            });

            // Retention settings
            this.keepLatest.value = settings.retention.keepLatest;
            this.keepDaily.value = settings.retention.keepDaily;
            this.keepWeekly.value = settings.retention.keepWeekly;
            this.keepMonthly.value = settings.retention.keepMonthly;

            // Application settings
            this.startWithSystem.checked = settings.application.startWithSystem;
            this.minimizeToTray.checked = settings.application.minimizeToTray;
            this.showNotifications.checked = settings.application.showNotifications;

            console.log('Settings applied successfully');
        } catch (error) {
            console.error('Error applying settings:', error);
            this.showStatus('Error applying settings', 'error');
        }
    }

    async saveSettings() {
        try {
            const settings = this.getCurrentSettings();
            
            // Validate settings before saving
            if (!this.validateSettings(settings)) {
                return;
            }

            this.saveButton.disabled = true;
            this.showStatus('Saving settings...', 'info');

            const result = await window.electron.kopia.updateSettings(settings);
            
            if (result.success) {
                this.showStatus('Settings saved successfully!', 'success');
                
                // Update scheduler if schedule changed
                if (settings.schedule) {
                    const scheduleResult = await window.electron.kopia.updateSchedule(settings.schedule);
                    if (!scheduleResult.success) {
                        this.showStatus('Schedule update failed: ' + scheduleResult.error, 'warning');
                    }
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showStatus(`Failed to save settings: ${error.message}`, 'error');
        } finally {
            this.saveButton.disabled = false;
        }
    }

    getCurrentSettings() {
        return {
            schedule: {
                frequency: this.scheduleFrequency.value,
                time: this.scheduleTime.value,
                weekdays: Array.from(this.weekdaySelectors)
                    .filter(cb => cb.checked)
                    .map(cb => parseInt(cb.value))
            },
            retention: {
                keepLatest: parseInt(this.keepLatest.value),
                keepDaily: parseInt(this.keepDaily.value),
                keepWeekly: parseInt(this.keepWeekly.value),
                keepMonthly: parseInt(this.keepMonthly.value)
            },
            application: {
                startWithSystem: this.startWithSystem.checked,
                minimizeToTray: this.minimizeToTray.checked,
                showNotifications: this.showNotifications.checked
            }
        };
    }

    validateSettings(settings) {
        // Validate schedule frequency
        if (!['daily', 'weekly', 'monthly', 'custom'].includes(settings.schedule.frequency)) {
            this.showStatus('Invalid schedule frequency', 'error');
            return false;
        }

        // Validate custom schedule weekdays
        if (settings.schedule.frequency === 'custom' && 
            (!settings.schedule.weekdays || settings.schedule.weekdays.length === 0)) {
            this.showStatus('Please select at least one day for custom schedule', 'error');
            return false;
        }

        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(settings.schedule.time)) {
            this.showStatus('Invalid time format', 'error');
            return false;
        }

        // Validate retention values
        const retentionValues = Object.values(settings.retention);
        if (retentionValues.some(value => !Number.isInteger(value) || value < 1)) {
            this.showStatus('Retention values must be positive integers', 'error');
            return false;
        }

        // Additional validation for retention policy logic
        if (settings.retention.keepLatest < 1) {
            this.showStatus('Must keep at least 1 latest backup', 'error');
            return false;
        }

        return true;
    }

    toggleCustomSchedule(show) {
        if (this.customSchedule) {
            this.customSchedule.style.display = show ? 'block' : 'none';
            
            if (show) {
                // Ensure at least one day is selected
                const anyChecked = Array.from(this.weekdaySelectors)
                    .some(checkbox => checkbox.checked);
                
                if (!anyChecked) {
                    // Default to Monday if nothing selected
                    const mondayCheckbox = document.querySelector('.weekday-selector input[value="1"]');
                    if (mondayCheckbox) {
                        mondayCheckbox.checked = true;
                    }
                }
            }
        }
    }

    // Helper methods
    formatScheduleDescription(schedule) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const time = schedule.time || '00:00';
        
        switch (schedule.frequency) {
            case 'daily':
                return `Daily at ${time}`;
            case 'weekly':
                return `Weekly on Monday at ${time}`;
            case 'monthly':
                return `Monthly on the 1st at ${time}`;
            case 'custom':
                const selectedDays = schedule.weekdays
                    .map(day => days[day])
                    .join(', ');
                return `Custom: ${selectedDays} at ${time}`;
            default:
                return 'Invalid schedule';
        }
    }
}

// Initialize settings manager
const initializeSettingsManager = () => {
    // Create global instance
    window.settingsManager = new SettingsManager();

    // Initialize when settings tab is shown
    document.querySelector('.tab-btn[onclick="showTab(\'settings\')"]')
        ?.addEventListener('click', async () => {
            if (window.settingsManager) {
                await window.settingsManager.initialize();
            }
        });

    // Add development mode features
    if (window.electron?.env?.isDevelopment) {
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset to Defaults';
        resetButton.className = 'secondary-btn';
        resetButton.style.marginLeft = '10px';
        
        resetButton.onclick = async () => {
            try {
                const result = await window.electron.kopia.resetSettings();
                if (result.success) {
                    window.settingsManager.applySettings(window.settingsManager.defaultSettings);
                    window.settingsManager.showStatus('Settings reset to defaults', 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                window.settingsManager.showStatus(
                    `Failed to reset settings: ${error.message}`, 
                    'error'
                );
            }
        };

        document.getElementById('save-settings')?.parentNode?.appendChild(resetButton);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSettingsManager);
} else {
    initializeSettingsManager();
}

// Add error handling for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Settings error:', event.error);
    if (window.settingsManager) {
        window.settingsManager.showStatus('An unexpected error occurred', 'error');
    }
});

