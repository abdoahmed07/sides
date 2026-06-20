#pragma once
// A ray is just an origin point and a direction vector
// The parametric form P(t) = origin + t * direction lets me compute any point along the ray
// t < 0 is "behind" the camera, t > 0 is "in front"

#include "vec3.h"

class Ray {
public:
    Ray() {}
    Ray(const Point3& origin, const Vec3& direction)
        : orig(origin), dir(direction) {}

    Point3 origin() const    { return orig; }
    Vec3   direction() const { return dir; }

    // at(t) gives the 3D point at parameter t along the ray
    // I use this constantly — for sphere intersection, for material scatter, etc.
    Point3 at(double t) const {
        return orig + t * dir;
    }

private:
    Point3 orig;
    Vec3   dir;
};
