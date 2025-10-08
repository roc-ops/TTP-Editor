// TTP Processor - Handles all TTP-related operations using Pyodide

class TTPProcessor {
    constructor() {
        this.pyodide = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.globalVars = null;
        this.customFunctions = [];
        this.lookupTables = [];
        this.inputs = [];
        this.basePythonCode = null;
    }

    async initialize() {
        if (this.isInitialized) {
            return this.pyodide;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    generatePythonCode() {
        // Generate custom functions code
        let customFunctionsCode = '';
        if (this.customFunctions && this.customFunctions.length > 0) {
            customFunctionsCode = this.customFunctions
                .filter(f => f && f.code && f.code.trim() && f.code.includes('def '))
                .map(f => f.code.trim())
                .filter(code => code.length > 0)
                .join('\n\n');
        }

        return `
import json
import yaml
from ttp import ttp
import traceback
import sys
from io import StringIO

# Custom functions start here
${customFunctionsCode}
# Custom functions end here

# Redirect Python stdout to browser console
import js
def print_to_console(*args, **kwargs):
    js.console.log(' '.join(map(str, args)))
sys.stdout.write = print_to_console

def process_ttp_template(data_text, template_text, output_format='json', global_vars_text='', global_vars_format='json', custom_functions_text='', custom_functions_data=None, lookup_tables_data=None, inputs_data=None):
    """
    Process TTP template with given data

    Args:
        data_text (str): Raw text data to parse
        template_text (str): TTP template
        output_format (str): Output format - 'json', 'yaml', or 'python'

    Returns:
        dict: Result with 'success', 'data', 'error', 'stats' keys
    """
    try:
        # Import required modules at the top
        import json
        import yaml

        # Parse global variables if provided
        global_vars_dict = {}
        if global_vars_text and global_vars_text.strip():
            try:
                if global_vars_format == 'json':
                    global_vars_dict = json.loads(global_vars_text)
                elif global_vars_format == 'yaml':
                    global_vars_dict = yaml.safe_load(global_vars_text)
                elif global_vars_format == 'python':
                    # Evaluate Python dict string
                    global_vars_dict = eval(global_vars_text)
                else:
                    global_vars_dict = {}

                print(f"TTP Debug: Parsed global variables from {global_vars_format} format: {global_vars_dict}")
            except Exception as e:
                print(f"TTP Debug: Error parsing global variables: {str(e)}")
                global_vars_dict = {}

        # Create TTP parser with global variables
        parser = ttp()

        # Add custom functions from modal
        if custom_functions_data:
            for func_config in custom_functions_data:
                try:
                    # Convert JavaScript object to Python dict properly
                    if hasattr(func_config, 'to_py'):
                        func_dict = func_config.to_py()
                    else:
                        func_dict = dict(func_config)

                    func_name = func_dict.get('function_name')
                    scope = func_dict.get('scope')
                    name = func_dict.get('name') if func_dict.get('name') else None
                    add_ttp = func_dict.get('add_ttp', False)

                    print(f"TTP Debug: Processing function config: {func_dict}")

                    # Validate function before adding
                    if func_name and scope and func_name in globals():
                        func = globals()[func_name]
                        # Additional validation - check if it's actually a function
                        if callable(func):
                            parser.add_function(func, scope, name=name, add_ttp=add_ttp)
                            print(f"TTP Debug: Added function {func_name} with scope {scope}")
                        else:
                            print(f"TTP Debug: {func_name} is not callable, skipping")
                    else:
                        print(f"TTP Debug: Missing required function_name, scope, or function not found: {func_name}, {scope}")
                except Exception as e:
                    print(f"TTP Debug: Error adding function: {str(e)}")
                    import traceback
                    print(f"TTP Debug: Traceback: {traceback.format_exc()}")

        parser.add_template(template_text)
        # Add lookup tables from modal
        if lookup_tables_data:
            for lookup_config in lookup_tables_data:
                try:
                    # Convert JavaScript object to Python dict properly
                    if hasattr(lookup_config, 'to_py'):
                        lookup_dict = lookup_config.to_py()
                    else:
                        lookup_dict = dict(lookup_config)

                    lookup_name = lookup_dict.get('name')
                    lookup_text_data = lookup_dict.get('text_data', '')
                    lookup_load = lookup_dict.get('load', 'python')

                    print(f"TTP Debug: Processing lookup table: {lookup_name} with load format {lookup_load}")

                    if lookup_name and lookup_text_data.strip():
                        # Use add_lookup method with the specified load format
                        parser.add_lookup(lookup_name, text_data=lookup_text_data, load=lookup_load)
                        print(f"TTP Debug: Added lookup table '{lookup_name}' with load format '{lookup_load}'")
                        print(f"TTP Debug: Lookup table data: {lookup_text_data}")
                    else:
                        print(f"TTP Debug: Missing required lookup name or text data: {lookup_name}")
                except Exception as e:
                    print(f"TTP Debug: Error adding lookup table: {str(e)}")
                    import traceback
                    print(f"TTP Debug: Traceback: {traceback.format_exc()}")

        
        # Add inputs - use configured inputs if available, otherwise fall back to single data input
        if inputs_data and len(inputs_data) > 0:
            for input_config in inputs_data:
                try:
                    # Convert JavaScript object to Python dict properly
                    if hasattr(input_config, 'to_py'):
                        input_dict = input_config.to_py()
                    else:
                        input_dict = dict(input_config)
                    
                    input_data = input_dict.get('data', '')
                    input_name = input_dict.get('input_name', 'Default_Input')
                    template_name = input_dict.get('template_name', '_root_template_')
                    groups = input_dict.get('groups')
                    
                    print(f"TTP Debug: Adding input '{input_name}' to template '{template_name}'")
                    
                    if input_data.strip():
                        if groups:
                            # Convert groups string to list
                            groups_list = [g.strip() for g in groups.split(',') if g.strip()]
                            parser.add_input(data=input_data, input_name=input_name, template_name=template_name, groups=groups_list)
                        else:
                            parser.add_input(data=input_data, input_name=input_name, template_name=template_name)
                        print(f"TTP Debug: Added input '{input_name}' with {len(input_data)} characters")
                    else:
                        print(f"TTP Debug: Skipping empty input '{input_name}'")
                except Exception as e:
                    print(f"TTP Debug: Error adding input: {str(e)}")
                    import traceback
                    print(f"TTP Debug: Traceback: {traceback.format_exc()}")
        else:
            # Fallback to single data input
            parser.add_input(data=data_text, template_name="_all_")
            print(f"TTP Debug: Using fallback single data input with {len(data_text)} characters")
        
        parser.add_vars(global_vars_dict)

        # Debug: Check if template has macros
        if 'macro(' in template_text:
            print("TTP Debug: Template contains macro calls")

        # Parse the data
        parser.parse()

        # Get results
        results = parser.result()

        # TTP returns results in nested arrays like [[{data}]]
        # Use all results instead of just the first group
        actual_data = results if results else []

        # Format output based on requested format
        if output_format == 'yaml':
            formatted_data = yaml.dump(actual_data, default_flow_style=False, indent=2)
        elif output_format == 'python':
            formatted_data = repr(actual_data)
        else:  # json
            formatted_data = json.dumps(actual_data, indent=2, ensure_ascii=False)

        # Calculate some basic stats
        # Count total items across all result groups
        total_items = 0
        if results:
            for group in results:
                if isinstance(group, list):
                    total_items += len(group)
                else:
                    total_items += 1

        stats = {
            'template_groups': len([line for line in template_text.split('\\\\n') if '<group' in line]),
            'parsed_items': total_items,
            'data_lines': len([line for line in data_text.split('\\\\n') if line.strip()])
        }

        return {
            'success': True,
            'data': formatted_data,
            'raw_results': results,
            'stats': stats,
            'error': None
        }

    except Exception as e:
        # Extract the first (most accurate) error from the traceback
        traceback_text = traceback.format_exc()
        first_error = str(e)

        # Look for the first ParseError in the traceback
        import re
        parse_error_match = re.search(r'ParseError: ([^\\\\n]+)', traceback_text)
        if parse_error_match:
            first_error = f"ParseError: {parse_error_match.group(1)}"

        error_info = {
            'type': type(e).__name__,
            'message': first_error,
            'traceback': traceback.format_exc()
        }

        # Try to provide more context about the error
        error_message = first_error
        if 'line' in error_message and 'column' in error_message:
            # TTP wraps templates in <template> tags, so line numbers are offset by 1
            if 'not well-formed' in error_message or 'invalid token' in error_message:
                # Extract line number and adjust for TTP wrapper
                import re
                line_match = re.search(r'line (\\\\d+)', error_message)
                if line_match:
                    reported_line = int(line_match.group(1))
                    template_lines = len(template_text.split('\\\\n'))
                    if reported_line > template_lines:
                        # This is likely the closing </template> tag
                        actual_line = template_lines
                        error_info['context'] = f'Error at end of template (line {actual_line}). TTP wraps templates in XML tags, so reported line {reported_line} refers to the wrapper.'
                    elif reported_line > 1:
                        # Adjust for the opening <template> tag
                        actual_line = reported_line - 1
                        error_info['context'] = f'Error at template line {actual_line} (TTP reports line {reported_line} due to XML wrapper).'
                    else:
                        error_info['context'] = f'Error at template line {reported_line}.'
                else:
                    error_info['context'] = 'This is a template syntax error. Check your TTP template format.'
            elif 'template' in error_message.lower():
                error_info['context'] = 'This error refers to the TTP template syntax.'

        return {
            'success': False,
            'data': None,
            'raw_results': None,
            'stats': None,
            'error': error_info
        }

def validate_ttp_template(template_text):
    """
    Validate TTP template syntax

    Args:
        template_text (str): TTP template to validate

    Returns:
        dict: Validation result with 'valid', 'errors', 'warnings' keys
    """
    try:
        # Try to create a parser with the template
        parser = ttp(data="test", template=template_text)

        return {
            'valid': True,
            'errors': [],
            'warnings': []
        }

    except Exception as e:
        return {
            'valid': False,
            'errors': [str(e)],
            'warnings': []
        }

def get_template_info(template_text):
    """
    Extract information about a TTP template

    Args:
        template_text (str): TTP template

    Returns:
        dict: Template information
    """
    try:
        lines = template_text.split('\\\\n')

        info = {
            'groups': [],
            'variables': [],
            'functions': [],
            'total_lines': len(lines),
            'template_names': []
        }

        for line in lines:
            line = line.strip()

            # Find template names
            if '<template name=' in line:
                import re
                match = re.search(r'name="([^"]+)"', line)
                if match:
                    info['template_names'].append(match.group(1))

            # Find groups
            if '<group name=' in line:
                import re
                match = re.search(r'name="([^"]+)"', line)
                if match:
                    info['groups'].append(match.group(1))

            # Find variables (simplified detection)
            if '{{' in line and '}}' in line:
                import re
                variables = re.findall(r'{{\\\\s*([^}|]+)', line)
                for var in variables:
                    var = var.strip()
                    if var not in info['variables']:
                        info['variables'].append(var)

            # Find functions (simplified detection)
            if '|' in line and '{{' in line:
                import re
                functions = re.findall(r'\\\\|\\\\s*([^}\\\\s]+)', line)
                for func in functions:
                    func = func.strip()
                    if func not in info['functions']:
                        info['functions'].append(func)

        return info

    except Exception as e:
        return {
            'error': str(e),
            'groups': [],
            'variables': [],
            'functions': [],
            'total_lines': 0,
            'template_names': []
        }
`;
    }

    async _doInitialize() {
        try {
            console.log('Loading Pyodide...');
            this.pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.2/full/"
            });

            // Set up custom stdout/stderr handlers to capture Python print statements
            this.capturedOutput = '';
            this.pyodide.setStdout({
                batched: (text) => {
                    console.log('Python stdout captured:', text);
                    this.capturedOutput += text;
                }
            });

            this.pyodide.setStderr({
                batched: (text) => {
                    console.log('Python stderr captured:', text);
                    this.capturedOutput += text;
                }
            });

            console.log('Installing packages...');
            await this.pyodide.loadPackage(['micropip']);

            // Install TTP and dependencies
            await this.pyodide.runPythonAsync(`
                import micropip
                await micropip.install(['ttp', 'pyyaml'])
            `);

            // Setup TTP processing functions
            this.basePythonCode = this.generatePythonCode();
            await this.pyodide.runPythonAsync(this.basePythonCode);

            console.log('TTP processor initialized successfully');
            this.isInitialized = true;
            return this.pyodide;

        } catch (error) {
            console.error('Failed to initialize TTP processor:', error);
            throw new Error(`Failed to initialize TTP processor: ${error.message}`);
        }
    }

