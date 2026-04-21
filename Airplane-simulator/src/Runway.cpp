#include "Runway.h"

Runway::Runway(std::string name)
    : _name(std::move(name))
    , _status(RunwayStatus::AVAILABLE)
    , _currentPlane{}
    , _hasPlane(false)
    , _timeRemaining(0)
    , _planesServed(0)
{}

bool Runway::assign(Plane& plane, int currentTime) {
    if (!isAvailable()) return false;

    plane.status         = PlaneStatus::ON_RUNWAY;
    plane.runwayStartTime = currentTime;
    _currentPlane        = plane;
    _hasPlane            = true;
    _timeRemaining       = plane.runwayDuration;
    _status              = (plane.type == PlaneType::ARRIVING)
                           ? RunwayStatus::LANDING
                           : RunwayStatus::TAKEOFF;
    return true;
}

std::optional<Plane> Runway::tick(int currentTime) {
    if (!_hasPlane) return std::nullopt;

    --_timeRemaining;

    if (_timeRemaining <= 0) {
        _currentPlane.status         = PlaneStatus::COMPLETED;
        _currentPlane.completionTime = currentTime;
        Plane done = _currentPlane;

        _status        = RunwayStatus::AVAILABLE;
        _hasPlane      = false;
        _timeRemaining = 0;
        ++_planesServed;

        return done;
    }
    return std::nullopt;
}
