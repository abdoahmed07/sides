#include "Airport.h"
#include <algorithm>
#include <iostream>

// Comparator: lower priority number = higher urgency
// Tie-break: earlier queueEntryTime wins (FIFO within same bucket)
static bool arrivalCmp(const Plane& a, const Plane& b) {
    if (a.priority() != b.priority())
        return a.priority() < b.priority();
    return a.queueEntryTime < b.queueEntryTime;
}

Airport::Airport(std::string name, int numRunways)
    : _name(std::move(name))
    , _arrivalQueue(arrivalCmp)
{
    for (int i = 1; i <= numRunways; ++i)
        _runways.emplace_back("RW-0" + std::to_string(i));
}

void Airport::addArrival(Plane plane) {
    ++_stats.totalArrivals;
    _arrivalQueue.enqueue(plane);
}

void Airport::addDeparture(Plane plane) {
    ++_stats.totalDepartures;
    _departureQueue.enqueue(plane);
}

void Airport::step(int currentTime) {
    _recentlyCompleted.clear();

    // 1. Burn fuel for every plane waiting to land
    _burnQueuedFuel();

    // 2. Tick each runway (process planes in progress)
    for (auto& rw : _runways) {
        auto done = rw.tick(currentTime);
        if (done) {
            // Collect stats
            int wt = done->waitTime();
            if (wt > 0) {
                _stats.totalWaitTime += wt;
                _stats.maxWaitTime    = std::max(_stats.maxWaitTime, wt);
            }
            if (done->type == PlaneType::ARRIVING) {
                ++_stats.completedLandings;
                if (done->isEmergency())   // was emergency when it landed
                    ++_stats.emergenciesHandled;
            } else {
                ++_stats.completedTakeoffs;
            }
            _recentlyCompleted.push_back(*done);
        }
    }

    // 3. Assign waiting planes to newly freed runways
    _assignToRunways(currentTime);
}

void Airport::_assignToRunways(int currentTime) {
    for (auto& rw : _runways) {
        if (!rw.isAvailable()) continue;

        bool assigned = false;

        // Arrivals take priority over departures.
        // Skip over any zero-fuel planes (crashed while waiting).
        while (!_arrivalQueue.isEmpty() && !assigned) {
            Plane p = _arrivalQueue.dequeue();
            if (p.fuelLevel == 0) {
                ++_stats.planesRejected;
                p.status          = PlaneStatus::COMPLETED;
                p.runwayStartTime = currentTime;
                p.completionTime  = currentTime;
                _recentlyCompleted.push_back(p);
                continue;  // try next plane in the arrival queue
            }
            rw.assign(p, currentTime);
            assigned = true;
        }

        if (!assigned && !_departureQueue.isEmpty()) {
            Plane p = _departureQueue.dequeue();
            rw.assign(p, currentTime);
        }
    }
}

void Airport::_burnQueuedFuel() {
    _arrivalQueue.forEachMut([](Plane& p) { p.burnFuel(); });
}
