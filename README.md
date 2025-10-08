# TTP Template Editor

A powerful browser-based TTP (Template Text Parser) template editor that runs entirely client-side using Pyodide. This tool allows you to create, edit, and test TTP templates with advanced features like custom functions, lookup tables, and global variables.

## Features

- **Client-side Processing**: Runs entirely in the browser using Pyodide (WebAssembly Python)
- **Monaco Editor**: Professional code editing with syntax highlighting, auto-completion, and IntelliSense
- **Multiple Output Formats**: JSON, YAML, and table formats
- **Multiple Named Inputs**: Configure multiple inputs with template and group specifications
- **Global Variables**: Define reusable variables for templates
- **Custom Functions**: Create Python functions for advanced data processing
- **Lookup Tables**: Define lookup tables for data enrichment
- **Export/Import**: Save and share complete configurations as `.ttp.export` files
- **Workspace Management**: Save, load, and manage multiple workspaces
- **Real-time Processing**: Auto-process templates as you type
- **Error Marking**: Visual error indicators in template editor
- **Built-in Examples**: Pre-loaded TTP templates for common use cases
- **Resizable Panes**: Adjustable editor panes for optimal workflow
- **Professional UI**: Modern dropdown menus, modals, and notifications
- **TTP Syntax Highlighting**: Custom syntax highlighting for TTP templates
- **Auto-completion**: Context-aware suggestions for TTP functions and Python built-ins

## Getting Started

### Prerequisites

- A modern web browser with WebAssembly support
- Internet connection (for loading Pyodide and dependencies)

### Running the Application

1. **Local Development Server** (recommended):
   ```bash
   cd "TTP Editor"
   python3 -m http.server 8080
   ```
   Then open http://localhost:8080 in your browser.

2. **Direct File Access**:
   You can also open `index.html` directly in your browser, though some features may be limited due to CORS restrictions.

### Usage

1. **Load the Application**: Open the website and wait for the Python runtime to initialize
2. **Input Data**: Paste your raw text data in the left panel
3. **Create Template**: Write or paste your TTP template in the middle panel
4. **Configure Inputs** (optional): Click "Config" → "📥 Inputs" to manage multiple named inputs
5. **Configure Variables** (optional): Click "Config" → "Variables" to define global variables
6. **Add Custom Functions** (optional): Click "Config" → "Functions" to create Python functions
7. **Define Lookup Tables** (optional): Click "Config" → "Lookups" to create data lookup tables
8. **Process**: Click "Process" or enable auto-processing
9. **View Results**: See parsed results in the right panel
10. **Export**: Click "File" → "Export" to download results or save complete configuration

### Example Templates

The application includes several built-in examples:

- **Cisco Interface Configuration**: Parse interface settings
- **Routing Table**: Extract routing information
- **System Log Parsing**: Parse various log formats
- **Network Device Inventory**: Extract device information

Click "Load Example" to try these templates.

## Advanced Features

### Multiple Named Inputs

Configure multiple inputs with different templates and groups:

1. Click "Config" → "📥 Inputs"
2. Add inputs with unique names, template associations, and group filters
3. Each input can target specific templates and process only certain groups
4. Perfect for processing multiple data sources with different parsing rules

**Example Input Configuration:**
- **Input Name**: `router_config`
- **Template**: `_root_template_`
- **Groups**: `interfaces,routing`
- **Data**: [Your router configuration data]

### Global Variables

Define reusable variables that can be used in your templates:

1. Click "Config" → "Variables"
2. Enter variables in JSON, YAML, or Python dictionary format
3. Use variables in templates with `{{ variable_name }}`

### Custom Functions

Create Python functions for advanced data processing:

1. Click "Config" → "Functions"
2. Define function scope (match, group, input, output, etc.)
3. Write Python code for your function
4. Use functions in templates with `{{ data | my_function }}`

### Lookup Tables

Define lookup tables for data enrichment:

1. Click "Config" → "Lookups"
2. Create lookup tables in various formats (JSON, YAML, CSV, etc.)
3. Use lookups in templates with `{{ data | lookup("table_name", "key") }}`

### Export/Import

Save and share complete configurations:

- **Export**: Click "File" → "Export" to download `.ttp.export` file
- **Import**: Click "File" → "Import" to load configuration from file
- **Workspace**: Use "Workspace" → "Save"/"Load" for local workspace management
- **Manage Workspaces**: Click "Workspace" → "Manage" to organize saved workspaces

### User Interface

The application features a modern, organized interface:

