class TTPEditor {
    constructor() {
        console.log('Initializing TTP Editor with Monaco Editor...');
        
        this.elements = {};
        this.ttpProcessor = null;
        
        // Monaco editors
        this.dataEditor = null;
        this.templateEditor = null;
        this.resultEditor = null;
        
        // Error decoration tracking
        this.errorDecorationIds = [];
        
        // URL configuration management
        this.urlConfig = null;
        this.workspaceName = null;
        
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

    registerTTPLanguage() {
        // Register TTP language
        window.MonacoLanguages.register({ id: 'ttp' });
        
        // Set language configuration
        window.MonacoLanguages.setLanguageConfiguration('ttp', {
            comments: {
                lineComment: '#',
                blockComment: ['{#', '#}']
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
                ['<', '>'],
                ['"', '"'],
                ["'", "'"]
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ]
        });

        // Set token provider
        window.MonacoLanguages.setMonarchTokensProvider('ttp', {
            tokenizer: {
                root: [
                    // TTP comments
                    [/{#.*?#}/, 'comment.ttp'],
                    
                    // XML-like template tags
                    [/<template\s+name\s*=\s*["'][^"']*["']/, 'keyword.template'],
                    [/<template\s+name\s*=\s*[^>]*>/, 'keyword.template'],
                    [/<template[^>]*>/, 'keyword.template'],
                    [/<\/template>/, 'keyword.template'],
                    
                    // Group tags
                    [/<group[^>]*>/, 'keyword.group'],
                    [/<\/group>/, 'keyword.group'],
                    
                    // Macro tags
                    [/<macro[^>]*>/, 'keyword.macro'],
                    [/<\/macro>/, 'keyword.macro'],
                    
                    // Doc tags
                    [/<doc[^>]*>/, 'keyword.doc'],
                    [/<\/doc>/, 'keyword.doc'],
                    
                    // TTP variable syntax
                    [/{{[^}]+}}/, 'variable.ttp'],
                    
                    // String literals
                    [/"[^"]*"/, 'string'],
                    [/'[^']*'/, 'string'],
                    
                    // Numbers
                    [/\d+\.?\d*/, 'number'],
                    
                    // TTP-specific functions
                    [/\b(to_int|to_float|to_string|re|contains|split|join|strip|upper|lower|replace|match|search|findall|sub|subn|escape|unescape|base64|unbase64|md5|sha1|sha256|sha512|uuid|timestamp|datetime|now|today|yesterday|tomorrow|strftime|strptime|timezone|utc|local|isoformat|fromisoformat|timedelta|total_seconds|days|seconds|microseconds|max|min|sum|len|sorted|reversed|enumerate|zip|map|filter|reduce|any|all|bool|int|float|str|list|dict|set|tuple|type|isinstance|issubclass|hasattr|getattr|setattr|delattr|dir|vars|locals|globals|callable|eval|exec|compile|open|file|input|print|range|xrange|iter|next|iteritems|iterkeys|itervalues|items|keys|values|pop|popitem|clear|copy|update|setdefault|get|fromkeys|index|count|append|extend|insert|remove|reverse|sort)\b/, 'function.ttp'],
                    
                    // Python keywords (for macro content)
                    [/\b(and|as|assert|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|raise|return|try|while|with|yield|True|False|None)\b/, 'keyword.python'],
                    
                    // Operators
                    [/[+\-*/%=<>!&|^~]/, 'operator'],
                    
                    // Punctuation
                    [/[.,;:(){}[\]<>]/, 'punctuation'],
                    
                    // Identifiers
                    [/\b[a-zA-Z_][a-zA-Z0-9_]*\b/, 'identifier']
                ]
            }
        });

        // Register completion provider
        window.MonacoLanguages.registerCompletionItemProvider('ttp', {
            triggerCharacters: ['{', '|', ' ', '<', '>', '(', ')', '"', "'"],
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const suggestions = [
                    // TTP template structure
                    {
                        label: 'template',
                        kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                        insertText: '<template name="${1:template_name}">\n\t${2:template_content}\n</template>',
                        insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'TTP template definition',
                        range: range
                    },
                    {
                        label: 'group',
                        kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                        insertText: '<group name="${1:group_name}">\n\t${2:group_content}\n</group>',
                        insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'TTP group definition',
                        range: range
                    },
                    {
                        label: 'macro',
                        kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                        insertText: '<macro name="${1:macro_name}">\n\t${2:macro_content}\n</macro>',
                        insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: 'TTP macro definition',
                        range: range
                    },
                    
                    // TTP functions
                    { label: 'to_int', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to integer', range: range },
                    { label: 'to_float', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to float' },
                    { label: 'to_string', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to string' },
                    { label: 're', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Regular expression matching' },
                    { label: 'contains', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if text contains substring' },
                    { label: 'split', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Split text by delimiter' },
                    { label: 'join', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Join list elements' },
                    { label: 'strip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Strip whitespace' },
                    { label: 'upper', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to uppercase' },
                    { label: 'lower', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to lowercase' },
                    { label: 'replace', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Replace text' },
                    { label: 'match', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Match pattern' },
                    { label: 'search', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Search pattern' },
                    { label: 'findall', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Find all matches' },
                    { label: 'sub', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Substitute pattern' },
                    { label: 'subn', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Substitute pattern with count' },
                    { label: 'escape', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Escape special characters' },
                    { label: 'unescape', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Unescape special characters' },
                    { label: 'base64', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Base64 encode' },
                    { label: 'unbase64', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Base64 decode' },
                    { label: 'md5', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'MD5 hash' },
                    { label: 'sha1', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'SHA1 hash' },
                    { label: 'sha256', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'SHA256 hash' },
                    { label: 'sha512', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'SHA512 hash' },
                    { label: 'uuid', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Generate UUID' },
                    { label: 'timestamp', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Current timestamp' },
                    { label: 'datetime', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Current datetime' },
                    { label: 'now', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Current time' },
                    { label: 'today', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Today\'s date' },
                    { label: 'yesterday', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Yesterday\'s date' },
                    { label: 'tomorrow', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Tomorrow\'s date' },
                    { label: 'strftime', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Format datetime' },
                    { label: 'strptime', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Parse datetime' },
                    { label: 'timezone', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Timezone conversion' },
                    { label: 'utc', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'UTC timezone' },
                    { label: 'local', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Local timezone' },
                    { label: 'isoformat', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'ISO format datetime' },
                    { label: 'fromisoformat', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Parse ISO format' },
                    { label: 'timedelta', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Time difference' },
                    { label: 'total_seconds', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Total seconds' },
                    { label: 'days', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Days component' },
                    { label: 'seconds', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Seconds component' },
                    { label: 'microseconds', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Microseconds component' },
                    { label: 'max', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Maximum value' },
                    { label: 'min', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Minimum value' },
                    { label: 'sum', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sum of values' },
                    { label: 'len', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Length of object' },
                    { label: 'sorted', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sort iterable' },
                    { label: 'reversed', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Reverse iterable' },
                    { label: 'enumerate', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Enumerate with index' },
                    { label: 'zip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Zip iterables' },
                    { label: 'map', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Map function to iterable' },
                    { label: 'filter', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Filter iterable' },
                    { label: 'reduce', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Reduce iterable' },
                    { label: 'any', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Any true value' },
                    { label: 'all', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'All true values' },
                    { label: 'bool', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to boolean' },
                    { label: 'int', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to integer' },
                    { label: 'float', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to float' },
                    { label: 'str', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to string' },
                    { label: 'list', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to list' },
                    { label: 'dict', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to dictionary' },
                    { label: 'set', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to set' },
                    { label: 'tuple', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to tuple' },
                    { label: 'type', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get type of object' },
                    { label: 'isinstance', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check instance type' },
                    { label: 'issubclass', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check subclass' },
                    { label: 'hasattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check attribute exists' },
                    { label: 'getattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get attribute' },
                    { label: 'setattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Set attribute' },
                    { label: 'delattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Delete attribute' },
                    { label: 'dir', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'List attributes' },
                    { label: 'vars', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get variables' },
                    { label: 'locals', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Local variables' },
                    { label: 'globals', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Global variables' },
                    { label: 'callable', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if callable' },
                    { label: 'eval', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Evaluate expression' },
                    { label: 'exec', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Execute code' },
                    { label: 'compile', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Compile code' },
                    { label: 'open', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Open file' },
                    { label: 'file', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'File object' },
                    { label: 'input', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get user input' },
                    { label: 'print', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Print output' },
                    { label: 'range', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Generate range' },
                    { label: 'xrange', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Generate range (Python 2)' },
                    { label: 'iter', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Create iterator' },
                    { label: 'next', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get next item' },
                    { label: 'iteritems', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Iterate items' },
                    { label: 'iterkeys', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Iterate keys' },
                    { label: 'itervalues', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Iterate values' },
                    { label: 'items', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get items' },
                    { label: 'keys', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get keys' },
                    { label: 'values', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get values' },
                    { label: 'pop', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Pop item' },
                    { label: 'popitem', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Pop arbitrary item' },
                    { label: 'clear', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Clear collection' },
                    { label: 'copy', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Copy collection' },
                    { label: 'update', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Update collection' },
                    { label: 'setdefault', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Set default value' },
                    { label: 'get', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get value with default' },
                    { label: 'fromkeys', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Create from keys' },
                    { label: 'index', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get index' },
                    { label: 'count', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Count occurrences' },
                    { label: 'append', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Append item' },
                    { label: 'extend', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Extend list' },
                    { label: 'insert', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Insert item' },
                    { label: 'remove', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Remove item' },
                    { label: 'reverse', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Reverse list' },
                    { label: 'sort', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sort list' }
                ];
                
                // Add range to all suggestions
                suggestions.forEach(suggestion => {
                    if (!suggestion.range) {
                        suggestion.range = range;
                    }
                });
                
                console.log('TTP completion triggered:', suggestions.length, 'suggestions');
                return { suggestions };
            }
        });

        // Register hover provider
        window.MonacoLanguages.registerHoverProvider('ttp', {
            provideHover: (model, position) => {
                const word = model.getWordAtPosition(position);
                if (!word) return null;

                const wordText = word.word;
                
                // TTP function documentation
                const ttpFunctions = {
                    'to_int': 'Convert value to integer',
                    'to_float': 'Convert value to float',
                    'to_string': 'Convert value to string',
                    're': 'Regular expression matching',
                    'contains': 'Check if text contains substring',
                    'split': 'Split text by delimiter',
                    'join': 'Join list elements',
                    'strip': 'Strip whitespace',
                    'upper': 'Convert to uppercase',
                    'lower': 'Convert to lowercase',
                    'replace': 'Replace text',
                    'match': 'Match pattern',
                    'search': 'Search pattern',
                    'findall': 'Find all matches',
                    'sub': 'Substitute pattern',
                    'subn': 'Substitute pattern with count',
                    'escape': 'Escape special characters',
                    'unescape': 'Unescape special characters',
                    'base64': 'Base64 encode',
                    'unbase64': 'Base64 decode',
                    'md5': 'MD5 hash',
                    'sha1': 'SHA1 hash',
                    'sha256': 'SHA256 hash',
                    'sha512': 'SHA512 hash',
                    'uuid': 'Generate UUID',
                    'timestamp': 'Current timestamp',
                    'datetime': 'Current datetime',
                    'now': 'Current time',
                    'today': 'Today\'s date',
                    'yesterday': 'Yesterday\'s date',
                    'tomorrow': 'Tomorrow\'s date',
                    'strftime': 'Format datetime',
                    'strptime': 'Parse datetime',
                    'timezone': 'Timezone conversion',
                    'utc': 'UTC timezone',
                    'local': 'Local timezone',
                    'isoformat': 'ISO format datetime',
                    'fromisoformat': 'Parse ISO format',
                    'timedelta': 'Time difference',
                    'total_seconds': 'Total seconds',
                    'days': 'Days component',
                    'seconds': 'Seconds component',
                    'microseconds': 'Microseconds component',
                    'max': 'Maximum value',
                    'min': 'Minimum value',
                    'sum': 'Sum of values',
                    'len': 'Length of object',
                    'sorted': 'Sort iterable',
                    'reversed': 'Reverse iterable',
                    'enumerate': 'Enumerate with index',
                    'zip': 'Zip iterables',
                    'map': 'Map function to iterable',
                    'filter': 'Filter iterable',
                    'reduce': 'Reduce iterable',
                    'any': 'Any true value',
                    'all': 'All true values',
                    'bool': 'Convert to boolean',
                    'int': 'Convert to integer',
                    'float': 'Convert to float',
                    'str': 'Convert to string',
                    'list': 'Convert to list',
                    'dict': 'Convert to dictionary',
                    'set': 'Convert to set',
                    'tuple': 'Convert to tuple',
                    'type': 'Get type of object',
                    'isinstance': 'Check instance type',
                    'issubclass': 'Check subclass',
                    'hasattr': 'Check attribute exists',
                    'getattr': 'Get attribute',
                    'setattr': 'Set attribute',
                    'delattr': 'Delete attribute',
                    'dir': 'List attributes',
                    'vars': 'Get variables',
                    'locals': 'Local variables',
                    'globals': 'Global variables',
                    'callable': 'Check if callable',
                    'eval': 'Evaluate expression',
                    'exec': 'Execute code',
                    'compile': 'Compile code',
                    'open': 'Open file',
                    'file': 'File object',
                    'input': 'Get user input',
                    'print': 'Print output',
                    'range': 'Generate range',
                    'xrange': 'Generate range (Python 2)',
                    'iter': 'Create iterator',
                    'next': 'Get next item',
                    'iteritems': 'Iterate items',
                    'iterkeys': 'Iterate keys',
                    'itervalues': 'Iterate values',
                    'items': 'Get items',
                    'keys': 'Get keys',
                    'values': 'Get values',
                    'pop': 'Pop item',
                    'popitem': 'Pop arbitrary item',
                    'clear': 'Clear collection',
                    'copy': 'Copy collection',
                    'update': 'Update collection',
                    'setdefault': 'Set default value',
                    'get': 'Get value with default',
                    'fromkeys': 'Create from keys',
                    'index': 'Get index',
                    'count': 'Count occurrences',
                    'append': 'Append item',
                    'extend': 'Extend list',
                    'insert': 'Insert item',
                    'remove': 'Remove item',
                    'reverse': 'Reverse list',
                    'sort': 'Sort list'
                };

                if (ttpFunctions[wordText]) {
                    return {
                        range: new window.MonacoEditor.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                        contents: [
                            { value: `**${wordText}**` },
                            { value: ttpFunctions[wordText] }
                        ]
                    };
                }

                return null;
            }
        });

        console.log('TTP language registered with Monaco Editor');
    }

    async init() {
        console.log('TTP Editor init started');
        
        // Wait for Monaco Editor to load
        while (!window.MonacoEditor) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('Monaco Editor available');
        
        // Register TTP language
        this.registerTTPLanguage();
        
        this.setupUI();
        this.setupEventListeners();
        await this.setupCodeEditors();
        this.setupPaneResizing();
        
        // Initialize TTP processor
        this.ttpProcessor = new TTPProcessor();
        await this.ttpProcessor.initialize();
        
        this.setupResultEditor();
        
        // Load configuration from URL parameters
        this.loadConfigurationFromURL();
        
        // Apply stored URL configuration now that editors are ready
        if (this.urlConfig) {
            this.applyConfiguration(this.urlConfig);
            this.urlConfig = null; // Clear after applying
        }
        
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
            cancelLookupsBtn: document.getElementById('cancelLookupsBtn'),
            // URL/Sharing elements
            shareBtn: document.getElementById('shareBtn'),
            exportBtn: document.getElementById('exportBtn'),
            importBtn: document.getElementById('importBtn'),
            importFile: document.getElementById('importFile'),
            saveWorkspaceBtn: document.getElementById('saveWorkspaceBtn'),
            loadWorkspaceBtn: document.getElementById('loadWorkspaceBtn'),
            // Documentation elements
            docsBtn: document.getElementById('docsBtn')
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
            language: 'ttp',
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
            // Clear error markers when template changes
            this.clearErrorMarkers();
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

        // URL/Sharing functionality
        this.setupURLSharing();
        
        // Export/Import functionality
        this.setupExportImport();
        
        // Documentation functionality
        this.setupDocumentation();

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

    setupURLSharing() {
        // Share button
        this.elements.shareBtn.addEventListener('click', async () => {
            const success = await this.copyShareableURL();
            if (success) {
                this.updateStatus('Shareable URL copied to clipboard!');
            } else {
                this.updateStatus('Failed to copy URL to clipboard');
            }
        });

        // Save workspace button
        this.elements.saveWorkspaceBtn.addEventListener('click', () => {
            const name = prompt('Enter workspace name:', 'workspace_' + Date.now());
            if (name) {
                this.saveWorkspace(name);
                this.updateStatus(`Workspace '${name}' saved`);
            }
        });

        // Load workspace button
        this.elements.loadWorkspaceBtn.addEventListener('click', () => {
            // Get list of saved workspaces
            const workspaces = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('ttp_workspace_')) {
                    const name = key.replace('ttp_workspace_', '');
                    workspaces.push(name);
                }
            }

            if (workspaces.length === 0) {
                alert('No saved workspaces found');
                return;
            }

            const name = prompt(`Enter workspace name to load:\n\nAvailable: ${workspaces.join(', ')}`);
            if (name) {
                this.loadWorkspace(name);
                this.updateStatus(`Workspace '${name}' loaded`);
            }
        });
    }

    setupExportImport() {
        // Export button
        this.elements.exportBtn.addEventListener('click', () => {
            this.exportConfiguration();
        });

        // Import button
        this.elements.importBtn.addEventListener('click', () => {
            this.elements.importFile.click();
        });

        // File input change handler
        this.elements.importFile.addEventListener('change', (e) => {
            this.importConfiguration(e.target.files[0]);
        });
    }

    setupDocumentation() {
        // Update documentation button with TTP version when processor is ready
        if (this.ttpProcessor) {
            this.updateDocumentationVersion();
        } else {
            // Wait for processor to be initialized
            const checkProcessor = () => {
                if (this.ttpProcessor) {
                    this.updateDocumentationVersion();
                } else {
                    setTimeout(checkProcessor, 100);
                }
            };
            checkProcessor();
        }
    }

    async updateDocumentationVersion() {
        try {
            // Get TTP version from the processor
            const version = await this.ttpProcessor.getTTPVersion();
            if (version && this.elements.docsBtn) {
                this.elements.docsBtn.title = `TTP Documentation (v${version})`;
                this.elements.docsBtn.href = `https://ttp.readthedocs.io/en/latest/`;
                console.log(`TTP version detected: ${version}`);
            }
        } catch (error) {
            console.warn('Could not get TTP version:', error);
            // Fallback to default
            if (this.elements.docsBtn) {
                this.elements.docsBtn.title = 'TTP Documentation';
                this.elements.docsBtn.href = 'https://ttp.readthedocs.io/en/latest/';
            }
        }
    }

    exportConfiguration() {
        const config = {
            data: this.dataEditor ? this.dataEditor.getValue() : '',
            template: this.templateEditor ? this.templateEditor.getValue() : '',
            vars: this.getCurrentVars(),
            functions: this.functions,
            lookups: this.lookupTables,
            outputFormat: this.elements.outputFormat ? this.elements.outputFormat.value : 'json',
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        const configString = JSON.stringify(config, null, 2);
        const blob = new Blob([configString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ttp-config-${new Date().toISOString().split('T')[0]}.ttp.export`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateStatus('Configuration exported successfully');
        console.log('Configuration exported');
    }

    importConfiguration(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // Validate the configuration structure
                if (this.validateImportedConfig(config)) {
                    this.applyConfiguration(config);
                    this.updateStatus('Configuration imported successfully');
                    console.log('Configuration imported:', config);
                } else {
                    this.updateStatus('Invalid configuration file format');
                    console.error('Invalid configuration file format');
                }
            } catch (error) {
                this.updateStatus('Error reading configuration file: ' + error.message);
                console.error('Error reading configuration file:', error);
            }
        };
        
        reader.readAsText(file);
    }

    validateImportedConfig(config) {
        // Check if it's a valid TTP configuration
        if (typeof config !== 'object' || config === null) {
            return false;
        }

        // Check for required fields (at least one should be present)
        const hasData = typeof config.data === 'string';
        const hasTemplate = typeof config.template === 'string';
        const hasVars = typeof config.vars === 'object' && config.vars !== null;
        const hasFunctions = Array.isArray(config.functions);
        const hasLookups = Array.isArray(config.lookups);
        const hasOutputFormat = typeof config.outputFormat === 'string';

        // At least one main field should be present
        return hasData || hasTemplate || hasVars || hasFunctions || hasLookups || hasOutputFormat;
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
            console.error('Error stack:', error.stack);
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
                    
                    // Validate that we have a template editor and model
                    if (this.templateEditor && this.templateEditor.getModel()) {
                        const templateLines = this.templateEditor.getModel().getLineCount();
                        
                        // Ensure line number is within valid range
                        let lineNumber = Math.max(0, Math.min(reportedLine - 1, templateLines - 1));
                        
                        // Only show error marker if we don't already have one
                        if (!this.hasErrorMarker) {
                            this.showErrorMarker(lineNumber, result.error.message);
                            this.hasErrorMarker = true;
                        }
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
        
        // Add Monaco error marker only if template editor is available
        if (this.templateEditor && this.templateEditor.getModel()) {
            this.addMonacoErrorMarker(lineNumber, message);
        } else {
            console.warn('Template editor not available for error marking');
        }
    }

    addMonacoErrorMarker(lineNumber, message) {
        // Clear any existing markers
        this.clearErrorMarkers();
        
        // Add Monaco error marker
        const model = this.templateEditor.getModel();
        if (model) {
            const totalLines = model.getLineCount();
            
            // Ensure line number is within valid range (Monaco uses 1-based line numbers)
            const validLineNumber = Math.max(1, Math.min(lineNumber + 1, totalLines));
            
            try {
                const lineContent = model.getLineContent(validLineNumber);
                const endColumn = lineContent.length + 1;
                
                // Add error marker using Monaco's decoration API
                const decorations = [{
                    range: {
                        startLineNumber: validLineNumber,
                        startColumn: 1,
                        endLineNumber: validLineNumber,
                        endColumn: endColumn
                    },
                    options: {
                        className: 'monaco-error-line',
                        glyphMarginClassName: 'monaco-error-glyph',
                        hoverMessage: { value: `Error: ${message}` }
                    }
                }];
                
                const decorationIds = this.templateEditor.deltaDecorations([], decorations);
                this.errorDecorationIds = decorationIds;
                console.log(`Added error marker at line ${validLineNumber} (original: ${lineNumber + 1})`);
            } catch (error) {
                console.error('Error adding Monaco error marker:', error);
                // Fallback: just show the error in the pane header without line marker
            }
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
        
        // Clear Monaco error markers using stored decoration IDs
        if (this.templateEditor && this.errorDecorationIds.length > 0) {
            this.templateEditor.deltaDecorations(this.errorDecorationIds, []);
            this.errorDecorationIds = [];
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

    // URL Configuration Management
    loadConfigurationFromURL() {
        console.log('Loading configuration from URL...');
        const urlParams = new URLSearchParams(window.location.search);
        const config = {};
        
        console.log('URL parameters:', Array.from(urlParams.entries()));
        
        // Parse individual parameters
        if (urlParams.has('data')) {
            config.data = this.decodeBase64(urlParams.get('data'));
            console.log('Found data parameter, length:', config.data.length);
        }
        
        if (urlParams.has('template')) {
            config.template = this.decodeBase64(urlParams.get('template'));
            console.log('Found template parameter, length:', config.template.length);
        }
        
        if (urlParams.has('vars')) {
            try {
                const varsParam = urlParams.get('vars');
                config.vars = varsParam.startsWith('{') ? 
                    JSON.parse(varsParam) : 
                    JSON.parse(this.decodeBase64(varsParam));
                console.log('Found vars parameter:', config.vars);
            } catch (error) {
                console.warn('Failed to parse vars parameter:', error);
            }
        }
        
        if (urlParams.has('functions')) {
            try {
                const functionsParam = urlParams.get('functions');
                config.functions = functionsParam.startsWith('[') ? 
                    JSON.parse(functionsParam) : 
                    JSON.parse(this.decodeBase64(functionsParam));
                console.log('Found functions parameter, count:', config.functions.length);
            } catch (error) {
                console.warn('Failed to parse functions parameter:', error);
            }
        }
        
        if (urlParams.has('lookups')) {
            try {
                const lookupsParam = urlParams.get('lookups');
                config.lookups = lookupsParam.startsWith('[') ? 
                    JSON.parse(lookupsParam) : 
                    JSON.parse(this.decodeBase64(lookupsParam));
                console.log('Found lookups parameter, count:', config.lookups.length);
            } catch (error) {
                console.warn('Failed to parse lookups parameter:', error);
            }
        }
        
        if (urlParams.has('format')) {
            config.outputFormat = urlParams.get('format');
            console.log('Found format parameter:', config.outputFormat);
        }
        
        // Parse full configuration
        if (urlParams.has('config')) {
            try {
                const configParam = this.decodeBase64(urlParams.get('config'));
                const fullConfig = JSON.parse(configParam);
                Object.assign(config, fullConfig);
                console.log('Found config parameter, keys:', Object.keys(fullConfig));
            } catch (error) {
                console.warn('Failed to parse config parameter:', error);
            }
        }
        
        // Parse share ID and load from localStorage
        if (urlParams.has('share')) {
            try {
                const shareId = urlParams.get('share');
                const shareData = localStorage.getItem(`ttp_share_${shareId}`);
                if (shareData) {
                    const shareConfig = JSON.parse(shareData);
                    Object.assign(config, shareConfig);
                    console.log('Found share parameter, loaded config with keys:', Object.keys(shareConfig));
                } else {
                    console.warn('Share ID not found in localStorage:', shareId);
                }
            } catch (error) {
                console.warn('Failed to parse share parameter:', error);
            }
        }
        
        // Load workspace from localStorage
        if (urlParams.has('workspace')) {
            this.workspaceName = urlParams.get('workspace');
            this.loadWorkspace(this.workspaceName);
        }
        
        // Store configuration for later application when editors are ready
        if (Object.keys(config).length > 0) {
            this.urlConfig = config;
            console.log('URL configuration loaded, will apply when editors are ready:', config);
        } else {
            console.log('No URL configuration found');
        }
    }

    applyConfiguration(config) {
        console.log('Applying configuration:', config);
        
        try {
            // Apply data
            if (config.data && this.dataEditor) {
                this.dataEditor.setValue(config.data);
            }
            
            // Apply template
            if (config.template && this.templateEditor) {
                this.templateEditor.setValue(config.template);
            }
            
            // Apply variables
            if (config.vars) {
                this.applyVariables(config.vars);
            }
            
            // Apply functions
            if (config.functions) {
                this.applyFunctions(config.functions);
            }
            
            // Apply lookups
            if (config.lookups) {
                this.applyLookups(config.lookups);
            }
            
            // Apply output format
            if (config.outputFormat && this.elements.outputFormat) {
                this.elements.outputFormat.value = config.outputFormat;
            }
            
            // Trigger auto-process if enabled
            if (this.isAutoProcessEnabled) {
                this.scheduleAutoProcess();
            }
            
            console.log('Configuration applied successfully');
        } catch (error) {
            console.error('Error applying configuration:', error);
            this.updateStatus('Error loading configuration from URL');
        }
    }

    applyVariables(vars) {
        if (typeof vars === 'object' && vars !== null) {
            // Convert to JSON string for the vars editor
            const varsString = JSON.stringify(vars, null, 2);
            if (this.varsEditor) {
                this.varsEditor.setValue(varsString);
            }
        }
    }

    applyFunctions(functions) {
        if (Array.isArray(functions)) {
            this.functions = functions.map((func, index) => ({
                id: `func_${++this.functionCounter}`,
                scope: func.scope || 'match',
                name: func.name || '',
                add_ttp: func.add_ttp || false,
                code: func.code || ''
            }));
        }
    }

    applyLookups(lookups) {
        if (Array.isArray(lookups)) {
            this.lookupTables = lookups.map((lookup, index) => ({
                id: `lookup_${++this.lookupCounter}`,
                name: lookup.name || '',
                load: lookup.load || 'python',
                textData: lookup.textData || ''
            }));
        }
    }

    // Base64 utilities
    encodeBase64(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch (error) {
            console.error('Base64 encoding error:', error);
            return '';
        }
    }

    decodeBase64(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch (error) {
            console.error('Base64 decoding error:', error);
            return '';
        }
    }

    // Workspace management
    saveWorkspace(name = 'default') {
        const workspace = {
            data: this.dataEditor ? this.dataEditor.getValue() : '',
            template: this.templateEditor ? this.templateEditor.getValue() : '',
            vars: this.getCurrentVars(),
            functions: this.functions,
            lookups: this.lookupTables,
            outputFormat: this.elements.outputFormat ? this.elements.outputFormat.value : 'json',
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`ttp_workspace_${name}`, JSON.stringify(workspace));
        console.log(`Workspace '${name}' saved`);
    }

    loadWorkspace(name = 'default') {
        const workspaceData = localStorage.getItem(`ttp_workspace_${name}`);
        if (workspaceData) {
            try {
                const workspace = JSON.parse(workspaceData);
                this.applyConfiguration(workspace);
                console.log(`Workspace '${name}' loaded`);
            } catch (error) {
                console.error('Failed to load workspace:', error);
            }
        }
    }

    getCurrentVars() {
        if (this.varsEditor) {
            try {
                return JSON.parse(this.varsEditor.getValue());
            } catch (error) {
                return {};
            }
        }
        return {};
    }

    // Generate shareable URL
    generateShareableURL() {
        const config = {
            data: this.dataEditor ? this.dataEditor.getValue() : '',
            template: this.templateEditor ? this.templateEditor.getValue() : '',
            vars: this.getCurrentVars(),
            functions: this.functions,
            lookups: this.lookupTables,
            outputFormat: this.elements.outputFormat ? this.elements.outputFormat.value : 'json'
        };
        
        const configString = JSON.stringify(config);
        const configSize = configString.length;
        
        // For small configurations, use base64 in URL (works across devices)
        if (configSize < 2000) { // 2KB limit
            const encodedConfig = this.encodeBase64(configString);
            const url = new URL(window.location);
            url.searchParams.set('config', encodedConfig);
            return url.toString();
        }
        
        // For larger configurations, use localStorage with share ID
        try {
            const configId = 'share_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(`ttp_share_${configId}`, configString);
            
            const url = new URL(window.location);
            url.searchParams.set('share', configId);
            return url.toString();
        } catch (error) {
            console.warn('localStorage not available, falling back to base64 method');
            // Fallback to base64 even if it might be too large
            const encodedConfig = this.encodeBase64(configString);
            const url = new URL(window.location);
            url.searchParams.set('config', encodedConfig);
            return url.toString();
        }
    }

    // Copy shareable URL to clipboard
    async copyShareableURL() {
        try {
            const config = {
                data: this.dataEditor ? this.dataEditor.getValue() : '',
                template: this.templateEditor ? this.templateEditor.getValue() : '',
                vars: this.getCurrentVars(),
                functions: this.functions,
                lookups: this.lookupTables,
                outputFormat: this.elements.outputFormat ? this.elements.outputFormat.value : 'json'
            };
            
            const configString = JSON.stringify(config);
            const configSize = configString.length;
            
            // Check if configuration is too large for URL sharing
            if (configSize > 2000) {
                const useExport = confirm(
                    `Configuration is too large for URL sharing (${Math.round(configSize/1024)}KB).\n\n` +
                    'Would you like to export it as a file instead?\n\n' +
                    'Click OK to export, or Cancel to try URL sharing anyway.'
                );
                
                if (useExport) {
                    this.exportConfiguration();
                    return true;
                }
            }
            
            const url = this.generateShareableURL();
            await navigator.clipboard.writeText(url);
            console.log('Shareable URL copied to clipboard');
            
            // Clean up old share configurations (keep only last 10)
            this.cleanupOldShares();
            
            return true;
        } catch (error) {
            console.error('Failed to copy URL to clipboard:', error);
            return false;
        }
    }
    
    // Clean up old share configurations to prevent localStorage bloat
    cleanupOldShares() {
        const shareKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ttp_share_')) {
                shareKeys.push(key);
            }
        }
        
        // Sort by timestamp (newest first)
        shareKeys.sort((a, b) => {
            const aTime = a.split('_')[1];
            const bTime = b.split('_')[1];
            return parseInt(bTime) - parseInt(aTime);
        });
        
        // Remove old shares (keep only last 10)
        if (shareKeys.length > 10) {
            const toRemove = shareKeys.slice(10);
            toRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log('Cleaned up old share:', key);
            });
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
