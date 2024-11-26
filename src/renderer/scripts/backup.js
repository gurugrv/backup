const selectedPaths = new Set();

document.getElementById('select-files').addEventListener('click', async () => {
    const paths = await window.electron.ipcRenderer.invoke('select-backup-paths');
    paths.forEach(path => selectedPaths.add(path));
    updateSelectedPathsDisplay();
});

document.getElementById('start-backup').addEventListener('click', async () => {
    if (selectedPaths.size === 0) {
        alert('Please select files or folders to backup');
        return;
    }

    const progressArea = document.getElementById('backup-progress');
    progressArea.classList.add('active');
    progressArea.innerHTML = '<p>Backup in progress...</p>';

    try {
        const result = await window.electron.ipcRenderer.invoke('create-snapshot', Array.from(selectedPaths));
        if (result.success) {
            progressArea.innerHTML = '<p class="success">Backup completed successfully!</p>';
            selectedPaths.clear();
            updateSelectedPathsDisplay();
        } else {
            progressArea.innerHTML = `<p class="error">Backup failed: ${result.error}</p>`;
        }
    } catch (error) {
        progressArea.innerHTML = `<p class="error">Backup failed: ${error.message}</p>`;
    }
});

function updateSelectedPathsDisplay() {
    const container = document.getElementById('selected-paths');
    if (selectedPaths.size === 0) {
        container.innerHTML = '<p class="empty-message">No files or folders selected</p>';
        return;
    }

    const list = document.createElement('ul');
    selectedPaths.forEach(path => {
        const item = document.createElement('li');
        item.className = 'path-item';
        
        const pathText = document.createElement('span');
        pathText.textContent = path;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = () => {
            selectedPaths.delete(path);
            updateSelectedPathsDisplay();
        };

        item.appendChild(pathText);
        item.appendChild(removeBtn);
        list.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(list);
}
