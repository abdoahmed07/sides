#pragma once
// Vec3 — the most important class in the whole project
// Almost everything in a ray tracer is a vector operation: positions, directions, colors
// I'm making Color an alias for Vec3 to keep the code readable

#include <cmath>
#include <iostream>

class Vec3 {
public:
    double e[3];

    Vec3() : e{0, 0, 0} {}
    Vec3(double x, double y, double z) : e{x, y, z} {}

    double x() const { return e[0]; }
    double y() const { return e[1]; }
    double z() const { return e[2]; }

    Vec3 operator-() const { return Vec3(-e[0], -e[1], -e[2]); }
    double operator[](int i) const { return e[i]; }
    double& operator[](int i) { return e[i]; }

    Vec3& operator+=(const Vec3& v) {
        e[0] += v.e[0]; e[1] += v.e[1]; e[2] += v.e[2];
        return *this;
    }

    Vec3& operator*=(double t) {
        e[0] *= t; e[1] *= t; e[2] *= t;
        return *this;
    }

    Vec3& operator/=(double t) {
        return *this *= 1.0 / t;
    }

    double length() const {
        return std::sqrt(length_squared());
    }

    double length_squared() const {
        return e[0]*e[0] + e[1]*e[1] + e[2]*e[2];
    }

    // Needed for generating random points in the unit sphere for diffuse scattering
    bool near_zero() const {
        const double eps = 1e-8;
        return (std::abs(e[0]) < eps) && (std::abs(e[1]) < eps) && (std::abs(e[2]) < eps);
    }

    // Generate a random Vec3 in a range — used for materials and sampling
    static Vec3 random();
    static Vec3 random(double min, double max);
};

// Type aliases — makes code much clearer when a Vec3 is being used as a point vs a color
using Point3 = Vec3;
using Color  = Vec3;

// ---- Utility functions (inline so the compiler can optimize them aggressively) ----

inline std::ostream& operator<<(std::ostream& out, const Vec3& v) {
    return out << v.e[0] << ' ' << v.e[1] << ' ' << v.e[2];
}

inline Vec3 operator+(const Vec3& u, const Vec3& v) {
    return Vec3(u.e[0] + v.e[0], u.e[1] + v.e[1], u.e[2] + v.e[2]);
}

inline Vec3 operator-(const Vec3& u, const Vec3& v) {
    return Vec3(u.e[0] - v.e[0], u.e[1] - v.e[1], u.e[2] - v.e[2]);
}

// Component-wise multiply — used for multiplying colors (attenuating light)
inline Vec3 operator*(const Vec3& u, const Vec3& v) {
    return Vec3(u.e[0] * v.e[0], u.e[1] * v.e[1], u.e[2] * v.e[2]);
}

inline Vec3 operator*(double t, const Vec3& v) {
    return Vec3(t * v.e[0], t * v.e[1], t * v.e[2]);
}

inline Vec3 operator*(const Vec3& v, double t) {
    return t * v;
}

inline Vec3 operator/(const Vec3& v, double t) {
    return (1.0 / t) * v;
}

inline double dot(const Vec3& u, const Vec3& v) {
    return u.e[0]*v.e[0] + u.e[1]*v.e[1] + u.e[2]*v.e[2];
}

inline Vec3 cross(const Vec3& u, const Vec3& v) {
    return Vec3(
        u.e[1] * v.e[2] - u.e[2] * v.e[1],
        u.e[2] * v.e[0] - u.e[0] * v.e[2],
        u.e[0] * v.e[1] - u.e[1] * v.e[0]
    );
}

inline Vec3 unit_vector(const Vec3& v) {
    return v / v.length();
}

// Reflect a vector v around a normal n
// v - 2*dot(v,n)*n is the reflection formula — I derived this from the book
inline Vec3 reflect(const Vec3& v, const Vec3& n) {
    return v - 2 * dot(v, n) * n;
}

// Refract a vector through a surface using Snell's law
// This was the hardest piece of math in Book 1 to understand
// cos_theta is clamped to 1.0 to handle floating point imprecision
inline Vec3 refract(const Vec3& uv, const Vec3& n, double etai_over_etat) {
    double cos_theta = std::fmin(dot(-uv, n), 1.0);
    Vec3 r_out_perp  = etai_over_etat * (uv + cos_theta * n);
    Vec3 r_out_para  = -std::sqrt(std::fabs(1.0 - r_out_perp.length_squared())) * n;
    return r_out_perp + r_out_para;
}
