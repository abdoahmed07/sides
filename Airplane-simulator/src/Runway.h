#pragma once
#include "Plane.h"
#include <string>
#include <optional>

enum class RunwayStatus { AVAILABLE, LANDING, TAKEOFF };

class Runway {
public:
    explicit Runway(std::string name);

    // Getters
    const std::string& name()          const { return _name; }
    RunwayStatus       status()        const { return _status; }
    int                timeRemaining() const { return _timeRemaining; }
    bool               isAvailable()   const { return _status == RunwayStatus::AVAILABLE; }
    bool               hasPlane()      const { return _hasPlane; }
    const Plane&       currentPlane()  const { return _currentPlane; }

    // Assign a plane; returns false if runway is busy
    bool assign(Plane& plane, int currentTime);

    // Advance one minute; returns completed plane (if any)
    std::optional<Plane> tick(int currentTime);

    // Statistics
    int planesServed() const { return _planesServed; }

private:
    std::string  _name;
    RunwayStatus _status;
    Plane        _currentPlane;
    bool         _hasPlane;
    int          _timeRemaining;
    int          _planesServed;
};
