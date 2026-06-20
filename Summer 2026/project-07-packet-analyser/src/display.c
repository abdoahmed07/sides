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
// I store each flag name as a null-terminated string (4 bytes) to avoid strncpy truncation
static void tcp_flags_str(uint8_t flags, char* out, int outlen) {
    const char* names[] = {"SYN", "ACK", "FIN", "RST", "PSH", "URG"};
    uint8_t     bits[]  = {0x02,  0x10,  0x01,  0x04,  0x08,  0x20};
    out[0] = '\0';
    int wrote = 0;
    for (int i = 0; i < 6; i++) {
        if (flags & bits[i]) {
            if (wrote) strncat(out, "-",       outlen - (int)strlen(out) - 1);
            strncat(out,  names[i], outlen - (int)strlen(out) - 1);
            wrote = 1;
        }
    }
    if (!wrote) strncat(out, "none", outlen - 1);
}

void print_header(void) {
    printf(COLOR_BOLD "%-12s %-6s %-21s -> %-21s %-12s %s\n" COLOR_RESET,
           "Time", "Proto", "Source", "Destination", "Flags/Info", "Bytes");
    printf("%-12s %-6s %-21s    %-21s %-12s %s\n",
           "------------", "------", "---------------------",
           "---------------------", "------------", "-----");
}

void print_packet(const PacketInfo* info) {
    // Format timestamp as HH:MM:SS.ms — buffer needs 13 chars + null
    char time_str[16];
    struct tm* t = localtime(&info->timestamp.tv_sec);
    snprintf(time_str, sizeof(time_str), "%02d:%02d:%02d.%03d",
             t->tm_hour, t->tm_min, t->tm_sec, (int)(info->timestamp.tv_usec / 1000));

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
            snprintf(extra, sizeof(extra), "%.28s->%.28s", info->dns_query, info->dns_answer);
        else
            snprintf(extra, sizeof(extra), "q:%.58s", info->dns_query);
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
