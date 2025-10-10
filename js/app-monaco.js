class TTPEditor {
    constructor() {
        console.log('Initializing TTP Editor with Monaco Editor...');
        
        this.elements = {};
        this.ttpProcessor = null;
        
        // Status bar elements
        this.statusBar = null;
        this.statusMessage = null;
        this.pythonVersion = null;
        this.ttpVersion = null;
        
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
        
        // Inputs management
        this.inputs = [];
        this.inputCounter = 0;
        
        // Packages management
        this.packages = [];
        this.packageCounter = 0;
        this.installButtonTimeouts = new Map(); // Track timeouts for each package

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
                { open: '"', close: '"' },
                { open: "'", close: "'" },
                { open: '<', close: '>' }
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" }
            ],
            // Enable auto-closing for XML tags
            autoClosingBrackets: 'languageDefined',
            autoClosingQuotes: 'languageDefined'
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

                // Check context for different TTP elements with more precise detection
                const textBefore = model.getValueInRange({
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });
                
                // More precise context detection - find the most recent unclosed tag
                const findCurrentContext = () => {
                    const lines = textBefore.split('\n');
                    let currentTag = null;
                    let tagDepth = 0;
                    
                    for (let i = lines.length - 1; i >= 0; i--) {
                        const line = lines[i];
                        
                        // Check for closing tags
                        const closingTags = line.match(/<\/\w+>/g);
                        if (closingTags) {
                            tagDepth += closingTags.length;
                        }
                        
                        // Check for opening tags
                        const openingTags = line.match(/<(\w+)[^>]*>/g);
                        if (openingTags) {
                            for (const tag of openingTags) {
                                const tagName = tag.match(/<(\w+)/)[1];
                                if (tagDepth > 0) {
                                    tagDepth--;
                                } else {
                                    // This is the most recent unclosed tag
                                    currentTag = tagName;
                                    break;
                                }
                            }
                        }
                        
                        if (currentTag) break;
                    }
                    
                    return currentTag;
                };
                
                const currentContext = findCurrentContext();
                
                // Set context flags based on current tag
                const isInGroup = currentContext === 'group';
                const isInGroupTag = /<group[^>]*$/.test(textBefore);
                const isInInput = currentContext === 'input';
                const isInInputTag = /<input[^>]*$/.test(textBefore);
                const isInOutput = currentContext === 'output';
                const isInOutputTag = /<output[^>]*$/.test(textBefore);
                const isInTemplate = currentContext === 'template';
                const isInTemplateTag = /<template[^>]*$/.test(textBefore);
                const isInLookup = currentContext === 'lookup';
                const isInLookupTag = /<lookup[^>]*$/.test(textBefore);
                const isInExtend = currentContext === 'extend';
                const isInExtendTag = /<extend[^>]*$/.test(textBefore);
                
                // Check if we're in a match variable context ({{ variable | }})
                const isInMatchVariable = /{{[^}]*\|[^}]*$/.test(textBefore);
                const isInMatchVariableStart = /{{[^}]*$/.test(textBefore);
                
                // Check if we're typing an XML tag (after < but before >)
                const isTypingXMLTag = /<[^>]*$/.test(textBefore);
                const isInXMLTagName = /<\w*$/.test(textBefore);
                const isInXMLAttribute = /<\w+[^>]*\s+\w*$/.test(textBefore);
                
                // More comprehensive XML tag detection - includes partial tag names
                const isInPartialXMLTag = /<\w*$/.test(textBefore);
                
                // Debug logging - expanded to see all values
                console.log('TTP Completion Context:');
                console.log('  currentContext:', currentContext);
                console.log('  isInGroup:', isInGroup);
                console.log('  isInGroupTag:', isInGroupTag);
                console.log('  isInPartialXMLTag:', isInPartialXMLTag);
                console.log('  isTypingXMLTag:', isTypingXMLTag);
                console.log('  isInXMLTagName:', isInXMLTagName);
                console.log('  textBefore (last 20):', textBefore.slice(-20));
                console.log('  regex /<\\w*$/ test:', /<\w*$/.test(textBefore));

                const suggestions = [
                    // TTP template structure (only when not in an existing tag AND not typing XML tags)
                    ...(!isInGroupTag && !isInInputTag && !isInOutputTag && !isInTemplateTag && !isInLookupTag && !isInExtendTag && !isInPartialXMLTag ? [
                        {
                            label: 'template',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'template name="${1:template_name}">\n  ${2:template_content}\n</template>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP template definition',
                            range: range
                        },
                        {
                            label: 'group',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'group name="${1:group_name}">\n  ${2:group_content}\n</group>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP group definition',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'macro>\n  def ${1:function_name}(data):\n    # Process data here\n    return data\n</macro>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP macro definition',
                            range: range
                        },
                        {
                            label: 'input',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'input name="${1:input_name}" load="${2:text}">\n  ${3:input_data}\n</input>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP input definition',
                            range: range
                        },
                        {
                            label: 'output',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'output name="${1:output_name}" format="${2:yaml}">\n  ${3:output_config}\n</output>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP output definition',
                            range: range
                        },
                        {
                            label: 'lookup',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'lookup name="${1:lookup_name}" load="${2:text}">\n  ${3:lookup_data}\n</lookup>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP lookup table definition',
                            range: range
                        },
                        {
                            label: 'extend',
                            kind: window.MonacoLanguages.CompletionItemKind.Keyword,
                            insertText: 'extend template="${1:template_name}" name="${2:extend_name}">\n  ${3:extend_content}\n</extend>',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'TTP extend definition',
                            range: range
                        }
                    ] : []),
                    
                    // Group attributes (only when in group tag)
                    ...(isInGroupTag ? [
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:group_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Group name attribute - defines the key name for group results',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'input',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'input="${1:input_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Input attribute - specifies which input to process',
                            sortText: '01',
                            range: range
                        },
                        {
                            label: 'default',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'default="${1:default_value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Default attribute - default value if no matches found',
                            sortText: '02',
                            range: range
                        },
                        {
                            label: 'method',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'method="${1:method_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Method attribute - specifies parsing method',
                            sortText: '03',
                            range: range
                        },
                        {
                            label: 'output',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'output="${1:output_format}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Output attribute - specifies output format',
                            sortText: '04',
                            range: range
                        },
                        // Group functions as attributes
                        {
                            label: 'containsall',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'containsall="${1:value1,value2}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Contains all function - check if group contains all specified values',
                            sortText: '05',
                            range: range
                        },
                        {
                            label: 'contains',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'contains="${1:value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Contains function - check if group contains specified value',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - run macro function on group results',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Functions attribute - apply functions to group results',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'chain',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'chain="${1:variable_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Chain function - chain functions from variable',
                            sortText: '09',
                            range: range
                        },
                        {
                            label: 'to_ip',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'to_ip="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'To IP function - convert group result to IP address object',
                            sortText: '10',
                            range: range
                        },
                        {
                            label: 'exclude',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'exclude="${1:pattern}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Exclude function - exclude group results matching pattern',
                            sortText: '11',
                            range: range
                        },
                        {
                            label: 'excludeall',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'excludeall="${1:pattern1,pattern2}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Exclude all function - exclude all group results matching patterns',
                            sortText: '12',
                            range: range
                        },
                        {
                            label: 'del',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'del="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Delete function - delete group results',
                            sortText: '13',
                            range: range
                        },
                        {
                            label: 'sformat',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'sformat="${1:format_string}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Sformat function - format group results using string format',
                            sortText: '14',
                            range: range
                        },
                        {
                            label: 'itemize',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'itemize="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Itemize function - convert group results to list of items',
                            sortText: '15',
                            range: range
                        },
                        {
                            label: 'cerberus',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'cerberus="${1:schema_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Cerberus function - validate group results using Cerberus schema',
                            sortText: '16',
                            range: range
                        },
                        {
                            label: 'void',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'void="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Void function - void group results (always returns False)',
                            sortText: '17',
                            range: range
                        },
                        {
                            label: 'str_to_unicode',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'str_to_unicode="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Str to unicode function - convert group results to unicode string',
                            sortText: '18',
                            range: range
                        },
                        {
                            label: 'equal',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'equal="${1:value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Equal function - check if group result equals specified value',
                            sortText: '19',
                            range: range
                        },
                        {
                            label: 'to_int',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'to_int="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'To int function - convert group result to integer',
                            sortText: '20',
                            range: range
                        },
                        {
                            label: 'contains_val',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'contains_val="${1:value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Contains val function - check if group contains specific value',
                            sortText: '21',
                            range: range
                        },
                        {
                            label: 'exclude_val',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'exclude_val="${1:value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Exclude val function - exclude group results with specific value',
                            sortText: '22',
                            range: range
                        },
                        {
                            label: 'record',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'record="${1:variable_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Record function - record group result in template variable',
                            sortText: '23',
                            range: range
                        },
                        {
                            label: 'set',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'set="${1:value}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Set function - set group result to specific value',
                            sortText: '24',
                            range: range
                        },
                        {
                            label: 'expand',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'expand="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Expand function - expand group results',
                            sortText: '25',
                            range: range
                        },
                        {
                            label: 'validate',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'validate="${1:schema_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Validate function - validate group results',
                            sortText: '26',
                            range: range
                        },
                        {
                            label: 'lookup',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'lookup="${1:lookup_table_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Lookup function - lookup group result in lookup table',
                            sortText: '27',
                            range: range
                        },
                        {
                            label: 'items2dict',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'items2dict="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Items2dict function - convert group items to dictionary',
                            sortText: '28',
                            range: range
                        }
                    ] : []),
                    
                    // Group functions (only when in group content)
                    ...(isInGroup ? [
                        {
                            label: 'containsall',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Check if group contains all specified values',
                            sortText: '05',
                            range: range
                        },
                        {
                            label: 'contains',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Check if group contains specified value',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Run macro function on group results',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Apply functions to group results',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'chain',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Chain functions from variable',
                            sortText: '09',
                            range: range
                        },
                        {
                            label: 'to_ip',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Convert group result to IP address object',
                            sortText: '10',
                            range: range
                        },
                        {
                            label: 'exclude',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Exclude group results matching pattern',
                            sortText: '11',
                            range: range
                        },
                        {
                            label: 'excludeall',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Exclude all group results matching patterns',
                            sortText: '12',
                            range: range
                        },
                        {
                            label: 'del',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Delete group results',
                            sortText: '13',
                            range: range
                        },
                        {
                            label: 'sformat',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Format group results using string format',
                            sortText: '14',
                            range: range
                        },
                        {
                            label: 'itemize',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Convert group results to list of items',
                            sortText: '15',
                            range: range
                        },
                        {
                            label: 'cerberus',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Validate group results using Cerberus schema',
                            sortText: '16',
                            range: range
                        },
                        {
                            label: 'void',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Void group results (always returns False)',
                            sortText: '17',
                            range: range
                        },
                        {
                            label: 'str_to_unicode',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Convert group results to unicode string',
                            sortText: '18',
                            range: range
                        },
                        {
                            label: 'equal',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Check if group result equals specified value',
                            sortText: '19',
                            range: range
                        },
                        {
                            label: 'to_int',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Convert group result to integer',
                            sortText: '20',
                            range: range
                        },
                        {
                            label: 'contains_val',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Check if group contains specific value',
                            sortText: '21',
                            range: range
                        },
                        {
                            label: 'exclude_val',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Exclude group results with specific value',
                            sortText: '22',
                            range: range
                        },
                        {
                            label: 'record',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Record group result in template variable',
                            sortText: '23',
                            range: range
                        },
                        {
                            label: 'set',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Set group result to specific value',
                            sortText: '24',
                            range: range
                        },
                        {
                            label: 'expand',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Expand group results',
                            sortText: '25',
                            range: range
                        },
                        {
                            label: 'validate',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Validate group results',
                            sortText: '26',
                            range: range
                        },
                        {
                            label: 'lookup',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Lookup group result in lookup table',
                            sortText: '27',
                            range: range
                        },
                        {
                            label: 'items2dict',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Convert group items to dictionary',
                            sortText: '28',
                            range: range
                        }
                    ] : []),
                    
                    // Input attributes (only when in input tag)
                    ...(isInInputTag ? [
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:input_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Input name attribute - unique identifier for input',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'groups',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'groups="${1:group_names}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Groups attribute - specifies which groups should process this input',
                            sortText: '01',
                            range: range
                        },
                        {
                            label: 'load',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'load="${1:text|yaml|python|json|xml}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Load attribute - specifies data format (text, yaml, python, json, xml)',
                            sortText: '02',
                            range: range
                        },
                        {
                            label: 'url',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'url="${1:/path/to/data/}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'URL attribute - specifies data location',
                            sortText: '03',
                            range: range
                        },
                        {
                            label: 'extensions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'extensions="${1:["txt", "conf"]}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Extensions attribute - file extensions to include',
                            sortText: '04',
                            range: range
                        },
                        {
                            label: 'filters',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'filters="${1:["pattern1", "pattern2"]}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Filters attribute - regex patterns to filter files',
                            sortText: '05',
                            range: range
                        },
                        // Input functions as attributes
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Functions attribute - apply functions to input data',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - run macro on input data',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'extract_commands',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'extract_commands="${1:command1,command2}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Extract commands function - extract specific commands from input',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'test',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'test="${1:test_expression}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Test function - test input data processing',
                            sortText: '09',
                            range: range
                        }
                    ] : []),
                    
                    // Input functions (only when in input content)
                    ...(isInInput ? [
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Functions attribute - apply functions to input data',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Macro function - run macro on input data',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'extract_commands',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Extract commands function - extract specific commands from input',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'test',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Test function - test input data processing',
                            sortText: '09',
                            range: range
                        }
                    ] : []),
                    
                    // Output attributes (only when in output tag)
                    ...(isInOutputTag ? [
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:output_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Output name attribute - unique identifier for output',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'description',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'description="${1:output_description}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Description attribute - description of output purpose',
                            sortText: '01',
                            range: range
                        },
                        {
                            label: 'load',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'load="${1:yaml|python|json}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Load attribute - specifies output configuration format',
                            sortText: '02',
                            range: range
                        },
                        {
                            label: 'returner',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'returner="${1:self|file|terminal|syslog}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Returner attribute - specifies how to return results',
                            sortText: '03',
                            range: range
                        },
                        {
                            label: 'format',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'format="${1:raw|yaml|json|pprint|table|csv|tabulate|jinja2|excel|n2g}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Format attribute - specifies output format',
                            sortText: '04',
                            range: range
                        },
                        {
                            label: 'condition',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'condition="${1:condition_expression}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Condition attribute - condition for output execution',
                            sortText: '05',
                            range: range
                        },
                        // Output functions as attributes
                        {
                            label: 'is_equal',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'is_equal="${1:true}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Is equal function - checks if results equal to structure loaded from output tag text',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'set_data',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'set_data="${1:path=\'dot.separated.path\', value=\'data\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Set data function - insert arbitrary data to results at given path',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'dict_to_list',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'dict_to_list="${1:key_name=\'key\', path=\'dot.separated.path\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Dict to list function - transforms dictionary to list of dictionaries at given path',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'traverse',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'traverse="${1:path=\'dot.separated.path\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Traverse function - returns data at given path location of results tree',
                            sortText: '09',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - passes results through macro function',
                            sortText: '10',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Output functions - pipe separated list of functions to run results through',
                            sortText: '11',
                            range: range
                        },
                        {
                            label: 'deepdiff',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'deepdiff="${1:path=\'dot.separated.path\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Deep diff function - function to compare result structures',
                            sortText: '12',
                            range: range
                        },
                        {
                            label: 'validate',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'validate="${1:schema=\'schema_name\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Validate function - add Cerberus validation information to results without filtering them',
                            sortText: '13',
                            range: range
                        },
                        {
                            label: 'validate_yangson',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'validate_yangson="${1:yang_mod_dir=\'./yang_modules/\', yang_mod_lib=\'./yang_modules/library/yang-library.json\'}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Validate Yangson function - uses YANG modules and yangson library to validate parsing results',
                            sortText: '14',
                            range: range
                        }
                    ] : []),
                    
                    // Output functions (only when in output content)
                    ...(isInOutput ? [
                        {
                            label: 'is_equal',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Is equal function - check if results are equal to value',
                            sortText: '06',
                            range: range
                        },
                        {
                            label: 'set_data',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Set data function - set specific data for output',
                            sortText: '07',
                            range: range
                        },
                        {
                            label: 'dict_to_list',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Dict to list function - convert dictionary to list',
                            sortText: '08',
                            range: range
                        },
                        {
                            label: 'traverse',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Traverse function - traverse results structure',
                            sortText: '09',
                            range: range
                        },
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Macro function - run macro on output results',
                            sortText: '10',
                            range: range
                        },
                        {
                            label: 'output_functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Output functions - apply output-specific functions',
                            sortText: '11',
                            range: range
                        },
                        {
                            label: 'deepdiff',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Deep diff function - compare results with deep diff',
                            sortText: '12',
                            range: range
                        },
                        {
                            label: 'validate',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Validate function - validate output results',
                            sortText: '13',
                            range: range
                        },
                        {
                            label: 'validate_yangson',
                            kind: window.MonacoLanguages.CompletionItemKind.Function,
                            documentation: 'Validate Yangson function - validate using Yangson schema',
                            sortText: '14',
                            range: range
                        }
                    ] : []),
                    
                    // Template attributes (only when in template tag)
                    ...(isInTemplateTag ? [
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:template_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Template name attribute - unique identifier for template',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'base_path',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'base_path="${1:/path/to/data/}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Base path attribute - base OS path to data location',
                            sortText: '01',
                            range: range
                        },
                        {
                            label: 'results',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'results="${1:per_template|per_input}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Results attribute - results grouping method (per_template or per_input)',
                            sortText: '02',
                            range: range
                        },
                        {
                            label: 'pathchar',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'pathchar="${1:.}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Path char attribute - character for group name-path processing',
                            sortText: '03',
                            range: range
                        },
                        // Template functions as attributes (limited functions available)
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - run macro function on template',
                            sortText: '04',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Functions attribute - apply functions to template',
                            sortText: '05',
                            range: range
                        }
                    ] : []),
                    
                    // Lookup attributes (only when in lookup tag)
                    ...(isInLookupTag ? [
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:lookup_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Lookup name attribute - unique identifier for lookup table',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'load',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'load="${1:text|yaml|python|json|xml}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Load attribute - specifies lookup data format',
                            sortText: '01',
                            range: range
                        },
                        {
                            label: 'url',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'url="${1:/path/to/lookup/data}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'URL attribute - specifies lookup data location',
                            sortText: '02',
                            range: range
                        },
                        // Lookup functions as attributes (limited functions available)
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - run macro function on lookup data',
                            sortText: '03',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Functions attribute - apply functions to lookup data',
                            sortText: '04',
                            range: range
                        }
                    ] : []),
                    
                    // Extend attributes (only when in extend tag)
                    ...(isInExtendTag ? [
                        {
                            label: 'template',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'template="${1:template_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Template attribute - name of template to extend',
                            sortText: '00',
                            range: range
                        },
                        {
                            label: 'name',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'name="${1:extend_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Name attribute - name for extended template',
                            sortText: '01',
                            range: range
                        },
                        // Extend functions as attributes (limited functions available)
                        {
                            label: 'macro',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'macro="${1:func_name}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Macro function - run macro function on extended template',
                            sortText: '02',
                            range: range
                        },
                        {
                            label: 'functions',
                            kind: window.MonacoLanguages.CompletionItemKind.Property,
                            insertText: 'functions="${1:function1(\'attributes\') | function2(\'attributes\')}"',
                            insertTextRules: window.MonacoLanguages.CompletionItemInsertTextRule.InsertAsSnippet,
                            documentation: 'Functions attribute - apply functions to extended template',
                            sortText: '03',
                            range: range
                        }
                    ] : []),
                    
                    // TTP Action Functions (only in match variable context)
                    ...(isInMatchVariable ? [
                        { label: 'append', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Append provided string to the end of match result', sortText: '01', range: range },
                    { label: 'chain', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Add functions from chain variable', sortText: '02', range: range },
                    { label: 'copy', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Copy match value into another variable', sortText: '03', range: range },
                    { label: 'count', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Function to count matches', sortText: '04', range: range },
                    { label: 'default', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Default value to use for match variable if no matches produced', sortText: '05', range: range },
                    { label: 'dns', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Performs DNS forward lookup', sortText: '06', range: range },
                    { label: 'geoip_lookup', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Uses GeoIP2 database to lookup ASN, Country or City information', sortText: '07', range: range },
                    { label: 'gpvlookup', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Glob Patterns Values lookup uses glob patterns testing against match result', sortText: '08', range: range },
                    { label: 'ip_info', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Produces a dictionary with information about given ip address or subnet', sortText: '09', range: range },
                    { label: 'item', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Returns item at given index of match result', sortText: '10', range: range },
                    { label: 'join', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Join match using provided character', sortText: '11', range: range },
                    { label: 'joinmatches', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Join matches using provided character', sortText: '12', range: range },
                    { label: 'let', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Assigns provided value to match variable', sortText: '13', range: range },
                    { label: 'lookup', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Find match value in lookup table and return result', sortText: '14', range: range },
                    { label: 'mac_eui', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms mac string into EUI format', sortText: '15', range: range },
                    { label: 'macro', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Runs match result against macro function', sortText: '16', range: range },
                    { label: 'prepend', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Prepend provided string at the beginning of match result', sortText: '17', range: range },
                    { label: 'print', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Print match result to terminal', sortText: '18', range: range },
                    { label: 'raise', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Raises RuntimeError with message provided', sortText: '19', range: range },
                    { label: 'rdns', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Performs DNS reverse lookup', sortText: '20', range: range },
                    { label: 'record', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Save match result in template variable with given name', sortText: '21', range: range },
                    { label: 'replaceall', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Run string replace against match result for all given values', sortText: '22', range: range },
                    { label: 'resub', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Replace old pattern with new pattern in match using re substitute method', sortText: '23', range: range },
                    { label: 'resuball', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Run re substitute against match for all given values', sortText: '24', range: range },
                    { label: 'rlookup', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Find rlookup table key in match result and return associated values', sortText: '25', range: range },
                    { label: 'set', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Set match result to specific value if certain string matched or unconditionally', sortText: '26', range: range },
                    { label: 'sformat', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Format string using python string format method', sortText: '27', range: range },
                    { label: 'to_cidr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms netmask to cidr (prefix length) notation', sortText: '28', range: range },
                    { label: 'to_float', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Converts match variable value to float integer', sortText: '29', range: range },
                    { label: 'to_int', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms result to integer', sortText: '30', range: range },
                    { label: 'to_ip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms result to python ipaddress module IPvXAddress or IPvXInterface object', sortText: '31', range: range },
                    { label: 'to_list', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Creates empty list and appends match result to it', sortText: '32', range: range },
                    { label: 'to_net', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms result to python ipaddress module IPvXNetwork object', sortText: '33', range: range },
                    { label: 'to_str', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms result to python string', sortText: '34', range: range },
                    { label: 'to_unicode', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'If script run by python2, converts match result string to unicode', sortText: '35', range: range },
                    { label: 'truncate', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Truncate match results', sortText: '36', range: range },
                    { label: 'unrange', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Unrange match result using given parameters', sortText: '37', range: range },
                    { label: 'uptimeparse', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Function to parse uptime string', sortText: '38', range: range },
                    { label: 'void', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Always returns False on results validation, allowing to skip them', sortText: '39', range: range }
                    ] : []),

                    // TTP Condition Functions (only in match variable context)
                    ...(isInMatchVariable ? [
                    { label: 'equal', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if match is equal to provided value', sortText: '40', range: range },
                    { label: 'notequal', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if match is not equal to provided value', sortText: '41', range: range },
                    { label: 'startswith_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match starts with certain string using regular expression', sortText: '42', range: range },
                    { label: 'endswith_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match ends with certain string using regular expression', sortText: '43', range: range },
                    { label: 'contains_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match contains certain string using regular expression', sortText: '44', range: range },
                    { label: 'contains', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match contains certain string patterns', sortText: '45', range: range },
                    { label: 'notstartswith_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match not starts with certain string using regular expression', sortText: '46', range: range },
                    { label: 'notendswith_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match not ends with certain string using regular expression', sortText: '47', range: range },
                    { label: 'exclude_re', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match not contains certain string using regular expression', sortText: '48', range: range },
                    { label: 'exclude', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match not contains certain string', sortText: '49', range: range },
                    { label: 'isdigit', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match is digit string e.g. \'42\'', sortText: '50', range: range },
                    { label: 'notdigit', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match is not digit string', sortText: '51', range: range },
                    { label: 'greaterthan', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match is greater than given value', sortText: '52', range: range },
                    { label: 'lessthan', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Checks if match is less than given value', sortText: '53', range: range },
                    { label: 'is_ip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Tries to convert match result to ipaddress object and returns True if so, False otherwise', sortText: '54', range: range },
                    { label: 'cidr_match', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Transforms result to ipaddress object and checks if it overlaps with given prefix', sortText: '55', range: range }
                    ] : []),

                    // Python built-ins (only in match variable context)
                    ...(isInMatchVariable ? [
                        { label: 'upper', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to uppercase', sortText: '90', range: range },
                    { label: 'lower', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to lowercase', sortText: '91', range: range },
                    { label: 'strip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Strip whitespace', sortText: '92', range: range },
                    { label: 'split', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Split text by delimiter', sortText: '93', range: range },
                    { label: 'replace', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Replace text', sortText: '94', range: range },
                    { label: 'find', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Find substring', sortText: '95', range: range },
                    { label: 'index', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get index of substring', sortText: '96', range: range },
                    { label: 'count', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Count occurrences', sortText: '97', range: range },
                    { label: 'startswith', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string starts with prefix', sortText: '98', range: range },
                    { label: 'endswith', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string ends with suffix', sortText: '99', range: range },
                    { label: 'isdigit', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string is digit', sortText: '100', range: range },
                    { label: 'isalpha', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string is alphabetic', sortText: '101', range: range },
                    { label: 'isalnum', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string is alphanumeric', sortText: '102', range: range },
                    { label: 'isspace', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if string is whitespace', sortText: '103', range: range },
                    { label: 'join', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Join list elements', sortText: '104', range: range },
                    { label: 'format', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Format string', sortText: '105', range: range },
                    { label: 'len', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Length of object', sortText: '106', range: range },
                    { label: 'max', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Maximum value', sortText: '107', range: range },
                    { label: 'min', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Minimum value', sortText: '108', range: range },
                    { label: 'sum', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sum of values', sortText: '109', range: range },
                    { label: 'sorted', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sort iterable', sortText: '110', range: range },
                    { label: 'reversed', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Reverse iterable', sortText: '111', range: range },
                    { label: 'enumerate', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Enumerate with index', sortText: '112', range: range },
                    { label: 'zip', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Zip iterables', sortText: '113', range: range },
                    { label: 'map', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Map function to iterable', sortText: '114', range: range },
                    { label: 'filter', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Filter iterable', sortText: '115', range: range },
                    { label: 'any', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Any true value', sortText: '116', range: range },
                    { label: 'all', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'All true values', sortText: '117', range: range },
                    { label: 'bool', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to boolean', sortText: '118', range: range },
                    { label: 'int', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to integer', sortText: '119', range: range },
                    { label: 'float', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to float', sortText: '120', range: range },
                    { label: 'str', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to string', sortText: '121', range: range },
                    { label: 'list', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to list', sortText: '122', range: range },
                    { label: 'dict', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to dictionary', sortText: '123', range: range },
                    { label: 'set', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to set', sortText: '124', range: range },
                    { label: 'tuple', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Convert to tuple', sortText: '125', range: range },
                    { label: 'type', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get type of object', sortText: '126', range: range },
                    { label: 'isinstance', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check instance type', sortText: '127', range: range },
                    { label: 'issubclass', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check subclass', sortText: '128', range: range },
                    { label: 'hasattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check attribute exists', sortText: '129', range: range },
                    { label: 'getattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get attribute', sortText: '130', range: range },
                    { label: 'setattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Set attribute', sortText: '131', range: range },
                    { label: 'delattr', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Delete attribute', sortText: '132', range: range },
                    { label: 'dir', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'List attributes', sortText: '133', range: range },
                    { label: 'vars', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get variables', sortText: '134', range: range },
                    { label: 'locals', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Local variables', sortText: '135', range: range },
                    { label: 'globals', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Global variables', sortText: '136', range: range },
                    { label: 'callable', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Check if callable', sortText: '137', range: range },
                    { label: 'eval', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Evaluate expression', sortText: '138', range: range },
                    { label: 'exec', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Execute code', sortText: '139', range: range },
                    { label: 'compile', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Compile code', sortText: '140', range: range },
                    { label: 'open', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Open file', sortText: '141', range: range },
                    { label: 'file', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'File object', sortText: '142', range: range },
                    { label: 'input', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get user input', sortText: '143', range: range },
                    { label: 'print', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Print output', sortText: '144', range: range },
                    { label: 'range', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Generate range', sortText: '145', range: range },
                    { label: 'iter', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Create iterator', sortText: '146', range: range },
                    { label: 'next', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get next item', sortText: '147', range: range },
                    { label: 'items', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get items', sortText: '148', range: range },
                    { label: 'keys', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get keys', sortText: '149', range: range },
                    { label: 'values', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get values', sortText: '150', range: range },
                    { label: 'pop', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Pop item', sortText: '151', range: range },
                    { label: 'popitem', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Pop arbitrary item', sortText: '152', range: range },
                    { label: 'clear', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Clear collection', sortText: '153', range: range },
                    { label: 'copy', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Copy collection', sortText: '154', range: range },
                    { label: 'update', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Update collection', sortText: '155', range: range },
                    { label: 'setdefault', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Set default value', sortText: '156', range: range },
                    { label: 'get', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Get value with default', sortText: '157', range: range },
                    { label: 'fromkeys', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Create from keys', sortText: '158', range: range },
                    { label: 'append', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Append item', sortText: '159', range: range },
                    { label: 'extend', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Extend list', sortText: '160', range: range },
                    { label: 'insert', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Insert item', sortText: '161', range: range },
                    { label: 'remove', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Remove item', sortText: '162', range: range },
                    { label: 'reverse', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Reverse list', sortText: '163', range: range },
                    { label: 'sort', kind: window.MonacoLanguages.CompletionItemKind.Function, documentation: 'Sort list', sortText: '164', range: range }
                    ] : []),
                    
                    // XML tag completion (when typing XML tags)
                    ...(isInPartialXMLTag ? [
                        { label: 'template', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP template tag', sortText: '001', range: range },
                        { label: 'group', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP group tag', sortText: '002', range: range },
                        { label: 'input', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP input tag', sortText: '003', range: range },
                        { label: 'output', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP output tag', sortText: '004', range: range },
                        { label: 'lookup', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP lookup tag', sortText: '005', range: range },
                        { label: 'extend', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP extend tag', sortText: '006', range: range },
                        { label: 'macro', kind: window.MonacoLanguages.CompletionItemKind.Keyword, documentation: 'TTP macro tag', sortText: '007', range: range }
                    ] : [])
                ];
                
                // Debug: Log raw suggestions before validation
                console.log('Raw suggestions count:', suggestions.length);
                console.log('isInPartialXMLTag for XML completion:', isInPartialXMLTag);
                
                // Validate and clean suggestions
                const validSuggestions = suggestions.filter(suggestion => {
                    // Ensure all required properties exist
                    return suggestion && 
                           suggestion.label && 
                           suggestion.kind !== undefined &&
                           suggestion.insertText;
                }).map(suggestion => {
                    // Ensure range is set
                    if (!suggestion.range) {
                        suggestion.range = range;
                    }
                    return suggestion;
                });
                
                console.log('TTP completion triggered:', validSuggestions.length, 'suggestions');
                return { suggestions: validSuggestions };
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
                    // Input Functions
                    'functions': 'Functions attribute - apply functions to input data',
                    'macro': 'Macro function - run macro on input data',
                    'extract_commands': 'Extract commands function - extract specific commands from input',
                    'test': 'Test function - test input data processing',
                    
                    // Output Functions (as attributes and content)
                    'is_equal': 'Is equal function - checks if results equal to structure loaded from output tag text',
                    'set_data': 'Set data function - insert arbitrary data to results at given path',
                    'dict_to_list': 'Dict to list function - transforms dictionary to list of dictionaries at given path',
                    'traverse': 'Traverse function - returns data at given path location of results tree',
                    'macro': 'Macro function - passes results through macro function',
                    'functions': 'Output functions - pipe separated list of functions to run results through',
                    'deepdiff': 'Deep diff function - function to compare result structures',
                    'validate': 'Validate function - add Cerberus validation information to results without filtering them',
                    'validate_yangson': 'Validate Yangson function - uses YANG modules and yangson library to validate parsing results',
                    
                    // Group Functions
                    'containsall': 'Check if group contains all specified values',
                    'contains': 'Check if group contains specified value',
                    'macro': 'Run macro function on group results',
                    'functions': 'Apply functions to group results',
                    'chain': 'Chain functions from variable',
                    'to_ip': 'Convert group result to IP address object',
                    'exclude': 'Exclude group results matching pattern',
                    'excludeall': 'Exclude all group results matching patterns',
                    'del': 'Delete group results',
                    'sformat': 'Format group results using string format',
                    'itemize': 'Convert group results to list of items',
                    'cerberus': 'Validate group results using Cerberus schema',
                    'void': 'Void group results (always returns False)',
                    'str_to_unicode': 'Convert group results to unicode string',
                    'equal': 'Check if group result equals specified value',
                    'to_int': 'Convert group result to integer',
                    'contains_val': 'Check if group contains specific value',
                    'exclude_val': 'Exclude group results with specific value',
                    'record': 'Record group result in template variable',
                    'set': 'Set group result to specific value',
                    'expand': 'Expand group results',
                    'validate': 'Validate group results',
                    'lookup': 'Lookup group result in lookup table',
                    'items2dict': 'Convert group items to dictionary',
                    
                    // TTP Action Functions
                    'append': 'Append provided string to the end of match result',
                    'chain': 'Add functions from chain variable',
                    'copy': 'Copy match value into another variable',
                    'count': 'Function to count matches',
                    'default': 'Default value to use for match variable if no matches produced',
                    'dns': 'Performs DNS forward lookup',
                    'geoip_lookup': 'Uses GeoIP2 database to lookup ASN, Country or City information',
                    'gpvlookup': 'Glob Patterns Values lookup uses glob patterns testing against match result',
                    'ip_info': 'Produces a dictionary with information about given ip address or subnet',
                    'item': 'Returns item at given index of match result',
                    'join': 'Join match using provided character',
                    'joinmatches': 'Join matches using provided character',
                    'let': 'Assigns provided value to match variable',
                    'lookup': 'Find match value in lookup table and return result',
                    'mac_eui': 'Transforms mac string into EUI format',
                    'macro': 'Runs match result against macro function',
                    'prepend': 'Prepend provided string at the beginning of match result',
                    'print': 'Print match result to terminal',
                    'raise': 'Raises RuntimeError with message provided',
                    'rdns': 'Performs DNS reverse lookup',
                    'record': 'Save match result in template variable with given name',
                    'replaceall': 'Run string replace against match result for all given values',
                    'resub': 'Replace old pattern with new pattern in match using re substitute method',
                    'resuball': 'Run re substitute against match for all given values',
                    'rlookup': 'Find rlookup table key in match result and return associated values',
                    'set': 'Set match result to specific value if certain string matched or unconditionally',
                    'sformat': 'Format string using python string format method',
                    'to_cidr': 'Transforms netmask to cidr (prefix length) notation',
                    'to_float': 'Converts match variable value to float integer',
                    'to_int': 'Transforms result to integer',
                    'to_ip': 'Transforms result to python ipaddress module IPvXAddress or IPvXInterface object',
                    'to_list': 'Creates empty list and appends match result to it',
                    'to_net': 'Transforms result to python ipaddress module IPvXNetwork object',
                    'to_str': 'Transforms result to python string',
                    'to_unicode': 'If script run by python2, converts match result string to unicode',
                    'truncate': 'Truncate match results',
                    'unrange': 'Unrange match result using given parameters',
                    'uptimeparse': 'Function to parse uptime string',
                    'void': 'Always returns False on results validation, allowing to skip them',
                    
                    // TTP Condition Functions
                    'equal': 'Check if match is equal to provided value',
                    'notequal': 'Check if match is not equal to provided value',
                    'startswith_re': 'Checks if match starts with certain string using regular expression',
                    'endswith_re': 'Checks if match ends with certain string using regular expression',
                    'contains_re': 'Checks if match contains certain string using regular expression',
                    'contains': 'Checks if match contains certain string patterns',
                    'notstartswith_re': 'Checks if match not starts with certain string using regular expression',
                    'notendswith_re': 'Checks if match not ends with certain string using regular expression',
                    'exclude_re': 'Checks if match not contains certain string using regular expression',
                    'exclude': 'Checks if match not contains certain string',
                    'isdigit': 'Checks if match is digit string e.g. \'42\'',
                    'notdigit': 'Checks if match is not digit string',
                    'greaterthan': 'Checks if match is greater than given value',
                    'lessthan': 'Checks if match is less than given value',
                    'is_ip': 'Tries to convert match result to ipaddress object and returns True if so, False otherwise',
                    'cidr_match': 'Transforms result to ipaddress object and checks if it overlaps with given prefix',
                    
                    // Python built-ins
                    'upper': 'Convert to uppercase',
                    'lower': 'Convert to lowercase',
                    'strip': 'Strip whitespace',
                    'split': 'Split text by delimiter',
                    'replace': 'Replace text',
                    'find': 'Find substring',
                    'index': 'Get index of substring',
                    'count': 'Count occurrences',
                    'startswith': 'Check if string starts with prefix',
                    'endswith': 'Check if string ends with suffix',
                    'isdigit': 'Check if string is digit',
                    'isalpha': 'Check if string is alphabetic',
                    'isalnum': 'Check if string is alphanumeric',
                    'isspace': 'Check if string is whitespace',
                    'join': 'Join list elements',
                    'format': 'Format string',
                    'len': 'Length of object',
                    'max': 'Maximum value',
                    'min': 'Minimum value',
                    'sum': 'Sum of values',
                    'sorted': 'Sort iterable',
                    'reversed': 'Reverse iterable',
                    'enumerate': 'Enumerate with index',
                    'zip': 'Zip iterables',
                    'map': 'Map function to iterable',
                    'filter': 'Filter iterable',
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
                    'iter': 'Create iterator',
                    'next': 'Get next item',
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
        
        // Update version info in status bar
        this.updateVersionInfo();
        
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
            // Configuration modal elements
            inputsBtn: document.getElementById('inputsBtn'),
            inputsModal: document.getElementById('inputsModal'),
            addInputBtn: document.getElementById('addInputBtn'),
            inputsList: document.getElementById('inputsList'),
            saveInputsBtn: document.getElementById('saveInputsBtn'),
            clearInputsBtn: document.getElementById('clearInputsBtn'),
            cancelInputsBtn: document.getElementById('cancelInputsBtn'),
            packagesBtn: document.getElementById('packagesBtn'),
            packagesModal: document.getElementById('packagesModal'),
            addPackageBtn: document.getElementById('addPackageBtn'),
            packagesList: document.getElementById('packagesList'),
            
            // Status bar elements
            statusBar: document.getElementById('statusBar'),
            statusMessage: document.getElementById('statusMessage'),
            pythonVersion: document.getElementById('pythonVersion'),
            ttpVersion: document.getElementById('ttpVersion'),
            savePackagesBtn: document.getElementById('savePackagesBtn'),
            clearPackagesBtn: document.getElementById('clearPackagesBtn'),
            cancelPackagesBtn: document.getElementById('cancelPackagesBtn'),
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
            shareBtn: document.getElementById('shareBtn'), // May be null if hidden
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
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            tabSize: 2,
            insertSpaces: true
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
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            // Enable auto-closing for XML tags and other brackets
            autoClosingBrackets: 'languageDefined',
            autoClosingQuotes: 'languageDefined',
            autoClosingOvertype: 'always',
            autoSurround: 'languageDefined',
            tabSize: 2,
            insertSpaces: true
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
            tabSize: 2,
            insertSpaces: true,
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
        // Inputs button
        this.elements.inputsBtn.addEventListener('click', () => {
            this.showInputsModal();
        });
        
        // Packages button
        this.elements.packagesBtn.addEventListener('click', () => {
            this.showPackagesModal();
        });
        
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
        // Share button (if it exists)
        if (this.elements.shareBtn) {
            this.elements.shareBtn.addEventListener('click', async () => {
                const success = await this.copyShareableURL();
                if (success) {
                    this.updateStatus('Shareable URL copied to clipboard!');
                } else {
                    this.updateStatus('Failed to copy URL to clipboard');
                }
            });
        }

        // Save workspace button
        this.elements.saveWorkspaceBtn.addEventListener('click', () => {
            this.showSaveWorkspaceModal();
        });

        // Load workspace button
        this.elements.loadWorkspaceBtn.addEventListener('click', () => {
            this.showLoadWorkspaceModal();
        });

        // Manage workspaces button
        this.elements.manageWorkspacesBtn = document.getElementById('manageWorkspacesBtn');
        this.elements.manageWorkspacesBtn.addEventListener('click', () => {
            this.showManageWorkspacesModal();
        });

        // Setup dropdown functionality
        this.setupDropdowns();
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
        if (this.ttpProcessor && this.ttpProcessor.isReady()) {
            // Add a small delay to ensure TTP is fully loaded
            setTimeout(() => {
                this.updateDocumentationVersion();
            }, 500);
        } else {
            // Wait for processor to be initialized and ready
            const checkProcessor = () => {
                if (this.ttpProcessor && this.ttpProcessor.isReady()) {
                    // Add a small delay to ensure TTP is fully loaded
                    setTimeout(() => {
                        this.updateDocumentationVersion();
                    }, 500);
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
            } else if (this.elements.docsBtn) {
                // Fallback if version is not available
                this.elements.docsBtn.title = 'TTP Documentation';
                this.elements.docsBtn.href = 'https://ttp.readthedocs.io/en/latest/';
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
            inputs: this.inputs,
            packages: this.packages,
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
        
        this.updateStatus('✅ Configuration exported successfully');
        this.showNotification('Configuration exported successfully!', 'success');
        console.log('Configuration exported');
    }

    importConfiguration(file) {
        if (!file) return;

        // Validate file extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.ttp.export') && !fileName.endsWith('.json')) {
            this.updateStatus('❌ Please select a .ttp.export or .json file');
            this.showNotification('Please select a .ttp.export or .json file', 'error');
            console.error('Invalid file type. Expected .ttp.export or .json file');
            return;
        }

        this.updateStatus('📁 Importing configuration...');
        this.showNotification('Importing configuration...', 'info');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // Validate the configuration structure
                if (this.validateImportedConfig(config)) {
                    this.applyConfiguration(config);
                    this.updateStatus('✅ Configuration imported successfully');
                    this.showNotification('Configuration imported successfully!', 'success');
                    console.log('Configuration imported:', config);
                } else {
                    this.updateStatus('❌ Invalid configuration file format');
                    this.showNotification('Invalid configuration file format', 'error');
                    console.error('Invalid configuration file format');
                }
            } catch (error) {
                this.updateStatus('❌ Error reading configuration file: ' + error.message);
                this.showNotification('Error reading configuration file: ' + error.message, 'error');
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
        const hasInputs = Array.isArray(config.inputs);
        const hasPackages = Array.isArray(config.packages);
        const hasOutputFormat = typeof config.outputFormat === 'string';

        // At least one main field should be present
        return hasData || hasTemplate || hasVars || hasFunctions || hasLookups || hasInputs || hasPackages || hasOutputFormat;
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

        this.updateStatusMessage('Processing template...');

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
            this.updateStatusMessage('Processing completed');
        } catch (error) {
            console.error('Processing error:', error);
            console.error('Error stack:', error.stack);
            this.showError(`Processing failed: ${error.message}`);
            this.updateStatusMessage('Processing failed');
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
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = message;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 4000);

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    // Modal functionality
    showSaveWorkspaceModal() {
        const modal = document.getElementById('saveWorkspaceModal');
        const input = document.getElementById('workspaceNameInput');
        
        // Set default name
        input.value = 'workspace_' + Date.now();
        
        // Show modal
        modal.classList.add('show');
        input.focus();
        input.select();
        
        // Add event listeners
        this.setupSaveWorkspaceModalEvents();
    }

    setupSaveWorkspaceModalEvents() {
        const modal = document.getElementById('saveWorkspaceModal');
        const input = document.getElementById('workspaceNameInput');
        const saveBtn = document.getElementById('saveWorkspaceConfirm');
        const cancelBtn = document.getElementById('saveWorkspaceCancel');
        const closeBtn = modal.querySelector('.modal-close');

        const closeModal = () => {
            modal.classList.remove('show');
            this.removeSaveWorkspaceModalEvents();
        };

        const handleSave = () => {
            const name = input.value.trim();
            if (name) {
                try {
                    this.saveWorkspace(name);
                    this.updateStatus(`✅ Workspace '${name}' saved`);
                    this.showNotification(`Workspace '${name}' saved successfully!`, 'success');
                    closeModal();
                } catch (error) {
                    this.updateStatus(`❌ Failed to save workspace: ${error.message}`);
                    this.showNotification(`Failed to save workspace: ${error.message}`, 'error');
                }
            }
        };

        // Event listeners
        saveBtn.addEventListener('click', handleSave);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Enter key to save
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') closeModal();
        });

        // Store references for cleanup
        this.saveModalEvents = { saveBtn, cancelBtn, closeBtn, modal, input };
    }

    removeSaveWorkspaceModalEvents() {
        if (this.saveModalEvents) {
            const { saveBtn, cancelBtn, closeBtn, modal, input } = this.saveModalEvents;
            saveBtn.removeEventListener('click', this.saveModalEvents.handleSave);
            cancelBtn.removeEventListener('click', this.saveModalEvents.handleClose);
            closeBtn.removeEventListener('click', this.saveModalEvents.handleClose);
            modal.removeEventListener('click', this.saveModalEvents.handleBackdrop);
            input.removeEventListener('keydown', this.saveModalEvents.handleKeydown);
            delete this.saveModalEvents;
        }
    }

    showLoadWorkspaceModal() {
        const modal = document.getElementById('loadWorkspaceModal');
        const workspaceList = document.getElementById('workspaceList');
        
        // Get list of saved workspaces
        const workspaces = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ttp_workspace_')) {
                const name = key.replace('ttp_workspace_', '');
                const data = JSON.parse(localStorage.getItem(key));
                workspaces.push({
                    name: name,
                    timestamp: data.timestamp || 'Unknown date'
                });
            }
        }

        if (workspaces.length === 0) {
            this.updateStatus('❌ No saved workspaces found');
            this.showNotification('No saved workspaces found', 'warning');
            return;
        }

        // Sort by timestamp (newest first)
        workspaces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Populate workspace list
        workspaceList.innerHTML = '';
        workspaces.forEach(workspace => {
            const item = document.createElement('div');
            item.className = 'workspace-item';
            item.innerHTML = `
                <div class="workspace-name">${workspace.name}</div>
                <div class="workspace-date">${new Date(workspace.timestamp).toLocaleDateString()}</div>
            `;
            item.addEventListener('click', () => {
                // Remove previous selection
                workspaceList.querySelectorAll('.workspace-item').forEach(i => i.classList.remove('selected'));
                // Add selection to clicked item
                item.classList.add('selected');
                // Enable load button
                document.getElementById('loadWorkspaceConfirm').disabled = false;
            });
            workspaceList.appendChild(item);
        });

        // Show modal
        modal.classList.add('show');
        
        // Add event listeners
        this.setupLoadWorkspaceModalEvents();
    }

    setupLoadWorkspaceModalEvents() {
        const modal = document.getElementById('loadWorkspaceModal');
        const loadBtn = document.getElementById('loadWorkspaceConfirm');
        const cancelBtn = document.getElementById('loadWorkspaceCancel');
        const closeBtn = modal.querySelector('.modal-close');

        const closeModal = () => {
            modal.classList.remove('show');
            this.removeLoadWorkspaceModalEvents();
        };

        const handleLoad = () => {
            const selectedItem = modal.querySelector('.workspace-item.selected');
            if (selectedItem) {
                const name = selectedItem.querySelector('.workspace-name').textContent;
                try {
                    this.loadWorkspace(name);
                    this.updateStatus(`✅ Workspace '${name}' loaded`);
                    this.showNotification(`Workspace '${name}' loaded successfully!`, 'success');
                    closeModal();
                } catch (error) {
                    this.updateStatus(`❌ Failed to load workspace: ${error.message}`);
                    this.showNotification(`Failed to load workspace: ${error.message}`, 'error');
                }
            }
        };

        // Event listeners
        loadBtn.addEventListener('click', handleLoad);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
        });

        // Store references for cleanup
        this.loadModalEvents = { loadBtn, cancelBtn, closeBtn, modal, handleLoad, handleClose: closeModal };
    }

    removeLoadWorkspaceModalEvents() {
        if (this.loadModalEvents) {
            const { loadBtn, cancelBtn, closeBtn, modal } = this.loadModalEvents;
            loadBtn.removeEventListener('click', this.loadModalEvents.handleLoad);
            cancelBtn.removeEventListener('click', this.loadModalEvents.handleClose);
            closeBtn.removeEventListener('click', this.loadModalEvents.handleClose);
            modal.removeEventListener('click', this.loadModalEvents.handleBackdrop);
            delete this.loadModalEvents;
        }
    }

    // Dropdown functionality
    setupDropdowns() {
        const dropdowns = document.querySelectorAll('.dropdown');
        
        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(dropdown);
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                this.closeAllDropdowns();
            }
        });

        // Close dropdowns on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllDropdowns();
            }
        });
    }

    toggleDropdown(dropdown) {
        const isOpen = dropdown.classList.contains('open');
        
        // Close all other dropdowns
        this.closeAllDropdowns();
        
        // Toggle this dropdown
        if (!isOpen) {
            dropdown.classList.add('open');
        }
    }

    closeAllDropdowns() {
        document.querySelectorAll('.dropdown.open').forEach(dropdown => {
            dropdown.classList.remove('open');
        });
    }

    // Manage workspaces modal
    showManageWorkspacesModal() {
        const modal = document.getElementById('manageWorkspacesModal');
        const workspaceList = document.getElementById('manageWorkspaceList');
        
        // Get list of saved workspaces
        const workspaces = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ttp_workspace_')) {
                const name = key.replace('ttp_workspace_', '');
                const data = JSON.parse(localStorage.getItem(key));
                workspaces.push({
                    name: name,
                    timestamp: data.timestamp || 'Unknown date',
                    key: key
                });
            }
        }

        if (workspaces.length === 0) {
            this.updateStatus('❌ No saved workspaces found');
            this.showNotification('No saved workspaces found', 'warning');
            return;
        }

        // Sort by timestamp (newest first)
        workspaces.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Populate workspace list
        workspaceList.innerHTML = '';
        workspaces.forEach(workspace => {
            const item = document.createElement('div');
            item.className = 'workspace-item';
            item.innerHTML = `
                <div class="workspace-name">${workspace.name}</div>
                <div class="workspace-date">${new Date(workspace.timestamp).toLocaleDateString()}</div>
            `;
            item.addEventListener('click', () => {
                // Toggle selection
                item.classList.toggle('selected');
                // Update delete button state
                const hasSelection = workspaceList.querySelector('.workspace-item.selected');
                document.getElementById('manageWorkspaceDelete').disabled = !hasSelection;
            });
            workspaceList.appendChild(item);
        });

        // Show modal
        modal.classList.add('show');
        
        // Add event listeners
        this.setupManageWorkspacesModalEvents();
    }

    setupManageWorkspacesModalEvents() {
        const modal = document.getElementById('manageWorkspacesModal');
        const deleteBtn = document.getElementById('manageWorkspaceDelete');
        const cancelBtn = document.getElementById('manageWorkspaceCancel');
        const closeBtn = modal.querySelector('.modal-close');

        const closeModal = () => {
            modal.classList.remove('show');
            this.removeManageWorkspacesModalEvents();
        };

        const handleDelete = () => {
            const selectedItems = modal.querySelectorAll('.workspace-item.selected');
            if (selectedItems.length === 0) return;

            const workspaceNames = Array.from(selectedItems).map(item => 
                item.querySelector('.workspace-name').textContent
            );

            if (confirm(`Are you sure you want to delete ${workspaceNames.length} workspace(s)?\n\n${workspaceNames.join('\n')}`)) {
                try {
                    selectedItems.forEach(item => {
                        const name = item.querySelector('.workspace-name').textContent;
                        localStorage.removeItem(`ttp_workspace_${name}`);
                    });
                    
                    this.updateStatus(`✅ Deleted ${workspaceNames.length} workspace(s)`);
                    this.showNotification(`Deleted ${workspaceNames.length} workspace(s)`, 'success');
                    
                    // Refresh the list
                    this.showManageWorkspacesModal();
                } catch (error) {
                    this.updateStatus(`❌ Failed to delete workspaces: ${error.message}`);
                    this.showNotification(`Failed to delete workspaces: ${error.message}`, 'error');
                }
            }
        };

        // Event listeners
        deleteBtn.addEventListener('click', handleDelete);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('show')) closeModal();
        });

        // Store references for cleanup
        this.manageModalEvents = { deleteBtn, cancelBtn, closeBtn, modal, handleDelete, handleClose: closeModal };
    }

    removeManageWorkspacesModalEvents() {
        if (this.manageModalEvents) {
            const { deleteBtn, cancelBtn, closeBtn, modal } = this.manageModalEvents;
            deleteBtn.removeEventListener('click', this.manageModalEvents.handleDelete);
            cancelBtn.removeEventListener('click', this.manageModalEvents.handleClose);
            closeBtn.removeEventListener('click', this.manageModalEvents.handleClose);
            modal.removeEventListener('click', this.manageModalEvents.handleBackdrop);
            delete this.manageModalEvents;
        }
    }

    // Inputs Modal Methods
    showInputsModal() {
        const modal = document.getElementById('inputsModal');
        this.populateInputsList();
        modal.classList.add('show');
        this.setupInputsModalEvents();
    }

    setupInputsModalEvents() {
        // Add input button
        this.elements.addInputBtn.addEventListener('click', () => {
            this.addInput();
        });

        // Save inputs button
        this.elements.saveInputsBtn.addEventListener('click', () => {
            this.saveInputs();
        });

        // Clear inputs button
        this.elements.clearInputsBtn.addEventListener('click', () => {
            this.clearInputs();
        });

        // Cancel button
        this.elements.cancelInputsBtn.addEventListener('click', () => {
            this.closeInputsModal();
        });

        // Modal close button
        const modal = document.getElementById('inputsModal');
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeInputsModal();
            });
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeInputsModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', this.handleInputsModalEscape);
    }

    handleInputsModalEscape = (e) => {
        if (e.key === 'Escape') {
            this.closeInputsModal();
        }
    }

    closeInputsModal() {
        const modal = document.getElementById('inputsModal');
        modal.classList.remove('show');
        this.removeInputsModalEvents();
    }

    removeInputsModalEvents() {
        // Remove event listeners to prevent memory leaks
        const addBtn = this.elements.addInputBtn;
        const saveBtn = this.elements.saveInputsBtn;
        const clearBtn = this.elements.clearInputsBtn;
        const cancelBtn = this.elements.cancelInputsBtn;
        
        if (addBtn) addBtn.replaceWith(addBtn.cloneNode(true));
        if (saveBtn) saveBtn.replaceWith(saveBtn.cloneNode(true));
        if (clearBtn) clearBtn.replaceWith(clearBtn.cloneNode(true));
        if (cancelBtn) cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        
        document.removeEventListener('keydown', this.handleInputsModalEscape);
    }

    populateInputsList() {
        const inputsList = this.elements.inputsList;
        
        if (this.inputs.length === 0) {
            inputsList.innerHTML = `
                <div class="inputs-empty">
                    <h5>No inputs configured</h5>
                    <p>Add inputs to organize your data processing</p>
                </div>
            `;
            return;
        }

        inputsList.innerHTML = '';
        
        this.inputs.forEach((input, index) => {
            const inputItem = this.createInputItem(input, index);
            inputsList.appendChild(inputItem);
        });
    }

    createInputItem(input, index) {
        const inputItem = document.createElement('div');
        inputItem.className = 'input-item';
        inputItem.innerHTML = `
            <div class="input-item-header">
                <div class="input-item-name">${input.name || 'Unnamed Input'}</div>
                <div class="input-item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="window.ttpEditor.duplicateInput(${index})">📋 Duplicate</button>
                    <button class="btn btn-danger btn-sm" onclick="window.ttpEditor.removeInput(${index})">🗑️ Remove</button>
                </div>
            </div>
            <div class="input-fields">
                <div class="input-field">
                    <label>Input Name *</label>
                    <input type="text" value="${input.name || ''}" onchange="window.ttpEditor.updateInputField(${index}, 'name', this.value)" placeholder="e.g., router_config">
                    <div class="input-field-help">Unique name for this input</div>
                </div>
                <div class="input-field">
                    <label>Template Name</label>
                    <input type="text" value="${input.template_name || ''}" onchange="window.ttpEditor.updateInputField(${index}, 'template_name', this.value)" placeholder="e.g., _root_template_">
                    <div class="input-field-help">Template to use (default: _root_template_)</div>
                </div>
                <div class="input-field">
                    <label>Groups</label>
                    <input type="text" value="${input.groups || ''}" onchange="window.ttpEditor.updateInputField(${index}, 'groups', this.value)" placeholder="e.g., group1,group2">
                    <div class="input-field-help">Comma-separated group names</div>
                </div>
                <div class="input-field full-width">
                    <label>Data Content</label>
                    <textarea onchange="window.ttpEditor.updateInputField(${index}, 'data', this.value)" placeholder="Paste your data here...">${input.data || ''}</textarea>
                    <div class="input-field-help">The actual data content for this input</div>
                </div>
            </div>
        `;
        return inputItem;
    }

    addInput() {
        const newInput = {
            name: `input_${this.inputCounter + 1}`,
            template_name: '_root_template_',
            groups: '',
            data: ''
        };
        
        this.inputs.push(newInput);
        this.inputCounter++;
        this.populateInputsList();
    }

    updateInputField(index, field, value) {
        if (this.inputs[index]) {
            this.inputs[index][field] = value;
        }
    }

    duplicateInput(index) {
        if (this.inputs[index]) {
            const original = this.inputs[index];
            const duplicate = {
                name: `${original.name}_copy`,
                template_name: original.template_name,
                groups: original.groups,
                data: original.data
            };
            
            this.inputs.splice(index + 1, 0, duplicate);
            this.populateInputsList();
        }
    }

    removeInput(index) {
        if (this.inputs[index]) {
            this.inputs.splice(index, 1);
            this.populateInputsList();
        }
    }

    saveInputs() {
        // Validate inputs
        const validInputs = this.inputs.filter(input => input.name && input.name.trim() !== '');
        
        if (validInputs.length === 0) {
            this.showNotification('No valid inputs to save', 'warning');
            return;
        }

        // Check for duplicate names
        const names = validInputs.map(input => input.name);
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        
        if (duplicates.length > 0) {
            this.showNotification(`Duplicate input names found: ${duplicates.join(', ')}`, 'error');
            return;
        }

        // Save inputs
        this.inputs = validInputs;
        
        // Update TTP processor with inputs
        this.updateTTPProcessorInputs();
        
        this.showNotification(`Saved ${validInputs.length} input(s)`, 'success');
        this.closeInputsModal();
    }

    clearInputs() {
        if (this.inputs.length === 0) {
            this.showNotification('No inputs to clear', 'info');
            return;
        }

        if (confirm('Are you sure you want to clear all inputs?')) {
            this.inputs = [];
            this.inputCounter = 0;
            this.populateInputsList();
            this.updateTTPProcessorInputs();
            this.showNotification('All inputs cleared', 'success');
        }
    }

    updateTTPProcessorInputs() {
        if (!this.ttpProcessor) return;

        // Clear existing inputs
        this.ttpProcessor.clearInputs();
        
        // Add each input
        this.inputs.forEach(input => {
            if (input.name && input.data) {
                const groups = input.groups ? input.groups.split(',').map(g => g.trim()).filter(g => g) : null;
                this.ttpProcessor.addInput(input.data, input.name, input.template_name, groups);
            }
        });
    }

    // Packages Modal Methods
    showPackagesModal() {
        const modal = document.getElementById('packagesModal');
        this.populatePackagesList();
        modal.classList.add('show');
        this.setupPackagesModalEvents();
    }

    setupPackagesModalEvents() {
        // Add package button
        this.elements.addPackageBtn.addEventListener('click', () => {
            this.addPackage();
        });

        // Save packages button
        this.elements.savePackagesBtn.addEventListener('click', () => {
            this.savePackages();
        });

        // Clear packages button
        this.elements.clearPackagesBtn.addEventListener('click', () => {
            this.clearPackages();
        });

        // Cancel button
        this.elements.cancelPackagesBtn.addEventListener('click', () => {
            this.closePackagesModal();
        });

        // Modal close button
        const modal = document.getElementById('packagesModal');
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closePackagesModal();
            });
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePackagesModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', this.handlePackagesModalEscape);

        // Delegated click for install buttons to survive re-renders
        if (this.elements.packagesList && !this._packagesInstallDelegated) {
            this.elements.packagesList.addEventListener('click', (e) => {
                const btn = e.target.closest('button.install-btn');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const packageItems = Array.from(this.elements.packagesList.querySelectorAll('.package-item'));
                    const itemEl = e.target.closest('.package-item');
                    const index = packageItems.indexOf(itemEl);
                    if (index >= 0) {
                        window.safeInstallPackage(index);
                    }
                }
            });
            this._packagesInstallDelegated = true;
        }
    }

    handlePackagesModalEscape = (e) => {
        if (e.key === 'Escape') {
            this.closePackagesModal();
        }
    }

    closePackagesModal() {
        const modal = document.getElementById('packagesModal');
        modal.classList.remove('show');
        this.removePackagesModalEvents();
    }

    removePackagesModalEvents() {
        // Remove event listeners to prevent memory leaks
        const addBtn = this.elements.addPackageBtn;
        const saveBtn = this.elements.savePackagesBtn;
        const clearBtn = this.elements.clearPackagesBtn;
        const cancelBtn = this.elements.cancelPackagesBtn;
        
        if (addBtn) addBtn.replaceWith(addBtn.cloneNode(true));
        if (saveBtn) saveBtn.replaceWith(saveBtn.cloneNode(true));
        if (clearBtn) clearBtn.replaceWith(clearBtn.cloneNode(true));
        if (cancelBtn) cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        
        document.removeEventListener('keydown', this.handlePackagesModalEscape);
    }

    populatePackagesList() {
        const packagesList = this.elements.packagesList;
        
        console.log('populatePackagesList: Packages array has', this.packages.length, 'items');
        console.log('populatePackagesList: Packages data:', this.packages);
        
        if (this.packages.length === 0) {
            packagesList.innerHTML = `
                <div class="packages-empty">
                    <h5>No packages configured</h5>
                    <p>Add Python packages to extend TTP functionality</p>
                </div>
            `;
            return;
        }

        packagesList.innerHTML = '';
        
        this.packages.forEach((pkg, index) => {
            console.log('populatePackagesList: Creating item for package', index, pkg);
            const packageItem = this.createPackageItem(pkg, index);
            packagesList.appendChild(packageItem);
        });
    }

    createPackageItem(pkg, index) {
        const statusIcon = this.getStatusIcon(pkg.status);
        const statusClass = this.getStatusClass(pkg.status);
        const isInstalled = pkg.status === 'success';
        const canInstall = pkg.name && pkg.name.trim() && (pkg.status === 'pending' || pkg.status === 'error');
        
        console.log('createPackageItem debug:', { 
            index, 
            pkgName: pkg.name, 
            pkgStatus: pkg.status, 
            canInstall,
            hasName: !!pkg.name,
            nameTrimmed: pkg.name ? pkg.name.trim() : '',
            isPending: pkg.status === 'pending',
            isError: pkg.status === 'error'
        });
        
        const packageItem = document.createElement('div');
        packageItem.className = `package-item ${statusClass}`;
        packageItem.innerHTML = `
            <div class="package-item-header">
                <div class="package-item-name">
                    ${statusIcon} ${pkg.name || 'Unnamed Package'}
                    ${pkg.status === 'installing' ? '<span class="loading-spinner">⏳</span>' : ''}
                </div>
                <div class="package-item-actions">
                    ${canInstall ? `<button class="btn btn-primary btn-sm install-btn" type="button" onclick="event.preventDefault(); event.stopPropagation(); window.safeInstallPackage(${index})">📦 Install</button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="window.safeRemovePackage(${index})">🗑️ Remove</button>
                </div>
            </div>
            <div class="package-fields">
                <div class="package-field">
                    <label>Package Name/URL *</label>
                    <input type="text" value="${pkg.name || ''}" onchange="window.safeUpdatePackageField(${index}, 'name', this.value)" oninput="window.safeUpdatePackageFieldDebounced(${index}, 'name', this.value); window.safeValidatePackageField(${index}, this.value, this)" placeholder="e.g., requests or https://example.com/package.whl" ${isInstalled ? 'readonly' : ''}>
                    <div class="package-field-help">PyPI package name or full URL to wheel file</div>
                    <div class="package-validation-message" id="validation-${index}" style="display: none;"></div>
                </div>
                <div class="package-field">
                    <label>Source Type</label>
                    <select onchange="window.safeUpdatePackageField(${index}, 'source', this.value); const input = document.querySelector('input[onchange*=\"safeUpdatePackageField(${index}\"]'); if(input) window.safeValidatePackageField(${index}, input.value, input);" ${isInstalled ? 'disabled' : ''}>
                        <option value="pypi" ${pkg.source === 'pypi' ? 'selected' : ''}>PyPI</option>
                        <option value="url" ${pkg.source === 'url' ? 'selected' : ''}>URL</option>
                    </select>
                    <div class="package-field-help">Package source type</div>
                </div>
            </div>
            ${pkg.status === 'error' && pkg.error ? `<div class="package-error">❌ ${pkg.error}</div>` : ''}
            ${pkg.status === 'success' ? `<div class="package-success">✅ Successfully installed and ready to use</div>` : ''}
        `;
        
        // Note: Event handlers are set via HTML oninput/onchange attributes
        
        return packageItem;
    }

    addPackage() {
        const newPackage = {
            name: '',
            source: 'pypi',
            status: 'pending', // pending, installing, success, error
            error: null
        };
        
        console.log('addPackage: Adding new package', newPackage);
        this.packages.push(newPackage);
        this.packageCounter++;
        console.log('addPackage: Packages array now has', this.packages.length, 'items');
        this.populatePackagesList();
    }

    updatePackageField(index, field, value, debounced = false) {
        // Ensure we have a valid instance and packages array
        if (!this || !this.packages || !this.packages[index]) {
            console.warn('updatePackageField: Invalid state', { index, field, value, hasThis: !!this, hasPackages: !!this?.packages, packagesLength: this?.packages?.length });
            return;
        }
        
        console.log('updatePackageField:', { index, field, value, before: this.packages[index][field], debounced });
        this.packages[index][field] = value;
        console.log('updatePackageField: Updated', { index, field, value, after: this.packages[index][field] });
        
        // If updating the name field, use debounced install button update
        if (field === 'name' && debounced) {
            this.debouncedUpdateInstallButton(index);
        } else if (field === 'name' && !debounced) {
            // Immediate update for onchange events
            this.updateInstallButtonVisibility(index);
        }
    }

    debouncedUpdateInstallButton(index) {
        // Clear any existing timeout for this package
        if (this.installButtonTimeouts.has(index)) {
            console.log('debouncedUpdateInstallButton: Clearing existing timeout for package', index);
            clearTimeout(this.installButtonTimeouts.get(index));
        }
        
        // Set a new timeout to update the install button after user stops typing
        const timeoutId = window.setTimeout(() => {
            console.log('debouncedUpdateInstallButton: Timeout fired for package', index);
            this.updateInstallButtonVisibility(index);
            this.installButtonTimeouts.delete(index);
        }, 150); // 150ms delay
        
        this.installButtonTimeouts.set(index, timeoutId);
        console.log('debouncedUpdateInstallButton: Set timeout for package', index, 'delay: 150ms, timeoutId:', timeoutId);
    }

    updateInstallButtonVisibility(index) {
        const pkg = this.packages[index];
        if (!pkg) return;

        // Find the package item in the DOM
        const packageItems = document.querySelectorAll('.package-item');
        const packageItem = packageItems[index];
        if (!packageItem) return;

        // Find the install button container
        const actionsContainer = packageItem.querySelector('.package-item-actions');
        if (!actionsContainer) return;

        // Determine if install button should be shown
        const canInstall = pkg.name && pkg.name.trim() && (pkg.status === 'pending' || pkg.status === 'error');
        
        console.log('updateInstallButtonVisibility:', { index, pkgName: pkg.name, pkgStatus: pkg.status, canInstall });

        // Remove all existing install buttons first (by class to be robust)
        const existingInstallBtns = actionsContainer.querySelectorAll('button.install-btn, button[onclick*="safeInstallPackage"]');
        existingInstallBtns.forEach(btn => btn.remove());

        // Add install button if needed
        if (canInstall) {
            const installBtn = document.createElement('button');
            installBtn.className = 'btn btn-primary btn-sm install-btn';
            installBtn.type = 'button';
            installBtn.innerHTML = '📦 Install';
            installBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.safeInstallPackage(index);
            });
            
            // Insert before the remove button
            const removeBtn = actionsContainer.querySelector('button[onclick*="safeRemovePackage"]');
            if (removeBtn) {
                actionsContainer.insertBefore(installBtn, removeBtn);
            } else {
                actionsContainer.appendChild(installBtn);
            }
            console.log('updateInstallButtonVisibility: Added install button for package', index);
        } else {
            console.log('updateInstallButtonVisibility: No install button needed for package', index);
        }
    }

    validatePackageField(index, value, inputElement) {
        // Ensure we have a valid instance and packages array
        if (!this || !this.packages || !this.packages[index]) {
            console.warn('validatePackageField: Invalid state', { index, value, hasThis: !!this, hasPackages: !!this?.packages });
            return;
        }

        const packageName = value.toLowerCase().trim();
        const source = this.packages[index].source;
        const validationElement = document.getElementById(`validation-${index}`);
        
        console.log('validatePackageField:', { index, value, packageName, source, hasValidationElement: !!validationElement });
        
        if (!validationElement) {
            console.warn('validatePackageField: Validation element not found', `validation-${index}`);
            return;
        }

        // Clear previous validation
        validationElement.style.display = 'none';
        validationElement.className = 'package-validation-message';
        inputElement.style.borderColor = '';

        if (!packageName) {
            validationElement.style.display = 'none';
            return;
        }

        const knownIncompatible = [
            'numpy', 'pandas', 'scipy', 'matplotlib', 'tensorflow', 'torch', 'pytorch',
            'opencv-python', 'pillow', 'scikit-learn', 'numba', 'cython', 'lxml',
            'psycopg2', 'mysql-connector-python', 'pymongo', 'redis', 'sqlalchemy'
        ];

        const suspiciousPatterns = [
            'numpy', 'pandas', 'scipy', 'matplotlib', 'tensorflow', 'torch',
            'opencv', 'pillow', 'sklearn', 'numba', 'cython', 'lxml',
            'psycopg', 'mysql', 'mongo', 'redis', 'sqlalchemy'
        ];

        let message = '';
        let isError = false;

        // Check for known incompatible packages
        if (knownIncompatible.some(incompatible => packageName.includes(incompatible))) {
            message = `⚠️ "${value}" is known to be incompatible with Pyodide (contains C extensions)`;
            isError = true;
        }
        // Validate URL format for URL packages
        else if (source === 'url') {
            if (!packageName.startsWith('http://') && !packageName.startsWith('https://')) {
                message = `⚠️ URL should start with http:// or https://`;
                isError = true;
            } else if (!packageName.endsWith('.whl')) {
                message = `⚠️ URL should point to a .whl file`;
                isError = true;
            } else {
                message = `✅ URL format looks correct`;
            }
        }
        // Validate PyPI package name format
        else if (source === 'pypi') {
            if (packageName.includes('/') || packageName.includes('\\')) {
                message = `⚠️ This looks like a URL but source is set to PyPI`;
                isError = true;
            } else if (suspiciousPatterns.some(pattern => packageName.includes(pattern))) {
                message = `⚠️ "${value}" may contain C extensions. Verify it's pure Python.`;
                isError = true;
            } else {
                message = `✅ Package name looks good - will be installed when you process a template`;
            }
        }

        if (message) {
            console.log('validatePackageField: Showing message', { message, isError });
            validationElement.textContent = message;
            validationElement.className = `package-validation-message ${isError ? 'error' : 'success'}`;
            validationElement.style.display = 'block';
            inputElement.style.borderColor = isError ? '#f56565' : '#68d391';
        } else {
            console.log('validatePackageField: No message to show');
        }
    }

    removePackage(index) {
        if (this.packages[index]) {
            // Clear any pending timeout for this package
            if (this.installButtonTimeouts.has(index)) {
                clearTimeout(this.installButtonTimeouts.get(index));
                this.installButtonTimeouts.delete(index);
            }
            
            this.packages.splice(index, 1);
            this.populatePackagesList();
        }
    }

    savePackages() {
        // Only save successfully installed packages
        const installedPackages = this.packages.filter(pkg => pkg.status === 'success');
        const pendingPackages = this.packages.filter(pkg => pkg.status === 'pending' || pkg.status === 'installing');
        const errorPackages = this.packages.filter(pkg => pkg.status === 'error');
        
        if (installedPackages.length === 0) {
            this.showNotification('No successfully installed packages to save', 'warning');
            return;
        }

        if (pendingPackages.length > 0) {
            this.showNotification(`⚠️ ${pendingPackages.length} package(s) not installed yet. Install them first or they will be removed.`, 'warning');
        }

        if (errorPackages.length > 0) {
            this.showNotification(`⚠️ ${errorPackages.length} package(s) failed to install and will be removed.`, 'warning');
        }

        // Save only successfully installed packages
        this.packages = installedPackages;
        
        // Update TTP processor with packages
        this.updateTTPProcessorPackages();
        
        this.showNotification(`✅ Saved ${installedPackages.length} successfully installed package(s)`, 'success');
        this.closePackagesModal();
    }

    validatePackages(packages) {
        const knownIncompatible = [
            'numpy', 'pandas', 'scipy', 'matplotlib', 'tensorflow', 'torch', 'pytorch',
            'opencv-python', 'pillow', 'scikit-learn', 'numba', 'cython', 'lxml',
            'psycopg2', 'mysql-connector-python', 'pymongo', 'redis', 'sqlalchemy'
        ];

        const knownCompatible = [
            'requests', 'pyyaml', 'jsonschema', 'python-dateutil', 'urllib3',
            'certifi', 'charset-normalizer', 'idna', 'pyparsing', 'six',
            'typing-extensions', 'zipp', 'importlib-metadata', 'packaging'
        ];

        for (const pkg of packages) {
            const packageName = pkg.name.toLowerCase().trim();
            
            // Check for known incompatible packages
            if (knownIncompatible.some(incompatible => packageName.includes(incompatible))) {
                return {
                    isValid: false,
                    message: `Package "${pkg.name}" is known to be incompatible with Pyodide (contains C extensions). Please use a pure Python alternative.`
                };
            }

            // Validate URL format for URL packages
            if (pkg.source === 'url') {
                if (!packageName.startsWith('http://') && !packageName.startsWith('https://')) {
                    return {
                        isValid: false,
                        message: `Package "${pkg.name}" appears to be a URL but doesn't start with http:// or https://`
                    };
                }
                if (!packageName.endsWith('.whl')) {
                    return {
                        isValid: false,
                        message: `Package "${pkg.name}" should be a .whl file for URL packages`
                    };
                }
            }

            // Validate PyPI package name format
            if (pkg.source === 'pypi') {
                if (packageName.includes('/') || packageName.includes('\\')) {
                    return {
                        isValid: false,
                        message: `Package "${pkg.name}" appears to be a URL but source is set to PyPI. Please change source to URL or use just the package name.`
                    };
                }
                
                // Check for common patterns that suggest C extensions
                const suspiciousPatterns = [
                    'numpy', 'pandas', 'scipy', 'matplotlib', 'tensorflow', 'torch',
                    'opencv', 'pillow', 'sklearn', 'numba', 'cython', 'lxml',
                    'psycopg', 'mysql', 'mongo', 'redis', 'sqlalchemy'
                ];
                
                if (suspiciousPatterns.some(pattern => packageName.includes(pattern))) {
                    return {
                        isValid: false,
                        message: `Package "${pkg.name}" may contain C extensions and might not work with Pyodide. Please verify it's pure Python or use a URL to a compatible wheel file.`
                    };
                }
            }
        }

        return { isValid: true, message: '' };
    }

    clearPackages() {
        if (this.packages.length === 0) {
            this.showNotification('No packages to clear', 'info');
            return;
        }

        if (confirm('Are you sure you want to clear all packages?')) {
            this.packages = [];
            this.packageCounter = 0;
            this.populatePackagesList();
            this.updateTTPProcessorPackages();
            this.showNotification('All packages cleared', 'success');
        }
    }

    updateTTPProcessorPackages() {
        if (!this.ttpProcessor) return;

        // Update packages in TTP processor
        this.ttpProcessor.setPackages(this.packages);
    }

    getStatusIcon(status) {
        switch (status) {
            case 'pending': return '⏳';
            case 'installing': return '📦';
            case 'success': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    }

    getStatusClass(status) {
        switch (status) {
            case 'pending': return 'package-pending';
            case 'installing': return 'package-installing';
            case 'success': return 'package-success';
            case 'error': return 'package-error';
            default: return 'package-pending';
        }
    }

    async installPackage(index) {
        if (!this.packages[index] || !this.ttpProcessor) return;

        const pkg = this.packages[index];
        if (!pkg.name || !pkg.name.trim()) {
            this.showNotification('Please enter a package name first', 'warning');
            return;
        }

        // Set status to installing
        pkg.status = 'installing';
        pkg.error = null;
        this.populatePackagesList();

        try {
            console.log(`Installing package: ${pkg.name} from ${pkg.source}`);
            
            // Install the package using TTP processor
            const success = await this.ttpProcessor.installPackage(pkg.name, pkg.source);
            
            if (success) {
                pkg.status = 'success';
                pkg.error = null;
                this.showNotification(`✅ Successfully installed ${pkg.name}`, 'success');
            } else {
                pkg.status = 'error';
                pkg.error = 'Installation failed';
                this.showNotification(`❌ Failed to install ${pkg.name}`, 'error');
            }
        } catch (error) {
            console.error('Package installation error:', error);
            pkg.status = 'error';
            pkg.error = error.message || 'Installation failed';
            this.showNotification(`❌ Error installing ${pkg.name}: ${pkg.error}`, 'error');
        }

        this.populatePackagesList();
    }

    hideLoadingOverlay() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.style.display = 'none';
        }
    }

    // Status Bar Methods
    updateStatusMessage(message) {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.textContent = message;
        }
    }

    async updateVersionInfo() {
        if (!this.ttpProcessor || !this.ttpProcessor.isReady()) {
            return;
        }

        try {
            // Get Python version
            const pythonVersion = await this.ttpProcessor.getPythonVersion();
            if (this.elements.pythonVersion && pythonVersion) {
                this.elements.pythonVersion.textContent = `Python: ${pythonVersion}`;
            }

            // Get TTP version
            const ttpVersion = await this.ttpProcessor.getTTPVersion();
            if (this.elements.ttpVersion && ttpVersion) {
                this.elements.ttpVersion.textContent = `TTP: ${ttpVersion}`;
            }
        } catch (error) {
            console.warn('Failed to get version info:', error);
            if (this.elements.pythonVersion) {
                this.elements.pythonVersion.textContent = 'Python: Unknown';
            }
            if (this.elements.ttpVersion) {
                this.elements.ttpVersion.textContent = 'TTP: Unknown';
            }
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
            
            // Apply inputs
            if (config.inputs) {
                this.applyInputs(config.inputs);
            }
            
            // Apply packages
            if (config.packages) {
                this.applyPackages(config.packages);
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

    applyInputs(inputs) {
        if (Array.isArray(inputs)) {
            this.inputs = inputs.map((input, index) => ({
                name: input.name || `input_${index + 1}`,
                template_name: input.template_name || '_root_template_',
                groups: input.groups || '',
                data: input.data || ''
            }));
            this.inputCounter = inputs.length;
            
            // Update TTP processor
            if (this.ttpProcessor) {
                this.ttpProcessor.clearInputs();
                this.inputs.forEach(input => {
                    if (input.name && input.data) {
                        const groups = input.groups ? input.groups.split(',').map(g => g.trim()).filter(g => g) : null;
                        this.ttpProcessor.addInput(input.data, input.name, input.template_name, groups);
                    }
                });
            }
        }
    }

    applyPackages(packages) {
        if (Array.isArray(packages)) {
            this.packages = packages.map((pkg, index) => ({
                name: pkg.name || `package_${index + 1}`,
                source: pkg.source || 'pypi'
            }));
            this.packageCounter = packages.length;
            
            // Update TTP processor
            if (this.ttpProcessor) {
                this.ttpProcessor.setPackages(this.packages);
            }
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
    
    // Make editor globally available
    window.ttpEditor = editor;
    
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

// Global helper functions for HTML event handlers
window.safeUpdatePackageField = function(index, field, value) {
    console.log('safeUpdatePackageField called:', { index, field, value, hasEditor: !!window.ttpEditor });
    if (window.ttpEditor && window.ttpEditor.updatePackageField) {
        window.ttpEditor.updatePackageField(index, field, value, false); // immediate update
    } else {
        console.warn('safeUpdatePackageField: TTP Editor not available');
    }
};

window.safeUpdatePackageFieldDebounced = function(index, field, value) {
    console.log('safeUpdatePackageFieldDebounced called:', { index, field, value, hasEditor: !!window.ttpEditor });
    if (window.ttpEditor && window.ttpEditor.updatePackageField) {
        window.ttpEditor.updatePackageField(index, field, value, true); // debounced update
    } else {
        console.warn('safeUpdatePackageFieldDebounced: TTP Editor not available');
    }
};

window.safeValidatePackageField = function(index, value, inputElement) {
    console.log('safeValidatePackageField called:', { index, value, hasEditor: !!window.ttpEditor });
    if (window.ttpEditor && window.ttpEditor.validatePackageField) {
        window.ttpEditor.validatePackageField(index, value, inputElement);
    } else {
        console.warn('safeValidatePackageField: TTP Editor not available');
    }
};

window.safeRemovePackage = function(index) {
    console.log('safeRemovePackage called:', { index, hasEditor: !!window.ttpEditor });
    if (window.ttpEditor && window.ttpEditor.removePackage) {
        window.ttpEditor.removePackage(index);
    } else {
        console.warn('safeRemovePackage: TTP Editor not available');
    }
};

window.safeInstallPackage = function(index) {
    console.log('safeInstallPackage called:', { index, hasEditor: !!window.ttpEditor });
    if (window.ttpEditor && window.ttpEditor.installPackage) {
        window.ttpEditor.installPackage(index);
    } else {
        console.warn('safeInstallPackage: TTP Editor not available');
    }
};
