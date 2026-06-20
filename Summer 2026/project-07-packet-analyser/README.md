# netwatch — Network Packet Analyser

A terminal tool written in C that captures and decodes live network traffic using libpcap.
No magic underneath — all header parsing is done by hand.

```
12:34:56.123 TCP    192.168.1.5:52001    -> 142.250.80.46:443   SYN          74
12:34:56.125 TCP    142.250.80.46:443    -> 192.168.1.5:52001   SYN-ACK      74
12:34:56.125 TCP    192.168.1.5:52001    -> 142.250.80.46:443   ACK          54
12:34:57.011 DNS    192.168.1.5:58432    -> 8.8.8.8:53          query: github.com  72
12:34:57.025 DNS    8.8.8.8:53           -> 192.168.1.5:58432   github.com -> 140.82.114.3  88
```

## Building

```bash
# Install libpcap dev headers
sudo apt install libpcap-dev   # Debian/Ubuntu
brew install libpcap            # macOS

make
```

## Usage

```bash
sudo ./netwatch                       # all traffic, default interface
sudo ./netwatch --interface eth0      # specific interface
sudo ./netwatch --tcp                 # only TCP
sudo ./netwatch --port 443            # only HTTPS traffic
sudo ./netwatch --host 8.8.8.8       # traffic to/from a specific host
sudo ./netwatch --write capture.pcap  # save to file (open in Wireshark)
sudo ./netwatch --tcp --port 80       # combine filters
```

## Packet structure (ASCII diagram)

```
Ethernet frame
+------------------+------------------+-----------+
| Dst MAC (6B)     | Src MAC (6B)     | Type (2B) |
+------------------+------------------+-----------+
                                            |
                                            v
IPv4 header (minimum 20B)
+------+------+-----+--------+-----+---+--------+
| Ver  | IHL  | TOS | Length | ID  |   | TTL    |
+------+------+-----+--------+-----+---+--------+
| Proto| Cksum| Src IP (4B)        | Dst IP (4B)|
+------+------+--------------------+------------+

TCP header (minimum 20B)
+----------+----------+----------------------+
| Src Port | Dst Port | Sequence Number      |
+----------+----------+----------------------+
| Ack Number         | Offset| Flags| Window |
+--------------------+-------+------+--------+

UDP header (always 8B)
+----------+----------+----------+----------+
| Src Port | Dst Port | Length   | Checksum |
+----------+----------+----------+----------+
```

## What I learned

**Everything is just bytes.** Reading a TCP header means casting a `const u_char*` pointer
to a `TCPHeader*` and reading fields. The network card puts bytes in memory in the exact
layout I described in the struct. Once I understood that, parsing felt simple.

**Byte order matters a lot.** Network protocols use big-endian. x86 is little-endian. Every
multi-byte field requires `ntohs()` or `ntohl()` before you can use it. I forgot this on the
port number first and was getting nonsense values for hours.

**libpcap's BPF filtering is fast.** Applying filters in the kernel (via pcap_setfilter) is
much faster than capturing everything and filtering in userspace. The kernel can discard packets
before they even cross the kernel/userspace boundary.

**DNS is surprisingly readable.** Once I understood the length-prefixed label format, parsing
domain names became a simple loop. The compression pointer scheme (used in responses) is a bit
more complex but the basic case is straightforward.

## Technical decisions

**Why C and not C++:** libpcap is a C library and the header structures map directly to C
structs with no overhead. C gives me direct control over pointer arithmetic and struct layout.

**Why `__attribute__((packed))` on the structs:** Without it, the compiler adds alignment
padding between struct fields to improve memory access performance. The raw packet bytes don't
have any padding, so a packed struct with exact byte offsets correctly mirrors the wire format.

**Why ANSI escape codes for color:** No external dependency. Works in any terminal that
supports ANSI codes (which is essentially all of them on Linux/macOS).
