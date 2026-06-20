/*
 * Display — formats and prints packet information to the terminal
 * I use ANSI escape codes for color — no external libraries needed
 * TCP = blue, UDP = green, ICMP = yellow, DNS = magenta, unknown = grey
 */

#include <stdio.h>
#include <string.h>
#include <time.h>
#include "display.h"
#include "headers.h"

// ANSI color codes
#define COLOR_RESET   "\x1b[0m"
#define COLOR_BLUE    "\x1b[34m"
#define COLOR_GREEN   "\x1b[32m"
#define COLOR_YELLOW  "\x1b[33m"
#define COLOR_MAGENTA "\x1b[35m"
#define COLOR_GREY    "\x1b[90m"
#define COLOR_BOLD    "\x1b[1m"

// Get a string description of TCP flags like "SYN", "ACK", "SYN-ACK", "FIN", "RST"
static void tcp_flags_str(uint8_t flags, char* out, int outlen) {
    char parts[6][4] = {0};
    int n = 0;
    if (flags & 0x02) strncpy(parts[n++], "SYN", 3);
    if (flags & 0x10) strncpy(parts[n++], "ACK", 3);
    if (flags & 0x01) strncpy(parts[n++], "FIN", 3);
    if (flags & 0x04) strncpy(parts[n++], "RST", 3);
    if (flags & 0x08) strncpy(parts[n++], "PSH", 3);
    if (flags & 0x20) strncpy(parts[n++], "URG", 3);

    out[0] = '\0';
    for (int i = 0; i < n; i++) {
        if (i > 0) strncat(out, "-", outlen - strlen(out) - 1);
        strncat(out, parts[i], outlen - strlen(out) - 1);
    }
    if (n == 0) strncpy(out, "none", outlen);
}

void print_header(void) {
    printf(COLOR_BOLD "%-12s %-6s %-21s -> %-21s %-12s %s\n" COLOR_RESET,
           "Time", "Proto", "Source", "Destination", "Flags/Info", "Bytes");
    printf("%-12s %-6s %-21s    %-21s %-12s %s\n",
           "------------", "------", "---------------------",
           "---------------------", "------------", "-----");
}

void print_packet(const PacketInfo* info) {
    // Format timestamp as HH:MM:SS.usec
    char time_str[16];
    struct tm* t = localtime(&info->timestamp.tv_sec);
    snprintf(time_str, sizeof(time_str), "%02d:%02d:%02d.%03ld",
             t->tm_hour, t->tm_min, t->tm_sec, info->timestamp.tv_usec / 1000);

    const char* color = COLOR_GREY;
    char proto[8]     = "???";
    char src[22]      = {0};
    char dst[22]      = {0};
    char extra[64]    = {0};

    if (!info->is_ip) {
        // Non-IP packet — show EtherType and MAC addresses
        snprintf(proto, sizeof(proto), "ETH");
        snprintf(src, sizeof(src), "%02x:%02x:%02x:%02x:%02x:%02x",
                 info->src_mac[0], info->src_mac[1], info->src_mac[2],
                 info->src_mac[3], info->src_mac[4], info->src_mac[5]);
        snprintf(dst, sizeof(dst), "%02x:%02x:%02x:%02x:%02x:%02x",
                 info->dst_mac[0], info->dst_mac[1], info->dst_mac[2],
                 info->dst_mac[3], info->dst_mac[4], info->dst_mac[5]);
    } else if (info->is_dns) {
        color = COLOR_MAGENTA;
        snprintf(proto, sizeof(proto), "DNS");
        snprintf(src, sizeof(src), "%s:%d", info->src_ip, info->src_port);
        snprintf(dst, sizeof(dst), "%s:%d", info->dst_ip, info->dst_port);
        if (info->dns_is_response && info->dns_answer[0])
            snprintf(extra, sizeof(extra), "%s -> %s", info->dns_query, info->dns_answer);
        else
            snprintf(extra, sizeof(extra), "query: %s", info->dns_query);
    } else if (info->is_tcp) {
        color = COLOR_BLUE;
        snprintf(proto, sizeof(proto), "TCP");
        snprintf(src, sizeof(src), "%s:%d", info->src_ip, info->src_port);
        snprintf(dst, sizeof(dst), "%s:%d", info->dst_ip, info->dst_port);
        tcp_flags_str(info->tcp_flags, extra, sizeof(extra));
    } else if (info->is_udp) {
        color = COLOR_GREEN;
        snprintf(proto, sizeof(proto), "UDP");
        snprintf(src, sizeof(src), "%s:%d", info->src_ip, info->src_port);
        snprintf(dst, sizeof(dst), "%s:%d", info->dst_ip, info->dst_port);
    } else if (info->is_icmp) {
        color = COLOR_YELLOW;
        snprintf(proto, sizeof(proto), "ICMP");
        snprintf(src, sizeof(src), "%s", info->src_ip);
        snprintf(dst, sizeof(dst), "%s", info->dst_ip);
    }

    printf("%s%-12s %-6s %-21s -> %-21s %-12s %u%s\n",
           color, time_str, proto, src, dst, extra, info->length, COLOR_RESET);
}
