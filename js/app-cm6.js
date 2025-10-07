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
        const { EditorView, EditorState, basicSetup, python, oneDark, searchKeymap, highlightSelectionMatches, keymap } = window.CodeMirror6;
        
        // Data input editor
        const dataState = EditorState.create({
            doc: this.elements.dataInput.value || '',
            extensions: [
                basicSetup,
                python(),
                oneDark,
                highlightSelectionMatches(),
                keymap.of(searchKeymap),
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
                highlightSelectionMatches(),
                keymap.of(searchKeymap),
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
        const { EditorView, EditorState, basicSetup, json, oneDark, foldGutter, foldKeymap, keymap, searchKeymap, highlightSelectionMatches } = window.CodeMirror6;
        
        // Clear the result output div first
        this.elements.resultOutput.innerHTML = '';
        
        // Custom extension to prevent editing but allow search
        const readOnlyExtension = EditorView.domEventHandlers({
            beforeinput: (event, view) => {
                // Allow search-related events but prevent content changes
                if (event.inputType === 'insertText' || 
                    event.inputType === 'insertCompositionText' ||
                    event.inputType === 'deleteContentBackward' ||
                    event.inputType === 'deleteContentForward') {
                    event.preventDefault();
                    return true;
                }
                return false;
            },
            keydown: (event, view) => {
                // Allow search shortcuts and navigation
                if (event.ctrlKey || event.metaKey) {
                    if (event.key === 'f' || event.key === 'g' || event.key === 'h') {
                        return false; // Allow search shortcuts
                    }
                }
                // Allow arrow keys, page up/down, home, end for navigation
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
                    return false;
                }
                // Prevent other key inputs that would modify content
                if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') {
                    event.preventDefault();
                    return true;
                }
                return false;
            }
        });
        
        // Setup result editor with CodeMirror 6 for better display and folding
        const resultState = EditorState.create({
            doc: 'Results will appear here after processing...',
            extensions: [
                basicSetup,
                json(), // Use JSON mode for better folding
                oneDark,
                highlightSelectionMatches(),
                keymap.of([...foldKeymap, ...searchKeymap]), // Add fold and search keyboard shortcuts
                readOnlyExtension, // Custom read-only extension that allows search
                EditorView.theme({
                    "&": { height: "100%" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        });
        
        this.resultEditor = new EditorView({
            state: resultState,
            parent: this.elements.resultOutput
        });
        
        console.log('CodeMirror 6 result editor initialized with JSON folding and search support');
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

        // Initialize CodeMirror editor for this function
        this.initializeFunctionEditor(func.id, func.code || '');

        // Add event listeners for remove button
        const removeBtn = container.querySelector('.function-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFunctionItem(func.id);
        });
    }

    initializeFunctionEditor(functionId, code) {
        const { EditorView, EditorState, basicSetup, python, oneDark } = window.CodeMirror6;
        const editorContainer = document.querySelector(`[data-function-id="${functionId}"]`);

        if (!editorContainer) return;

        const editor = new EditorView({
            state: EditorState.create({
                doc: code,
                extensions: [
                    basicSetup,
                    python(),
                    oneDark,
                    EditorView.theme({
                        "&": { height: "200px" },
                        ".cm-scroller": { overflow: "auto" }
                    })
                ]
            }),
            parent: editorContainer
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
                code = this.functionEditors.get(func.id).state.doc.toString();
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

        // Initialize CodeMirror editor for this lookup
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
        const { EditorView, EditorState, basicSetup, json, yaml, python, oneDark } = window.CodeMirror6;
        const editorContainer = document.querySelector(`[data-lookup-id="${lookupId}"]`);

        if (!editorContainer) return;

        // Choose language extension based on load format
        let languageExtension;
        switch (loadFormat) {
            case 'json':
                languageExtension = json();
                break;
            case 'yaml':
                languageExtension = yaml();
                break;
            case 'python':
            case 'csv':
            case 'ini':
            default:
                languageExtension = python(); // Use python for python dict format, plain for others
                break;
        }

        const editor = new EditorView({
            state: EditorState.create({
                doc: textData,
                extensions: [
                    basicSetup,
                    languageExtension,
                    oneDark,
                    EditorView.theme({
                        "&": { height: "200px" },
                        ".cm-scroller": { overflow: "auto" }
                    })
                ]
            }),
            parent: editorContainer
        });

        this.lookupEditors.set(lookupId, editor);
    }

    updateLookupEditorMode(lookupId, loadFormat) {
        const editor = this.lookupEditors.get(lookupId);
        if (!editor) return;

        const { EditorView, EditorState, basicSetup, json, yaml, python, oneDark } = window.CodeMirror6;

        // Choose language extension and default content based on load format
        let languageExtension;
        let defaultContent = editor.state.doc.toString(); // Keep existing content

        switch (loadFormat) {
            case 'json':
                languageExtension = json();
                if (!defaultContent.trim()) {
                    defaultContent = `{
    "device1": {"ip": "192.168.1.1", "hostname": "router1"},
    "device2": {"ip": "192.168.1.2", "hostname": "router2"}
}`;
                }
                break;
            case 'yaml':
                languageExtension = yaml();
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
                languageExtension = python(); // Plain text
                if (!defaultContent.trim()) {
                    defaultContent = `hostname,ip,device_type
router1,192.168.1.1,cisco
router2,192.168.1.2,cisco`;
                }
                break;
            case 'ini':
                languageExtension = python(); // Plain text
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
                languageExtension = python();
                if (!defaultContent.trim()) {
                    defaultContent = `{
    "device1": {"ip": "192.168.1.1", "hostname": "router1"},
    "device2": {"ip": "192.168.1.2", "hostname": "router2"}
}`;
                }
                break;
        }

        const newState = EditorState.create({
            doc: defaultContent,
            extensions: [
                basicSetup,
                languageExtension,
                oneDark,
                EditorView.theme({
                    "&": { height: "200px" },
                    ".cm-scroller": { overflow: "auto" }
                })
            ]
        });

        editor.setState(newState);
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
                textData = this.lookupEditors.get(lookup.id).state.doc.toString();
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
        console.log('Found resize handles:', resizeHandles.length);
        
        resizeHandles.forEach((handle, index) => {
            console.log(`Setting up resize handle ${index}:`, handle);
            let isResizing = false;
            let startX = 0;
            let startLeftWidth = 0;
            let startRightWidth = 0;
            let leftPane = null;
            let rightPane = null;
            
            handle.addEventListener('mousedown', (e) => {
                console.log('Resize handle mousedown triggered');
                isResizing = true;
                startX = e.clientX;
                leftPane = handle.previousElementSibling;
                rightPane = handle.nextElementSibling;
                console.log('Left pane:', leftPane, 'Right pane:', rightPane);
                
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
        const { EditorView, EditorState, basicSetup, json, oneDark, foldGutter, foldKeymap, keymap, searchKeymap, highlightSelectionMatches } = window.CodeMirror6;
        
        // Custom extension to prevent editing but allow search
        const readOnlyExtension = EditorView.domEventHandlers({
            beforeinput: (event, view) => {
                // Allow search-related events but prevent content changes
                if (event.inputType === 'insertText' || 
                    event.inputType === 'insertCompositionText' ||
                    event.inputType === 'deleteContentBackward' ||
                    event.inputType === 'deleteContentForward') {
                    event.preventDefault();
                    return true;
                }
                return false;
            },
            keydown: (event, view) => {
                // Allow search shortcuts and navigation
                if (event.ctrlKey || event.metaKey) {
                    if (event.key === 'f' || event.key === 'g' || event.key === 'h') {
                        return false; // Allow search shortcuts
                    }
                }
                // Allow arrow keys, page up/down, home, end for navigation
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
                    return false;
                }
                // Prevent other key inputs that would modify content
                if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') {
                    event.preventDefault();
                    return true;
                }
                return false;
            }
        });
        
        const extensions = [
            basicSetup,
            oneDark,
            highlightSelectionMatches(),
            keymap.of([...foldKeymap, ...searchKeymap]), // Add fold and search keyboard shortcuts
            readOnlyExtension, // Custom read-only extension that allows search
            EditorView.theme({
                "&": { height: "100%" },
                ".cm-scroller": { overflow: "auto" }
            })
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
        
        console.log('CodeMirror 6 content updated with proper JSON folding and search support');
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
