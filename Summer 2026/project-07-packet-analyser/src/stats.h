#pragma once
#include "headers.h"

// How many unique IPs to track in the top-N display
#define MAX_TRACKED_IPS 1024

typedef struct {
    char ip[INET_ADDRSTRLEN];
    uint64_t packet_count;
} IPEntry;

typedef struct {
    uint64_t total_packets;
    uint64_t tcp_packets;
    uint64_t udp_packets;
    uint64_t icmp_packets;
    uint64_t dns_queries;
    uint64_t total_bytes;

    IPEntry  src_ips[MAX_TRACKED_IPS];  // tracked source IPs
    int      src_ip_count;
    uint16_t top_ports[65536];          // packet count per destination port
} Stats;

void update_stats(Stats* stats, const PacketInfo* info);
void print_summary(const Stats* stats);
