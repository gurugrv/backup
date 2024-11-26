const store = require('electron-store');
const settings = new store();

// Initialize settings with default values
const defaultSettings = {
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
    }
};

// Load settings when the page loads
document.addEventListener('DOMContentLoaded', loadSettings);

function loadSettings() {
    const savedSettings = settings.get('backup-settings', defaultSettings);
    
    // Schedule settings
    document.getElementById('schedule-frequency').value = savedSettings.schedule.frequency;
    document.getElementById('schedule-time').value = savedSettings.schedule.time;
    
    // Show/hide custom schedule options
    toggleCustomSchedule(savedSettings.schedule.frequency === 'custom');
    
    // Set weekday checkboxes
    savedSettings.schedule.weekdays.forEach(day => {
        document.querySelector(`.weekday-selector input[value="${day}"]`).checked = true;
    });

    // Retention settings
    document.getElementById('keep-latest').value = savedSettings.retention.keepLatest;
    document.getElementById('keep-daily').value = savedSettings.retention.keepDaily;
    document.getElementById('keep-weekly').value = savedSettings.retention.keepWeekly;
    document.getElementById('keep-monthly').value = savedSettings.retention.keepMonthly;
}

// Handle schedule frequency changes
document.getElementById('schedule-frequency').addEventListener('change', (e) => {
    toggleCustomSchedule(e.target.value === 'custom');
});

function toggleCustomSchedule(show) {
    const customScheduleDiv = document.getElementById('custom-schedule');
    customScheduleDiv.classList.toggle('hidden', !show);
}

// Save settings
document.getElementById('save-settings').addEventListener('click', async () => {
    const newSettings = {
        schedule: {
            frequency: document.getElementById('schedule-frequency').value,
            time: document.getElementById('schedule-time').value,
            weekdays: Array.from(document.querySelectorAll('.weekday-selector input:checked'))
                .map(cb => parseInt(cb.value)),
            lastRun: settings.get('backup-settings.schedule.lastRun', null)
        },
        retention: {
            keepLatest: parseInt(document.getElementById('keep-latest').value),
            keepDaily: parseInt(document.getElementById('keep-daily').value),
            keepWeekly: parseInt(document.getElementById('keep-weekly').value),
            keepMonthly: parseInt(document.getElementById('keep-monthly').value)
        }
    };

    try {
        // Update Kopia retention policy
        await window.electron.ipcRenderer.invoke('update-retention-policy', newSettings.retention);
        
        // Save settings to electron-store
        settings.set('backup-settings', newSettings);
        
        // Update scheduler if needed
        await window.electron.ipcRenderer.invoke('update-backup-schedule', newSettings.schedule);
        
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        showNotification('Failed to save settings: ' + error.message, 'error');
    }
});

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}