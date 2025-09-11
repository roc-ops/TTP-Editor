// Main Application Logic for TTP Template Processor

class TTPEditor {
    constructor() {
        this.processor = new TTPProcessor();
        this.dataEditor = null;
        this.templateEditor = null;
        this.resultEditor = null;
        this.isProcessing = false;
        this.currentExample = null;
        this.autoProcessTimeout = null;
        this.autoProcessDelay = 1000; // 1 second delay
        this.isAutoProcessEnabled = true;
        
        // Initialize the application
        this.init();
    }

    async init() {
        console.log('Initializing TTP Editor...');
        
        // Setup UI elements
        this.setupUI();
        
        // Setup code editors
        this.setupCodeEditors();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup pane resizing
        this.setupPaneResizing();
        
        // Initialize TTP processor
        await this.initializeTTPProcessor();
        
        // Setup result editor after everything else is ready
        this.setupResultEditor();
        
        console.log('TTP Editor initialized successfully');
    }

    setupUI() {
        // Get DOM elements
        this.elements = {
            processBtn: document.getElementById('processBtn'),
            clearBtn: document.getElementById('clearBtn'),
            exampleBtn: document.getElementById('exampleBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            dataInput: document.getElementById('dataInput'),
            templateInput: document.getElementById('templateInput'),
            resultOutput: document.getElementById('resultOutput'),
            outputFormat: document.getElementById('outputFormat'),
            pyodideStatus: document.getElementById('pyodideStatus'),
            processingTime: document.getElementById('processingTime'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            autoProcess: document.getElementById('autoProcess')
        };

        // Initially disable process button
        this.elements.processBtn.disabled = true;
        this.elements.downloadBtn.disabled = true;
    }

    setupCodeEditors() {
        // Setup data input editor
        this.dataEditor = CodeMirror.fromTextArea(this.elements.dataInput, {
            mode: 'text/plain',
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 2,
            tabSize: 2,
            placeholder: 'Paste your raw text data here...'
        });

        // Setup template input editor
        this.templateEditor = CodeMirror.fromTextArea(this.elements.templateInput, {
            mode: 'text/html', // Closest to TTP template syntax
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 2,
            tabSize: 2,
            placeholder: 'Enter your TTP template here...'
        });

        // Auto-resize editors
        this.dataEditor.setSize(null, '100%');
        this.templateEditor.setSize(null, '100%');

        // Add change listeners for validation and auto-processing
        this.dataEditor.on('change', () => {
            this.validateInputs();
            this.scheduleAutoProcess();
        });
        this.templateEditor.on('change', () => {
            this.validateInputs();
            this.scheduleAutoProcess();
        });
    }

    setupResultEditor() {
        // Clear the result output div first
        this.elements.resultOutput.innerHTML = '';
        
        // Setup result editor with CodeMirror for better display and folding
        this.resultEditor = CodeMirror(this.elements.resultOutput, {
            mode: 'application/json', // Use specific JSON mode
            theme: 'monokai',
            lineNumbers: true,
            readOnly: true,
            lineWrapping: true,
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            extraKeys: {
                "Ctrl-Q": function(cm) { cm.foldCode(cm.getCursor()); },
                "Cmd-Q": function(cm) { cm.foldCode(cm.getCursor()); },
                "F1": function(cm) { cm.foldAll(); },
                "F2": function(cm) { cm.unfoldAll(); }
            },
            value: 'Results will appear here after processing...'
        });

        // Use CodeMirror's built-in fold gutter click handling
        this.resultEditor.on("gutterClick", function(cm, n, gutter, e) {
            if (gutter === "CodeMirror-foldgutter") {
                // Let CodeMirror handle the folding naturally
                cm.foldCode(CodeMirror.Pos(n, 0), null, "toggle");
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });

        // Auto-resize result editor
        this.resultEditor.setSize(null, '100%');
        
        // Force refresh after a short delay to ensure proper rendering
        setTimeout(() => {
            if (this.resultEditor) {
                this.resultEditor.refresh();
                
                // Test folding functionality with sample JSON
                this.resultEditor.setValue(`{
  "test": {
    "nested": {
      "value": "hello"
    },
    "array": [
      {
        "item1": "value1"
      },
      {
        "item2": "value2"
      }
    ]
  }
}`);
                
                // Let CodeMirror handle fold detection naturally
                this.resultEditor.refresh();
            }
        }, 100);
    }

    setupEventListeners() {
        // Process button
        this.elements.processBtn.addEventListener('click', () => this.processTemplate());

        // Clear button
        this.elements.clearBtn.addEventListener('click', () => this.clearAll());

        // Example button
        this.elements.exampleBtn.addEventListener('click', () => this.showExampleMenu());

        // Download button
        this.elements.downloadBtn.addEventListener('click', () => this.downloadResults());

        // Output format change
        this.elements.outputFormat.addEventListener('change', () => {
            if (this.lastResults) {
                this.displayResults(this.lastResults);
            }
        });

        // Auto-process toggle
        this.elements.autoProcess.addEventListener('change', (e) => {
            this.isAutoProcessEnabled = e.target.checked;
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            } else {
                this.cancelAutoProcess();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'Enter':
                        e.preventDefault();
                        if (!this.isProcessing) {
                            this.processTemplate();
                        }
                        break;
                    case 'l':
                        e.preventDefault();
                        this.showExampleMenu();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.clearAll();
                        break;
                }
            }
        });
    }

    setupPaneResizing() {
        const resizeHandles = document.querySelectorAll('.resize-handle');
        let isResizing = false;
        let currentHandle = null;
        let startX = 0;
        let startWidths = [];

        resizeHandles.forEach((handle, index) => {
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                currentHandle = handle;
                startX = e.clientX;
                
                // Get current widths of all panes
                const panes = document.querySelectorAll('.pane');
                startWidths = Array.from(panes).map(pane => pane.offsetWidth);
                
                handle.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                
                e.preventDefault();
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const panes = document.querySelectorAll('.pane');
            const container = document.querySelector('.pane-container');
            const containerWidth = container.offsetWidth;
            
            // Calculate which panes to resize based on handle position
            const handleIndex = Array.from(resizeHandles).indexOf(currentHandle);
            const leftPane = panes[handleIndex];
            const rightPane = panes[handleIndex + 1];
            
            if (leftPane && rightPane) {
                const leftStartWidth = startWidths[handleIndex];
                const rightStartWidth = startWidths[handleIndex + 1];
                
                const newLeftWidth = leftStartWidth + deltaX;
                const newRightWidth = rightStartWidth - deltaX;
                
                // Enforce minimum widths
                const minWidth = 200;
                if (newLeftWidth >= minWidth && newRightWidth >= minWidth) {
                    const leftFlex = newLeftWidth / containerWidth;
                    const rightFlex = newRightWidth / containerWidth;
                    
                    leftPane.style.flex = `${leftFlex} 1 0px`;
                    rightPane.style.flex = `${rightFlex} 1 0px`;
                }
            }
            
            e.preventDefault();
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                currentHandle.classList.remove('dragging');
                currentHandle = null;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    scheduleAutoProcess() {
        if (!this.isAutoProcessEnabled || this.isProcessing) {
            return;
        }

        // Cancel any existing timeout
        this.cancelAutoProcess();

        // Check if we have both data and template
        const hasData = this.dataEditor && this.dataEditor.getValue().trim().length > 0;
        const hasTemplate = this.templateEditor && this.templateEditor.getValue().trim().length > 0;
        const isReady = this.processor.isReady();

        if (hasData && hasTemplate && isReady) {
            this.autoProcessTimeout = setTimeout(() => {
                this.processTemplate(true); // true indicates auto-processing
            }, this.autoProcessDelay);
        }
    }

    cancelAutoProcess() {
        if (this.autoProcessTimeout) {
            clearTimeout(this.autoProcessTimeout);
            this.autoProcessTimeout = null;
        }
    }

    async initializeTTPProcessor() {
        try {
            this.elements.pyodideStatus.textContent = 'Loading Python runtime...';
            
            await this.processor.initialize();
            
            this.elements.pyodideStatus.textContent = 'Python runtime ready';
            this.elements.processBtn.disabled = false;
            this.hideLoadingOverlay();
            
        } catch (error) {
            console.error('Failed to initialize TTP processor:', error);
            this.elements.pyodideStatus.textContent = 'Failed to load Python runtime';
            this.showError('Failed to initialize TTP processor. Please refresh the page.');
        }
    }

    validateInputs() {
        const hasData = this.dataEditor.getValue().trim().length > 0;
        const hasTemplate = this.templateEditor.getValue().trim().length > 0;
        const isReady = this.processor.isReady();

        this.elements.processBtn.disabled = !hasData || !hasTemplate || !isReady || this.isProcessing;
    }

    async processTemplate(isAutoProcess = false) {
        if (this.isProcessing) return;

        const dataText = this.dataEditor.getValue();
        const templateText = this.templateEditor.getValue();
        const outputFormat = this.elements.outputFormat.value;

        if (!dataText.trim() || !templateText.trim()) {
            this.showError('Please provide both data and template');
            return;
        }

        this.isProcessing = true;
        this.elements.processBtn.disabled = true;
        
        if (!isAutoProcess) {
            this.elements.processBtn.textContent = 'Processing...';
            if (this.resultEditor) {
                this.resultEditor.setValue('Processing template...');
            }
        } else {
            // For auto-processing, show a subtle indicator
            if (this.resultEditor) {
                this.resultEditor.setValue('Auto-processing template...');
            }
        }

        try {
            const startTime = performance.now();
            const result = await this.processor.processTemplate(dataText, templateText, outputFormat);
            const endTime = performance.now();

            this.isProcessing = false;
            this.validateInputs(); // Re-enable button based on current state
            this.elements.processBtn.textContent = 'Process Template';

            if (result.success) {
                this.displayResults(result);
                this.elements.downloadBtn.disabled = false;
                this.elements.processingTime.textContent = `Processed in ${result.processingTime || Math.round(endTime - startTime)}ms`;
            } else {
                this.showError('Processing failed', result.error);
            }

            this.lastResults = result;

        } catch (error) {
            console.error('Processing error:', error);
            this.isProcessing = false;
            this.validateInputs(); // Re-enable button based on current state
            this.elements.processBtn.textContent = 'Process Template';
            this.showError('An unexpected error occurred during processing');
        }
    }

    displayResults(result) {
        if (!this.resultEditor) {
            console.error('Result editor not initialized');
            return;
        }
        
        const format = this.elements.outputFormat.value;
        
        if (result.success) {
            let displayData = result.data;
            let mode = 'application/json'; // Default to JSON mode
            
            // Handle different formats and set appropriate CodeMirror mode
            if (format === 'table' && result.raw_results) {
                displayData = this.formatAsTable(result.raw_results);
                mode = 'text/plain';
            } else if (format === 'yaml') {
                mode = 'yaml';
            } else if (format === 'json') {
                mode = 'application/json';
            }
            
            console.log('Setting mode to:', mode, 'Data length:', displayData?.length); // Debug log
            
            // Update the result editor
            this.resultEditor.setOption('mode', mode);
            this.resultEditor.setValue(displayData || 'No data returned');
            
            // Force refresh and re-enable folding after content change
            setTimeout(() => {
                if (this.resultEditor) {
                    this.resultEditor.refresh();
                    
                    // Let CodeMirror handle fold detection naturally
                    if (this.resultEditor.getOption('foldGutter')) {
                        this.resultEditor.refresh();
                        
                        // Manual fold range detection and setup
                        setTimeout(() => {
                            console.log('Testing with CodeMirror', CodeMirror.version || 'unknown version');
                            this.resultEditor.refresh();
                            
                            // Try manual fold range creation
                            this.createManualFoldRanges();
                        }, 200);
                    }
                }
            }, 100);
            
            // Show stats if available
            if (result.stats) {
                const statsInfo = [
                    `Groups: ${result.stats.template_groups}`,
                    `Items: ${result.stats.parsed_items}`,
                    `Lines: ${result.stats.data_lines}`
                ].join(' | ');
                
                this.elements.processingTime.textContent += ` | ${statsInfo}`;
            }
        } else {
            this.showError('Processing failed', result.error);
        }
    }

    formatAsTable(data) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return 'No data to display in table format';
        }

        try {
            const firstResult = data[0];
            if (!Array.isArray(firstResult) || firstResult.length === 0) {
                return JSON.stringify(data, null, 2);
            }

            let table = '';
            
            // Process each result set
            firstResult.forEach((resultSet, index) => {
                if (index > 0) table += '\n\n';
                
                if (Array.isArray(resultSet)) {
                    // Handle array of objects
                    if (resultSet.length > 0 && typeof resultSet[0] === 'object') {
                        const headers = Object.keys(resultSet[0]);
                        table += headers.join('\t') + '\n';
                        table += headers.map(() => '---').join('\t') + '\n';
                        
                        resultSet.forEach(row => {
                            table += headers.map(header => row[header] || '').join('\t') + '\n';
                        });
                    } else {
                        table += resultSet.join('\n');
                    }
                } else if (typeof resultSet === 'object') {
                    // Handle single object
                    Object.entries(resultSet).forEach(([key, value]) => {
                        table += `${key}:\t${value}\n`;
                    });
                } else {
                    table += String(resultSet);
                }
            });
            
            return table;
        } catch (error) {
            console.error('Error formatting table:', error);
            return JSON.stringify(data, null, 2);
        }
    }

    showError(message, errorDetails = null) {
        if (!this.resultEditor) {
            console.error('Result editor not initialized for error display');
            return;
        }
        
        let errorText = `Error: ${message}`;
        
        if (errorDetails) {
            if (typeof errorDetails === 'object') {
                errorText += `\n\nDetails:\n${errorDetails.message || JSON.stringify(errorDetails, null, 2)}`;
                
                if (errorDetails.traceback) {
                    errorText += `\n\nTraceback:\n${errorDetails.traceback}`;
                }
            } else {
                errorText += `\n\nDetails: ${errorDetails}`;
            }
        }
        
        this.resultEditor.setOption('mode', 'text/plain');
        this.resultEditor.setValue(errorText);
        this.elements.processingTime.textContent = '';
        
        // Force refresh
        setTimeout(() => {
            if (this.resultEditor) {
                this.resultEditor.refresh();
            }
        }, 50);
    }

    clearAll() {
        this.cancelAutoProcess(); // Cancel any pending auto-processing
        this.dataEditor.setValue('');
        this.templateEditor.setValue('');
        if (this.resultEditor) {
            this.resultEditor.setValue('Results will appear here after processing...');
        }
        this.elements.processingTime.textContent = '';
        this.elements.downloadBtn.disabled = true;
        this.lastResults = null;
        this.currentExample = null;
    }

    showExampleMenu() {
        const examples = getExampleNames();
        const menu = document.createElement('div');
        menu.className = 'example-menu';
        menu.innerHTML = `
            <div class="example-menu-content">
                <h3>Load Example Template</h3>
                <div class="example-list">
                    ${examples.map(example => 
                        `<button class="example-item" data-key="${example.key}">
                            ${example.name}
                        </button>`
                    ).join('')}
                </div>
                <button class="close-menu">Cancel</button>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .example-menu {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1001;
            }
            .example-menu-content {
                background: white;
                padding: 30px;
                border-radius: 16px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            .example-list {
                margin: 20px 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .example-item {
                padding: 15px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
            }
            .example-item:hover {
                border-color: #667eea;
                background: #f8fafc;
            }
            .close-menu {
                padding: 10px 20px;
                background: #f56565;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 15px;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(menu);

        // Add event listeners
        menu.addEventListener('click', (e) => {
            if (e.target.classList.contains('example-item')) {
                const exampleKey = e.target.dataset.key;
                this.loadExample(exampleKey);
                document.body.removeChild(menu);
                document.head.removeChild(style);
            } else if (e.target.classList.contains('close-menu') || e.target === menu) {
                document.body.removeChild(menu);
                document.head.removeChild(style);
            }
        });
    }

    loadExample(exampleKey) {
        const example = loadExample(exampleKey);
        if (example) {
            this.dataEditor.setValue(example.data);
            this.templateEditor.setValue(example.template);
            this.currentExample = exampleKey;
            
            // Clear previous results
            if (this.resultEditor) {
                if (this.isAutoProcessEnabled) {
                    this.resultEditor.setValue('Example loaded. Processing automatically...');
                } else {
                    this.resultEditor.setValue('Example loaded. Click "Process Template" to see results.');
                }
            }
            this.elements.processingTime.textContent = '';
            this.lastResults = null;
            
            this.validateInputs();
            
            // Trigger auto-processing if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        }
    }

    downloadResults() {
        if (!this.lastResults || !this.lastResults.success) {
            this.showError('No results to download');
            return;
        }

        const format = this.elements.outputFormat.value;
        const data = this.lastResults.data;
        
        let filename = 'ttp_results';
        let mimeType = 'text/plain';
        
        switch (format) {
            case 'json':
                filename += '.json';
                mimeType = 'application/json';
                break;
            case 'yaml':
                filename += '.yaml';
                mimeType = 'text/yaml';
                break;
            case 'table':
                filename += '.txt';
                mimeType = 'text/plain';
                break;
        }

        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    hideLoadingOverlay() {
        const overlay = this.elements.loadingOverlay;
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ttpEditor = new TTPEditor();
});
