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

        // Handle encryption/estimation phase - strict check for both phase and estimating flag
        if ((progress.phase === 'estimating' || progress.phase === 'hashing') && progress.estimating) {
            return 'Encrypting backup data...';
        }

        // Handle upload phase - strict check for upload phase and not estimating
        if (progress.phase === 'uploading' && !progress.estimating) {
            const progressText = ['Uploading data to cloud'];

            // Show uploaded size, and total size only if we have a proper estimate
            if (progress.uploaded !== undefined) {
                if (progress.estimated !== null && progress.estimated !== undefined) {
                    progressText.push(`${this.formatBytes(progress.uploaded)} / ${this.formatBytes(progress.estimated)}`);
                } else {
                    progressText.push(`${this.formatBytes(progress.uploaded)} uploaded`);
                }
            }

            // Add time remaining if available
            if (progress.timeLeft) {
                progressText.push(this.formatTimeLeft(progress.timeLeft));
            }

            return progressText.join(' • ');
        }

        // Default case - show basic progress info
        const progressText = [];
        if (progress.uploaded !== undefined) {
            if (progress.estimated !== null && progress.estimated !== undefined) {
                progressText.push(`${this.formatBytes(progress.uploaded)} / ${this.formatBytes(progress.estimated)}`);
            } else {
                progressText.push(`${this.formatBytes(progress.uploaded)} uploaded`);
            }
        }

        if (progress.timeLeft) {
            progressText.push(this.formatTimeLeft(progress.timeLeft));
        }

        return progressText.join(' • ');
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

    static async showConfirmDialog({ title, message, confirmText, cancelText = 'Cancel', confirmClass = 'bg-red-100 text-red-700 hover:bg-red-200' }) {
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        confirmDialog.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">${title}</h3>
                <p class="text-gray-600 mb-6">${message}</p>
                <div class="flex justify-end gap-3">
                    <button class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium" id="confirm-no">${cancelText}</button>
                    <button class="px-4 py-2 ${confirmClass} rounded-lg font-medium" id="confirm-yes">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmDialog);

        return new Promise((resolve) => {
            const handleNo = () => {
                document.body.removeChild(confirmDialog);
                resolve(false);
            };

            const handleYes = () => {
                document.body.removeChild(confirmDialog);
                resolve(true);
            };

            document.getElementById('confirm-no').addEventListener('click', handleNo);
            document.getElementById('confirm-yes').addEventListener('click', handleYes);

            // Close on background click
            confirmDialog.addEventListener('click', (e) => {
                if (e.target === confirmDialog) {
                    handleNo();
                }
            });
        });
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

    static createPathItem(path, onRemove, isBackupInProgress, currentProgress) {
        const pathItem = document.createElement('div');
        pathItem.id = `path-item-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        pathItem.className = 'flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200';
        
        const pathInfo = document.createElement('div');
        pathInfo.className = 'flex-1';
        pathInfo.innerHTML = `
            <div class="font-medium text-gray-900">${path}</div>
            <div id="progress-info-${path.replace(/[^a-zA-Z0-9]/g, '-')}" class="text-sm text-gray-600"></div>
        `;

        const actions = document.createElement('div');
        actions.className = 'actions flex items-center gap-2';

        if (!isBackupInProgress) {
            const removeButton = document.createElement('button');
            removeButton.className = 'px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200';
            removeButton.innerHTML = '<i class="fas fa-times mr-1.5"></i>Remove';
            removeButton.onclick = () => onRemove(path);
            actions.appendChild(removeButton);
        }

        pathItem.appendChild(pathInfo);
        pathItem.appendChild(actions);

        // Update progress if available
        if (currentProgress) {
            this.updatePathItemProgress(path, currentProgress);
        }

        return pathItem;
    }
}
