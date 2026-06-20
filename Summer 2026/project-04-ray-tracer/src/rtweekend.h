#pragma once
// Utility constants and functions used throughout the tracer
// I put them all here so I don't have to remember which header they're in

#include <cmath>
#include <limits>
#include <memory>
#include <random>

// Constants
const double infinity = std::numeric_limits<double>::infinity();
const double pi = 3.1415926535897932385;

// Utility functions
inline double degrees_to_radians(double degrees) {
    return degrees * pi / 180.0;
}

// Random double in [0,1) — used everywhere for Monte Carlo sampling
// I'm using the standard library's Mersenne Twister for decent quality random numbers
inline double random_double() {
    static std::mt19937 generator(std::random_device{}());
    static std::uniform_real_distribution<double> distribution(0.0, 1.0);
    return distribution(generator);
}

// Random double in [min,max)
inline double random_double(double min, double max) {
    return min + (max - min) * random_double();
}

// Clamp a value to [min,max]
inline double clamp(double x, double min, double max) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

#include "vec3.h"
#include "ray.h"

// These need to be defined here because they depend on random_double above
inline Vec3 Vec3::random() {
    return Vec3(random_double(), random_double(), random_double());
}

inline Vec3 Vec3::random(double min, double max) {
    return Vec3(random_double(min,max), random_double(min,max), random_double(min,max));
}

// Random vector in the unit sphere — I use rejection sampling: generate random vectors
// until one lands inside the unit sphere. It's not elegant but it's simple and correct.
inline Vec3 random_in_unit_sphere() {
    while (true) {
        Vec3 p = Vec3::random(-1, 1);
        if (p.length_squared() < 1.0) return p;
    }
}

// Normalized random vector on the surface of the unit sphere — for Lambertian diffuse
inline Vec3 random_unit_vector() {
    return unit_vector(random_in_unit_sphere());
}

// Random vector in the unit disk — used for camera defocus blur (depth of field)
inline Vec3 random_in_unit_disk() {
    while (true) {
        Vec3 p = Vec3(random_double(-1,1), random_double(-1,1), 0);
        if (p.length_squared() < 1.0) return p;
    }
}
