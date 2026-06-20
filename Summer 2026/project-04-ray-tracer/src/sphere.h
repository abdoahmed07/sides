#pragma once
// Sphere — the fundamental shape for Book 1
// A ray P(t) = A + t*b hits a sphere centered at C with radius r when:
// |P(t) - C|^2 = r^2
// Expanding: t^2*dot(b,b) + 2t*dot(b,A-C) + dot(A-C,A-C) - r^2 = 0
// This is a quadratic in t — I use the discriminant to check for intersection

#include "hittable.h"
#include "vec3.h"

class Sphere : public Hittable {
public:
    Point3 center;
    double radius;
    std::shared_ptr<Material> mat_ptr;

    Sphere() {}
    Sphere(Point3 cen, double r, std::shared_ptr<Material> m)
        : center(cen), radius(r), mat_ptr(m) {}

    bool hit(const Ray& r, double t_min, double t_max, HitRecord& rec) const override {
        Vec3 oc = r.origin() - center;
        double a = r.direction().length_squared();
        double half_b = dot(oc, r.direction()); // using half_b simplifies the discriminant formula
        double c = oc.length_squared() - radius * radius;

        double discriminant = half_b * half_b - a * c;
        if (discriminant < 0) return false;  // ray misses the sphere

        double sqrtd = std::sqrt(discriminant);

        // Find the nearest root that falls within [t_min, t_max]
        // I check both roots (entry and exit of the sphere) and take the closer valid one
        double root = (-half_b - sqrtd) / a;
        if (root < t_min || root > t_max) {
            root = (-half_b + sqrtd) / a;
            if (root < t_min || root > t_max) return false;
        }

        rec.t = root;
        rec.p = r.at(rec.t);
        Vec3 outward_normal = (rec.p - center) / radius; // normalized: divide by radius
        rec.set_face_normal(r, outward_normal);
        rec.mat_ptr = mat_ptr;

        return true;
    }
};
