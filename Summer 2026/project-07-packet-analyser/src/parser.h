#pragma once
#include "headers.h"
#include <pcap.h>

int parse_ethernet(const u_char* packet, uint32_t caplen, PacketInfo* info);
int parse_ip(const u_char* packet, uint32_t caplen, PacketInfo* info);
int parse_tcp(const u_char* packet, uint32_t caplen, PacketInfo* info);
int parse_udp(const u_char* packet, uint32_t caplen, PacketInfo* info);
int parse_dns(const u_char* packet, uint32_t caplen, PacketInfo* info);
