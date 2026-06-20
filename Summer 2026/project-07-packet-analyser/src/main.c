/*
 * netwatch — a terminal network packet analyser
 * Captures live traffic using libpcap and decodes Ethernet/IP/TCP/UDP/DNS headers
 *
 * Build: make
 * Run:   sudo ./netwatch [options]
 * (sudo is needed because raw packet capture requires elevated privileges)
 *
 * Usage examples:
 *   sudo ./netwatch                        -- capture all traffic on default interface
 *   sudo ./netwatch --tcp --port 443       -- only HTTPS traffic
 *   sudo ./netwatch --interface wlan0      -- specify interface
 *   sudo ./netwatch --write capture.pcap   -- save to file
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <getopt.h>
#include <pcap.h>

#include "headers.h"
#include "parser.h"
#include "display.h"
#include "stats.h"

// Global pcap handle — needed by the signal handler so Ctrl+C can clean up
static pcap_t* handle = NULL;

// Statistics tracked across all packets
Stats global_stats = {0};

// Signal handler — print summary and exit cleanly on Ctrl+C
static void handle_sigint(int sig) {
    (void)sig;
    printf("\n");
    print_summary(&global_stats);
    if (handle) pcap_breakloop(handle);
}

// Called by libpcap for each captured packet
void packet_handler(u_char* user, const struct pcap_pkthdr* header, const u_char* packet) {
    (void)user; /* unused when not writing to a dump file */
    PacketInfo info = {0};
    info.timestamp  = header->ts;
    info.length     = header->len;

    // Parse from Ethernet outward — each layer hands off to the next
    if (!parse_ethernet(packet, header->caplen, &info)) return;
    if (info.is_ip)  parse_ip(packet + ETHERNET_HEADER_LEN, header->caplen - ETHERNET_HEADER_LEN, &info);
    if (info.is_tcp) parse_tcp(packet + ETHERNET_HEADER_LEN + info.ip_header_len,
                                header->caplen - ETHERNET_HEADER_LEN - info.ip_header_len, &info);
    if (info.is_udp) {
        parse_udp(packet + ETHERNET_HEADER_LEN + info.ip_header_len,
                  header->caplen - ETHERNET_HEADER_LEN - info.ip_header_len, &info);
        // DNS is UDP on port 53
        if (info.src_port == 53 || info.dst_port == 53) {
            parse_dns(packet + ETHERNET_HEADER_LEN + info.ip_header_len + UDP_HEADER_LEN,
                      header->caplen - ETHERNET_HEADER_LEN - info.ip_header_len - UDP_HEADER_LEN, &info);
        }
    }

    // Update stats (always) and print (applies filters)
    update_stats(&global_stats, &info);
    print_packet(&info);
}

