# TTP Template Editor

A powerful browser-based TTP (Template Text Parser) template editor that runs entirely client-side using Pyodide. This tool allows you to create, edit, and test TTP templates with advanced features like custom functions, lookup tables, and global variables.

## Features

- **Client-side Processing**: Runs entirely in the browser using Pyodide (WebAssembly Python)
- **Monaco Editor**: Professional code editing with syntax highlighting, folding, and search
- **Multiple Output Formats**: JSON, YAML, and table formats
- **Global Variables**: Define reusable variables for templates
- **Custom Functions**: Create Python functions for advanced data processing
- **Lookup Tables**: Define lookup tables for data enrichment
- **Export/Import**: Save and share complete configurations as `.ttp.export` files
- **Workspace Management**: Save and load multiple workspaces
- **Real-time Processing**: Auto-process templates as you type
- **Error Marking**: Visual error indicators in template editor
- **Built-in Examples**: Pre-loaded TTP templates for common use cases
- **Resizable Panes**: Adjustable editor panes for optimal workflow

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
4. **Configure Variables** (optional): Click "Vars" to define global variables
5. **Add Custom Functions** (optional): Click "Functions" to create Python functions
6. **Define Lookup Tables** (optional): Click "Lookups" to create data lookup tables
7. **Process**: Click "Process Template" or enable auto-processing
8. **View Results**: See parsed results in the right panel
9. **Export**: Download results or save complete configuration as `.ttp.export` file

### Example Templates

The application includes several built-in examples:

- **Cisco Interface Configuration**: Parse interface settings
- **Routing Table**: Extract routing information
- **System Log Parsing**: Parse various log formats
- **Network Device Inventory**: Extract device information

Click "Load Example" to try these templates.

## Advanced Features

### Global Variables

Define reusable variables that can be used in your templates:

1. Click the "Vars" button
2. Enter variables in JSON, YAML, or Python dictionary format
3. Use variables in templates with `{{ variable_name }}`

### Custom Functions

Create Python functions for advanced data processing:

1. Click the "Functions" button
2. Define function scope (match, group, input, output, etc.)
3. Write Python code for your function
4. Use functions in templates with `{{ data | my_function }}`

### Lookup Tables

Define lookup tables for data enrichment:

1. Click the "Lookups" button
2. Create lookup tables in various formats (JSON, YAML, CSV, etc.)
3. Use lookups in templates with `{{ data | lookup("table_name", "key") }}`

### Export/Import

Save and share complete configurations:

- **Export**: Click "Export" to download `.ttp.export` file
- **Import**: Click "Import" to load configuration from file
- **Workspace**: Use "Save"/"Load" for local workspace management

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Process template
- `Ctrl/Cmd + L`: Load example
- `Ctrl/Cmd + K`: Clear all inputs

## Technical Details

### Architecture

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Python Runtime**: Pyodide v0.28.2 (WebAssembly)
- **Text Processing**: TTP (Template Text Parser) library
- **Code Editor**: Monaco Editor for professional code editing
- **Styling**: Modern CSS with dark theme and resizable panes
- **Storage**: LocalStorage for workspace persistence
- **Sharing**: Export/Import system with `.ttp.export` files

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

- `TTPProcessor`: Handles Pyodide and TTP operations
- `TTPEditor`: Manages UI, Monaco editors, and user interactions
- `examples.js`: Contains sample data and templates
- **Monaco Editor**: Professional code editing with syntax highlighting
- **Export/Import System**: File-based configuration sharing

## Troubleshooting

### Common Issues

1. **Slow Initial Load**: Pyodide downloads ~10MB on first load. Subsequent loads are cached.

2. **Memory Issues**: Large datasets may cause memory issues. Try processing smaller chunks.

3. **Template Errors**: Check template syntax. The application provides detailed error messages.

4. **Browser Compatibility**: Ensure your browser supports WebAssembly.

### Performance Tips

- Use specific regular expressions in templates
- Avoid overly complex nested groups
- Process data in reasonable chunks
- Clear results between large processing runs

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
