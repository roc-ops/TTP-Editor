// Simple test examples
const TTP_EXAMPLES = {
    'simple_test': {
        name: 'Simple Test',
        data: 'interface GigabitEthernet0/1\n description Test Interface\n ip address 192.168.1.1 255.255.255.0',
        template: '<group name="interfaces">\ninterface {{ interface }}\n description {{ description | re(".+") }}\n ip address {{ ip }} {{ mask }}\n</group>'
    }
};

// Make TTP_EXAMPLES available globally
window.TTP_EXAMPLES = TTP_EXAMPLES;
console.log('Test examples loaded:', Object.keys(TTP_EXAMPLES));

// Get all example names for dropdown/selection
function getExampleNames() {
    return Object.keys(TTP_EXAMPLES).map(key => ({
        key: key,
        name: TTP_EXAMPLES[key].name
    }));
}

// Make function available globally
window.getExampleNames = getExampleNames;