int main(int argc, char* argv[]) {
    char errbuf[PCAP_ERRBUF_SIZE];
    char* interface  = NULL;
    char* write_file = NULL;
    char  filter_expr[256] = {0}; // BPF filter expression built from CLI args

    // Parse command-line arguments with getopt_long
    static struct option long_options[] = {
        {"interface", required_argument, 0, 'i'},
        {"tcp",       no_argument,       0, 't'},
        {"udp",       no_argument,       0, 'u'},
        {"icmp",      no_argument,       0, 'c'},
        {"port",      required_argument, 0, 'p'},
        {"host",      required_argument, 0, 'h'},
        {"write",     required_argument, 0, 'w'},
        {"help",      no_argument,       0, '?'},
        {0, 0, 0, 0}
    };

    // I build a BPF filter string from the CLI flags so I can pass it to libpcap
    // libpcap applies the filter in the kernel which is much more efficient than filtering in userspace
    char proto_filter[64] = {0};
    char port_filter[64]  = {0};
    char host_filter[64]  = {0};

    int opt;
    while ((opt = getopt_long(argc, argv, "i:tucp:h:w:?", long_options, NULL)) != -1) {
        switch (opt) {
            case 'i': interface  = optarg; break;
            case 'w': write_file = optarg; break;
            case 't': snprintf(proto_filter, sizeof(proto_filter), "tcp");  break;
            case 'u': snprintf(proto_filter, sizeof(proto_filter), "udp");  break;
            case 'c': snprintf(proto_filter, sizeof(proto_filter), "icmp"); break;
            case 'p': snprintf(port_filter,  sizeof(port_filter),  "port %s", optarg); break;
            case 'h': snprintf(host_filter,  sizeof(host_filter),  "host %s", optarg); break;
            default:
                printf("Usage: netwatch [--interface IF] [--tcp|--udp|--icmp] "
                       "[--port N] [--host IP] [--write FILE]\n");
                return 0;
        }
    }

    // Combine filter parts with "and"
    if (proto_filter[0] && port_filter[0])
        snprintf(filter_expr, sizeof(filter_expr), "%s and %s", proto_filter, port_filter);
    else if (proto_filter[0])
        snprintf(filter_expr, sizeof(filter_expr), "%s", proto_filter);
    else if (port_filter[0])
        snprintf(filter_expr, sizeof(filter_expr), "%s", port_filter);
    if (host_filter[0] && filter_expr[0])
        snprintf(filter_expr + strlen(filter_expr), sizeof(filter_expr) - strlen(filter_expr),
                 " and %s", host_filter);
    else if (host_filter[0])
        snprintf(filter_expr, sizeof(filter_expr), "%s", host_filter);

    // Find default interface if none specified
    // pcap_lookupdev() was deprecated in libpcap 1.9 and removed in some builds,
    // so I use pcap_findalldevs() instead — it's the modern way
    if (!interface) {
        pcap_if_t* alldevs;
        if (pcap_findalldevs(&alldevs, errbuf) == -1 || alldevs == NULL) {
            fprintf(stderr, "No interface found: %s\n", errbuf);
            return 1;
        }
        // Use the first non-loopback interface, falling back to whatever is first
        interface = alldevs->name;
        for (pcap_if_t* d = alldevs; d != NULL; d = d->next) {
            if (!(d->flags & PCAP_IF_LOOPBACK)) { interface = d->name; break; }
        }
        // Note: alldevs memory leaks here intentionally — we exit or use it right after
    }

    printf("Capturing on %s", interface);
    if (filter_expr[0]) printf(" [filter: %s]", filter_expr);
    printf("\n");
    print_header(); // print the column header line

    // Open the capture handle
    // 65535 = capture entire packet, 1 = promiscuous mode, 1000ms timeout
    handle = pcap_open_live(interface, 65535, 1, 1000, errbuf);
    if (!handle) {
        fprintf(stderr, "Could not open device %s: %s\n", interface, errbuf);
        return 1;
    }

    // Apply BPF filter if we have one
    if (filter_expr[0]) {
        struct bpf_program fp;
        if (pcap_compile(handle, &fp, filter_expr, 0, PCAP_NETMASK_UNKNOWN) < 0) {
            fprintf(stderr, "Could not compile filter: %s\n", pcap_geterr(handle));
            return 1;
        }
        if (pcap_setfilter(handle, &fp) < 0) {
            fprintf(stderr, "Could not set filter: %s\n", pcap_geterr(handle));
            return 1;
        }
        pcap_freecode(&fp);
    }

    // Open output file if --write was specified
    pcap_dumper_t* dumper = NULL;
    if (write_file) {
        dumper = pcap_dump_open(handle, write_file);
        if (!dumper) {
            fprintf(stderr, "Could not open output file: %s\n", pcap_geterr(handle));
            return 1;
        }
        printf("Writing to %s\n", write_file);
    }

    // Set up Ctrl+C handler
    signal(SIGINT, handle_sigint);

    // Start capturing — calls packet_handler for each packet
    // 0 means loop forever (until pcap_breakloop is called)
    pcap_loop(handle, 0, dumper ? (pcap_handler)pcap_dump : packet_handler, (u_char*)dumper);

    if (dumper)  pcap_dump_close(dumper);
    pcap_close(handle);
    return 0;
}
