#pragma once
#include <string>
#include <array>
#include <cstdlib>

enum class PlaneType   { ARRIVING, DEPARTING };
enum class PlaneStatus { IN_QUEUE, ON_RUNWAY, COMPLETED };

struct Plane {
    int         id;
    std::string flightNumber;
    std::string airline;
    std::string origin;
    std::string destination;
    int         fuelLevel;        // 0–100 %
    PlaneType   type;
    PlaneStatus status;
    int         queueEntryTime;   // simulation minute when plane joined queue
    int         runwayStartTime;  // -1 until assigned
    int         completionTime;   // -1 until done
    int         runwayDuration;   // minutes needed on runway

    // Fuel decreases every minute while waiting
    void burnFuel() {
        if (fuelLevel > 0) fuelLevel--;
    }

    bool isEmergency() const { return fuelLevel < 20; }
    bool isLowFuel()   const { return fuelLevel >= 20 && fuelLevel < 40; }

    // 0 = highest priority (emergency), 1 = low fuel, 2 = normal
    // Departures don't burn fuel so they are always priority 2
    int priority() const {
        if (type == PlaneType::DEPARTING) return 2;
        if (isEmergency()) return 0;
        if (isLowFuel())   return 1;
        return 2;
    }

    int waitTime() const {
        return (runwayStartTime >= 0) ? runwayStartTime - queueEntryTime : -1;
    }

    static Plane createArrival(int id, int currentTime) {
        static const std::array<std::string, 8> airlines = {
            "Delta", "United", "American", "Southwest",
            "JetBlue", "Alaska", "Spirit", "Frontier"
        };
        static const std::array<std::string, 2> codes = { "AA", "DL" };
        static const std::array<std::string, 10> cities = {
            "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
            "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"
        };

        Plane p;
        p.id             = id;
        p.airline        = airlines[id % airlines.size()];
        p.flightNumber   = p.airline.substr(0, 2) + std::to_string(100 + (id * 37) % 900);
        p.origin         = cities[(id * 3) % cities.size()];
        p.destination    = cities[(id * 7 + 2) % cities.size()];
        p.fuelLevel      = 20 + (std::rand() % 80);   // 20–99 %
        p.type           = PlaneType::ARRIVING;
        p.status         = PlaneStatus::IN_QUEUE;
        p.queueEntryTime = currentTime;
        p.runwayStartTime = -1;
        p.completionTime  = -1;
        p.runwayDuration  = 3 + (std::rand() % 3);    // 3–5 min to land
        return p;
    }

    static Plane createDeparture(int id, int currentTime) {
        static const std::array<std::string, 8> airlines = {
            "Delta", "United", "American", "Southwest",
            "JetBlue", "Alaska", "Spirit", "Frontier"
        };
        static const std::array<std::string, 10> cities = {
            "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
            "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"
        };

        Plane p;
        p.id             = id;
        p.airline        = airlines[id % airlines.size()];
        p.flightNumber   = p.airline.substr(0, 2) + std::to_string(100 + (id * 53) % 900);
        p.origin         = cities[(id * 5) % cities.size()];
        p.destination    = cities[(id * 11 + 3) % cities.size()];
        p.fuelLevel      = 100;   // full tank for departures
        p.type           = PlaneType::DEPARTING;
        p.status         = PlaneStatus::IN_QUEUE;
        p.queueEntryTime = currentTime;
        p.runwayStartTime = -1;
        p.completionTime  = -1;
        p.runwayDuration  = 2 + (std::rand() % 3);    // 2–4 min to take off
        return p;
    }
};
