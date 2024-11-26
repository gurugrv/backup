console.log('Renderer process started');

// Tab switching functionality
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-btn[onclick="showTab('${tabName}')"]`).classList.add('active');
}

// Event Listeners
document.getElementById('select-files').addEventListener('click', async () => {
    try {
        const paths = await window.electron.ipcRenderer.invoke('select-backup-paths');
        const container = document.getElementById('selected-paths');
        container.innerHTML = paths.map(path => `<div>${path}</div>`).join('');
    } catch (error) {
        console.error('Failed to select files:', error);
    }
});

document.getElementById('start-backup').addEventListener('click', async () => {
    try {
        const paths = Array.from(document.getElementById('selected-paths').children)
            .map(div => div.textContent);
            
        if (paths.length === 0) {
            alert('Please select files or folders to backup');
            return;
        }

        const progressArea = document.getElementById('backup-progress');
        progressArea.classList.add('active');
        progressArea.innerHTML = '<p>Backup in progress...</p>';

        const result = await window.electron.ipcRenderer.invoke('start-backup', paths);
        
        if (result.success) {
            progressArea.innerHTML = '<p>Backup completed successfully!</p>';
        } else {
            progressArea.innerHTML = `<p>Backup failed: ${result.error}</p>`;
        }
    } catch (error) {
        console.error('Backup failed:', error);
    }
});

document.getElementById('save-settings').addEventListener('click', async () => {
    try {
        const settings = {
            schedule: {
                frequency: document.getElementById('schedule-frequency').value,
                time: document.getElementById('schedule-time').value
            }
        };

        const result = await window.electron.ipcRenderer.invoke('update-settings', settings);
        
        if (result.success) {
            alert('Settings saved successfully!');
        } else {
            alert('Failed to save settings: ' + result.error);
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    showTab('backup');
});
