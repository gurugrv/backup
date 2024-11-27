export class UIComponents {
    static showStatus(elementId, message, type = 'info') {
        const statusElement = document.getElementById(elementId);
        if (!statusElement) {
            console.warn(`Status element with id '${elementId}' not found`);
            return;
        }

        statusElement.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                           type === 'error' ? 'fa-exclamation-circle' : 
                           type === 'warning' ? 'fa-exclamation-triangle' : 
                           'fa-info-circle'} mr-2"></i> ${message}`;
        statusElement.className = `rounded-lg border p-4 text-sm ${
            type === 'success' ? 'bg-green-50 border-green-200 text-green-600' :
            type === 'error' ? 'bg-red-50 border-red-200 text-red-600' :
            type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-600' :
            'bg-blue-50 border-blue-200 text-blue-600'
        }`;

        if (type !== 'error') {
            setTimeout(() => {
                if (statusElement) {
                    statusElement.innerHTML = '';
                    statusElement.className = '';
                }
            }, 5000);
        }
    }

    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static formatSpeed(bytesPerSecond) {
        if (bytesPerSecond === 0) return '0 B/s';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
        return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static formatDate(date) {
        if (!date) return 'Unknown';
        return new Date(date).toLocaleString();
    }

    static formatTimeLeft(seconds) {
        if (seconds < 60) {
            return `${seconds}s left`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m${remainingSeconds}s left`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h${minutes}m left`;
        }
    }

    static formatProgressText(progress) {
        console.log('UIComponents: Formatting progress text for:', progress);
        if (!progress) return '';

        // Handle initialization phase
        if (progress.phase === 'initializing') {
            return progress.message || 'Initializing backup...';
        }

        // Handle estimation phase
        if (progress.phase === 'estimating' || progress.estimating) {
            return 'Estimating backup size...';
        }

        const progressText = [];

        // Show uploaded/total size
        if (progress.uploaded !== undefined && progress.estimated !== undefined) {
            progressText.push(`${this.formatBytes(progress.uploaded)} / ${this.formatBytes(progress.estimated)}`);
        }

        // Add time remaining if available
        if (progress.timeLeft) {
            progressText.push(this.formatTimeLeft(progress.timeLeft));
        }

        const result = progressText.join(' • ');
        console.log('UIComponents: Formatted progress text:', result);
        return result;
    }

    static createPathItem(path, onRemove, isBackupInProgress = false, progress = null) {
        console.log('UIComponents: Creating path item for:', path);
        const item = document.createElement('div');
        item.className = 'flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300';
        item.id = `path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        // Create the main row with all information
        const row = document.createElement('div');
        row.className = 'flex items-center p-4 gap-4';
        
        // Left section: Path info with icon
        const pathSection = document.createElement('div');
        pathSection.className = 'flex items-center gap-2 min-w-[200px]';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-folder text-primary';
        
        const pathText = document.createElement('span');
        pathText.className = 'text-gray-700 select-all font-medium';
        pathText.textContent = path;
        
        pathSection.appendChild(icon);
        pathSection.appendChild(pathText);
        
        // Middle section: Progress info
        const progressSection = document.createElement('div');
        progressSection.className = 'flex items-center gap-2 flex-1';
        progressSection.id = `progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        
        if (isBackupInProgress && progress) {
            const progressText = document.createElement('span');
            progressText.className = 'text-sm text-gray-600';
            progressText.textContent = this.formatProgressText(progress);
            progressSection.appendChild(progressText);
        }
        
        // Right section: Action button
        const actionButton = document.createElement('button');
        if (isBackupInProgress) {
            actionButton.className = 'p-2 text-primary flex items-center gap-2';
            actionButton.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <span class="text-sm font-medium progress-percentage">0%</span>
            `;
            actionButton.disabled = true;
            actionButton.title = 'Backup in progress';
        } else {
            actionButton.className = 'p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100';
            actionButton.innerHTML = '<i class="fas fa-times"></i>';
            actionButton.title = 'Remove from selection';
            actionButton.onclick = () => onRemove(path);
        }
        
        row.appendChild(pathSection);
        row.appendChild(progressSection);
        row.appendChild(actionButton);
        item.appendChild(row);
        
        return item;
    }

    static updatePathItemProgress(path, progress) {
        console.log('UIComponents: Updating path item progress for:', path);
        const pathId = `path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const pathItem = document.getElementById(pathId);
        if (!pathItem) {
            console.warn('Path item not found for path:', path);
            return;
        }

        // Update progress percentage
        const progressPercentage = pathItem.querySelector('.progress-percentage');
        if (progressPercentage && progress) {
            progressPercentage.textContent = `${Math.min(progress.percentage || 0, 100).toFixed(1)}%`;
        }

        // Update progress info section
        const progressSection = document.getElementById(`progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (!progressSection) {
            console.warn('Progress section not found for path:', path);
            return;
        }

        if (progress) {
            const progressText = document.createElement('span');
            progressText.className = 'text-sm text-gray-600';
            progressText.textContent = this.formatProgressText(progress);
            
            progressSection.innerHTML = '';
            progressSection.appendChild(progressText);
        } else {
            progressSection.innerHTML = '';
        }
    }

    static setLoading(button, isLoading) {
        if (!button) {
            console.warn('Cannot set loading state on null element');
            return;
        }

        const originalContent = button.dataset.originalContent || button.innerHTML;
        
        if (isLoading) {
            if (!button.dataset.originalContent) {
                button.dataset.originalContent = originalContent;
            }
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
            button.disabled = true;
            button.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            button.innerHTML = originalContent;
            button.disabled = false;
            button.classList.remove('opacity-50', 'cursor-not-allowed');
            delete button.dataset.originalContent;
        }
    }

    static clearElement(element) {
        if (!element) {
            console.warn('Cannot clear null element');
            return;
        }
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    static createTableRow(cellContents) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors duration-200';
        
        cellContents.forEach((content, index) => {
            const cell = document.createElement('td');
            cell.className = 'px-6 py-4 whitespace-nowrap text-sm';
            
            switch (index) {
                case 0: // Directory column
                    cell.className += ' text-gray-900 font-medium w-[45%]';
                    break;
                case 1: // Files column
                    cell.className += ' text-gray-600 w-[15%]';
                    break;
                case 2: // Size column
                    cell.className += ' text-gray-600 w-[15%]';
                    break;
                case 3: // Last Backup column
                    cell.className += ' text-gray-600 w-[15%]';
                    break;
                case 4: // Actions column
                    cell.className += ' text-right w-[10%]';
                    break;
            }
            
            if (typeof content === 'string') {
                cell.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                cell.appendChild(content);
            }
            row.appendChild(cell);
        });
        return row;
    }
}
