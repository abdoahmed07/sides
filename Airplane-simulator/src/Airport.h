#pragma once
#include "Plane.h"
#include "Queue.h"
#include "Runway.h"
#include <vector>
#include <string>
#include <numeric>

// ─────────────────────────────────────────────────────────────────────────────
// Statistics gathered over the entire simulation
// ─────────────────────────────────────────────────────────────────────────────
struct Stats {
    int totalArrivals    = 0;
    int totalDepartures  = 0;
    int completedLandings  = 0;
    int completedTakeoffs  = 0;
    int emergenciesHandled = 0;
    int totalWaitTime    = 0;   // sum of all wait times (minutes)
    int maxWaitTime      = 0;
    int planesRejected   = 0;   // planes that ran out of fuel (fuel == 0 when dequeued)

    double averageWait() const {
        int served = completedLandings + completedTakeoffs;
        return served > 0 ? static_cast<double>(totalWaitTime) / served : 0.0;
    }
    int totalServed() const { return completedLandings + completedTakeoffs; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Airport – owns runways and manages the arrival / departure queues
// ─────────────────────────────────────────────────────────────────────────────
class Airport {
public:
    Airport(std::string name, int numRunways);

    // Add planes to queues
    void addArrival(Plane plane);
    void addDeparture(Plane plane);

    // Advance simulation by one minute
    void step(int currentTime);

    // Accessors for display
    const std::string& name()       const { return _name; }
    const Stats&       stats()      const { return _stats; }
    const std::vector<Runway>& runways() const { return _runways; }

    // Queue sizes
    int arrivalQueueSize()   const { return _arrivalQueue.size(); }
    int departureQueueSize() const { return _departureQueue.size(); }

    // Traversal helpers for display
    template<typename Fn>
    void forEachArrival(Fn fn) const { _arrivalQueue.forEach(fn); }
    template<typename Fn>
    void forEachDeparture(Fn fn) const { _departureQueue.forEach(fn); }

    // Recently completed planes (cleared each step by caller if needed)
    const std::vector<Plane>& recentlyCompleted() const { return _recentlyCompleted; }
    void clearRecentlyCompleted() { _recentlyCompleted.clear(); }

private:
    std::string            _name;
    std::vector<Runway>    _runways;
    Stats                  _stats;
    std::vector<Plane>     _recentlyCompleted;

    // Arrival queue: PRIORITY sorted by fuel urgency
    PriorityQueue<Plane>   _arrivalQueue;

    // Departure queue: plain FIFO
    Queue<Plane>           _departureQueue;

    // Assign waiting planes to free runways
    void _assignToRunways(int currentTime);

    // Burn fuel for all queued arrivals; flag if any drop to 0
    void _burnQueuedFuel();
};
