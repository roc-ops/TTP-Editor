// TTP Processor - Handles all TTP-related operations using Pyodide

class TTPProcessor {
    constructor() {
        this.pyodide = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.globalVars = null;
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
            await this.pyodide.runPythonAsync(`
import json
import yaml
from ttp import ttp
import traceback
import sys
from io import StringIO

# Redirect Python stdout to browser console
import js
def print_to_console(*args, **kwargs):
    js.console.log(' '.join(map(str, args)))
sys.stdout.write = print_to_console

def process_ttp_template(data_text, template_text, output_format='json', global_vars_text='', global_vars_format='json'):
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
        # Debug: Log template info (can be removed later)
        # template_lines = template_text.split('\\n')
        # print(f"TTP Debug: Template has {len(template_lines)} lines")
        # print(f"TTP Debug: Template length: {len(template_text)} characters")
        
        # Parse global variables if provided
        global_vars_dict = {}
        if global_vars_text and global_vars_text.strip():
            try:
                if global_vars_format == 'json':
                    import json
                    global_vars_dict = json.loads(global_vars_text)
                elif global_vars_format == 'yaml':
                    import yaml
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
        parser = ttp(data=data_text, template=template_text, vars=global_vars_dict)
        
        # Debug: Check if template has macros
        if 'macro(' in template_text:
            print("TTP Debug: Template contains macro calls")
        
        # Parse the data
        parser.parse()
        
        # Get results
        results = parser.result()
        
        # TTP returns results in nested arrays like [[{data}]]
        # Extract the actual data from the first group
        actual_data = results[0] if results and len(results) > 0 else []
        
        # Format output based on requested format
        if output_format == 'yaml':
            formatted_data = yaml.dump(actual_data, default_flow_style=False, indent=2)
        elif output_format == 'python':
            formatted_data = repr(actual_data)
        else:  # json
            formatted_data = json.dumps(actual_data, indent=2, ensure_ascii=False)
        
        # Calculate some basic stats
        stats = {
            'template_groups': len([line for line in template_text.split('\\n') if '<group' in line]),
            'parsed_items': len(results[0]) if results and len(results) > 0 and isinstance(results[0], list) else (1 if results else 0),
            'data_lines': len([line for line in data_text.split('\\n') if line.strip()])
        }
        
        return {
            'success': True,
            'data': formatted_data,
            'raw_results': results,
            'stats': stats,
            'error': None
        }
        
    except Exception as e:
        # Debug: Log the full error details (can be removed later)
        # print(f"TTP Error: {type(e).__name__}: {str(e)}")
        # print(f"TTP Traceback: {traceback.format_exc()}")
        
        # Extract the first (most accurate) error from the traceback
        traceback_text = traceback.format_exc()
        first_error = str(e)
        
        # Look for the first ParseError in the traceback
        import re
        parse_error_match = re.search(r'ParseError: ([^\\n]+)', traceback_text)
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
                line_match = re.search(r'line (\d+)', error_message)
                if line_match:
                    reported_line = int(line_match.group(1))
                    template_lines = len(template_text.split('\\n'))
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
        lines = template_text.split('\\n')
        
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
                variables = re.findall(r'{{\\s*([^}|]+)', line)
                for var in variables:
                    var = var.strip()
                    if var not in info['variables']:
                        info['variables'].append(var)
            
            # Find functions (simplified detection)
            if '|' in line and '{{' in line:
                import re
                functions = re.findall(r'\\|\\s*([^}\\s]+)', line)
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
`);

            console.log('TTP processor initialized successfully');
            this.isInitialized = true;
            return this.pyodide;

        } catch (error) {
            console.error('Failed to initialize TTP processor:', error);
            throw new Error(`Failed to initialize TTP processor: ${error.message}`);
        }
    }

    setGlobalVars(varsText, format = 'json') {
        this.globalVars = {
            text: varsText,
            format: format
        };
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
            
            // Set global variables if they exist
            if (this.globalVars) {
                this.pyodide.globals.set('global_vars_text', this.globalVars.text);
                this.pyodide.globals.set('global_vars_format', this.globalVars.format);
            } else {
                this.pyodide.globals.set('global_vars_text', '');
                this.pyodide.globals.set('global_vars_format', 'json');
            }

            // Call the Python function
            const result = await this.pyodide.runPythonAsync(`
                process_ttp_template(data_input, template_input, format_input, global_vars_text, global_vars_format)
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
}

// Export for use in other modules
window.TTPProcessor = TTPProcessor;
