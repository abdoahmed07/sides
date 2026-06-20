#pragma once

// Network header structures — mirroring the actual on-wire layout
// I pad everything manually and use __attribute__((packed)) so the compiler doesn't
// add alignment padding that would mess up the byte offsets

#include <stdint.h>
#include <sys/time.h>    /* struct timeval */
#include <netinet/in.h>

#define ETHERNET_HEADER_LEN 14
#define UDP_HEADER_LEN       8
#define DNS_HEADER_LEN      12

// Ethernet frame header — 14 bytes
// EtherType 0x0800 = IPv4, 0x0806 = ARP, 0x86DD = IPv6
typedef struct __attribute__((packed)) {
    uint8_t  dst_mac[6];   // destination MAC address
    uint8_t  src_mac[6];   // source MAC address
    uint16_t ethertype;    // big-endian on the wire — use ntohs() before comparing
} EthernetHeader;

// IPv4 header — minimum 20 bytes (ihl field tells us the actual size)
typedef struct __attribute__((packed)) {
    uint8_t  version_ihl;  // top 4 bits = version (4), bottom 4 bits = IHL (header length in 32-bit words)
    uint8_t  dscp_ecn;
    uint16_t total_length;
    uint16_t identification;
    uint16_t flags_fragment_offset;
    uint8_t  ttl;
    uint8_t  protocol;     // 6 = TCP, 17 = UDP, 1 = ICMP
    uint16_t checksum;
    uint32_t src_addr;
    uint32_t dst_addr;
} IPv4Header;

// TCP header — minimum 20 bytes (data_offset tells us actual size)
typedef struct __attribute__((packed)) {
    uint16_t src_port;
    uint16_t dst_port;
    uint32_t seq_num;
    uint32_t ack_num;
    uint8_t  data_offset;  // top 4 bits = header length in 32-bit words
    uint8_t  flags;        // SYN=0x02, ACK=0x10, FIN=0x01, RST=0x04, PSH=0x08
    uint16_t window_size;
    uint16_t checksum;
    uint16_t urgent_ptr;
} TCPHeader;

// UDP header — always exactly 8 bytes (simple compared to TCP)
typedef struct __attribute__((packed)) {
    uint16_t src_port;
    uint16_t dst_port;
    uint16_t length;
    uint16_t checksum;
} UDPHeader;

// DNS header — for decoding queries on port 53
typedef struct __attribute__((packed)) {
    uint16_t id;
    uint16_t flags;
    uint16_t qdcount; // number of questions
    uint16_t ancount; // number of answers
    uint16_t nscount;
    uint16_t arcount;
} DNSHeader;

// Extracted packet information — filled in by the parsers
typedef struct {
    struct timeval timestamp;
    uint32_t length;

    uint8_t src_mac[6];
    uint8_t dst_mac[6];
    uint16_t ethertype;

    int is_ip;
    int is_tcp;
    int is_udp;
    int is_icmp;
    int is_dns;

    char src_ip[INET_ADDRSTRLEN];
    char dst_ip[INET_ADDRSTRLEN];
    uint8_t protocol;
    uint8_t ttl;
    int ip_header_len;

    uint16_t src_port;
    uint16_t dst_port;
    uint8_t  tcp_flags;
    int tcp_header_len;

    char dns_query[256];   // domain name from DNS query
    char dns_answer[64];   // resolved IP from DNS response (if present)
    int  dns_is_response;
} PacketInfo;