    async reinitializePython() {
        try {
            console.log('Reinitializing Python with custom functions...');
            this.basePythonCode = this.generatePythonCode();
            await this.pyodide.runPythonAsync(this.basePythonCode);
            console.log('Python reinitialized successfully');
        } catch (error) {
            console.error('Failed to reinitialize Python:', error);
            throw new Error(`Failed to reinitialize Python: ${error.message}`);
        }
    }

    setGlobalVars(varsText, format = 'json') {
        this.globalVars = {
            text: varsText,
            format: format
        };
    }

    async setCustomFunctions(functions) {
        this.customFunctions = functions || [];

        // Reinitialize Python with new functions
        if (this.isInitialized) {
            await this.reinitializePython();
        }
    }

    addCustomFunction(func) {
        this.customFunctions.push(func);
    }

    removeCustomFunction(id) {
        this.customFunctions = this.customFunctions.filter(f => f.id !== id);
    }

    async clearCustomFunctions() {
        this.customFunctions = [];

        // Reinitialize Python without custom functions
        if (this.isInitialized) {
            await this.reinitializePython();
        }
    }

    async setLookupTables(lookupTables) {
        this.lookupTables = lookupTables || [];
        console.log('TTPProcessor: Set lookup tables:', this.lookupTables);
    }

