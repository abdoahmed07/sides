#pragma once
// Color output — converts a floating-point Color (Vec3) to a PPM pixel value
// The gamma correction step (sqrt) is important: without it, the image looks too dark
// because monitors expect gamma-corrected values

#include "vec3.h"
#include <iostream>

void write_color(std::ostream& out, Color pixel_color, int samples_per_pixel) {
    double r = pixel_color.x();
    double g = pixel_color.y();
    double b = pixel_color.z();

    // Average the samples — each pixel accumulates color over many rays
    double scale = 1.0 / samples_per_pixel;
    r *= scale;
    g *= scale;
    b *= scale;

    // Gamma correction: raise to power 1/gamma (gamma=2 means sqrt)
    // This makes the image look correct on a standard monitor
    r = std::sqrt(r);
    g = std::sqrt(g);
    b = std::sqrt(b);

    // Write the integer [0,255] values
    out << static_cast<int>(256 * clamp(r, 0.0, 0.999)) << ' '
        << static_cast<int>(256 * clamp(g, 0.0, 0.999)) << ' '
        << static_cast<int>(256 * clamp(b, 0.0, 0.999)) << '\n';
}
