class TTPEditor {
    constructor() {
        console.log('Initializing TTP Editor with Monaco Editor...');
        
        this.elements = {};
        this.ttpProcessor = null;
        
        // Monaco editors
        this.dataEditor = null;
        this.templateEditor = null;
        this.resultEditor = null;
        
        // Auto-processing
        this.autoProcessTimeout = null;
        this.autoProcessDelay = 1000;
        this.isAutoProcessEnabled = false;
        this.hasErrorMarker = false;

        // Functions management
        this.functions = [];
        this.functionCounter = 0;
        this.functionEditors = new Map();

        // Lookups management
        this.lookupTables = [];
        this.lookupCounter = 0;
        this.lookupEditors = new Map();
    }

    async init() {
        console.log('TTP Editor init started');
        
        // Wait for Monaco Editor to load
        while (!window.MonacoEditor) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('Monaco Editor available');
        
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
            cancelVarsBtn: document.getElementById('cancelVarsBtn'),
            // Functions modal elements
            functionsBtn: document.getElementById('functionsBtn'),
            functionsModal: document.getElementById('functionsModal'),
            functionsContainer: document.getElementById('functionsContainer'),
            addFunctionBtn: document.getElementById('addFunctionBtn'),
            saveFunctionsBtn: document.getElementById('saveFunctionsBtn'),
            clearFunctionsBtn: document.getElementById('clearFunctionsBtn'),
            cancelFunctionsBtn: document.getElementById('cancelFunctionsBtn'),
            // Lookups modal elements
            lookupsBtn: document.getElementById('lookupsBtn'),
            lookupsModal: document.getElementById('lookupsModal'),
            lookupsContainer: document.getElementById('lookupsContainer'),
            addLookupBtn: document.getElementById('addLookupBtn'),
            saveLookupsBtn: document.getElementById('saveLookupsBtn'),
            clearLookupsBtn: document.getElementById('clearLookupsBtn'),
            cancelLookupsBtn: document.getElementById('cancelLookupsBtn')
        };

