#pragma once
// Abstract base class for anything a ray can hit
// I designed this interface following the book — it makes adding new shapes really easy
// Sphere, rectangle, triangle mesh all implement the same hit() function

#include "rtweekend.h"

class Material; // forward declaration — Material and Hittable need each other

// When a ray hits something, we fill in a HitRecord with the details
// Instead of returning a bunch of values from hit(), we pass a record to fill in
struct HitRecord {
    Point3 p;           // the point where the ray hit
    Vec3 normal;        // the surface normal at that point
    std::shared_ptr<Material> mat_ptr; // what material is this object made of?
    double t;           // the ray parameter at the hit point
    bool front_face;    // did the ray hit the outside or inside of the surface?

    // I always want normals to point against the incoming ray direction
    // This makes the lighting math simpler — I don't have to handle both cases
    inline void set_face_normal(const Ray& r, const Vec3& outward_normal) {
        front_face = dot(r.direction(), outward_normal) < 0;
        normal = front_face ? outward_normal : -outward_normal;
    }
};

class Hittable {
public:
    virtual bool hit(const Ray& r, double t_min, double t_max, HitRecord& rec) const = 0;
    virtual ~Hittable() = default;
};
