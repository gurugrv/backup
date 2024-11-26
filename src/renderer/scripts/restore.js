let snapshots = [];

async function loadSnapshots() {
    const snapshotsList = document.getElementById('snapshots-list');
    snapshotsList.innerHTML = '<p>Loading snapshots...</p>';

    try {
        snapshots = await window.electron.ipcRenderer.invoke('list-snapshots');
        renderSnapshotTree(snapshots);
    } catch (error) {
        snapshotsList.innerHTML = `<p class="error">Failed to load snapshots: ${error.message}</p>`;
    }
}

function renderSnapshotTree(snapshots) {
    const container = document.getElementById('snapshots-list');
    container.innerHTML = '';

    // Group snapshots by source
    const groupedSnapshots = groupSnapshotsBySource(snapshots);
    
    Object.entries(groupedSnapshots).forEach(([source, sourceSnapshots]) => {
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'snapshot-source';

        const sourceHeader = document.createElement('h3');
        sourceHeader.textContent = source;
        sourceDiv.appendChild(sourceHeader);

        const snapshotList = document.createElement('div');
        snapshotList.className = 'snapshot-list';

        sourceSnapshots.forEach(snapshot => {
            const snapshotItem = createSnapshotItem(snapshot);
            snapshotList.appendChild(snapshotItem);
        });

        sourceDiv.appendChild(snapshotList);
        container.appendChild(sourceDiv);
    });
}

function createSnapshotItem(snapshot) {
    const item = document.createElement('div');
    item.className = 'snapshot-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.snapshotId = snapshot.id;

    const details = document.createElement('div');
    details.className = 'snapshot-details';
    details.innerHTML = `
        <span class="snapshot-time">${new Date(snapshot.startTime).toLocaleString()}</span>
        <span class="snapshot-size">${formatSize(snapshot.stats.totalSize)}</span>
    `;

    item.appendChild(checkbox);
    item.appendChild(details);
    return item;
}

document.getElementById('restore-selected').addEventListener('click', async () => {
    const selectedSnapshots = Array.from(document.querySelectorAll('.snapshot-item input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.dataset.snapshotId);

    if (selectedSnapshots.length === 0) {
        alert('Please select snapshots to restore');
        return;
    }

    const targetPath = await window.electron.ipcRenderer.invoke('select-restore-directory');
    if (!targetPath) return;

    const progressArea = document.getElementById('restore-progress');
    progressArea.classList.add('active');

    for (const snapshotId of selectedSnapshots) {
        try {
            progressArea.innerHTML = `<p>Restoring snapshot ${snapshotId}...</p>`;
            const result = await window.electron.ipcRenderer.invoke('restore-snapshot', snapshotId, targetPath);
            
            if (result.success) {
                progressArea.innerHTML += `<p class="success">Successfully restored snapshot ${snapshotId}</p>`;
            } else {
                progressArea.innerHTML += `<p class="error">Failed to restore snapshot ${snapshotId}: ${result.error}</p>`;
            }
        } catch (error) {
            progressArea.innerHTML += `<p class="error">Failed to restore snapshot ${snapshotId}: ${error.message}</p>`;
        }
    }
});

function groupSnapshotsBySource(snapshots) {
    return snapshots.reduce((groups, snapshot) => {
        if (!groups[snapshot.source]) {
            groups[snapshot.source] = [];
        }
        groups[snapshot.source].push(snapshot);
        return groups;
    }, {});
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

// Load snapshots when the restore tab is shown
document.querySelector('.tab-btn[onclick="showTab(\'restore\')"]').addEventListener('click', loadSnapshots);