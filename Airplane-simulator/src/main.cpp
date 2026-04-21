#include "Simulation.h"
#include <iostream>
#include <string>
#include <limits>
#include <algorithm>

static void banner() {
    std::cout << "\033[2J\033[H";
    std::cout << "\033[1;36m"
"\n"
"   ╔══════════════════════════════════════════════════════════╗\n"
"   ║           A I R P O R T   S I M U L A T O R            ║\n"
"   ║         Manual Queue  |  Priority Landings  |  C++      ║\n"
"   ╚══════════════════════════════════════════════════════════╝\n"
"\033[0m\n";
}

static int readInt(const std::string& prompt, int defaultVal, int lo, int hi) {
    while (true) {
        std::cout << "  " << prompt << " [" << lo << "-" << hi
                  << ", default=" << defaultVal << "]: ";
        std::string line;
        std::getline(std::cin, line);
        if (line.empty()) return defaultVal;
        try {
            int v = std::stoi(line);
            if (v >= lo && v <= hi) return v;
            std::cout << "  Please enter a value between " << lo << " and " << hi << ".\n";
        } catch (...) {
            std::cout << "  Invalid input.\n";
        }
    }
}

static bool readBool(const std::string& prompt, bool defaultVal) {
    std::string def = defaultVal ? "y" : "n";
    std::cout << "  " << prompt << " [y/n, default=" << def << "]: ";
    std::string line;
    std::getline(std::cin, line);
    if (line.empty()) return defaultVal;
    return line[0] == 'y' || line[0] == 'Y';
}

int main() {
    banner();

    std::cout << "\033[1mCONFIGURATION\033[0m\n\n";

    SimConfig cfg;

    std::cout << "  Airport name [default=\"Metro International Airport\"]: ";
    std::string name;
    std::getline(std::cin, name);
    if (!name.empty()) cfg.name = name;

    cfg.numRunways    = readInt("Number of runways",                2, 1, 6);
    cfg.duration      = readInt("Simulation duration (minutes)",   60, 5, 300);
    cfg.arrivalRate   = readInt("Average arrivals per 10 minutes",  3, 0, 10);
    cfg.departureRate = readInt("Average departures per 10 minutes",3, 0, 10);

    std::cout << '\n';
    cfg.stepMode  = readBool("Step mode (press Enter each minute)?", false);
    if (!cfg.stepMode)
        cfg.fastMode = readBool("Fast mode (no delay between ticks)?",  false);

    std::cout << "\n\033[1;32m  Configuration accepted. Starting...\033[0m\n\n";

    Simulation sim(cfg);
    sim.run();

    return 0;
}
