#pragma once
// Materials — Lambertian (matte), Metal (reflective), Dielectric (glass)
// Each material implements scatter(): given an incoming ray and a hit record,
// it produces a scattered ray and an attenuation color

#include "rtweekend.h"
#include "hittable.h"

class Material {
public:
    // Returns true if the ray scatters (vs is absorbed)
    // attenuation tells us how much each color channel is absorbed
    // scattered is the new ray direction
    virtual bool scatter(
        const Ray& r_in,
        const HitRecord& rec,
        Color& attenuation,
        Ray& scattered
    ) const = 0;

    virtual ~Material() = default;
};

// Lambertian — perfectly diffuse (matte) surface
// Scatters light in a random direction on the hemisphere around the normal
// The Lambertian model distributes scattered rays proportional to cos(theta),
// which is physically correct for matte surfaces
class Lambertian : public Material {
public:
    Color albedo; // "albedo" = how much of each color component is reflected

    Lambertian(const Color& a) : albedo(a) {}

    bool scatter(const Ray& r_in, const HitRecord& rec, Color& attenuation, Ray& scattered) const override {
        Vec3 scatter_direction = rec.normal + random_unit_vector();

        // Edge case: if the random unit vector exactly opposes the normal, the sum is zero
        // That would give a degenerate ray direction, so I catch it here
        if (scatter_direction.near_zero())
            scatter_direction = rec.normal;

        scattered = Ray(rec.p, scatter_direction);
        attenuation = albedo;
        return true;
    }
};

// Metal — reflective surface with optional fuzz for brushed metal look
// The fuzz parameter (0 = perfect mirror, 1 = very rough) perturbs the reflected ray
class Metal : public Material {
public:
    Color albedo;
    double fuzz; // how rough the metal surface is

    Metal(const Color& a, double f) : albedo(a), fuzz(f < 1 ? f : 1) {}

    bool scatter(const Ray& r_in, const HitRecord& rec, Color& attenuation, Ray& scattered) const override {
        Vec3 reflected = reflect(unit_vector(r_in.direction()), rec.normal);
        // Add random perturbation proportional to fuzz for the brushed metal effect
        scattered = Ray(rec.p, reflected + fuzz * random_in_unit_sphere());
        attenuation = albedo;
        return dot(scattered.direction(), rec.normal) > 0; // don't scatter below the surface
    }
};

// Dielectric — glass, water, diamond
// Uses Schlick's approximation for the Fresnel effect:
// at grazing angles, glass reflects more than it refracts (this is physically correct)
// I had to look up what Schlick's approximation actually was before I understood why it works
class Dielectric : public Material {
public:
    double ir; // index of refraction (glass ≈ 1.5, diamond ≈ 2.4, water ≈ 1.33)

    Dielectric(double index_of_refraction) : ir(index_of_refraction) {}

    bool scatter(const Ray& r_in, const HitRecord& rec, Color& attenuation, Ray& scattered) const override {
        attenuation = Color(1.0, 1.0, 1.0); // glass doesn't absorb color
        double refraction_ratio = rec.front_face ? (1.0 / ir) : ir;

        Vec3 unit_direction = unit_vector(r_in.direction());
        double cos_theta = std::fmin(dot(-unit_direction, rec.normal), 1.0);
        double sin_theta = std::sqrt(1.0 - cos_theta * cos_theta);

        // Total internal reflection: if sin_theta * refraction_ratio > 1, refraction is impossible
        bool cannot_refract = refraction_ratio * sin_theta > 1.0;
        Vec3 direction;

        if (cannot_refract || reflectance(cos_theta, refraction_ratio) > random_double()) {
            // Must reflect
            direction = reflect(unit_direction, rec.normal);
        } else {
            // Refract using Snell's law
            direction = refract(unit_direction, rec.normal, refraction_ratio);
        }

        scattered = Ray(rec.p, direction);
        return true;
    }

private:
    // Schlick's approximation for reflectance — polynomial that approximates the Fresnel equations
    // It's accurate enough for ray tracing and much cheaper than the full calculation
    static double reflectance(double cosine, double ref_idx) {
        double r0 = (1 - ref_idx) / (1 + ref_idx);
        r0 = r0 * r0;
        return r0 + (1 - r0) * std::pow((1 - cosine), 5);
    }
};
