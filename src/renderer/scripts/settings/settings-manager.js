export class SettingsManager {
    constructor() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing SettingsManager');
        this.initializeElements();
        this.setupEventListeners();
        this.loadSettings().catch(error => {
            console.error('Failed to load initial settings:', error);
            this.showNotification('Failed to load settings', 'error');
        });
    }

    initializeElements() {
        console.log('Initializing settings elements');
        this.elements = {
            settingsTab: document.getElementById('settings'),
            scheduleSection: document.getElementById('schedule-section'),
            retentionSection: document.getElementById('retention-section'),
            scheduleForm: null,
            retentionForm: null
        };

        // Ensure settings tab exists
        if (!this.elements.settingsTab) {
            console.error('Settings tab element not found');
            return;
        }

        // Create settings container for side-by-side layout
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
        this.elements.settingsTab.appendChild(settingsContainer);

        // Create sections if they don't exist
        if (!this.elements.scheduleSection) {
            this.createScheduleSection(settingsContainer);
        }
        if (!this.elements.retentionSection) {
            this.createRetentionSection(settingsContainer);
        }
    }

    createScheduleSection(container) {
        const section = document.createElement('div');
        section.id = 'schedule-section';
        section.className = 'p-6 bg-white rounded-lg shadow';

        section.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Backup Schedule</h3>
            <p class="text-gray-600 mb-4">Configure automated backup schedules.</p>
            <form id="schedule-form" class="space-y-6">
                <!-- Daily Backup -->
                <div class="border-b pb-4">
                    <h4 class="font-medium text-gray-700 mb-2">Daily Backup</h4>
                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Time</label>
                        <input type="time" name="daily-time" value="02:00" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Daily incremental backup</p>
                    </div>
                </div>

                <!-- Frequent Snapshots -->
                <div class="border-b pb-4">
                    <h4 class="font-medium text-gray-700 mb-2">Frequent Snapshots</h4>
                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Active Hours</label>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="text-xs text-gray-500">Start Time</label>
                                <input type="time" name="frequent-start" value="08:00" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            <div>
                                <label class="text-xs text-gray-500">End Time</label>
                                <input type="time" name="frequent-end" value="20:00" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        <label class="text-sm font-medium text-gray-700 mt-2">Interval</label>
                        <select name="frequent-interval" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                            <option value="4">Every 4 hours</option>
                            <option value="2">Every 2 hours</option>
                            <option value="1">Every hour</option>
                        </select>
                        <p class="text-sm text-gray-500">Frequent incremental snapshots during active hours</p>
                    </div>
                </div>

                <!-- Weekly Full Backup -->
                <div class="pb-4">
                    <h4 class="font-medium text-gray-700 mb-2">Weekly Full Backup</h4>
                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Day and Time</label>
                        <div class="grid grid-cols-2 gap-4">
                            <select name="weekly-day" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md">
                                <option value="0" selected>Sunday</option>
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                            </select>
                            <input type="time" name="weekly-time" value="02:00" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <p class="text-sm text-gray-500">Weekly full backup</p>
                    </div>
                </div>

                <button type="submit" class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                    Save Schedule
                </button>
            </form>
        `;

        container.appendChild(section);
        this.elements.scheduleSection = section;
        this.elements.scheduleForm = section.querySelector('#schedule-form');
    }

    createRetentionSection(container) {
        const section = document.createElement('div');
        section.id = 'retention-section';
        section.className = 'p-6 bg-white rounded-lg shadow';

        section.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">Backup Retention</h3>
            <p class="text-gray-600 mb-4">Configure how long to keep your backup snapshots.</p>
            <form id="retention-form" class="space-y-4">
                <div class="grid grid-cols-1 gap-4">
                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Hourly Snapshots</label>
                        <input type="number" name="keepHourly" value="168" min="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Keep the last 7 days (168 hours)</p>
                    </div>

                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Daily Snapshots</label>
                        <input type="number" name="keepDaily" value="30" min="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Retain the last 30 days</p>
                    </div>

                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Weekly Backups</label>
                        <input type="number" name="keepWeekly" value="12" min="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Retain for 12 weeks</p>
                    </div>

                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Monthly Backups</label>
                        <input type="number" name="keepMonthly" value="12" min="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Retain for 12 months</p>
                    </div>

                    <div class="flex flex-col space-y-2">
                        <label class="text-sm font-medium text-gray-700">Yearly Backups</label>
                        <input type="number" name="keepAnnual" value="1" min="0" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <p class="text-sm text-gray-500">Retain 1 yearly snapshot indefinitely</p>
                    </div>
                </div>

                <button type="submit" class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                    Save Retention Policy
                </button>
            </form>
        `;

        container.appendChild(section);
        this.elements.retentionSection = section;
        this.elements.retentionForm = section.querySelector('#retention-form');
    }

    setupEventListeners() {
        if (this.elements.scheduleForm) {
            this.elements.scheduleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveSchedule(e.target);
            });
        }

        if (this.elements.retentionForm) {
            this.elements.retentionForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveRetention(e.target);
            });
        }
    }

    async loadSettings() {
        try {
            console.log('Loading settings...');
            const settings = await window.electron.getSettings();
            if (!settings) {
                console.warn('No settings returned from backend');
                return;
            }
            console.log('Settings loaded:', settings);
            this.updateUI(settings);
        } catch (error) {
            console.error('Error loading settings:', error);
            throw error;
        }
    }

    updateUI(settings) {
        console.log('Updating UI with settings:', settings);
        
        // Update schedule form
        if (this.elements.scheduleForm && settings.schedule) {
            const form = this.elements.scheduleForm;
            
            // Daily backup
            if (settings.schedule.daily) {
                form.querySelector('[name="daily-time"]').value = settings.schedule.daily.time || '02:00';
            }

            // Frequent snapshots
            if (settings.schedule.frequent) {
                const cronParts = (settings.schedule.frequent.cronExpression || '0 */4 8-20 * * *').split(' ');
                const interval = cronParts[1].split('/')[1] || '4';
                const startHour = cronParts[2].split('-')[0] || '8';
                const endHour = cronParts[2].split('-')[1] || '20';

                form.querySelector('[name="frequent-interval"]').value = interval;
                form.querySelector('[name="frequent-start"]').value = `${startHour.padStart(2, '0')}:00`;
                form.querySelector('[name="frequent-end"]').value = `${endHour.padStart(2, '0')}:00`;
            }

            // Weekly backup
            if (settings.schedule.weekly) {
                form.querySelector('[name="weekly-day"]').value = settings.schedule.weekly.dayOfWeek || '0';
                form.querySelector('[name="weekly-time"]').value = settings.schedule.weekly.time || '02:00';
            }
        }

        // Update retention form
        if (this.elements.retentionForm && settings.retention) {
            const form = this.elements.retentionForm;
            const fields = ['keepHourly', 'keepDaily', 'keepWeekly', 'keepMonthly', 'keepAnnual'];
            
            fields.forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input && settings.retention[field] !== undefined) {
                    input.value = settings.retention[field];
                }
            });
        }
    }

    async saveSchedule(form) {
        try {
            const formData = new FormData(form);
            
            const schedule = {
                daily: {
                    frequency: 'daily',
                    time: formData.get('daily-time'),
                    type: 'incremental'
                },
                frequent: {
                    frequency: 'custom',
                    cronExpression: this.buildFrequentCron(
                        formData.get('frequent-interval'),
                        formData.get('frequent-start'),
                        formData.get('frequent-end')
                    ),
                    type: 'incremental'
                },
                weekly: {
                    frequency: 'weekly',
                    time: formData.get('weekly-time'),
                    dayOfWeek: parseInt(formData.get('weekly-day')),
                    type: 'full'
                }
            };

            await window.electron.saveSettings({ schedule });
            this.showNotification('Schedule saved successfully', 'success');
        } catch (error) {
            console.error('Error saving schedule:', error);
            this.showNotification('Failed to save schedule', 'error');
        }
    }

    buildFrequentCron(interval, startTime, endTime) {
        const startHour = startTime.split(':')[0];
        const endHour = endTime.split(':')[0];
        return `0 */${interval} ${startHour}-${endHour} * * *`;
    }

    async saveRetention(form) {
        try {
            const formData = new FormData(form);
            const retention = {
                keepLatest: 1,
                keepHourly: parseInt(formData.get('keepHourly')) || 168,
                keepDaily: parseInt(formData.get('keepDaily')) || 30,
                keepWeekly: parseInt(formData.get('keepWeekly')) || 12,
                keepMonthly: parseInt(formData.get('keepMonthly')) || 12,
                keepAnnual: parseInt(formData.get('keepAnnual')) || 1
            };

            await window.electron.saveSettings({ retention });
            this.showNotification('Retention policy saved successfully', 'success');
        } catch (error) {
            console.error('Error saving retention policy:', error);
            this.showNotification('Failed to save retention policy', 'error');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 
            type === 'error' ? 'bg-red-500' : 
            'bg-blue-500'
        } text-white`;
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}
