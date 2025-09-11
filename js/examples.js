// TTP Template Examples
const TTP_EXAMPLES = {
    'cisco_interface': {
        name: 'Cisco Interface Configuration',
        data: `interface GigabitEthernet0/1
 description Connection to Server Farm
 ip address 192.168.1.1 255.255.255.0
 duplex auto
 speed auto
 switchport mode access
 switchport access vlan 100
!
interface GigabitEthernet0/2
 description Connection to Core Switch
 ip address 192.168.2.1 255.255.255.0
 duplex full
 speed 1000
 switchport mode trunk
 switchport trunk allowed vlan 100,200,300
!
interface FastEthernet0/1
 description Management Interface
 ip address 10.0.0.1 255.255.255.0
 duplex auto
 speed auto
!`,
        template: `<template name="interfaces">
<macro>
def debug_print(data):
    print("TTP Debug: Processing interface " + str(data))
    return data
</macro>

interface {{ interface | macro("debug_print") }}
<group name="config">
 description {{ description | re(".+") }}
 ip address {{ ip }} {{ mask }}
 duplex {{ duplex }}
 speed {{ speed }}
 switchport mode {{ switchport_mode }}
 switchport access vlan {{ access_vlan | to_int }}
 switchport trunk allowed vlan {{ trunk_vlans }}
</group>
</template>`
    },
    
    'routing_table': {
        name: 'Routing Table Parsing',
        data: `Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP
       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area

Gateway of last resort is 192.168.1.1 to network 0.0.0.0

C    192.168.1.0/24 is directly connected, GigabitEthernet0/1
S    0.0.0.0/0 [1/0] via 192.168.1.1
O    10.0.0.0/8 [110/2] via 192.168.2.1, 00:15:30, GigabitEthernet0/2
D    172.16.0.0/12 [90/156160] via 192.168.1.2, 00:05:15, GigabitEthernet0/1
B    203.0.113.0/24 [20/0] via 192.168.1.3, 02:30:45`,
        template: `<template name="routing_table">
<group name="routes*">
{{ protocol | re("[CSRMBDOEX]+") }}{{ ignore("\\\\s+") }}{{ network }}/{{ prefix_len | to_int }} {{ ignore(".+") }} {{ next_hop }} {{ ignore(".+") }}
{{ protocol | re("[CSRMBDOEX]+") }}{{ ignore("\\\\s+") }}{{ network }}/{{ prefix_len | to_int }} [{{ ad | to_int }}/{{ metric | to_int }}] via {{ next_hop }}{{ ignore(".+") }}
{{ protocol | re("[CSRMBDOEX]+") }}{{ ignore("\\\\s+") }}{{ network }}/{{ prefix_len | to_int }} [{{ ad | to_int }}/{{ metric | to_int }}] via {{ next_hop }}, {{ uptime }}, {{ interface }}
</group>
</template>`
    },
    
    'log_parsing': {
        name: 'System Log Parsing',
        data: `Jan 15 10:30:15 server1 sshd[1234]: Accepted password for admin from 192.168.1.100 port 22 ssh2
Jan 15 10:31:22 server1 kernel: [12345.678] USB disconnect, address 1
Jan 15 10:32:45 server1 httpd[5678]: 192.168.1.200 - - [15/Jan/2024:10:32:45 +0000] "GET /index.html HTTP/1.1" 200 1234
Jan 15 10:33:10 server1 sshd[9101]: Failed password for root from 192.168.1.150 port 22 ssh2
Jan 15 10:34:05 server1 postfix/smtpd[1112]: connect from unknown[192.168.1.250]`,
        template: `<template name="system_logs">
<group name="ssh_events*">
{{ timestamp | re("\\\\w+\\\\s+\\\\d+\\\\s+\\\\d+:\\\\d+:\\\\d+") }} {{ hostname }} sshd[{{ pid | to_int }}]: {{ action | re("Accepted|Failed") }} password for {{ username }} from {{ src_ip }} port {{ port | to_int }} ssh2
</group>

<group name="http_events*">
{{ timestamp | re("\\\\w+\\\\s+\\\\d+\\\\s+\\\\d+:\\\\d+:\\\\d+") }} {{ hostname }} httpd[{{ pid | to_int }}]: {{ src_ip }} - - [{{ http_timestamp }}] "{{ method }} {{ url }} {{ protocol }}" {{ status_code | to_int }} {{ response_size | to_int }}
</group>

<group name="kernel_events*">
{{ timestamp | re("\\\\w+\\\\s+\\\\d+\\\\s+\\\\d+:\\\\d+:\\\\d+") }} {{ hostname }} kernel: [{{ kernel_time }}] {{ message | re(".+") }}
</group>

<group name="postfix_events*">
{{ timestamp | re("\\\\w+\\\\s+\\\\d+\\\\s+\\\\d+:\\\\d+:\\\\d+") }} {{ hostname }} postfix/{{ service }}[{{ pid | to_int }}]: {{ event | re(".+") }}
</group>
</template>`
    },
    
    'network_inventory': {
        name: 'Network Device Inventory',
        data: `Device: switch-core-01
Model: Cisco Catalyst 3850-48T
Serial: ABC123456789
Software: IOS-XE 16.12.04
Uptime: 45 days, 12 hours, 30 minutes
Location: Data Center Rack 1

Device: router-edge-02  
Model: Cisco ISR 4331
Serial: DEF987654321
Software: IOS 15.7(3)M4a
Uptime: 120 days, 5 hours, 15 minutes
Location: Network Closet B

Device: firewall-dmz-01
Model: Palo Alto PA-220
Serial: GHI456789123
Software: PAN-OS 9.1.3
Uptime: 30 days, 8 hours, 45 minutes
Location: DMZ Cabinet`,
        template: `<template name="inventory">
<group name="devices*">
Device: {{ hostname }}
Model: {{ model | re(".+") }}
Serial: {{ serial }}
Software: {{ software | re(".+") }}
Uptime: {{ uptime | re(".+") }}
Location: {{ location | re(".+") }}
</group>
</template>`
    }
};

// Function to load example data
function loadExample(exampleKey) {
    if (TTP_EXAMPLES[exampleKey]) {
        return TTP_EXAMPLES[exampleKey];
    }
    return null;
}

// Make TTP_EXAMPLES available globally
window.TTP_EXAMPLES = TTP_EXAMPLES;
console.log('Examples loaded:', Object.keys(TTP_EXAMPLES));

// Get all example names for dropdown/selection
function getExampleNames() {
    return Object.keys(TTP_EXAMPLES).map(key => ({
        key: key,
        name: TTP_EXAMPLES[key].name
    }));
}

// Make function available globally
window.getExampleNames = getExampleNames;