    addLookupTable(lookup) {
        this.lookupTables.push(lookup);
    }

    removeLookupTable(id) {
        this.lookupTables = this.lookupTables.filter(l => l.id !== id);
    }

    async clearLookupTables() {
        this.lookupTables = [];
        console.log('TTPProcessor: Cleared lookup tables');
    }

    async processTemplate(dataText, templateText, outputFormat = 'json') {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const startTime = performance.now();

            // Clear captured output before processing
            this.capturedOutput = '';

            // Set the Python variables
            this.pyodide.globals.set('data_input', dataText);
            this.pyodide.globals.set('template_input', templateText);
            this.pyodide.globals.set('format_input', outputFormat);
            
            // Set inputs data
            const plainInputsData = this.inputs.map(input => ({
                data: input.data,
                input_name: input.input_name,
                template_name: input.template_name,
                groups: input.groups
            }));
            this.pyodide.globals.set('inputs_data', plainInputsData);

            // Set global variables if they exist
            if (this.globalVars) {
                this.pyodide.globals.set('global_vars_text', this.globalVars.text);
                this.pyodide.globals.set('global_vars_format', this.globalVars.format);
            } else {
                this.pyodide.globals.set('global_vars_text', '');
                this.pyodide.globals.set('global_vars_format', 'json');
            }

            // Prepare function data for registration
            let customFunctionsData = [];
            if (this.customFunctions && this.customFunctions.length > 0) {
                customFunctionsData = this.customFunctions
                    .filter(f => f.code && f.code.trim() && f.scope)
                    .map(f => {
                        // Extract function name from code
                        const funcNameMatch = f.code.match(/def\s+(\w+)\s*\(/);
                        const functionName = funcNameMatch ? funcNameMatch[1] : null;

                        return {
                            function_name: functionName,
                            scope: f.scope,
                            name: f.name || null,
                            add_ttp: f.add_ttp || false
                        };
                    })
                    .filter(f => f.function_name); // Only include functions with valid names
            }

            // Convert to plain JavaScript objects for Python
            const plainFunctionsData = customFunctionsData.map(f => ({
                function_name: f.function_name,
                scope: f.scope,
                name: f.name,
                add_ttp: f.add_ttp
            }));

            this.pyodide.globals.set('custom_functions_data', plainFunctionsData);

            // Prepare lookup tables data
            const plainLookupsData = this.lookupTables.map(lookup => ({
                name: lookup.name,
                text_data: lookup.textData,
                load: lookup.load
            }));

            this.pyodide.globals.set('lookup_tables_data', plainLookupsData);

            // Call the Python function
            const result = await this.pyodide.runPythonAsync(`
                process_ttp_template(data_input, template_input, format_input, global_vars_text, global_vars_format, '', custom_functions_data, lookup_tables_data, inputs_data)
            `);

            // Wait a moment for any remaining stdout to be captured
            await new Promise(resolve => setTimeout(resolve, 10));

            // Add captured output to the result
            console.log('Captured output:', this.capturedOutput);
            if (result && result.success && result.stats) {
                result.stats.processing_info = this.capturedOutput.trim() || null;
                console.log('Added processing_info to result:', result.stats.processing_info);
            }

            const endTime = performance.now();
            const processingTime = Math.round(endTime - startTime);

            return {
                ...result,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Error processing template:', error);
            return {
                success: false,
                data: null,
                error: {
                    type: 'ProcessingError',
                    message: error.message,
                    traceback: error.stack
                },
                processingTime: 0
            };
        }
    }

    async validateTemplate(templateText) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            this.pyodide.globals.set('template_to_validate', templateText);

            const result = await this.pyodide.runPythonAsync(`
                validate_ttp_template(template_to_validate)
            `);

            return result;

        } catch (error) {
            console.error('Error validating template:', error);
            return {
                valid: false,
                errors: [error.message],
                warnings: []
            };
        }
    }

    async getTemplateInfo(templateText) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            this.pyodide.globals.set('template_to_analyze', templateText);

            const result = await this.pyodide.runPythonAsync(`
                get_template_info(template_to_analyze)
            `);

            return result;

        } catch (error) {
            console.error('Error analyzing template:', error);
            return {
                error: error.message,
                groups: [],
                variables: [],
                functions: [],
                total_lines: 0,
                template_names: []
            };
        }
    }

    isReady() {
        return this.isInitialized;
    }

    async getTTPVersion() {
        try {
            if (!this.pyodide) {
                return null;
            }
            
            // Get TTP version from Python
            const version = this.pyodide.runPython(`
import ttp
print(ttp.__version__)
`);
            return version.trim();
        } catch (error) {
            console.warn('Could not get TTP version:', error);
            return null;
        }
    }

    // Input management methods
    addInput(data, inputName = 'Default_Input', templateName = '_root_template_', groups = null) {
        this.inputs.push({
            data: data,
            input_name: inputName,
            template_name: templateName,
            groups: groups
        });
    }

    clearInputs() {
        this.inputs = [];
    }

    getInputs() {
        return this.inputs;
    }
}

// Export for use in other modules
window.TTPProcessor = TTPProcessor;