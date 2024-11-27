export class TabManager {
    constructor() {
        this.initializeTabs();
    }

    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        // Show first tab by default if none is active
        if (!document.querySelector('.tab-btn.active')) {
            this.switchTab('backup', tabButtons, tabContents);
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId, tabButtons, tabContents);
            });
        });
    }

    switchTab(tabId, tabButtons, tabContents) {
        console.log('Switching to tab:', tabId);

        // Remove active class from all buttons and hide all contents
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.classList.remove('bg-gray-100');
        });
        
        tabContents.forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });

        // Add active class to selected button and show selected content
        const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
        const selectedContent = document.getElementById(tabId);

        if (selectedButton && selectedContent) {
            selectedButton.classList.add('active');
            selectedButton.classList.add('bg-gray-100');
            selectedContent.classList.remove('hidden');
            selectedContent.classList.add('active');
            console.log('Tab switched successfully');
        } else {
            console.warn('Tab elements not found:', { tabId, selectedButton, selectedContent });
        }
    }
}