        // Initially disable process button
        this.elements.processBtn.disabled = true;
        this.elements.downloadBtn.disabled = true;
    }

    async setupCodeEditors() {
        // Data input editor
        this.dataEditor = window.MonacoEditor.create(this.elements.dataInput.parentElement, {
            value: this.elements.dataInput.value || '',
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            renderWhitespace: 'selection',
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });

        // Hide original textarea
        this.elements.dataInput.style.display = 'none';

        // Template editor
        this.templateEditor = window.MonacoEditor.create(this.elements.templateInput.parentElement, {
            value: this.elements.templateInput.value || '',
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            renderWhitespace: 'selection',
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });

        // Hide original textarea
        this.elements.templateInput.style.display = 'none';

        // Add change listeners
        this.dataEditor.onDidChangeModelContent(() => {
            this.validateInputs();
            this.scheduleAutoProcess();
        });

        this.templateEditor.onDidChangeModelContent(() => {
            this.validateInputs();
            this.scheduleAutoProcess();
        });
    }

    setupResultEditor() {
        // Clear the result output div first
        this.elements.resultOutput.innerHTML = '';
        
        // Setup result editor with Monaco for better display and search
        this.resultEditor = window.MonacoEditor.create(this.elements.resultOutput, {
            value: 'Results will appear here after processing...',
            language: 'json',
            theme: 'vs-dark',
            readOnly: true,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            renderWhitespace: 'selection',
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            // Enable search functionality
            find: {
                addExtraSpaceOnTop: false,
                autoFindInSelection: 'never',
                seedSearchStringFromSelection: 'never'
            }
        });
        
        console.log('Monaco result editor initialized with JSON folding and search support');
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

        // Functions modal
        this.setupFunctionsModal();

        // Lookups modal
        this.setupLookupsModal();

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
        
        // Default JSON content
        const defaultContent = `{
  "hostname": "switch-1",
  "domain": "example.com",
  "timezone": "UTC"
}`;

        this.varsEditor = window.MonacoEditor.create(this.elements.varsEditor, {
            value: defaultContent,
            language: 'json',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });
    }

    setupFunctionsModal() {
        // Functions button
        this.elements.functionsBtn.addEventListener('click', () => {
            this.openFunctionsModal();
        });

        // Modal close buttons
        this.elements.functionsModal.querySelector('.close').addEventListener('click', () => {
            this.closeFunctionsModal();
        });

        this.elements.cancelFunctionsBtn.addEventListener('click', () => {
            this.closeFunctionsModal();
        });

        // Add function button
        this.elements.addFunctionBtn.addEventListener('click', () => {
            this.addFunctionItem();
        });

        // Modal action buttons
        this.elements.saveFunctionsBtn.addEventListener('click', () => {
            this.saveFunctions();
        });

        this.elements.clearFunctionsBtn.addEventListener('click', () => {
            this.clearFunctions();
        });

        // Close modal when clicking outside
        this.elements.functionsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.functionsModal) {
                this.closeFunctionsModal();
            }
        });
    }

    openFunctionsModal() {
        this.elements.functionsModal.style.display = 'block';
        this.loadFunctions();
    }

    closeFunctionsModal() {
        this.elements.functionsModal.style.display = 'none';
        // Clean up any editors
        this.functionEditors.clear();
    }

    loadFunctions() {
        // Clear existing functions
        this.elements.functionsContainer.innerHTML = '';

        // Load functions from processor
        if (this.ttpProcessor && this.ttpProcessor.customFunctions) {
            this.functions = [...this.ttpProcessor.customFunctions];
        }

        // If no functions, add one by default
        if (this.functions.length === 0) {
            this.addFunctionItem();
        } else {
            // Load existing functions
            this.functions.forEach(func => {
                this.createFunctionItem(func);
            });
        }
    }

    addFunctionItem() {
        const newFunction = {
            id: `func_${++this.functionCounter}`,
            scope: 'match',
            name: '',
            add_ttp: false,
            code: `def my_function(data):
    """
    Custom function for TTP processing

    Args:
        data: Input data to process

    Returns:
        Processed data
    """
    return data.strip()`
        };

        this.functions.push(newFunction);
        this.createFunctionItem(newFunction);
    }

    createFunctionItem(func) {
        const container = document.createElement('div');
        container.className = 'function-item';
        container.dataset.id = func.id;

        container.innerHTML = `
            <div class="function-header" onclick="this.classList.toggle('collapsed')">
                <div class="function-title">
                    <span class="function-collapse-icon">▼</span>
                    <span>Function: ${func.name || 'Unnamed'}</span>
                </div>
                <div class="function-controls">
                    <button class="function-remove-btn" onclick="event.stopPropagation(); this.closest('.function-item').remove();">Remove</button>
                </div>
            </div>
            <div class="function-body">
                <div class="function-form">
                    <div class="function-form-group">
                        <label>Scope (required):</label>
                        <select class="function-scope">
                            <option value="match" ${func.scope === 'match' ? 'selected' : ''}>match</option>
                            <option value="group" ${func.scope === 'group' ? 'selected' : ''}>group</option>
                            <option value="input" ${func.scope === 'input' ? 'selected' : ''}>input</option>
                            <option value="output" ${func.scope === 'output' ? 'selected' : ''}>output</option>
                            <option value="returners" ${func.scope === 'returners' ? 'selected' : ''}>returners</option>
                            <option value="formatters" ${func.scope === 'formatters' ? 'selected' : ''}>formatters</option>
                            <option value="variable" ${func.scope === 'variable' ? 'selected' : ''}>variable</option>
                            <option value="macro" ${func.scope === 'macro' ? 'selected' : ''}>macro</option>
                        </select>
                    </div>
                    <div class="function-form-group">
                        <label>Name (optional):</label>
                        <input type="text" class="function-name" value="${func.name || ''}" placeholder="Optional function name">
                    </div>
                    <div class="function-form-group">
                        <div class="function-checkbox-group">
                            <input type="checkbox" class="function-add-ttp" ${func.add_ttp ? 'checked' : ''}>
                            <label>Add TTP</label>
                        </div>
                    </div>
                </div>
                <div class="function-form-group full-width">
                    <label>Python Code (required):</label>
                    <div class="function-code-editor" data-function-id="${func.id}"></div>
                </div>
            </div>
        `;

        this.elements.functionsContainer.appendChild(container);

        // Initialize Monaco editor for this function
        this.initializeFunctionEditor(func.id, func.code || '');

        // Add event listeners for remove button
        const removeBtn = container.querySelector('.function-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFunctionItem(func.id);
        });
    }

    initializeFunctionEditor(functionId, code) {
        const editorContainer = document.querySelector(`[data-function-id="${functionId}"]`);

        if (!editorContainer) return;

        const editor = window.MonacoEditor.create(editorContainer, {
            value: code,
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });

        this.functionEditors.set(functionId, editor);
    }

    removeFunctionItem(functionId) {
        // Remove from functions array
        this.functions = this.functions.filter(f => f.id !== functionId);

        // Clean up editor
        if (this.functionEditors.has(functionId)) {
            this.functionEditors.delete(functionId);
        }

        // Remove DOM element
        const item = document.querySelector(`[data-id="${functionId}"]`);
        if (item) {
            item.remove();
        }
    }

    async saveFunctions() {
        // Collect function data from UI
        const functions = [];

        this.functions.forEach(func => {
            const container = document.querySelector(`[data-id="${func.id}"]`);
            if (!container) return;

            const scope = container.querySelector('.function-scope').value;
            const name = container.querySelector('.function-name').value.trim();
            const addTtp = container.querySelector('.function-add-ttp').checked;

            // Get code from editor
            let code = '';
            if (this.functionEditors.has(func.id)) {
                code = this.functionEditors.get(func.id).getValue();
            }

            if (scope && code.trim()) {
                functions.push({
                    id: func.id,
                    scope: scope,
                    name: name || null,
                    add_ttp: addTtp,
                    code: code
                });
            }
        });

        try {
            // Update processor (this will reinitialize Python)
            await this.ttpProcessor.setCustomFunctions(functions);
            this.closeFunctionsModal();

            // Trigger auto-process if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        } catch (error) {
            console.error('Error saving functions:', error);
            alert('Error saving functions: ' + error.message);
        }
    }

    async clearFunctions() {
        this.functions = [];
        this.functionEditors.clear();
        this.elements.functionsContainer.innerHTML = '';

        try {
            await this.ttpProcessor.clearCustomFunctions();

            // Trigger auto-process if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        } catch (error) {
            console.error('Error clearing functions:', error);
            alert('Error clearing functions: ' + error.message);
        }
    }

    setupLookupsModal() {
        // Lookups button
        this.elements.lookupsBtn.addEventListener('click', () => {
            this.openLookupsModal();
        });

        // Modal close buttons
        this.elements.lookupsModal.querySelector('.close').addEventListener('click', () => {
            this.closeLookupsModal();
        });

        this.elements.cancelLookupsBtn.addEventListener('click', () => {
            this.closeLookupsModal();
        });

        // Add lookup button
        this.elements.addLookupBtn.addEventListener('click', () => {
            this.addLookupItem();
        });

        // Modal action buttons
        this.elements.saveLookupsBtn.addEventListener('click', () => {
            this.saveLookups();
        });

        this.elements.clearLookupsBtn.addEventListener('click', () => {
            this.clearLookups();
        });

        // Close modal when clicking outside
        this.elements.lookupsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.lookupsModal) {
                this.closeLookupsModal();
            }
        });
    }

    openLookupsModal() {
        this.elements.lookupsModal.style.display = 'block';
        this.loadLookups();
    }

    closeLookupsModal() {
        this.elements.lookupsModal.style.display = 'none';
        // Clean up any editors
        this.lookupEditors.clear();
    }

    loadLookups() {
        // Clear existing lookups
        this.elements.lookupsContainer.innerHTML = '';

        // Load lookups from processor
        if (this.ttpProcessor && this.ttpProcessor.lookupTables) {
            this.lookupTables = [...this.ttpProcessor.lookupTables];
        }

        // If no lookups, add one by default
        if (this.lookupTables.length === 0) {
            this.addLookupItem();
        } else {
            // Load existing lookups
            this.lookupTables.forEach(lookup => {
                this.createLookupItem(lookup);
            });
        }
    }

    addLookupItem() {
        const newLookup = {
            id: `lookup_${++this.lookupCounter}`,
            name: '',
            load: 'python',
            textData: `{
    "device1": {"ip": "192.168.1.1", "hostname": "router1"},
    "device2": {"ip": "192.168.1.2", "hostname": "router2"}
}`
        };

        this.lookupTables.push(newLookup);
        this.createLookupItem(newLookup);
    }

    createLookupItem(lookup) {
        const container = document.createElement('div');
        container.className = 'lookup-item';
        container.dataset.id = lookup.id;

        container.innerHTML = `
            <div class="lookup-header" onclick="this.classList.toggle('collapsed')">
                <div class="lookup-title">
                    <span class="lookup-collapse-icon">▼</span>
                    <span>Lookup: ${lookup.name || 'Unnamed'}</span>
                </div>
                <div class="lookup-controls">
                    <button class="lookup-remove-btn" onclick="event.stopPropagation(); this.closest('.lookup-item').remove();">Remove</button>
                </div>
            </div>
            <div class="lookup-body">
                <div class="lookup-form">
                    <div class="lookup-form-group">
                        <label>Name (required):</label>
                        <input type="text" class="lookup-name" value="${lookup.name || ''}" placeholder="Lookup table name">
                    </div>
                    <div class="lookup-form-group">
                        <label>Load format:</label>
                        <select class="lookup-load">
                            <option value="python" ${lookup.load === 'python' ? 'selected' : ''}>python</option>
                            <option value="json" ${lookup.load === 'json' ? 'selected' : ''}>json</option>
                            <option value="yaml" ${lookup.load === 'yaml' ? 'selected' : ''}>yaml</option>
                            <option value="csv" ${lookup.load === 'csv' ? 'selected' : ''}>csv</option>
                            <option value="ini" ${lookup.load === 'ini' ? 'selected' : ''}>ini</option>
                        </select>
                    </div>
                </div>
                <div class="lookup-form-group full-width">
                    <label>Text Data (required):</label>
                    <div class="lookup-data-editor" data-lookup-id="${lookup.id}"></div>
                </div>
            </div>
        `;

        this.elements.lookupsContainer.appendChild(container);

        // Initialize Monaco editor for this lookup
        this.initializeLookupEditor(lookup.id, lookup.textData || '', lookup.load);

        // Add event listeners
        const removeBtn = container.querySelector('.lookup-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeLookupItem(lookup.id);
        });

        // Add event listener for load format changes
        const loadSelect = container.querySelector('.lookup-load');
        loadSelect.addEventListener('change', (e) => {
            this.updateLookupEditorMode(lookup.id, e.target.value);
        });
    }

    initializeLookupEditor(lookupId, textData, loadFormat) {
        const editorContainer = document.querySelector(`[data-lookup-id="${lookupId}"]`);

        if (!editorContainer) return;

        // Choose language based on load format
        let language;
        switch (loadFormat) {
            case 'json':
                language = 'json';
                break;
            case 'yaml':
                language = 'yaml';
                break;
            case 'python':
            case 'csv':
            case 'ini':
            default:
                language = 'python'; // Use python for python dict format, plain for others
                break;
        }

        const editor = window.MonacoEditor.create(editorContainer, {
            value: textData,
            language: language,
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            fontSize: 13,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
        });

        this.lookupEditors.set(lookupId, editor);
    }

    updateLookupEditorMode(lookupId, loadFormat) {
        const editor = this.lookupEditors.get(lookupId);
        if (!editor) return;

        // Choose language and default content based on load format
        let language;
        let defaultContent = editor.getValue(); // Keep existing content

        switch (loadFormat) {
            case 'json':
                language = 'json';
                if (!defaultContent.trim()) {
                    defaultContent = `{
    "device1": {"ip": "192.168.1.1", "hostname": "router1"},
    "device2": {"ip": "192.168.1.2", "hostname": "router2"}
}`;
                }
                break;
            case 'yaml':
                language = 'yaml';
                if (!defaultContent.trim()) {
                    defaultContent = `device1:
  ip: 192.168.1.1
  hostname: router1
device2:
  ip: 192.168.1.2
  hostname: router2`;
                }
                break;
            case 'csv':
                language = 'plaintext';
                if (!defaultContent.trim()) {
                    defaultContent = `hostname,ip,device_type
router1,192.168.1.1,cisco
router2,192.168.1.2,cisco`;
                }
                break;
            case 'ini':
                language = 'plaintext';
                if (!defaultContent.trim()) {
                    defaultContent = `[device1]
hostname = router1
ip = 192.168.1.1

[device2]
hostname = router2
ip = 192.168.1.2`;
                }
                break;
            case 'python':
            default:
                language = 'python';
                if (!defaultContent.trim()) {
                    defaultContent = `{
    "device1": {"ip": "192.168.1.1", "hostname": "router1"},
    "device2": {"ip": "192.168.1.2", "hostname": "router2"}
}`;
                }
                break;
        }

        // Update the editor with new language and content
        editor.setValue(defaultContent);
        editor.setModel(window.MonacoEditor.createModel(defaultContent, language));
    }

    removeLookupItem(lookupId) {
        // Remove from lookups array
        this.lookupTables = this.lookupTables.filter(l => l.id !== lookupId);

        // Clean up editor
        if (this.lookupEditors.has(lookupId)) {
            this.lookupEditors.delete(lookupId);
        }

        // Remove DOM element
        const item = document.querySelector(`[data-id="${lookupId}"]`);
        if (item) {
            item.remove();
        }
    }

    async saveLookups() {
        // Collect lookup data from UI
        const lookups = [];

        this.lookupTables.forEach(lookup => {
            const container = document.querySelector(`[data-id="${lookup.id}"]`);
            if (!container) return;

            const name = container.querySelector('.lookup-name').value.trim();
            const load = container.querySelector('.lookup-load').value;

            // Get text data from editor
            let textData = '';
            if (this.lookupEditors.has(lookup.id)) {
                textData = this.lookupEditors.get(lookup.id).getValue();
            }

            if (name && textData.trim()) {
                lookups.push({
                    id: lookup.id,
                    name: name,
                    load: load,
                    textData: textData
                });
            }
        });

        try {
            // Update processor
            await this.ttpProcessor.setLookupTables(lookups);
            this.closeLookupsModal();

            // Trigger auto-process if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        } catch (error) {
            console.error('Error saving lookups:', error);
            alert('Error saving lookups: ' + error.message);
        }
    }

    async clearLookups() {
        this.lookupTables = [];
        this.lookupEditors.clear();
        this.elements.lookupsContainer.innerHTML = '';

        try {
            await this.ttpProcessor.clearLookupTables();

            // Trigger auto-process if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
        } catch (error) {
            console.error('Error clearing lookups:', error);
            alert('Error clearing lookups: ' + error.message);
        }
    }

    updateVarsEditorFormat() {
        if (!this.varsEditor) return;

        const format = this.elements.varsFormat.value;
        
        let language;
        let defaultContent;
        
        switch (format) {
            case 'yaml':
                language = 'yaml';
                defaultContent = `hostname: switch-1
domain: example.com
timezone: UTC`;
                break;
            case 'python':
                language = 'python';
                defaultContent = `{
    "hostname": "switch-1",
    "domain": "example.com", 
    "timezone": "UTC"
}`;
                break;
            default: // json
                language = 'json';
                defaultContent = `{
  "hostname": "switch-1",
  "domain": "example.com",
  "timezone": "UTC"
}`;
        }

        this.varsEditor.setValue(defaultContent);
        this.varsEditor.setModel(window.MonacoEditor.createModel(defaultContent, language));
    }

    saveGlobalVars() {
        if (!this.varsEditor) return;

        const varsText = this.varsEditor.getValue();
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
        
        resizeHandles.forEach((handle, index) => {
            let isResizing = false;
            let startX = 0;
            let startLeftWidth = 0;
            let startRightWidth = 0;
            let leftPane = null;
            let rightPane = null;
            
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                leftPane = handle.previousElementSibling;
                rightPane = handle.nextElementSibling;
                
                // Get current widths
                startLeftWidth = leftPane.offsetWidth;
                startRightWidth = rightPane.offsetWidth;
                
                // Add visual feedback
                handle.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
                e.stopPropagation();
            });
            
            const handleMouseMove = (e) => {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const containerWidth = leftPane.parentElement.offsetWidth;
                
                // Calculate new widths
                const newLeftWidth = startLeftWidth + deltaX;
                const newRightWidth = startRightWidth - deltaX;
                
                // Convert to percentages
                const leftPercentage = (newLeftWidth / containerWidth) * 100;
                const rightPercentage = (newRightWidth / containerWidth) * 100;
                
                // Apply constraints (minimum 15%, maximum 70% for each pane)
                if (leftPercentage >= 15 && leftPercentage <= 70 && 
                    rightPercentage >= 15 && rightPercentage <= 70) {
                    leftPane.style.flex = `0 0 ${leftPercentage}%`;
                    leftPane.style.width = leftPercentage + '%';
                    rightPane.style.flex = `0 0 ${rightPercentage}%`;
                    rightPane.style.width = rightPercentage + '%';
                }
            };
            
            const handleMouseUp = () => {
                isResizing = false;
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        });
    }

    validateInputs() {
        const dataValue = this.dataEditor ? this.dataEditor.getValue() : '';
        const templateValue = this.templateEditor ? this.templateEditor.getValue() : '';
        
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

        const dataValue = this.dataEditor.getValue();
        const templateValue = this.templateEditor.getValue();
        
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
        const format = this.elements.outputFormat.value;
        
        if (result.success) {
            let displayData = result.data;
            let language = 'json'; // Default to JSON for better folding
            
            // Handle different formats and set appropriate language
            if (format === 'table' && result.raw_results) {
                displayData = this.formatAsTable(result.raw_results);
                language = 'plaintext'; // Plain text
            } else if (format === 'yaml') {
                language = 'yaml';
            } else if (format === 'json') {
                language = 'json'; // Use proper JSON mode
            }
            
            console.log('Setting mode to:', format, 'Data length:', displayData?.length);
            
            // Update the result editor with new content and language
            this.updateResultEditor(displayData || 'No data returned', language);
            
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
                    const templateLines = this.templateEditor.getModel().getLineCount();
                    
                    // The error message uses 1-based line numbers, but Monaco uses 1-based too
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

    updateResultEditor(content, language = 'json') {
        // Set the content
        this.resultEditor.setValue(content);
        
        // Set the language
        window.MonacoLanguages.setLanguageConfiguration(language, {});
        this.resultEditor.setModel(window.MonacoEditor.createModel(content, language));
        
        console.log('Monaco content updated with proper JSON folding and search support');
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
            templateContainer.title = `Error at line ${lineNumber + 1}: ${message}`;
        }
        
        // Add error indicator to the pane header
        const templateHeader = document.querySelector('.template-pane .panel-header');
        if (templateHeader) {
            templateHeader.innerHTML = `<span class="panel-title">TTP Template <span style="color: #ff6666;">⚠ Error at line ${lineNumber + 1}</span></span>`;
        }
        
        // Add Monaco error marker
        this.addMonacoErrorMarker(lineNumber, message);
    }

    addMonacoErrorMarker(lineNumber, message) {
        // Clear any existing markers
        this.clearErrorMarkers();
        
        // Add Monaco error marker
        const model = this.templateEditor.getModel();
        if (model) {
            const lineContent = model.getLineContent(lineNumber + 1);
            const endColumn = lineContent.length + 1;
            
            // Add error marker using Monaco's decoration API
            const decorations = [{
                range: {
                    startLineNumber: lineNumber + 1,
                    startColumn: 1,
                    endLineNumber: lineNumber + 1,
                    endColumn: endColumn
                },
                options: {
                    className: 'monaco-error-line',
                    glyphMarginClassName: 'monaco-error-glyph',
                    hoverMessage: { value: `Error: ${message}` }
                }
            }];
            
            this.templateEditor.deltaDecorations([], decorations);
        }
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
        const templateHeader = document.querySelector('.template-pane .panel-header');
        if (templateHeader) {
            templateHeader.innerHTML = '<span class="panel-title">TTP Template</span>';
        }
        
        // Clear Monaco error markers
        if (this.templateEditor) {
            this.templateEditor.deltaDecorations(this.templateEditor.getModel().getAllDecorations(), []);
        }
        
        // Reset the error marker flag
        this.hasErrorMarker = false;
    }


    clearAll() {
        this.cancelAutoProcess();
        
        // Clear editors
        if (this.dataEditor) {
            this.dataEditor.setValue('');
        }
        
        if (this.templateEditor) {
            this.templateEditor.setValue('');
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
            this.dataEditor.setValue(example.data);
        }
        
        // Set template
        if (this.templateEditor) {
            this.templateEditor.setValue(example.template);
        }
        
        this.updateResultEditor('Example loaded. Processing...');
        this.updateStatus('Example loaded');
        
        if (this.isAutoProcessEnabled) {
            this.scheduleAutoProcess();
        }
    }

    downloadResults() {
        const content = this.resultEditor.getValue();
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
    
    // Set up global function for Monaco initialization
    window.initializeEditors = async () => {
        await editor.init();
        editor.hideLoadingOverlay();
    };
    
    // If Monaco is already loaded, initialize immediately
    if (window.MonacoEditor) {
        await editor.init();
        editor.hideLoadingOverlay();
    }
});
