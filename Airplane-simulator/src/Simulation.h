#pragma once
#include "Airport.h"
#include <string>
#include <vector>

struct SimConfig {
    std::string name           = "Metro International Airport";
    int         numRunways     = 2;     // 1–6
    int         duration       = 60;    // simulation minutes
    int         arrivalRate    = 3;     // avg arrivals per 10 min
    int         departureRate  = 3;     // avg departures per 10 min
    bool        stepMode       = false; // true = press Enter each tick
    bool        fastMode       = false; // true = no sleep between ticks
};

class Simulation {
public:
    explicit Simulation(SimConfig cfg);
    void run();

private:
    SimConfig _cfg;
    Airport   _airport;
    int       _clock;          // current simulation minute
    int       _nextPlaneId;

    // Plane generation
    void _generateTraffic();

    // Rendering
    void _render() const;
    void _renderRunways() const;
    void _renderArrivalQueue() const;
    void _renderDepartureQueue() const;
    void _renderStats() const;
    void _renderFinal() const;
    void _renderLog() const;

    // Log of recent events (shown in the display)
    mutable std::vector<std::string> _log;
    void _logEvent(const std::string& msg);
    void _processCompleted();

    // Saved for logging after step()
    std::vector<Plane> _justCompleted;
};
