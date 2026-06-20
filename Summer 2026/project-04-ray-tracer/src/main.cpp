// Ray Tracer — main entry point and scene setup
// This produces the Book 1 final scene: hundreds of spheres with different materials
// Output is a PPM file written to stdout. Run with: ./raytracer > output.ppm
// Then convert to PNG: convert output.ppm output.png (ImageMagick)

#include "rtweekend.h"
#include "color.h"
#include "hittable_list.h"
#include "sphere.h"
#include "camera.h"
#include "material.h"

#include <iostream>

// The core of the ray tracer: trace a ray through the scene and return its color
// This is recursive — when a ray hits a surface, it bounces and we trace the bounce too
// max_depth prevents infinite recursion (a ray bouncing in a closed box would loop forever)
Color ray_color(const Ray& r, const Hittable& world, int depth) {
    // If we've exceeded the ray bounce limit, return no light (absorbed by the scene)
    if (depth <= 0) return Color(0, 0, 0);

    HitRecord rec;

    // t_min = 0.001 instead of 0 to avoid "shadow acne" — a floating point artifact where
    // a ray hits the same surface it just scattered from due to rounding errors
    if (world.hit(r, 0.001, infinity, rec)) {
        Ray scattered;
        Color attenuation;

        if (rec.mat_ptr->scatter(r, rec, attenuation, scattered)) {
            // Recursively trace the scattered ray and multiply by the attenuation
            // This implements the rendering equation for indirect illumination
            return attenuation * ray_color(scattered, world, depth - 1);
        }

        return Color(0, 0, 0); // absorbed — dark
    }

    // Background: simple gradient from white to sky blue based on ray Y direction
    // This is the "environment light" — what the ray hits when it escapes the scene
    Vec3 unit_direction = unit_vector(r.direction());
    double t = 0.5 * (unit_direction.y() + 1.0); // remap [-1,1] to [0,1]
    return (1.0 - t) * Color(1.0, 1.0, 1.0) + t * Color(0.5, 0.7, 1.0);
}

// The Book 1 final scene — I generated this procedurally following the book exactly
HittableList random_scene() {
    HittableList world;

    // Ground plane (a huge sphere acts as the floor)
    auto ground_material = std::make_shared<Lambertian>(Color(0.5, 0.5, 0.5));
    world.add(std::make_shared<Sphere>(Point3(0, -1000, 0), 1000, ground_material));

    // Grid of small random spheres
    for (int a = -11; a < 11; a++) {
        for (int b = -11; b < 11; b++) {
            double choose_mat = random_double();
            Point3 center(a + 0.9 * random_double(), 0.2, b + 0.9 * random_double());

            // Skip spheres that would overlap the big spheres in the center
            if ((center - Point3(4, 0.2, 0)).length() > 0.9) {
                std::shared_ptr<Material> sphere_material;

                if (choose_mat < 0.8) {
                    // Diffuse — most common
                    Color albedo = Color::random() * Color::random();
                    sphere_material = std::make_shared<Lambertian>(albedo);
                } else if (choose_mat < 0.95) {
                    // Metal
                    Color albedo = Color::random(0.5, 1);
                    double fuzz = random_double(0, 0.5);
                    sphere_material = std::make_shared<Metal>(albedo, fuzz);
                } else {
                    // Glass
                    sphere_material = std::make_shared<Dielectric>(1.5);
                }

                world.add(std::make_shared<Sphere>(center, 0.2, sphere_material));
            }
        }
    }

    // Three large spheres in the center — glass, matte, metal
    world.add(std::make_shared<Sphere>(Point3(0, 1, 0),  1.0, std::make_shared<Dielectric>(1.5)));
    world.add(std::make_shared<Sphere>(Point3(-4, 1, 0), 1.0, std::make_shared<Lambertian>(Color(0.4, 0.2, 0.1))));
    world.add(std::make_shared<Sphere>(Point3(4, 1, 0),  1.0, std::make_shared<Metal>(Color(0.7, 0.6, 0.5), 0.0)));

    return world;
}

int main() {
    // Image settings
    const double aspect_ratio      = 3.0 / 2.0;
    const int    image_width       = 1200;
    const int    image_height      = static_cast<int>(image_width / aspect_ratio);
    const int    samples_per_pixel = 500;  // more samples = less noise, much slower
    const int    max_depth         = 50;   // max ray bounces

    // Scene
    HittableList world = random_scene();

    // Camera — positioned to match the book's final scene
    Point3 lookfrom(13, 2, 3);
    Point3 lookat(0, 0, 0);
    Vec3 vup(0, 1, 0);
    double dist_to_focus = 10.0;
    double aperture = 0.1; // small aperture = subtle depth of field

    Camera cam(lookfrom, lookat, vup, 20, aspect_ratio, aperture, dist_to_focus);

    // Render — write PPM header then scan top-to-bottom, left-to-right
    std::cout << "P3\n" << image_width << ' ' << image_height << "\n255\n";

    for (int j = image_height - 1; j >= 0; --j) {
        // Progress indicator to stderr (doesn't pollute the PPM output on stdout)
        std::cerr << "\rScanlines remaining: " << j << ' ' << std::flush;

        for (int i = 0; i < image_width; ++i) {
            Color pixel_color(0, 0, 0);

            // Multi-sample anti-aliasing: average several rays per pixel with random jitter
            // This removes the jagged edges you'd get with a single ray per pixel
            for (int s = 0; s < samples_per_pixel; ++s) {
                double u = (i + random_double()) / (image_width - 1);
                double v = (j + random_double()) / (image_height - 1);
                Ray r = cam.get_ray(u, v);
                pixel_color += ray_color(r, world, max_depth);
            }

            write_color(std::cout, pixel_color, samples_per_pixel);
        }
    }

    std::cerr << "\nDone.\n";
    return 0;
}
