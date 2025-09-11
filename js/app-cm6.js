class TTPEditor {
    constructor() {
        console.log('Initializing TTP Editor...');
        
        this.elements = {};
        this.ttpProcessor = null;
        
        // CodeMirror 6 editors
        this.dataEditor = null;
        this.templateEditor = null;
        this.resultEditor = null;
        
        // Auto-processing
        this.autoProcessTimeout = null;
        this.autoProcessDelay = 1000;
        this.isAutoProcessEnabled = false;
        this.hasErrorMarker = false;
    }

    async init() {
        console.log('TTP Editor init started');
        
        // Wait for CodeMirror 6 to load
        while (!window.CodeMirror6) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('CodeMirror 6 available');
        
        this.setupUI();
        this.setupEventListeners();
        await this.setupCodeEditors();
        this.setupPaneResizing();
        
        // Initialize TTP processor
        this.ttpProcessor = new TTPProcessor();
        await this.ttpProcessor.initialize();
        
        this.setupResultEditor();
        
        console.log('TTP Editor initialized successfully');
    }

    setupUI() {
        // Get all UI elements
        this.elements = {
            dataInput: document.getElementById('dataInput'),
            templateInput: document.getElementById('templateInput'),
            resultOutput: document.getElementById('resultOutput'),
            processBtn: document.getElementById('processBtn'),
            clearBtn: document.getElementById('clearBtn'),
            exampleBtn: document.getElementById('exampleBtn'),
            downloadBtn: document.getElementById('downloadBtn'),
            outputFormat: document.getElementById('outputFormat'),
            autoProcess: document.getElementById('autoProcess'),
            statusBar: document.querySelector('.status-bar'),
            loadingOverlay: document.querySelector('.loading-overlay'),
            // Global vars modal elements
            globalVarsBtn: document.getElementById('globalVarsBtn'),
            globalVarsModal: document.getElementById('globalVarsModal'),
            varsFormat: document.getElementById('varsFormat'),
            varsEditor: document.getElementById('varsEditor'),
            saveVarsBtn: document.getElementById('saveVarsBtn'),
            clearVarsBtn: document.getElementById('clearVarsBtn'),
            cancelVarsBtn: document.getElementById('cancelVarsBtn')
        };

        // Initially disable process button
        this.elements.processBtn.disabled = true;
        this.elements.downloadBtn.disabled = true;
    }

    async setupCodeEditors() {
        const { EditorView, EditorState, basicSetup, python, oneDark } = window.CodeMirror6;
        
        // Data input editor
        const dataState = EditorState.create({
            doc: this.elements.dataInput.value || '',
            extensions: [
                basicSetup,
                python(),
                oneDark,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        this.validateInputs();
                        this.scheduleAutoProcess();
                    }
                })
            ]
        });
        
        this.dataEditor = new EditorView({
            state: dataState,
            parent: this.elements.dataInput.parentElement
        });
        
        // Hide original textarea
        this.elements.dataInput.style.display = 'none';

        // Template editor
        const templateState = EditorState.create({
            doc: this.elements.templateInput.value || '',
            extensions: [
                basicSetup,
                python(),
                oneDark,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        this.validateInputs();
                        this.scheduleAutoProcess();
                    }
                })
            ]
        });
        
        this.templateEditor = new EditorView({
            state: templateState,
            parent: this.elements.templateInput.parentElement
        });
        
        // Hide original textarea
        this.elements.templateInput.style.display = 'none';
    }

    setupResultEditor() {
        const { EditorView, EditorState, basicSetup, json, oneDark, foldGutter, foldKeymap, keymap } = window.CodeMirror6;
        
        // Clear the result output div first
        this.elements.resultOutput.innerHTML = '';
        
        // Setup result editor with CodeMirror 6 for better display and folding
        const resultState = EditorState.create({
            doc: 'Results will appear here after processing...',
            extensions: [
                basicSetup,
                json(), // Use JSON mode for better folding
                oneDark,
                // Note: foldGutter() might be included in basicSetup already
                keymap.of(foldKeymap), // Add fold keyboard shortcuts
                EditorView.editable.of(false) // Read-only
            ]
        });
        
        this.resultEditor = new EditorView({
            state: resultState,
            parent: this.elements.resultOutput
        });
        
        console.log('CodeMirror 6 result editor initialized with JSON folding support');
    }

    setupEventListeners() {
        this.elements.processBtn.addEventListener('click', () => this.processTemplate());
        this.elements.clearBtn.addEventListener('click', () => this.clearAll());
        this.elements.exampleBtn.addEventListener('click', () => this.loadExample());
        this.elements.downloadBtn.addEventListener('click', () => this.downloadResults());
        this.elements.outputFormat.addEventListener('change', () => {
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        });
        this.elements.autoProcess.addEventListener('change', (e) => {
            this.isAutoProcessEnabled = e.target.checked;
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            } else {
                this.cancelAutoProcess();
            }
        });

        // Global vars modal
        this.setupGlobalVarsModal();
        
        // Check initial state of auto-process checkbox
        this.isAutoProcessEnabled = this.elements.autoProcess.checked;
    }

    setupGlobalVarsModal() {
        // Global vars button
        this.elements.globalVarsBtn.addEventListener('click', () => {
            this.openGlobalVarsModal();
        });

        // Modal close buttons
        this.elements.globalVarsModal.querySelector('.close').addEventListener('click', () => {
            this.closeGlobalVarsModal();
        });

        this.elements.cancelVarsBtn.addEventListener('click', () => {
            this.closeGlobalVarsModal();
        });

        // Modal action buttons
        this.elements.saveVarsBtn.addEventListener('click', () => {
            this.saveGlobalVars();
        });

        this.elements.clearVarsBtn.addEventListener('click', () => {
            this.clearGlobalVars();
        });

        // Format change handler
        this.elements.varsFormat.addEventListener('change', () => {
            this.updateVarsEditorFormat();
        });

        // Close modal when clicking outside
        this.elements.globalVarsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.globalVarsModal) {
                this.closeGlobalVarsModal();
            }
        });
    }

    openGlobalVarsModal() {
        this.elements.globalVarsModal.style.display = 'block';
        this.initializeVarsEditor();
    }

    closeGlobalVarsModal() {
        this.elements.globalVarsModal.style.display = 'none';
    }

    initializeVarsEditor() {
        if (this.varsEditor) {
            return; // Already initialized
        }

        const { EditorView, EditorState, basicSetup, json, yaml, python, oneDark } = window.CodeMirror6;
        
        // Default JSON content
        const defaultContent = `{
  "hostname": "switch-1",
  "domain": "example.com",
  "timezone": "UTC"
}`;

        this.varsEditor = new EditorView({
            state: EditorState.create({
                doc: defaultContent,
                extensions: [
                    basicSetup,
                    json(),
                    oneDark,
                    EditorView.theme({
                        "&": { height: "100%" },
                        ".cm-scroller": { overflow: "auto" }
                    })
                ]
            }),
            parent: this.elements.varsEditor
        });
    }

    updateVarsEditorFormat() {
        if (!this.varsEditor) return;

        const { EditorView, EditorState, basicSetup, json, yaml, python, oneDark } = window.CodeMirror6;
        const format = this.elements.varsFormat.value;
        
        let languageExtension;
        let defaultContent;
        
        switch (format) {
            case 'yaml':
                languageExtension = yaml();
                defaultContent = `hostname: switch-1
domain: example.com
timezone: UTC`;
                break;
            case 'python':
                languageExtension = python();
                defaultContent = `{
    "hostname": "switch-1",
    "domain": "example.com", 
    "timezone": "UTC"
}`;
                break;
            default: // json
                languageExtension = json();
                defaultContent = `{
  "hostname": "switch-1",
  "domain": "example.com",
  "timezone": "UTC"
}`;
        }

        const newState = EditorState.create({
            doc: defaultContent,
            extensions: [
                basicSetup,
                languageExtension,
                oneDark,
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        });

        this.varsEditor.setState(newState);
    }

    saveGlobalVars() {
        if (!this.varsEditor) return;

        const varsText = this.varsEditor.state.doc.toString();
        const format = this.elements.varsFormat.value;
        
        this.ttpProcessor.setGlobalVars(varsText, format);
        this.closeGlobalVarsModal();
        
        // Trigger auto-process if enabled
        if (this.isAutoProcessEnabled) {
            this.scheduleAutoProcess();
        }
    }

    clearGlobalVars() {
        this.ttpProcessor.globalVars = null;
        this.closeGlobalVarsModal();
        
        // Trigger auto-process if enabled
        if (this.isAutoProcessEnabled) {
            this.scheduleAutoProcess();
        }
    }

    setupPaneResizing() {
        const resizeHandles = document.querySelectorAll('.resize-handle');
        
        resizeHandles.forEach(handle => {
            let isResizing = false;
            let startX = 0;
            let startWidth = 0;
            let leftPane = null;
            
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                leftPane = handle.previousElementSibling;
                startWidth = leftPane.offsetWidth;
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            });
            
            const handleMouseMove = (e) => {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const newWidth = startWidth + deltaX;
                const containerWidth = leftPane.parentElement.offsetWidth;
                const percentage = (newWidth / containerWidth) * 100;
                
                if (percentage > 10 && percentage < 80) {
                    leftPane.style.width = percentage + '%';
                }
            };
            
            const handleMouseUp = () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        });
    }

    validateInputs() {
        const dataValue = this.dataEditor ? this.dataEditor.state.doc.toString() : '';
        const templateValue = this.templateEditor ? this.templateEditor.state.doc.toString() : '';
        
        const isValid = dataValue.trim().length > 0 && templateValue.trim().length > 0;
        this.elements.processBtn.disabled = !isValid;
    }

    scheduleAutoProcess() {
        if (!this.isAutoProcessEnabled) return;
        
        this.cancelAutoProcess();
        this.autoProcessTimeout = setTimeout(() => {
            this.processTemplate();
        }, this.autoProcessDelay);
    }

    cancelAutoProcess() {
        if (this.autoProcessTimeout) {
            clearTimeout(this.autoProcessTimeout);
            this.autoProcessTimeout = null;
        }
    }

    async processTemplate() {
        if (!this.ttpProcessor) {
            console.error('TTP processor not initialized');
            return;
        }

        const dataValue = this.dataEditor.state.doc.toString();
        const templateValue = this.templateEditor.state.doc.toString();
        
        // Debug: Check for hidden characters or extra content (can be removed later)
        // console.log('Template length:', templateValue.length);
        // console.log('Template lines:', templateValue.split('\n').length);
        
        if (!dataValue.trim() || !templateValue.trim()) {
            this.showError('Please provide both data and template');
            return;
        }

        try {
            // Show processing status and start timing
            const startTime = performance.now();
            this.updateResultEditor('Processing template...');
            
            const outputFormat = this.elements.outputFormat.value;
            const result = await this.ttpProcessor.processTemplate(dataValue, templateValue, outputFormat);
            const endTime = performance.now();
            const processingTime = Math.round(endTime - startTime);
            
            // Add processing time to result
            result.processingTime = processingTime;
            this.displayResults(result);
        } catch (error) {
            console.error('Processing error:', error);
            this.showError(`Processing failed: ${error.message}`);
        }
    }

    displayResults(result) {
        const { json, javascript, yaml } = window.CodeMirror6;
        const format = this.elements.outputFormat.value;
        
        if (result.success) {
            let displayData = result.data;
            let languageExtension = json(); // Default to JSON for better folding
            
            // Handle different formats and set appropriate language
            if (format === 'table' && result.raw_results) {
                displayData = this.formatAsTable(result.raw_results);
                languageExtension = null; // Plain text
            } else if (format === 'yaml') {
                languageExtension = yaml();
            } else if (format === 'json') {
                languageExtension = json(); // Use proper JSON mode
            }
            
            console.log('Setting mode to:', format, 'Data length:', displayData?.length);
            
            // Update the result editor with new content and language
            this.updateResultEditor(displayData || 'No data returned', languageExtension);
            
            // Enable download button
            this.elements.downloadBtn.disabled = false;
            
            // Show stats if available
            let statusMessage = `Processed successfully in ${result.processingTime}ms`;
            if (result.stats) {
                // Convert Pyodide proxy to regular JS object
                const stats = result.stats.toJs();
                
                const parsedItems = stats.parsed_items || 0;
                const templateGroups = stats.template_groups || 0;
                statusMessage += `. Groups: ${templateGroups}, Items: ${parsedItems}`;
                
                // Display any print output from TTP template
                if (stats.processing_info) {
                    console.log('TTP Template Print Output:', stats.processing_info);
                    // Also show in status if it's short enough
                    if (stats.processing_info.length < 50) {
                        statusMessage += `. Print: ${stats.processing_info}`;
                    }
                }
            }
            this.updateStatus(statusMessage);
            
            // Clear any error markers on successful processing
            this.clearErrorMarkers();
        } else {
            // Handle error case
            let errorMessage = 'Unknown processing error';
            if (result.error) {
                if (typeof result.error === 'object') {
                    errorMessage = `${result.error.type}: ${result.error.message}`;
                    if (result.error.context) {
                        errorMessage += `\n\n${result.error.context}`;
                    }
                    if (result.error.traceback) {
                        errorMessage += `\n\nTraceback:\n${result.error.traceback}`;
                    }
                } else {
                    errorMessage = result.error;
                }
            }
            this.showError(errorMessage);
            
            // Try to show error marker in template editor
            if (result.error && typeof result.error === 'object' && result.error.message) {
                const lineMatch = result.error.message.match(/line (\d+)/);
                if (lineMatch) {
                    let reportedLine = parseInt(lineMatch[1]);
                    const templateLines = this.templateEditor.state.doc.lines;
                    
                    // The error message uses 1-based line numbers, but gutter elements are 0-based
                    // So line 18 in the error message = index 17 in the gutter array
                    let lineNumber = reportedLine - 1;
                    
                    // Only show error marker if we don't already have one
                    if (!this.hasErrorMarker) {
                        this.showErrorMarker(lineNumber, result.error.message);
                        this.hasErrorMarker = true;
                    }
                }
            }
        }
    }

    updateResultEditor(content, languageExtension = null) {
        const { EditorView, EditorState, basicSetup, json, oneDark, foldGutter, foldKeymap, keymap } = window.CodeMirror6;
        
        const extensions = [
            basicSetup,
            oneDark,
            // Note: foldGutter() might be included in basicSetup already
            keymap.of(foldKeymap), // Add fold keyboard shortcuts
            EditorView.editable.of(false)
        ];
        
        if (languageExtension) {
            extensions.push(languageExtension);
        } else {
            extensions.push(json()); // Default to JSON for folding
        }
        
        const newState = EditorState.create({
            doc: content,
            extensions: extensions
        });
        
        this.resultEditor.setState(newState);
        
        console.log('CodeMirror 6 content updated with proper JSON folding support');
    }

    showError(message) {
        this.updateResultEditor(`Error: ${message}`);
        this.updateStatus('Error occurred - see results pane for details');
        this.elements.downloadBtn.disabled = true;
    }

    showErrorMarker(lineNumber, message) {
        console.log(`Error at template line ${lineNumber}: ${message}`);
        
        // Add visual error indicator to template editor
        const templateContainer = document.querySelector('.template-pane');
        if (templateContainer) {
            templateContainer.classList.add('has-error');
            templateContainer.title = `Error at line ${lineNumber}: ${message}`;
        }
        
        // Add error indicator to the pane header
        const templateHeader = document.querySelector('.template-pane .pane-header');
        if (templateHeader) {
            templateHeader.innerHTML = `TTP Template <span style="color: #ff6666;">⚠ Error at line ${lineNumber}</span>`;
        }
        
        // Add line-specific error marker
        this.addLineErrorMarker(lineNumber, message);
    }

    addLineErrorMarker(lineNumber, message) {
        // Wait a bit for the editor to be fully rendered
        setTimeout(() => {
            const editorElement = document.querySelector('.template-pane .cm-editor');
            if (!editorElement) {
                console.log('Editor element not found');
                return;
            }
            
            // Find the line number gutter
            const gutterElement = editorElement.querySelector('.cm-gutter');
            if (!gutterElement) {
                console.log('Gutter element not found');
                return;
            }
            
            // Find the specific line number element
            const lineNumberElements = gutterElement.querySelectorAll('.cm-gutterElement');
            
            // The first gutter element is the fold gutter, so we need to adjust for that
            let targetIndex = lineNumber; // This is 0-based for the line number
            
            // Get the number of lines in the template
            const templateLines = this.templateEditor.state.doc.lines;
            
            // If we have more gutter elements than lines, the first one is the fold gutter
            if (lineNumberElements.length > templateLines) {
                targetIndex = lineNumber + 1; // Skip the fold gutter
            }
            
            if (lineNumberElements.length > targetIndex) {
                const targetLineNumber = lineNumberElements[targetIndex];
                if (targetLineNumber) {
                    // Add error marker class to the line number
                    targetLineNumber.classList.add('cm-error-line-number');
                    targetLineNumber.title = `Error: ${message}`;
                    
                    // Add a red error icon
                    const errorIcon = document.createElement('span');
                    errorIcon.className = 'cm-error-icon';
                    errorIcon.innerHTML = '⚠';
                    errorIcon.title = `Error: ${message}`;
                    targetLineNumber.appendChild(errorIcon);
                }
            }
            
            // Also highlight the line itself
            const lineElements = editorElement.querySelectorAll('.cm-line');
            
            if (lineElements.length > lineNumber) {
                const targetLine = lineElements[lineNumber];
                if (targetLine) {
                    targetLine.classList.add('cm-error-line');
                    targetLine.title = `Error: ${message}`;
                }
            }
        }, 100);
    }

    clearErrorMarkers() {
        console.log('Clearing error markers');
        
        // Remove visual error indicator from template editor
        const templateContainer = document.querySelector('.template-pane');
        if (templateContainer) {
            templateContainer.classList.remove('has-error');
            templateContainer.title = '';
        }
        
        // Restore normal header text
        const templateHeader = document.querySelector('.template-pane .pane-header');
        if (templateHeader) {
            templateHeader.innerHTML = 'TTP Template';
        }
        
        // Remove line-specific error markers
        this.removeLineErrorMarkers();
    }

    removeLineErrorMarkers() {
        const editorElement = document.querySelector('.template-pane .cm-editor');
        if (!editorElement) return;
        
        // Remove error line classes
        const errorLines = editorElement.querySelectorAll('.cm-error-line');
        errorLines.forEach(line => {
            line.classList.remove('cm-error-line');
            line.title = '';
        });
        
        // Remove error line number classes and icons
        const errorLineNumbers = editorElement.querySelectorAll('.cm-error-line-number');
        errorLineNumbers.forEach(lineNumber => {
            lineNumber.classList.remove('cm-error-line-number');
            lineNumber.title = '';
        });
        
        // Remove error icons
        const errorIcons = editorElement.querySelectorAll('.cm-error-icon');
        errorIcons.forEach(icon => icon.remove());
        
        // Reset the error marker flag
        this.hasErrorMarker = false;
    }

    clearAll() {
        this.cancelAutoProcess();
        
        // Clear editors
        if (this.dataEditor) {
            this.dataEditor.dispatch({
                changes: { from: 0, to: this.dataEditor.state.doc.length, insert: '' }
            });
        }
        
        if (this.templateEditor) {
            this.templateEditor.dispatch({
                changes: { from: 0, to: this.templateEditor.state.doc.length, insert: '' }
            });
        }
        
        this.updateResultEditor('Results will appear here after processing...');
        this.updateStatus('Ready');
        this.elements.downloadBtn.disabled = true;
    }

    loadExample() {
        console.log('loadExample called, window.TTP_EXAMPLES:', window.TTP_EXAMPLES);
        if (!window.TTP_EXAMPLES) {
            console.error('Examples not loaded');
            return;
        }

        // Use cisco_interface example or fallback to first available
        const exampleKey = window.TTP_EXAMPLES.cisco_interface ? 'cisco_interface' : Object.keys(window.TTP_EXAMPLES)[0];
        const example = window.TTP_EXAMPLES[exampleKey];
        
        // Set data
        if (this.dataEditor) {
            this.dataEditor.dispatch({
                changes: { from: 0, to: this.dataEditor.state.doc.length, insert: example.data }
            });
        }
        
        // Set template
        if (this.templateEditor) {
            this.templateEditor.dispatch({
                changes: { from: 0, to: this.templateEditor.state.doc.length, insert: example.template }
            });
        }
        
        this.updateResultEditor('Example loaded. Processing...');
        this.updateStatus('Example loaded');
        
        if (this.isAutoProcessEnabled) {
            this.scheduleAutoProcess();
        }
    }

    downloadResults() {
        const content = this.resultEditor.state.doc.toString();
        const format = this.elements.outputFormat.value;
        const filename = `ttp_results.${format}`;
        const mimeType = format === 'json' ? 'application/json' : 
                        format === 'yaml' ? 'application/x-yaml' : 'text/plain';
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatAsTable(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return 'No data to display as table';
        }

        try {
            const firstItem = data[0];
            if (typeof firstItem !== 'object' || firstItem === null) {
                return JSON.stringify(data, null, 2);
            }

            const headers = Object.keys(firstItem);
            let table = headers.join('\t') + '\n';
            table += headers.map(() => '---').join('\t') + '\n';
            
            data.forEach(item => {
                const row = headers.map(header => {
                    const value = item[header];
                    return value !== undefined && value !== null ? String(value) : '';
                }).join('\t');
                table += row + '\n';
            });

            return table;
        } catch (error) {
            console.error('Error formatting table:', error);
            return JSON.stringify(data, null, 2);
        }
    }

    updateStatus(message) {
        if (this.elements.statusBar) {
            this.elements.statusBar.textContent = message;
        }
    }

    hideLoadingOverlay() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    const editor = new TTPEditor();
    await editor.init();
    editor.hideLoadingOverlay();
});