- **Main Actions**: Process, Download, Output Format selector
- **Actions Dropdown**: Clear All, Load Example
- **Config Dropdown**: Inputs, Variables, Functions, Lookups
- **File Dropdown**: Export, Import
- **Workspace Dropdown**: Save, Load, Manage workspaces
- **Auto-completion**: Context-aware suggestions for TTP functions and Python built-ins
- **Syntax Highlighting**: Custom highlighting for TTP templates
- **Professional Modals**: Beautiful dialogs for configuration and management

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Process template
- `Ctrl/Cmd + L`: Load example
- `Ctrl/Cmd + K`: Clear all inputs
- `Escape`: Close modals and dropdowns
- `Enter`: Save in modals

## Technical Details

### Architecture

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Python Runtime**: Pyodide v0.28.2 (WebAssembly)
- **Text Processing**: TTP (Template Text Parser) library
- **Code Editor**: Monaco Editor with custom TTP language support
- **Styling**: Modern CSS with dark theme, dropdowns, and modals
- **Storage**: LocalStorage for workspace persistence and URL sharing
- **Sharing**: Export/Import system with `.ttp.export` files
- **UI Components**: Professional modals, dropdowns, and notifications

### File Structure

```
TTP Editor/
├── index.html              # Main application page
├── css/
│   └── main.css            # Application styles
├── js/
│   ├── app-monaco.js       # Main application logic with Monaco Editor
│   ├── ttp-processor.js    # TTP processing wrapper
│   └── examples.js         # Sample templates and data
└── README.md               # This file
```

### Browser Compatibility

- Chrome/Chromium 57+
- Firefox 52+
- Safari 11+
- Edge 16+

WebAssembly support is required for Pyodide to function.

## TTP Template Syntax

TTP uses a template-based approach to parse text data. Here are some key concepts:

### Basic Template Structure

```html
<template name="example">
<group name="items*">
{{ variable1 }} {{ variable2 }}
{{ variable3 | to_int }} {{ variable4 | re("\\d+") }}
</group>
</template>
```

### Common TTP Functions

- `to_int`: Convert to integer
- `to_float`: Convert to float
- `re("pattern")`: Regular expression matching
- `contains("text")`: Check if text contains substring
- `split("delimiter")`: Split text by delimiter

### Group Types

- `group*`: Multiple results (list)
- `group`: Single result (dict)
- `group**`: Nested groups

For more detailed TTP documentation, visit: https://ttp.readthedocs.io/

## Development

### Adding New Examples

To add new examples, edit `js/examples.js` and add entries to the `TTP_EXAMPLES` object:

```javascript
'new_example': {
    name: 'Example Name',
    data: 'Raw text data...',
    template: 'TTP template...'
}
```

### Customizing Styles

The application uses CSS custom properties for easy theming. Main colors and styles are defined in `css/main.css`.

### Extending Functionality

The modular architecture makes it easy to extend:

- `TTPProcessor`: Handles Pyodide and TTP operations with multiple input support
- `TTPEditor`: Manages UI, Monaco editors, modals, and user interactions
- `examples.js`: Contains sample data and templates
- **Monaco Editor**: Professional code editing with TTP syntax highlighting and auto-completion
- **Export/Import System**: File-based configuration sharing with inputs support
- **Modal System**: Reusable modal components for configuration dialogs
- **Dropdown System**: Organized menu system for better UX

## Troubleshooting

### Common Issues

1. **Slow Initial Load**: Pyodide downloads ~10MB on first load. Subsequent loads are cached.

2. **Memory Issues**: Large datasets may cause memory issues. Try processing smaller chunks or use multiple inputs.

3. **Template Errors**: Check template syntax. The application provides detailed error messages and visual indicators.

4. **Browser Compatibility**: Ensure your browser supports WebAssembly.

5. **Auto-completion Issues**: If suggestions don't appear, ensure you're typing in the template editor and check the context.

6. **Input Configuration**: When using multiple inputs, ensure each has a unique name and valid data content.

### Performance Tips

- Use specific regular expressions in templates
- Avoid overly complex nested groups
- Process data in reasonable chunks or use multiple inputs
- Clear results between large processing runs
- Use group filtering in inputs to process only relevant data
- Take advantage of auto-completion for faster template writing

## Contributing

This is a standalone application. To contribute:

1. Fork the repository
2. Make your changes
3. Test across different browsers
4. Submit a pull request

## License

This project is open source. Please check individual dependencies for their licenses:

- Pyodide: Mozilla Public License 2.0
- TTP: MIT License
- Monaco Editor: MIT License

## Acknowledgments

- Built on the excellent [Pyodide](https://pyodide.org/) project
- Uses the powerful [TTP](https://ttp.readthedocs.io/) library by Denis Mulyalin
- Code editing powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Inspired by the original [TextFSM Nornir](https://textfsm.nornir.tech/) tool
