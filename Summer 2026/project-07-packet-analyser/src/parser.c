/*
 * Packet parsers — extract structured information from raw bytes
 * The key thing: everything on the network is big-endian, x86 is little-endian,
 * so I have to call ntohs() and ntohl() to convert multi-byte fields
 */

#include <stdio.h>
#include <string.h>
#include <arpa/inet.h>

#include "parser.h"
#include "headers.h"

int parse_ethernet(const u_char* packet, uint32_t caplen, PacketInfo* info) {
    if (caplen < ETHERNET_HEADER_LEN) return 0;

    const EthernetHeader* eth = (const EthernetHeader*)packet;

    memcpy(info->src_mac, eth->src_mac, 6);
    memcpy(info->dst_mac, eth->dst_mac, 6);
    info->ethertype = ntohs(eth->ethertype);

    // Only handle IPv4 for now — I could add IPv6 (0x86DD) and ARP (0x0806) later
    info->is_ip = (info->ethertype == 0x0800);
    return 1;
}

int parse_ip(const u_char* packet, uint32_t caplen, PacketInfo* info) {
    if (caplen < 20) return 0; // minimum IP header size

    const IPv4Header* ip = (const IPv4Header*)packet;

    // IHL (Internet Header Length) is in 32-bit words — multiply by 4 to get bytes
    info->ip_header_len = (ip->version_ihl & 0x0F) * 4;
    info->ttl = ip->ttl;
    info->protocol = ip->protocol;

    // Convert raw uint32 addresses to dotted decimal strings
    struct in_addr src_addr, dst_addr;
    src_addr.s_addr = ip->src_addr;
    dst_addr.s_addr = ip->dst_addr;
    inet_ntop(AF_INET, &src_addr, info->src_ip, INET_ADDRSTRLEN);
    inet_ntop(AF_INET, &dst_addr, info->dst_ip, INET_ADDRSTRLEN);

    info->is_tcp  = (ip->protocol == 6);
    info->is_udp  = (ip->protocol == 17);
    info->is_icmp = (ip->protocol == 1);

    return 1;
}

int parse_tcp(const u_char* packet, uint32_t caplen, PacketInfo* info) {
    if (caplen < 20) return 0;

    const TCPHeader* tcp = (const TCPHeader*)packet;

    info->src_port = ntohs(tcp->src_port);
    info->dst_port = ntohs(tcp->dst_port);
    info->tcp_flags = tcp->flags;
    info->tcp_header_len = ((tcp->data_offset >> 4) & 0x0F) * 4; // same as IHL: words -> bytes

    return 1;
}

int parse_udp(const u_char* packet, uint32_t caplen, PacketInfo* info) {
    if (caplen < UDP_HEADER_LEN) return 0;

    const UDPHeader* udp = (const UDPHeader*)packet;
    info->src_port = ntohs(udp->src_port);
    info->dst_port = ntohs(udp->dst_port);

    return 1;
}

/*
 * DNS query parser — decodes the compressed domain name format
 * DNS names are encoded as length-prefixed labels: [3]www[6]google[3]com[0]
 * I decode this into a normal dotted string like "www.google.com"
 */
int parse_dns(const u_char* packet, uint32_t caplen, PacketInfo* info) {
    if (caplen < DNS_HEADER_LEN) return 0;

    const DNSHeader* dns = (const DNSHeader*)packet;
    info->dns_is_response = (ntohs(dns->flags) & 0x8000) != 0;

    if (ntohs(dns->qdcount) == 0) return 1; // no questions

    // The question section starts right after the DNS header
    const u_char* pos = packet + DNS_HEADER_LEN;
    const u_char* end = packet + caplen;
    char* out = info->dns_query;
    int out_remaining = sizeof(info->dns_query) - 1;
    int first_label = 1;

    // Decode each label until we hit the zero-length terminator
    while (pos < end && *pos != 0) {
        if (!first_label && out_remaining > 0) {
            *out++ = '.';
            out_remaining--;
        }
        first_label = 0;

        int label_len = *pos++;
        if (label_len > 63) break; // sanity check — labels can't be > 63 bytes

        int copy_len = label_len < out_remaining ? label_len : out_remaining;
        memcpy(out, pos, copy_len);
        out += copy_len;
        out_remaining -= copy_len;
        pos += label_len;
    }
    *out = '\0';

    info->is_dns = 1;

    // If this is a response, try to extract the first A record answer
    // (skipping over the question section)
    if (info->dns_is_response && ntohs(dns->ancount) > 0) {
        pos++; // skip the final zero of the question name
        if (pos + 4 < end) pos += 4; // skip QTYPE and QCLASS

        // Parse the first answer — there could be compression pointers here,
        // but for simplicity I handle only the non-compressed case
        while (pos < end && *pos != 0) pos++; // skip answer name
        pos++; // skip zero terminator
        if (pos + 10 < end) {
            uint16_t rtype = ntohs(*(uint16_t*)pos);  pos += 2;
            pos += 2; // class
            pos += 4; // TTL
            uint16_t rdlength = ntohs(*(uint16_t*)pos); pos += 2;
            if (rtype == 1 && rdlength == 4 && pos + 4 <= end) { // A record = 4 bytes
                struct in_addr addr;
                memcpy(&addr.s_addr, pos, 4);
                inet_ntop(AF_INET, &addr, info->dns_answer, sizeof(info->dns_answer));
            }
        }
    }

    return 1;
}
