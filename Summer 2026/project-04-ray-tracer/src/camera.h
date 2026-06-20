#pragma once
// Camera — computes rays from the eye through each pixel on the image plane
// Also handles defocus blur (depth of field): rays originate from a disk rather than
// a single point, creating the blurry foreground/background effect

#include "rtweekend.h"

class Camera {
public:
    // I expose these as constructor parameters so the final scene rendering is clean
    Camera(
        Point3 lookfrom,    // camera position
        Point3 lookat,      // point the camera is aimed at
        Vec3 vup,           // "up" direction — usually (0,1,0)
        double vfov,        // vertical field of view in degrees
        double aspect_ratio,
        double aperture,    // controls how blurry the defocus blur is (0 = no blur)
        double focus_dist   // distance to the plane of perfect focus
    ) {
        double theta = degrees_to_radians(vfov);
        double h = std::tan(theta / 2);

        double viewport_height = 2.0 * h;
        double viewport_width  = aspect_ratio * viewport_height;

        // Build an orthonormal basis (w, u, v) for the camera coordinate system
        // w points from the camera back toward where we came from (opposite of viewing direction)
        w = unit_vector(lookfrom - lookat);
        u = unit_vector(cross(vup, w)); // u points right
        v = cross(w, u);               // v points up

        origin = lookfrom;
        horizontal  = focus_dist * viewport_width  * u;
        vertical    = focus_dist * viewport_height * v;
        lower_left_corner = origin - horizontal/2 - vertical/2 - focus_dist * w;

        // Defocus blur: the lens has a finite size (aperture)
        // Rays originate from random points on this disk instead of the exact origin
        lens_radius = aperture / 2;
    }

    // Returns a ray going from the camera through the (s, t) point on the image plane
    // s and t are in [0,1] — I add random jitter for anti-aliasing when called multiple times
    Ray get_ray(double s, double t) const {
        Vec3 rd = lens_radius * random_in_unit_disk();
        Vec3 offset = u * rd.x() + v * rd.y();

        return Ray(
            origin + offset,
            lower_left_corner + s*horizontal + t*vertical - origin - offset
        );
    }

private:
    Point3 origin;
    Point3 lower_left_corner;
    Vec3 horizontal;
    Vec3 vertical;
    Vec3 u, v, w;
    double lens_radius;
};
