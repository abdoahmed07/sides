#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "stats.h"
#include "headers.h"

void update_stats(Stats* stats, const PacketInfo* info) {
    stats->total_packets++;
    stats->total_bytes += info->length;

    if (info->is_tcp)  stats->tcp_packets++;
    if (info->is_udp)  stats->udp_packets++;
    if (info->is_icmp) stats->icmp_packets++;
    if (info->is_dns)  stats->dns_queries++;

    if (info->dst_port > 0)
        stats->top_ports[info->dst_port]++;

    // Track source IPs — linear search through the table, add if not present
    // For a production tool I'd use a hash map here, but this is fine for a portfolio project
    if (info->is_ip && stats->src_ip_count < MAX_TRACKED_IPS) {
        int found = 0;
        for (int i = 0; i < stats->src_ip_count; i++) {
            if (strcmp(stats->src_ips[i].ip, info->src_ip) == 0) {
                stats->src_ips[i].packet_count++;
                found = 1;
                break;
            }
        }
        if (!found) {
            strncpy(stats->src_ips[stats->src_ip_count].ip, info->src_ip, INET_ADDRSTRLEN);
            stats->src_ips[stats->src_ip_count].packet_count = 1;
            stats->src_ip_count++;
        }
    }
}

// Comparison function for sorting IPs by packet count (descending)
static int ip_cmp(const void* a, const void* b) {
    const IPEntry* ia = (const IPEntry*)a;
    const IPEntry* ib = (const IPEntry*)b;
    if (ib->packet_count > ia->packet_count) return  1;
    if (ib->packet_count < ia->packet_count) return -1;
    return 0;
}

void print_summary(const Stats* stats) {
    printf("\n=== Capture Summary ===\n");
    printf("Total packets : %llu\n", (unsigned long long)stats->total_packets);
    printf("Total bytes   : %llu\n", (unsigned long long)stats->total_bytes);
    printf("TCP           : %llu\n", (unsigned long long)stats->tcp_packets);
    printf("UDP           : %llu\n", (unsigned long long)stats->udp_packets);
    printf("ICMP          : %llu\n", (unsigned long long)stats->icmp_packets);
    printf("DNS queries   : %llu\n", (unsigned long long)stats->dns_queries);

    // Top 5 source IPs
    if (stats->src_ip_count > 0) {
        IPEntry sorted[MAX_TRACKED_IPS];
        memcpy(sorted, stats->src_ips, stats->src_ip_count * sizeof(IPEntry));
        qsort(sorted, stats->src_ip_count, sizeof(IPEntry), ip_cmp);

        printf("\nTop source IPs:\n");
        int show = stats->src_ip_count < 5 ? stats->src_ip_count : 5;
        for (int i = 0; i < show; i++) {
            printf("  %-20s  %llu packets\n", sorted[i].ip,
                   (unsigned long long)sorted[i].packet_count);
        }
    }

    // Top 5 destination ports
    printf("\nTop destination ports:\n");
    typedef struct { int port; uint16_t count; } PortEntry;
    PortEntry top[5] = {0};
    for (int p = 0; p < 65536; p++) {
        if (stats->top_ports[p] > top[4].count) {
            top[4].port  = p;
            top[4].count = stats->top_ports[p];
            // Bubble up
            for (int j = 4; j > 0 && top[j].count > top[j-1].count; j--) {
                PortEntry tmp = top[j]; top[j] = top[j-1]; top[j-1] = tmp;
            }
        }
    }
    for (int i = 0; i < 5 && top[i].count > 0; i++) {
        printf("  port %-6d  %d packets\n", top[i].port, top[i].count);
    }
}
